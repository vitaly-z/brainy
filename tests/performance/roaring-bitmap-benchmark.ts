/**
 * Roaring Bitmap Performance Benchmark
 *
 * Compares performance between JavaScript Sets and Roaring Bitmaps
 * for metadata index operations.
 *
 * Run with: NODE_OPTIONS='--max-old-space-size=8192' npx tsx tests/performance/roaring-bitmap-benchmark.ts
 */

import { RoaringBitmap32 } from 'roaring-wasm'
import { v4 as uuidv4 } from 'uuid'

// Benchmark configuration
const DATASET_SIZES = [1000, 10000, 50000, 100000]
const NUM_FIELDS = 5
const NUM_QUERIES = 1000

interface BenchmarkResult {
  operation: string
  datasetSize: number
  setTime: number
  roaringTime: number
  speedup: number
  memorySet: number
  memoryRoaring: number
  memorySavings: number
}

/**
 * Generate test data: entity IDs and their field-value mappings
 */
function generateTestData(size: number) {
  const entityIds: string[] = []
  const fieldMaps: Map<string, Map<string, Set<string>>> = new Map()

  // Initialize field maps
  for (let f = 0; f < NUM_FIELDS; f++) {
    fieldMaps.set(`field${f}`, new Map())
  }

  // Generate entities
  for (let i = 0; i < size; i++) {
    const entityId = uuidv4()
    entityIds.push(entityId)

    // Assign values to fields (simulate realistic distribution)
    for (let f = 0; f < NUM_FIELDS; f++) {
      const fieldName = `field${f}`
      // Create skewed distribution: some values are common, others rare
      const value = `value${Math.floor(Math.random() * (size / 10))}`

      const fieldMap = fieldMaps.get(fieldName)!
      if (!fieldMap.has(value)) {
        fieldMap.set(value, new Set())
      }
      fieldMap.get(value)!.add(entityId)
    }
  }

  return { entityIds, fieldMaps }
}

/**
 * Convert UUID to integer for roaring bitmap
 */
function uuidToInt(uuid: string, uuidToIntMap: Map<string, number>, nextId: { value: number }): number {
  let intId = uuidToIntMap.get(uuid)
  if (intId === undefined) {
    intId = nextId.value++
    uuidToIntMap.set(uuid, intId)
  }
  return intId
}

/**
 * Benchmark: Single field query
 */
function benchmarkSingleFieldQuery(datasetSize: number): BenchmarkResult {
  console.log(`\n📊 Benchmarking single field query (${datasetSize.toLocaleString()} entities)...`)

  const { entityIds, fieldMaps } = generateTestData(datasetSize)

  // Setup: Create roaring bitmap version
  const uuidToIntMap = new Map<string, number>()
  const nextId = { value: 1 }
  const roaringFieldMaps = new Map<string, Map<string, RoaringBitmap32>>()

  for (const [fieldName, valueMap] of fieldMaps.entries()) {
    const roaringValueMap = new Map<string, RoaringBitmap32>()
    for (const [value, ids] of valueMap.entries()) {
      const bitmap = new RoaringBitmap32()
      for (const id of ids) {
        bitmap.add(uuidToInt(id, uuidToIntMap, nextId))
      }
      roaringValueMap.set(value, bitmap)
    }
    roaringFieldMaps.set(fieldName, roaringValueMap)
  }

  // Benchmark: Set approach
  const setStart = performance.now()
  let setResultCount = 0
  for (let q = 0; q < NUM_QUERIES; q++) {
    const value = `value${Math.floor(Math.random() * (datasetSize / 10))}`
    const results = fieldMaps.get('field0')?.get(value)
    setResultCount += results?.size || 0
  }
  const setTime = performance.now() - setStart

  // Benchmark: Roaring bitmap approach
  const roaringStart = performance.now()
  let roaringResultCount = 0
  for (let q = 0; q < NUM_QUERIES; q++) {
    const value = `value${Math.floor(Math.random() * (datasetSize / 10))}`
    const bitmap = roaringFieldMaps.get('field0')?.get(value)
    roaringResultCount += bitmap?.size || 0
  }
  const roaringTime = performance.now() - roaringStart

  // Memory estimation
  const memorySet = fieldMaps.get('field0')!.size * 36 * 10 // UUID strings
  const memoryRoaring = Array.from(roaringFieldMaps.get('field0')!.values())
    .reduce((sum, bitmap) => sum + bitmap.getSerializationSizeInBytes('portable'), 0)

  return {
    operation: 'Single field query',
    datasetSize,
    setTime,
    roaringTime,
    speedup: setTime / roaringTime,
    memorySet,
    memoryRoaring,
    memorySavings: ((memorySet - memoryRoaring) / memorySet) * 100
  }
}

/**
 * Benchmark: Multi-field intersection (the BIG win!)
 */
