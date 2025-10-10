/**
 * Cache Performance Monitoring Example
 *
 * Demonstrates comprehensive monitoring of Brainy's adaptive memory system
 * and cache performance in production environments.
 *
 * Features:
 * - Real-time cache performance monitoring
 * - Memory pressure detection
 * - Fairness violation alerts
 * - Actionable recommendations
 *
 * Usage:
 *   ts-node examples/monitor-cache-performance.ts
 */

import { Brainy, NounType } from '@soulcraft/brainy'

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
}

function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`
}

function colorStatus(value: number, thresholds: { good: number, warning: number }): string {
  if (value >= thresholds.good) return colors.green
  if (value >= thresholds.warning) return colors.yellow
  return colors.red
}

/**
 * Initialize Brainy with production configuration
 */
async function initializeBrain() {
  console.log(`${colors.cyan}Initializing Brainy...${colors.reset}`)

  const brain = new Brainy({
    storage: {
      type: 'filesystem',
      path: './brainy-data'
    },
    model: { precision: 'q8' }
  })

  await brain.init()
  console.log(`${colors.green}✓ Brainy initialized${colors.reset}\n`)

  return brain
}

/**
 * Display comprehensive cache performance statistics
 */
function displayCacheStats(brain: Brainy) {
  const stats = brain.hnsw.getCacheStats()

  console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.blue}  CACHE PERFORMANCE & STATUS${colors.reset}`)
  console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`)

  // Caching Strategy Status
  const modeColor = stats.cachingStrategy === 'on-demand' ? colors.cyan : colors.green
  const modeStatus = stats.cachingStrategy === 'on-demand' ? 'ON-DEMAND (adaptive)' : 'PRELOADED (all in memory)'
  console.log(`\n${modeColor}Caching Strategy:${colors.reset} ${modeStatus}`)

  // Entity Count
  console.log(`${colors.gray}Entities:${colors.reset} ${stats.autoDetection.entityCount.toLocaleString()}`)

  // Cache Hit Rate
  const hitRate = stats.unifiedCache.hitRatePercent
  const hitRateColor = colorStatus(hitRate, { good: 80, warning: 60 })
  console.log(`\n${colors.blue}Cache Performance:${colors.reset}`)
  console.log(`  Hit Rate: ${hitRateColor}${hitRate.toFixed(1)}%${colors.reset}`)
  console.log(`  ${colors.gray}Hits:   ${stats.unifiedCache.hits.toLocaleString()}${colors.reset}`)
  console.log(`  ${colors.gray}Misses: ${stats.unifiedCache.misses.toLocaleString()}${colors.reset}`)

  // HNSW Cache Details
  console.log(`\n${colors.blue}HNSW Cache:${colors.reset}`)
  console.log(`  Memory: ${colors.cyan}${stats.hnswCache.estimatedMemoryMB.toFixed(2)} MB${colors.reset}`)
  console.log(`  ${colors.gray}Vectors Cached: ${stats.hnswCache.vectorsCached.toLocaleString()}${colors.reset}`)
  console.log(`  ${colors.gray}Cache Utilization: ${stats.hnswCache.sizePercent.toFixed(1)}%${colors.reset}`)

  if (stats.lazyModeEnabled) {
    const hnswHitRate = stats.hnswCache.hitRatePercent
    const hnswHitColor = colorStatus(hnswHitRate, { good: 75, warning: 50 })
    console.log(`  HNSW Hit Rate: ${hnswHitColor}${hnswHitRate.toFixed(1)}%${colors.reset}`)
  }

  // Fairness Metrics
  console.log(`\n${colors.blue}Fairness Metrics:${colors.reset}`)
  if (stats.fairness.fairnessViolation) {
    console.log(`  ${colors.red}⚠ VIOLATION DETECTED${colors.reset}`)
    console.log(`  ${colors.red}HNSW Access: ${stats.fairness.hnswAccessPercent.toFixed(1)}%${colors.reset}`)
    console.log(`  ${colors.red}HNSW Cache: ${stats.hnswCache.sizePercent.toFixed(1)}%${colors.reset}`)
  } else {
    console.log(`  ${colors.green}✓ No violations${colors.reset}`)
    console.log(`  ${colors.gray}HNSW Access: ${stats.fairness.hnswAccessPercent.toFixed(1)}%${colors.reset}`)
  }

  // Memory Pressure
  const memoryInfo = brain.hnsw.unifiedCache.getMemoryInfo()
  console.log(`\n${colors.blue}Memory Status:${colors.reset}`)

  const pressureColor = {
    low: colors.green,
    moderate: colors.yellow,
    high: colors.red,
    critical: colors.red
  }[memoryInfo.currentPressure.pressure]

  console.log(`  Pressure: ${pressureColor}${memoryInfo.currentPressure.pressure.toUpperCase()}${colors.reset}`)

  if (memoryInfo.currentPressure.warnings.length > 0) {
    console.log(`  ${colors.red}Warnings:${colors.reset}`)
    memoryInfo.currentPressure.warnings.forEach(warning => {
      console.log(`    ${colors.red}⚠ ${warning}${colors.reset}`)
    })
  }

  // Recommendations
  console.log(`\n${colors.blue}Recommendations:${colors.reset}`)
  if (stats.recommendations.length === 0) {
    console.log(`  ${colors.green}✓ All metrics healthy - no action needed${colors.reset}`)
  } else {
    stats.recommendations.forEach(rec => {
      console.log(`  ${colors.yellow}→ ${rec}${colors.reset}`)
    })
  }

  console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`)
}

