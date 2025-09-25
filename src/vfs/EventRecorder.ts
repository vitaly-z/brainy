/**
 * Event Recording System for VFS
 *
 * Records every file operation as an event for complete history tracking
 * PRODUCTION-READY: No mocks, real implementation
 */

import { Brainy } from '../brainy.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { v4 as uuidv4 } from '../universal/uuid.js'
import { createHash } from 'crypto'
import { EntityManager, ManagedEntity } from './EntityManager.js'

/**
 * File operation event
 */
export interface FileEvent extends ManagedEntity {
  id: string
  type: 'create' | 'write' | 'append' | 'delete' | 'move' | 'rename' | 'mkdir' | 'rmdir'
  path: string
  timestamp: number
  content?: Buffer
  size?: number
  hash?: string
  author?: string
  metadata?: Record<string, any>
  previousHash?: string  // For tracking changes
  oldPath?: string  // For move/rename operations
  eventType?: string  // For EntityManager queries
}

/**
 * Event Recorder - Stores all file operations as searchable events
 */
export class EventRecorder extends EntityManager {
  constructor(brain: Brainy) {
    super(brain, 'vfs')
  }

  /**
   * Record a file operation event
   */
  async recordEvent(event: Omit<FileEvent, 'id' | 'timestamp'>): Promise<string> {
    const eventId = uuidv4()
    const timestamp = Date.now()

    // Calculate content hash if content provided
    const hash = event.content
      ? createHash('sha256').update(event.content).digest('hex')
      : undefined

    // Create file event
    const fileEvent: FileEvent = {
      id: eventId,
      type: event.type,
      path: event.path,
      timestamp,
      content: event.content,
      size: event.size,
      hash,
      author: event.author,
      metadata: event.metadata,
      previousHash: event.previousHash,
      oldPath: event.oldPath
    }

    // Generate embedding for content-based events
    const embedding = event.content && event.content.length < 100000
      ? await this.generateEventEmbedding(event)
      : undefined

    // Add eventType for event classification
    const eventWithType = {
      ...fileEvent,
      eventType: 'file-operation'
    }

    // Store event using EntityManager
    await this.storeEntity(
      eventWithType,
      NounType.Event,
      embedding,
      event.content || Buffer.from(JSON.stringify(event))
    )

    return eventId
  }