function benchmarkMultiFieldIntersection(datasetSize: number): BenchmarkResult {
  console.log(`\n📊 Benchmarking multi-field intersection (${datasetSize.toLocaleString()} entities)...`)

  const { entityIds, fieldMaps } = generateTestData(datasetSize)

  // Setup: Create roaring bitmap version
  const uuidToIntMap = new Map<string, number>()
  const intToUuidMap = new Map<number, string>()
  const nextId = { value: 1 }
  const roaringFieldMaps = new Map<string, Map<string, RoaringBitmap32>>()

  for (const [fieldName, valueMap] of fieldMaps.entries()) {
    const roaringValueMap = new Map<string, RoaringBitmap32>()
    for (const [value, ids] of valueMap.entries()) {
      const bitmap = new RoaringBitmap32()
      for (const id of ids) {
        const intId = uuidToInt(id, uuidToIntMap, nextId)
        intToUuidMap.set(intId, id)
        bitmap.add(intId)
      }
      roaringValueMap.set(value, bitmap)
    }
    roaringFieldMaps.set(fieldName, roaringValueMap)
  }

  // Benchmark: Set approach (JavaScript array filtering)
  const setStart = performance.now()
  let setResultCount = 0
  for (let q = 0; q < NUM_QUERIES; q++) {
    const queries = []
    for (let f = 0; f < 3; f++) {
      const value = `value${Math.floor(Math.random() * (datasetSize / 10))}`
      queries.push({ field: `field${f}`, value })
    }

    // Fetch all ID sets
    const idSets: string[][] = []
    for (const { field, value } of queries) {
      const ids = fieldMaps.get(field)?.get(value)
      if (ids && ids.size > 0) {
        idSets.push(Array.from(ids))
      }
    }

    // JavaScript intersection (slow!)
    if (idSets.length > 0) {
      let result = idSets[0]
      for (let i = 1; i < idSets.length; i++) {
        result = result.filter(id => idSets[i].includes(id))
      }
      setResultCount += result.length
    }
  }
  const setTime = performance.now() - setStart

  // Benchmark: Roaring bitmap approach (hardware-accelerated!)
  const roaringStart = performance.now()
  let roaringResultCount = 0
  for (let q = 0; q < NUM_QUERIES; q++) {
    const queries = []
    for (let f = 0; f < 3; f++) {
      const value = `value${Math.floor(Math.random() * (datasetSize / 10))}`
      queries.push({ field: `field${f}`, value })
    }

    // Fetch all bitmaps
    const bitmaps: RoaringBitmap32[] = []
    for (const { field, value } of queries) {
      const bitmap = roaringFieldMaps.get(field)?.get(value)
      if (bitmap && bitmap.size > 0) {
        bitmaps.push(bitmap)
      }
    }

    // Hardware-accelerated intersection (FAST!)
    if (bitmaps.length > 0) {
      const result = RoaringBitmap32.and(...bitmaps)
      roaringResultCount += result.size
    }
  }
  const roaringTime = performance.now() - roaringStart

  // Memory estimation
  let memorySet = 0
  for (const valueMap of fieldMaps.values()) {
    for (const ids of valueMap.values()) {
      memorySet += ids.size * 36 // UUID strings
    }
  }

  let memoryRoaring = 0
  for (const valueMap of roaringFieldMaps.values()) {
    for (const bitmap of valueMap.values()) {
      memoryRoaring += bitmap.getSerializationSizeInBytes('portable')
    }
  }

  return {
    operation: 'Multi-field intersection (3 fields)',
    datasetSize,
    setTime,
    roaringTime,
    speedup: setTime / roaringTime,
    memorySet,
    memoryRoaring,
    memorySavings: ((memorySet - memoryRoaring) / memorySet) * 100
  }
}

/**
 * Format benchmark results as a table
 */
function printResults(results: BenchmarkResult[]) {
  console.log('\n' + '='.repeat(120))
  console.log('🏆 ROARING BITMAP BENCHMARK RESULTS')
  console.log('='.repeat(120))

  for (const result of results) {
    console.log(`\n${result.operation} - ${result.datasetSize.toLocaleString()} entities`)
    console.log('-'.repeat(120))
    console.log(`  JavaScript Sets:  ${result.setTime.toFixed(2)}ms`)
    console.log(`  Roaring Bitmaps:  ${result.roaringTime.toFixed(2)}ms`)
    console.log(`  ⚡ SPEEDUP:        ${result.speedup.toFixed(1)}x faster`)
    console.log(`  📦 Memory (Set):   ${(result.memorySet / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  📦 Memory (Roar):  ${(result.memoryRoaring / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  💾 SAVINGS:        ${result.memorySavings.toFixed(1)}% less memory`)
  }

  console.log('\n' + '='.repeat(120))

  // Summary
  const avgSpeedup = results.reduce((sum, r) => sum + r.speedup, 0) / results.length
  const avgMemorySavings = results.reduce((sum, r) => sum + r.memorySavings, 0) / results.length

  console.log('\n📈 SUMMARY:')
  console.log(`  Average speedup: ${avgSpeedup.toFixed(1)}x faster`)
  console.log(`  Average memory savings: ${avgMemorySavings.toFixed(1)}%`)
  console.log('='.repeat(120))
}

/**
 * Run all benchmarks
 */
async function runBenchmarks() {
  console.log('🚀 Starting Roaring Bitmap Performance Benchmarks...')
  console.log(`   Dataset sizes: ${DATASET_SIZES.map(s => s.toLocaleString()).join(', ')}`)
  console.log(`   Queries per test: ${NUM_QUERIES.toLocaleString()}`)
  console.log(`   Fields: ${NUM_FIELDS}`)

  const results: BenchmarkResult[] = []

  // Run single field query benchmarks
  for (const size of DATASET_SIZES) {
    results.push(benchmarkSingleFieldQuery(size))
  }

  // Run multi-field intersection benchmarks (THE BIG WIN!)
  for (const size of DATASET_SIZES) {
    results.push(benchmarkMultiFieldIntersection(size))
  }

  printResults(results)
}

// Run benchmarks
runBenchmarks().catch(console.error)