/**
 * Display memory allocation breakdown
 */
function displayMemoryAllocation(brain: Brainy) {
  const memoryInfo = brain.hnsw.unifiedCache.getMemoryInfo()
  const cacheStats = brain.hnsw.unifiedCache.getStats()

  console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.blue}  MEMORY ALLOCATION${colors.reset}`)
  console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`)

  console.log(`\n${colors.cyan}System Configuration:${colors.reset}`)
  console.log(`  Environment: ${colors.gray}${cacheStats.memory.environment}${colors.reset}`)
  console.log(`  Container: ${colors.gray}${memoryInfo.memoryInfo.isContainer ? 'Yes' : 'No'}${colors.reset}`)

  if (memoryInfo.memoryInfo.isContainer) {
    console.log(`  Detection: ${colors.gray}${memoryInfo.memoryInfo.source}${colors.reset}`)
  }

  console.log(`\n${colors.cyan}Memory Breakdown:${colors.reset}`)
  console.log(`  System Total: ${colors.gray}${formatBytes(memoryInfo.memoryInfo.systemTotal)}${colors.reset}`)
  console.log(`  Available: ${colors.gray}${formatBytes(memoryInfo.memoryInfo.available)}${colors.reset}`)

  console.log(`\n${colors.cyan}Model Memory (Reserved):${colors.reset}`)
  console.log(`  Total: ${colors.gray}${formatBytes(cacheStats.memory.modelMemory)}${colors.reset}`)
  console.log(`  Precision: ${colors.gray}${cacheStats.memory.modelPrecision.toUpperCase()}${colors.reset}`)

  console.log(`\n${colors.cyan}UnifiedCache Allocation:${colors.reset}`)
  console.log(`  Size: ${colors.green}${formatBytes(cacheStats.maxSize)}${colors.reset}`)
  console.log(`  Ratio: ${colors.gray}${(cacheStats.memory.allocationRatio * 100).toFixed(0)}%${colors.reset}`)
  console.log(`  Current Usage: ${colors.gray}${formatBytes(cacheStats.currentSize)}${colors.reset}`)

  console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`)
}

/**
 * Add sample data to demonstrate lazy mode
 */
async function addSampleData(brain: Brainy, count: number) {
  console.log(`${colors.cyan}Adding ${count.toLocaleString()} sample entities...${colors.reset}`)

  const sampleTexts = [
    'Machine learning is transforming artificial intelligence',
    'Cloud computing enables scalable infrastructure',
    'Kubernetes orchestrates containerized applications',
    'TypeScript adds type safety to JavaScript',
    'React builds interactive user interfaces',
    'Node.js runs JavaScript on the server',
    'PostgreSQL is a powerful relational database',
    'Redis provides in-memory data caching',
    'GraphQL offers flexible API queries',
    'Docker containerizes application environments'
  ]

  for (let i = 0; i < count; i++) {
    const text = sampleTexts[i % sampleTexts.length]
    await brain.add({
      data: `${text} - Sample ${i}`,
      type: NounType.Document,
      metadata: {
        index: i,
        category: 'tech',
        timestamp: Date.now()
      }
    })

    // Progress indicator
    if ((i + 1) % 100 === 0 || i === count - 1) {
      process.stdout.write(`\r  ${colors.gray}Progress: ${i + 1}/${count}${colors.reset}`)
    }
  }

  console.log(`\n${colors.green}✓ Sample data added${colors.reset}\n`)
}

/**
 * Perform sample searches to generate cache activity
 */
async function performSampleSearches(brain: Brainy) {
  console.log(`${colors.cyan}Performing sample searches...${colors.reset}`)

  const queries = [
    'machine learning artificial intelligence',
    'cloud computing infrastructure',
    'kubernetes docker containers',
    'typescript javascript development',
    'react user interface'
  ]

  for (const query of queries) {
    const startTime = Date.now()
    const results = await brain.search(query, { limit: 10 })
    const latency = Date.now() - startTime

    const latencyColor = latency < 10 ? colors.green : latency < 20 ? colors.yellow : colors.red
    console.log(`  ${colors.gray}Query: "${query.substring(0, 30)}..."${colors.reset}`)
    console.log(`    ${colors.gray}Results: ${results.length}, Latency: ${latencyColor}${latency}ms${colors.reset}`)
  }

  console.log(`${colors.green}✓ Searches completed${colors.reset}\n`)
}

/**
 * Continuous monitoring loop (optional)
 */
function startContinuousMonitoring(brain: Brainy, intervalMs: number = 60000) {
  console.log(`${colors.cyan}Starting continuous monitoring (every ${intervalMs / 1000}s)...${colors.reset}`)
  console.log(`${colors.gray}Press Ctrl+C to stop${colors.reset}\n`)

  setInterval(() => {
    const timestamp = new Date().toISOString()
    console.log(`${colors.gray}[${timestamp}]${colors.reset}`)
    displayCacheStats(brain)
  }, intervalMs)
}

/**
 * Main example
 */
async function main() {
  console.clear()
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.blue}║    Brainy v3.36.0+ Cache Performance Monitoring Example  ║${colors.reset}`)
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`)

  // Initialize Brainy
  const brain = await initializeBrain()

  // Display initial memory allocation
  displayMemoryAllocation(brain)

  // Add sample data (adjust count based on available memory)
  await addSampleData(brain, 500)

  // Display initial stats
  console.log(`${colors.cyan}Initial Statistics:${colors.reset}\n`)
  displayCacheStats(brain)

  // Perform searches to generate cache activity
  await performSampleSearches(brain)

  // Display stats after searches
  console.log(`${colors.cyan}After Search Activity:${colors.reset}\n`)
  displayCacheStats(brain)

  // Optional: Start continuous monitoring
  const continuousMonitoring = process.argv.includes('--continuous')
  if (continuousMonitoring) {
    startContinuousMonitoring(brain, 60000)
  } else {
    console.log(`${colors.gray}Tip: Run with --continuous flag for live monitoring${colors.reset}`)
    await brain.close()
    console.log(`\n${colors.green}✓ Example completed${colors.reset}`)
  }
}

// Run example
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}Error:${colors.reset}`, error)
    process.exit(1)
  })
}

export { displayCacheStats, displayMemoryAllocation }
