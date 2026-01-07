/**
 * BrainyInterface - Modern API Only
 *
 * This interface defines the MODERN methods from Brainy 3.0.
 * Used to break circular dependencies while enforcing modern API usage.
 *
 * NO DEPRECATED METHODS - Only clean, modern API patterns.
 */

import { Vector } from '../coreTypes.js'
import { AddParams, RelateParams, Result, Entity, FindParams, SimilarParams } from './brainy.types.js'
import { NounType, VerbType } from './graphTypes.js'

export interface BrainyInterface<T = unknown> {
  /**
   * Initialize the database
   */
  init(): Promise<void>

  /**
   * Promise that resolves when initialization is complete (v7.3.0+)
   * Can be awaited multiple times safely.
   */
  readonly ready: Promise<void>

  /**
   * Check if basic initialization is complete
   */
  readonly isInitialized: boolean

  /**
   * Check if all initialization including background tasks is complete (v7.3.0+)
   */
  isFullyInitialized(): boolean

  /**
   * Wait for all background initialization tasks to complete (v7.3.0+)
   * For cloud storage adapters, this waits for bucket validation and count sync.
   */
  awaitBackgroundInit(): Promise<void>

  /**
   * Modern add method - unified entity creation
   * @param params Parameters for adding entities
   * @returns The ID of the created entity
   */
  add(params: AddParams<T>): Promise<string>

  /**
   * Modern relate method - unified relationship creation
   * @param params Parameters for creating relationships
   * @returns The ID of the created relationship
   */
  relate(params: RelateParams<T>): Promise<string>

  /**
   * Modern find method - unified search and discovery
   * @param query Search query or parameters object
   * @returns Array of search results
   */
  find(query: string | FindParams<T>): Promise<Result<T>[]>

  /**
   * Modern get method - retrieve entities by ID
   * @param id The entity ID to retrieve
   * @returns Entity or null if not found
   */
  get(id: string): Promise<Entity<T> | null>

  /**
   * Modern similar method - find similar entities
   * @param params Parameters for similarity search
   * @returns Array of similar entities with scores
   */
  similar(params: SimilarParams<T>): Promise<Result<T>[]>

  /**
   * Generate embedding vector from text
   * @param data The data to embed (text, array, or object)
   * @returns Vector representation of the data
   */
  embed(data: any): Promise<Vector>

  /**
   * Batch embed multiple texts at once
   * @param texts Array of texts to embed
   * @returns Array of embedding vectors (384 dimensions each)
   */
  embedBatch(texts: string[]): Promise<number[][]>

  /**
   * Calculate semantic similarity between two texts
   * @param textA First text
   * @param textB Second text
   * @returns Similarity score between 0 and 1
   */
  similarity(textA: string, textB: string): Promise<number>

  /**
   * Get comprehensive index statistics
   * @returns Index statistics object
   */
  indexStats(): Promise<{
    entities: number
    vectors: number
    relationships: number
    metadataFields: string[]
    memoryUsage: {
      vectors: number
      graph: number
      metadata: number
      total: number
    }
  }>

  /**
   * Get graph neighbors of an entity
   * @param entityId The entity to get neighbors for
   * @param options Optional traversal options
   * @returns Array of neighbor entity IDs
   */
  neighbors(
    entityId: string,
    options?: {
      direction?: 'outgoing' | 'incoming' | 'both'
      depth?: number
      verbType?: VerbType
      limit?: number
    }
  ): Promise<string[]>

  /**
   * Find semantic duplicates in the database
   * @param options Optional search options
   * @returns Array of duplicate groups with similarity scores
   */
  findDuplicates(options?: {
    threshold?: number
    type?: NounType
    limit?: number
  }): Promise<Array<{
    entity: Entity<any>
    duplicates: Array<{ entity: Entity<any>; similarity: number }>
  }>>

  /**
   * Cluster entities by semantic similarity
   * @param options Optional clustering options
   * @returns Array of clusters with entities and optional centroids
   */
  cluster(options?: {
    threshold?: number
    type?: NounType
    minClusterSize?: number
    limit?: number
    includeCentroid?: boolean
  }): Promise<Array<{
    clusterId: string
    entities: Entity<any>[]
    centroid?: number[]
  }>>
}