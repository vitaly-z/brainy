#!/usr/bin/env node

/**
 * REAL DISTRIBUTED BLUESKY FIREHOSE SETUP
 *
 * This is how you handle multiple writers and readers processing
 * the Bluesky firehose with Brainy's distributed architecture
 */

import { Brainy } from '@soulcraft/brainy'
import { WebSocket } from 'ws'

// =====================================================
// PART 1: MULTIPLE WRITER NODES (Write-Only Mode)
// =====================================================

/**
 * Writer Node - Ingests from Bluesky Firehose
 * Deploy multiple instances of this for parallel processing
 */
export class BlueskySh
Writer {
  constructor(nodeId, shardRange) {
    // Each writer handles specific shards (consistent hashing)
    this.nodeId = nodeId
    this.shardRange = shardRange // e.g., [0, 31] for shards 0-31

    // Initialize Brainy in WRITE-ONLY mode
    this.brain = new Brainy({
      storage: {
        type: 's3',
        options: {
          bucketName: process.env.BRAINY_S3_BUCKET,
          region: process.env.AWS_REGION,
          // Shared S3 bucket - all nodes write to same bucket
        }
      },
      distributed: {
        enabled: true,
        nodeId: this.nodeId,
        shardCount: 256,              // 256 shards total
        replicationFactor: 3,          // 3x redundancy
        operationalMode: 'writer',    // WRITE-ONLY mode
        consensus: 'none',             // No consensus needed for writers
        transport: 'http'
      }
    })

    // Bluesky firehose connection
    this.ws = null
    this.messageBuffer = []
    this.batchSize = 1000
    this.flushInterval = 5000  // Flush every 5 seconds
  }

  async start() {
    await this.brain.init()
    console.log(`📝 Writer ${this.nodeId} started (shards ${this.shardRange[0]}-${this.shardRange[1]})`)

    // Connect to Bluesky firehose
    this.connectToFirehose()

    // Start batch processor
    this.startBatchProcessor()
  }

  connectToFirehose() {
    const BLUESKY_FIREHOSE = 'wss://bsky.social/xrpc/com.atproto.sync.subscribeRepos'

    this.ws = new WebSocket(BLUESKY_FIREHOSE)

    this.ws.on('message', async (data) => {
      try {
        const message = this.parseCAR(data)  // Parse CAR format

        // Check if this message belongs to our shard range
        const shardId = this.brain.shardManager.getShardForKey(message.did)
        const shardNum = parseInt(shardId.split('-')[1])

        if (shardNum >= this.shardRange[0] && shardNum <= this.shardRange[1]) {
          // This message is ours to process
          this.messageBuffer.push(message)

          // Flush if buffer is full
          if (this.messageBuffer.length >= this.batchSize) {
            await this.flushBuffer()
          }
        }
        // Silently ignore messages for other shards

      } catch (error) {
        console.error(`Writer ${this.nodeId} parse error:`, error)
      }
    })

    this.ws.on('error', (error) => {
      console.error(`Writer ${this.nodeId} WebSocket error:`, error)
      // Implement reconnection logic
      setTimeout(() => this.connectToFirehose(), 5000)
    })
  }

  async flushBuffer() {
    if (this.messageBuffer.length === 0) return

    const batch = this.messageBuffer.splice(0, this.batchSize)
    console.log(`💾 Writer ${this.nodeId} flushing ${batch.length} messages`)

    // Process batch in parallel
    const promises = batch.map(async (message) => {
      // Extract post content for embedding
      if (message.type === 'post') {
        return this.brain.add({
          data: message.text,
          type: 'Post',
          metadata: {
            did: message.did,
            uri: message.uri,
            createdAt: message.createdAt,
            author: message.author,
            hashtags: this.extractHashtags(message.text),
            mentions: this.extractMentions(message.text),
            lang: message.lang
          }
        })
      }
      // Handle other types (follows, likes, etc)
      else if (message.type === 'follow') {
        return this.brain.relate({
          from: message.from,
          to: message.to,
          type: 'Follows',
          metadata: {
            createdAt: message.createdAt
          }
        })
      }
    })

    await Promise.all(promises)
  }

  startBatchProcessor() {
    // Periodic flush to handle low-volume periods
    setInterval(async () => {
      if (this.messageBuffer.length > 0) {
        await this.flushBuffer()
      }
    }, this.flushInterval)
  }

  parseCAR(data) {
    // Implement CAR (Content Addressable aRchive) parsing
    // This is the format Bluesky uses
    // For now, returning mock structure
    return {
      type: 'post',
      did: 'did:plc:' + Math.random().toString(36),
      uri: 'at://...',
      text: 'Sample post text',
      createdAt: Date.now(),
      author: 'user.bsky.social'
    }
  }

  extractHashtags(text) {
    return (text.match(/#\w+/g) || []).map(tag => tag.slice(1))
  }

  extractMentions(text) {
    return (text.match(/@[\w.]+/g) || []).map(mention => mention.slice(1))
  }
}

// =====================================================
// PART 2: MULTIPLE READER NODES (Read-Only Mode)
// =====================================================

/**
 * Reader Node - Serves search queries
 * Deploy multiple instances behind a load balancer
 */
export class BlueskySh
Reader {
  constructor(nodeId) {
    this.nodeId = nodeId

    // Initialize Brainy in READ-ONLY mode
    this.brain = new Brainy({
      storage: {
        type: 's3',
        options: {
          bucketName: process.env.BRAINY_S3_BUCKET,
          region: process.env.AWS_REGION,
          // Same shared S3 bucket as writers
        }
      },
      distributed: {
        enabled: true,
        nodeId: this.nodeId,
        shardCount: 256,              // Must match writer config
        operationalMode: 'reader',    // READ-ONLY mode
        consensus: 'none',             // No consensus needed
        transport: 'http',
        cache: {
          hotCacheRatio: 0.8,         // 80% memory for read cache
          ttl: 3600000,               // 1 hour cache
          prefetch: true              // Aggressive prefetching
        }
      }
    })

    // Cache popular queries
    this.queryCache = new Map()
    this.cacheStats = {
      hits: 0,
      misses: 0
    }
  }

  async start() {
    await this.brain.init()
    console.log(`📖 Reader ${this.nodeId} started (read-only mode)`)

    // Start cache warmer
    this.startCacheWarmer()

    // Start metrics collector
    this.startMetricsCollector()
  }

  /**
   * Search posts by content (semantic search)
   */
  async searchPosts(query, options = {}) {
    const cacheKey = `search:${query}:${JSON.stringify(options)}`

    // Check cache first
    if (this.queryCache.has(cacheKey)) {
      this.cacheStats.hits++
      return this.queryCache.get(cacheKey)
    }

    this.cacheStats.misses++

    // Perform search
    const results = await this.brain.find({
      query,
      type: 'Post',
      limit: options.limit || 20,
      where: options.filters || {},
      mode: 'hybrid',  // Use hybrid search for best results
      explain: options.explain || false
    })

    // Cache results
    this.queryCache.set(cacheKey, results)

    // Expire cache after 5 minutes
    setTimeout(() => this.queryCache.delete(cacheKey), 300000)

    return results
  }

  /**
   * Find trending topics using graph analysis
   */
  async findTrending(timeWindow = 3600000) {  // Last hour
    const cutoff = Date.now() - timeWindow

    // Find recent posts with hashtags
    const recentPosts = await this.brain.find({
      type: 'Post',
      where: {
        createdAt: { $gte: cutoff },
        hashtags: { $exists: true }
      },
      limit: 1000
    })

    // Count hashtag frequency
    const hashtagCounts = {}
    for (const post of recentPosts) {
      for (const tag of post.metadata.hashtags || []) {
        hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1
      }
    }

    // Sort by frequency
    return Object.entries(hashtagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))
  }

  /**
   * Find similar posts (recommendation engine)
   */
  async findSimilar(postId, limit = 10) {
    return await this.brain.similar({
      to: postId,
      type: 'Post',
      limit
    })
  }

  /**
   * Get user's social graph
   */
  async getUserNetwork(did, depth = 2) {
    return await this.brain.traverse({
      from: did,
      types: ['Follows', 'Mentions'],
      depth,
      strategy: 'bfs'
    })
  }

  startCacheWarmer() {
    // Warm cache with popular queries
    setInterval(async () => {
      const popularQueries = [
        'ai', 'tech', 'news', 'politics', 'sports',
        'music', 'art', 'science', 'programming'
      ]

      for (const query of popularQueries) {
        await this.searchPosts(query, { limit: 10 })
      }

      console.log(`♨️ Reader ${this.nodeId} cache warmed (hit rate: ${this.getCacheHitRate()}%)`)
    }, 60000)  // Every minute
  }

  startMetricsCollector() {
    setInterval(() => {
      const metrics = {
        nodeId: this.nodeId,
        cacheHitRate: this.getCacheHitRate(),
        queriesPerSecond: this.getQPS(),
        memoryUsage: process.memoryUsage()
      }

      // Send to monitoring system
      console.log(`📊 Reader ${this.nodeId} metrics:`, metrics)
    }, 30000)  // Every 30 seconds
  }

  getCacheHitRate() {
    const total = this.cacheStats.hits + this.cacheStats.misses
    if (total === 0) return 0
    return Math.round((this.cacheStats.hits / total) * 100)
  }

  getQPS() {
    // Implement QPS tracking
    return 0
  }
}

// =====================================================
// PART 3: ORCHESTRATOR - Manages the Fleet
// =====================================================

/**
 * Orchestrator - Manages writer and reader nodes
 * This would typically be a Kubernetes deployment
 */
export class BlueskySh
Orchestrator {
  constructor() {
    this.writers = []
    this.readers = []
    this.config = {
      numWriters: parseInt(process.env.NUM_WRITERS) || 4,
      numReaders: parseInt(process.env.NUM_READERS) || 8,
      totalShards: 256
    }
  }

  async start() {
    console.log('🚀 Starting Bluesky Distributed Processor')
    console.log(`Configuration: ${this.config.numWriters} writers, ${this.config.numReaders} readers`)

    // Calculate shard distribution for writers
    const shardsPerWriter = Math.floor(this.config.totalShards / this.config.numWriters)

    // Start writer nodes
    for (let i = 0; i < this.config.numWriters; i++) {
      const startShard = i * shardsPerWriter
      const endShard = (i === this.config.numWriters - 1)
        ? this.config.totalShards - 1
        : (i + 1) * shardsPerWriter - 1

      const writer = new BlueskySh
Writer(`writer-${i}`, [startShard, endShard])
      await writer.start()
      this.writers.push(writer)
    }

    // Start reader nodes
    for (let i = 0; i < this.config.numReaders; i++) {
      const reader = new BlueskySh
Reader(`reader-${i}`)
      await reader.start()
      this.readers.push(reader)
    }

    console.log('✅ All nodes started successfully!')
    console.log('📝 Writers are processing firehose data')
    console.log('📖 Readers are serving queries')

    // Start health monitor
    this.startHealthMonitor()
  }

  startHealthMonitor() {
    setInterval(() => {
      console.log('\n=== SYSTEM HEALTH ===')
      console.log(`Writers: ${this.writers.length} active`)
      console.log(`Readers: ${this.readers.length} active`)
      console.log(`Timestamp: ${new Date().toISOString()}`)
      console.log('==================\n')
    }, 60000)  // Every minute
  }
}

// =====================================================
// PART 4: DEPLOYMENT SCRIPT
// =====================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2] || 'orchestrator'

  switch (mode) {
    case 'writer':
      // Start single writer node
      const writerId = process.argv[3] || '0'
      const shardStart = parseInt(process.argv[4]) || 0
      const shardEnd = parseInt(process.argv[5]) || 63
      const writer = new BlueskySh
Writer(`writer-${writerId}`, [shardStart, shardEnd])
      writer.start().catch(console.error)
      break

    case 'reader':
      // Start single reader node
      const readerId = process.argv[3] || '0'
      const reader = new BlueskySh
Reader(`reader-${readerId}`)
      reader.start().catch(console.error)
      break

    case 'orchestrator':
      // Start full orchestrated setup
      const orchestrator = new BlueskySh
Orchestrator()
      orchestrator.start().catch(console.error)
      break

    default:
      console.log('Usage:')
      console.log('  node bluesky-distributed.js orchestrator  # Start full system')
      console.log('  node bluesky-distributed.js writer [id] [startShard] [endShard]')
      console.log('  node bluesky-distributed.js reader [id]')
  }
}

/**
 * DEPLOYMENT NOTES:
 *
 * 1. DOCKER DEPLOYMENT:
 *    docker run -e MODE=writer -e NODE_ID=writer-0 brainy-writer
 *    docker run -e MODE=reader -e NODE_ID=reader-0 brainy-reader
 *
 * 2. KUBERNETES DEPLOYMENT:
 *    kubectl apply -f brainy-writers-deployment.yaml  # 4 replicas
 *    kubectl apply -f brainy-readers-deployment.yaml  # 8 replicas
 *
 * 3. LOAD BALANCING:
 *    - Put readers behind an ALB/NLB
 *    - Writers don't need load balancing (each handles specific shards)
 *
 * 4. MONITORING:
 *    - Use Prometheus/Grafana for metrics
 *    - CloudWatch for S3 access patterns
 *    - Datadog for distributed tracing
 *
 * 5. SCALING:
 *    - Writers: Add more nodes and redistribute shards
 *    - Readers: Simply add more nodes behind load balancer
 */