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

/**
 * File operation event
 */
export interface FileEvent {
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
}

/**
 * Event Recorder - Stores all file operations as searchable events
 */
export class EventRecorder {
  constructor(private brain: Brainy) {}

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

    // Store event as Brainy entity
    const entity = await this.brain.add({
      type: NounType.Event,
      data: event.content || Buffer.from(JSON.stringify(event)),
      metadata: {
        ...event,
        id: eventId,
        timestamp,
        hash,
        eventType: 'file-operation',
        system: 'vfs'
      },
      // Generate embedding for content-based events
      vector: event.content && event.content.length < 100000
        ? await this.generateEventEmbedding(event)
        : undefined
    })

    return entity
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

    // Query events from Brainy
    const results = await this.brain.find({
      where: query,
      type: NounType.Event,
      limit
    })

    const events: FileEvent[] = []
    for (const result of results) {
      if (result.entity?.metadata) {
        events.push(result.entity.metadata as FileEvent)
      }
    }

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

    // Query events from Brainy
    const results = await this.brain.find({
      where: query,
      type: NounType.Event,
      limit: options?.limit || 100,
      // Sort by timestamp descending (newest first)
      // Note: Sorting would need to be implemented in Brainy
    })

    // Convert results to FileEvent format
    const events = results.map(r => ({
      id: r.entity.metadata.id,
      type: r.entity.metadata.type,
      path: r.entity.metadata.path,
      timestamp: r.entity.metadata.timestamp,
      content: r.entity.metadata.content,
      size: r.entity.metadata.size,
      hash: r.entity.metadata.hash,
      author: r.entity.metadata.author,
      metadata: r.entity.metadata.metadata,
      previousHash: r.entity.metadata.previousHash
    } as FileEvent))

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

    const results = await this.brain.find({
      where: query,
      type: NounType.Event,
      limit: 1000
    })

    return results.map(r => ({
      id: r.entity.metadata.id,
      type: r.entity.metadata.type,
      path: r.entity.metadata.path,
      timestamp: r.entity.metadata.timestamp,
      size: r.entity.metadata.size,
      hash: r.entity.metadata.hash,
      author: r.entity.metadata.author
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
        await this.brain.delete(events[i].id)
        pruned++
      }
    }

    return pruned
  }
}