  /**
   * Get all events matching criteria
   */
  async getEvents(options?: {
    since?: number
    until?: number
    types?: string[]
    limit?: number
  }): Promise<FileEvent[]> {
    const limit = options?.limit || 100
    const since = options?.since || 0
    const until = options?.until || Date.now()

    const query: any = {
      eventType: 'file-operation'
    }

    // Add time filters
    if (since || until) {
      query.timestamp = {}
      if (since) query.timestamp.$gte = since
      if (until) query.timestamp.$lte = until
    }

    // Add type filter
    if (options?.types && options.types.length > 0) {
      query.type = { $in: options.types }
    }

    // Query using EntityManager
    const events = await this.findEntities<FileEvent>(query, NounType.Event, limit)

    return events.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get complete history for a file
   */
  async getHistory(path: string, options?: {
    limit?: number
    since?: number
    until?: number
    types?: FileEvent['type'][]
  }): Promise<FileEvent[]> {
    const query: any = {
      path,
      eventType: 'file-operation'
    }

    // Add time filters
    if (options?.since || options?.until) {
      query.timestamp = {}
      if (options.since) query.timestamp.$gte = options.since
      if (options.until) query.timestamp.$lte = options.until
    }

    // Add type filter
    if (options?.types && options.types.length > 0) {
      query.type = { $in: options.types }
    }

    // Query using EntityManager
    const events = await this.findEntities<FileEvent>(query, NounType.Event, options?.limit || 100)

    // Sort by timestamp (newest first)
    return events.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Replay events to reconstruct file state at a specific time
   */
  async reconstructFileAtTime(path: string, timestamp: number): Promise<Buffer | null> {
    // Get all events up to the specified time
    const events = await this.getHistory(path, {
      until: timestamp,
      types: ['create', 'write', 'append', 'delete']
    })

    // Sort chronologically for replay
    const chronological = events.reverse()

    // Find last write or create event
    let lastContent: Buffer | null = null
    let deleted = false

    for (const event of chronological) {
      switch (event.type) {
        case 'create':
        case 'write':
          lastContent = event.content || null
          deleted = false
          break

        case 'append':
          if (lastContent && event.content) {
            lastContent = Buffer.concat([lastContent, event.content])
          }
          break

        case 'delete':
          deleted = true
          lastContent = null
          break
      }
    }

    return deleted ? null : lastContent
  }

  /**
   * Get file changes between two timestamps
   */
  async getChanges(since: number, until?: number): Promise<FileEvent[]> {
    const query: any = {
      eventType: 'file-operation',
      timestamp: { $gte: since }
    }

    if (until) {
      query.timestamp.$lte = until
    }

    // Query using EntityManager
    const events = await this.findEntities<FileEvent>(query, NounType.Event, 1000)

    return events.map(event => ({
      id: event.id,
      type: event.type,
      path: event.path,
      timestamp: event.timestamp,
      size: event.size,
      hash: event.hash,
      author: event.author
    } as FileEvent))
  }

  /**
   * Calculate statistics for a file or directory
   */
  async getStatistics(path: string): Promise<{
    totalEvents: number
    firstEvent: number | null
    lastEvent: number | null
    totalWrites: number
    totalBytes: number
    authors: string[]
  }> {
    const events = await this.getHistory(path, { limit: 10000 })

    if (events.length === 0) {
      return {
        totalEvents: 0,
        firstEvent: null,
        lastEvent: null,
        totalWrites: 0,
        totalBytes: 0,
        authors: []
      }
    }

    const stats = {
      totalEvents: events.length,
      firstEvent: events[events.length - 1].timestamp,  // Oldest
      lastEvent: events[0].timestamp,  // Newest
      totalWrites: 0,
      totalBytes: 0,
      authors: new Set<string>()
    }

    for (const event of events) {
      if (event.type === 'write' || event.type === 'append') {
        stats.totalWrites++
        stats.totalBytes += event.size || 0
      }
      if (event.author) {
        stats.authors.add(event.author)
      }
    }

    return {
      ...stats,
      authors: Array.from(stats.authors)
    }
  }

  /**
   * Find files that changed together (temporal coupling)
   */
  async findTemporalCoupling(path: string, windowMs = 60000): Promise<Map<string, number>> {
    const events = await this.getHistory(path)
    const coupling = new Map<string, number>()

    for (const event of events) {
      // Find other files changed within the time window
      const related = await this.getChanges(
        event.timestamp - windowMs,
        event.timestamp + windowMs
      )

      for (const relatedEvent of related) {
        if (relatedEvent.path !== path) {
          const count = coupling.get(relatedEvent.path) || 0
          coupling.set(relatedEvent.path, count + 1)
        }
      }
    }

    // Sort by coupling strength
    return new Map(
      Array.from(coupling.entries())
        .sort((a, b) => b[1] - a[1])
    )
  }

  /**
   * Generate embedding for an event (for semantic search)
   */
  private async generateEventEmbedding(event: Omit<FileEvent, 'id' | 'timestamp'>): Promise<number[] | undefined> {
    try {
      // Generate embedding based on event type and content
      let textToEmbed: string

      if (event.type === 'write' || event.type === 'create') {
        // For write/create events with content, embed the content
        if (event.content && event.content.length < 100000) {
          // Convert Buffer to string for text files
          textToEmbed = Buffer.isBuffer(event.content)
            ? event.content.toString('utf8', 0, Math.min(10240, event.content.length))
            : String(event.content).slice(0, 10240)
        } else {
          // For large files or no content, create descriptive text
          textToEmbed = `File ${event.type} event at ${event.path}, size: ${event.size || 0} bytes`
        }
      } else {
        // For other events (read, delete, rename, etc), create descriptive text
        textToEmbed = `File ${event.type} event at ${event.path}${event.oldPath ? ` from ${event.oldPath}` : ''}`
      }

      // Use Brainy's embed function
      const vector = await this.brain.embed(textToEmbed)
      return vector
    } catch (error) {
      console.error('Failed to generate event embedding:', error)
      return undefined
    }
  }

  /**
   * Prune old events (for storage management)
   */
  async pruneEvents(olderThan: number, keepEvery = 10): Promise<number> {
    const events = await this.getChanges(0, Date.now() - olderThan)

    let pruned = 0
    for (let i = 0; i < events.length; i++) {
      // Keep every Nth event for history sampling
      if (i % keepEvery !== 0) {
        await this.deleteEntity(events[i].id)
        pruned++
      }
    }

    return pruned
  }
}