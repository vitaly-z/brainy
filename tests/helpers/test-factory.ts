/**
 * Test Factory - Comprehensive test data generation and utilities
 * Provides consistent, realistic test data for all Brainy tests
 */

import { v4 as uuidv4 } from '../../src/universal/uuid'
import type { NounType, VerbType } from '../../src/types/graphTypes'
import type {
  Entity,
  Relation,
  Result,
  AddParams,
  UpdateParams,
  RelateParams,
  FindParams,
  BrainyConfig,
} from '../../src/types/brainy.types'
import type { Vector } from '../../src/coreTypes'

/**
 * Test Data Generators
 */

// Generate a unique test ID
export function generateTestId(prefix = 'test'): string {
  return `${prefix}_${uuidv4().slice(0, 8)}_${Date.now()}`
}

// Generate test vector (realistic 1536-dimensional vector like OpenAI)
export function generateTestVector(dimension = 1536): Vector {
  // Generate a deterministic but varied embedding
  const vector = new Array(dimension)
  for (let i = 0; i < dimension; i++) {
    // Create varied but deterministic values
    vector[i] = Math.sin(i * 0.1) * 0.5 + Math.cos(i * 0.05) * 0.3
  }
  // Normalize to unit vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  return vector.map(val => val / magnitude)
}

