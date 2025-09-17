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

export interface BrainyInterface<T = unknown> {
  /**
   * Initialize the database
   */
  init(): Promise<void>

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
   * @param text The text to embed
   * @returns Vector representation of the text
   */
  embed(text: string): Promise<Vector>
}