// Generate realistic metadata
export function generateTestMetadata(overrides: any = {}): any {
  return {
    name: `Test Item ${generateTestId()}`,
    description: 'Test description',
    tags: ['test', 'automated'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    source: 'test-factory',
    confidence: 0.95,
    ...overrides,
  }
}

// Generate a test entity
export function createTestEntity(overrides: Partial<Entity> = {}): Entity {
  const id = overrides.id || generateTestId('entity')
  const now = Date.now()
  
  return {
    id,
    type: 'person' as NounType,
    vector: generateTestVector(),
    metadata: generateTestMetadata(),
    service: 'test',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// Generate multiple test entities
export function createTestEntities(count: number, baseOverrides: Partial<Entity> = {}): Entity[] {
  return Array.from({ length: count }, (_, i) => 
    createTestEntity({
      ...baseOverrides,
      metadata: {
        ...generateTestMetadata(),
        name: `Test Entity ${i + 1}`,
        index: i,
      },
    })
  )
}

// Generate a test relation
export function createTestRelation(overrides: Partial<Relation> = {}): Relation {
  const id = overrides.id || generateTestId('relation')
  const now = Date.now()
  
  return {
    id,
    from: overrides.from || generateTestId('from'),
    to: overrides.to || generateTestId('to'),
    type: (overrides.type || 'RelatedTo') as VerbType,
    weight: 1.0,
    metadata: generateTestMetadata(),
    service: 'test',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// Generate multiple test relations
export function createTestRelations(count: number, baseOverrides: Partial<Relation> = {}): Relation[] {
  return Array.from({ length: count }, (_, i) => 
    createTestRelation({
      ...baseOverrides,
      metadata: {
        ...generateTestMetadata(),
        index: i,
      },
    })
  )
}

// Generate a test result (entity with score)
export function createTestResult(
  score: number = 0.95,
  entityOverrides: Partial<Entity> = {}
): Result {
  return {
    id: entityOverrides.id || generateTestId('result'),
    score,
    entity: createTestEntity(entityOverrides),
  }
}

// Generate add parameters
export function createAddParams(overrides: Partial<AddParams> = {}): AddParams {
  return {
    data: 'Test content for embedding',
    type: 'thing' as NounType,
    metadata: generateTestMetadata(),
    service: 'test',
    ...overrides,
  }
}

// Generate update parameters
export function createUpdateParams(id: string, overrides: Partial<UpdateParams> = {}): UpdateParams {
  return {
    id,
    metadata: { updated: true },
    merge: true,
    ...overrides,
  }
}

// Generate relate parameters
export function createRelateParams(from: string, to: string, overrides: Partial<RelateParams> = {}): RelateParams {
  return {
    from,
    to,
    type: 'RelatedTo' as VerbType,
    weight: 1.0,
    metadata: generateTestMetadata(),
    service: 'test',
    ...overrides,
  }
}

// Generate find parameters
export function createFindParams(overrides: Partial<FindParams> = {}): FindParams {
  return {
    query: 'test query',
    limit: 10,
    offset: 0,
    explain: false,
    includeRelations: false,
    service: 'test',
    ...overrides,
  }
}

// Generate test configuration
export function createTestConfig(overrides: Partial<BrainyConfig> = {}): BrainyConfig {
  return {
    storage: { type: 'memory' },
    model: { type: 'fast' },
    index: {
      m: 16,
      efConstruction: 200,
      efSearch: 50,
    },
    cache: { maxSize: 1000, ttl: 3600 },
    ...overrides,
  }
}

/**
 * Test Data Sets - Pre-built realistic scenarios
 */

// Create a social network graph
export function createSocialNetworkTestData() {
  const alice = createTestEntity({ 
    id: 'alice', 
    type: 'person' as NounType,
    metadata: { name: 'Alice', age: 30 }
  })
  const bob = createTestEntity({ 
    id: 'bob', 
    type: 'person' as NounType,
    metadata: { name: 'Bob', age: 25 }
  })
  const charlie = createTestEntity({ 
    id: 'charlie', 
    type: 'person' as NounType,
    metadata: { name: 'Charlie', age: 35 }
  })
  const diana = createTestEntity({ 
    id: 'diana', 
    type: 'person' as NounType,
    metadata: { name: 'Diana', age: 28 }
  })
  
  const entities = [alice, bob, charlie, diana]
  
  const relations = [
    createTestRelation({ from: 'alice', to: 'bob', type: 'friendOf' as VerbType }),
    createTestRelation({ from: 'alice', to: 'charlie', type: 'friendOf' as VerbType }),
    createTestRelation({ from: 'bob', to: 'charlie', type: 'worksWith' as VerbType }),
    createTestRelation({ from: 'charlie', to: 'diana', type: 'mentors' as VerbType }),
    createTestRelation({ from: 'alice', to: 'diana', type: 'likes' as VerbType }),
  ]
  
  return { entities, relations }
}

// Create a knowledge graph
export function createKnowledgeGraphTestData() {
  const entities = [
    createTestEntity({ 
      id: 'earth', 
      type: 'location' as NounType,
      metadata: { name: 'Earth', type: 'planet' }
    }),
    createTestEntity({ 
      id: 'sun', 
      type: 'thing' as NounType,
      metadata: { name: 'Sun', type: 'star' }
    }),
    createTestEntity({ 
      id: 'moon', 
      type: 'thing' as NounType,
      metadata: { name: 'Moon', type: 'satellite' }
    }),
    createTestEntity({ 
      id: 'mars', 
      type: 'location' as NounType,
      metadata: { name: 'Mars', type: 'planet' }
    }),
  ]
  
  const relations = [
    createTestRelation({ from: 'earth', to: 'sun', type: 'DependsOn' as VerbType }),
    createTestRelation({ from: 'moon', to: 'earth', type: 'DependsOn' as VerbType }),
    createTestRelation({ from: 'mars', to: 'sun', type: 'DependsOn' as VerbType }),
    createTestRelation({ from: 'earth', to: 'moon', type: 'Contains' as VerbType }),
  ]
  
  return { entities, relations }
}

// Create large dataset for performance testing
export function createLargeTestDataset(entityCount = 1000, relationCount = 5000) {
  const entities = createTestEntities(entityCount)
  const relations: Relation[] = []
  
  const verbTypes = ['relatedTo', 'friendOf', 'worksWith', 'creates', 'owns'] as VerbType[]
  
  // Create random relations between entities
  for (let i = 0; i < relationCount; i++) {
    const fromIdx = Math.floor(Math.random() * entityCount)
    const toIdx = Math.floor(Math.random() * entityCount)
    if (fromIdx !== toIdx) {
      relations.push(
        createTestRelation({
          from: entities[fromIdx].id,
          to: entities[toIdx].id,
          type: verbTypes[Math.floor(Math.random() * verbTypes.length)],
        })
      )
    }
  }
  
  return { entities, relations }
}

/**
 * Test Assertion Helpers
 */

export function assertEntity(entity: any): asserts entity is Entity {
  if (!entity || typeof entity !== 'object') {
    throw new Error('Entity must be an object')
  }
  if (!entity.id || typeof entity.id !== 'string') {
    throw new Error('Entity must have a string id')
  }
  if (!entity.type || typeof entity.type !== 'string') {
    throw new Error('Entity must have a string type')
  }
  if (!entity.vector || !Array.isArray(entity.vector)) {
    throw new Error('Entity must have an array vector')
  }
  if (typeof entity.createdAt !== 'number') {
    throw new Error('Entity must have a numeric createdAt timestamp')
  }
}

export function assertRelation(relation: any): asserts relation is Relation {
  if (!relation || typeof relation !== 'object') {
    throw new Error('Relation must be an object')
  }
  if (!relation.id || typeof relation.id !== 'string') {
    throw new Error('Relation must have a string id')
  }
  if (!relation.from || typeof relation.from !== 'string') {
    throw new Error('Relation must have a string from')
  }
  if (!relation.to || typeof relation.to !== 'string') {
    throw new Error('Relation must have a string to')
  }
  if (!relation.type || typeof relation.type !== 'string') {
    throw new Error('Relation must have a string type')
  }
  if (typeof relation.createdAt !== 'number') {
    throw new Error('Relation must have a numeric createdAt timestamp')
  }
}

export function assertResult(result: any): asserts result is Result {
  if (!result || typeof result !== 'object') {
    throw new Error('Result must be an object')
  }
  if (!result.id || typeof result.id !== 'string') {
    throw new Error('Result must have a string id')
  }
  if (typeof result.score !== 'number') {
    throw new Error('Result must have a numeric score')
  }
  assertEntity(result.entity)
}

/**
 * Test Cleanup Helpers
 */

export class TestCleanup {
  private cleanupFunctions: Array<() => Promise<void>> = []
  
  register(fn: () => Promise<void>) {
    this.cleanupFunctions.push(fn)
  }
  
  async cleanup() {
    for (const fn of this.cleanupFunctions.reverse()) {
      try {
        await fn()
      } catch (error) {
        console.error('Cleanup error:', error)
      }
    }
    this.cleanupFunctions = []
  }
}

/**
 * Test Timing Helpers
 */

export async function measureExecutionTime<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<{ result: T; duration: number }> {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  
  if (label) {
    console.log(`${label}: ${duration.toFixed(2)}ms`)
  }
  
  return { result, duration }
}

/**
 * Test Delay Helper
 */

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Mock Storage Helper
 */

export function createMockStorage() {
  const store = new Map<string, any>()
  
  return {
    get: async (key: string) => store.get(key),
    set: async (key: string, value: any) => { store.set(key, value); return true },
    delete: async (key: string) => store.delete(key),
    has: async (key: string) => store.has(key),
    clear: async () => store.clear(),
    size: () => store.size,
    entries: () => Array.from(store.entries()),
  }
}

/**
 * Test Error Generators
 */

export function createTestError(message = 'Test error', code = 'TEST_ERROR') {
  const error = new Error(message) as any
  error.code = code
  return error
}

export function createNetworkError() {
  return createTestError('Network request failed', 'NETWORK_ERROR')
}

export function createTimeoutError() {
  return createTestError('Operation timed out', 'TIMEOUT_ERROR')
}

export function createValidationError(field: string) {
  return createTestError(`Validation failed for field: ${field}`, 'VALIDATION_ERROR')
}

// Export everything as a namespace for convenience
export const TestFactory = {
  // IDs
  generateTestId,
  
  // Core data
  generateTestVector,
  generateTestMetadata,
  createTestEntity,
  createTestEntities,
  createTestRelation,
  createTestRelations,
  createTestResult,
  
  // Parameters
  createAddParams,
  createUpdateParams,
  createRelateParams,
  createFindParams,
  
  // Config
  createTestConfig,
  
  // Datasets
  createSocialNetworkTestData,
  createKnowledgeGraphTestData,
  createLargeTestDataset,
  
  // Assertions
  assertEntity,
  assertRelation,
  assertResult,
  
  // Utilities
  TestCleanup,
  measureExecutionTime,
  delay,
  createMockStorage,
  
  // Errors
  createTestError,
  createNetworkError,
  createTimeoutError,
  createValidationError,
}

export default TestFactory