/**
 * BrainyInterface
 * 
 * This interface defines the methods from Brainy that are used by serverSearchAugmentations.ts.
 * It's used to break the circular dependency between brainyData.ts and serverSearchAugmentations.ts.
 */

import { Vector } from '../coreTypes.js'

export interface BrainyInterface<T = unknown> {
  /**
   * Initialize the database
   */
  init(): Promise<void>

  /**
   * Get a noun by ID
   * @param id The ID of the noun to get
   */
  getNoun(id: string): Promise<unknown>

  /**
   * @deprecated Use add() instead - it's smart by default now
   * Add a noun (entity with vector and metadata) to the database
   * @param data Text string or vector representation (will auto-embed strings)
   * @param nounType Required noun type (one of 31 types)
   * @param metadata Optional metadata to associate with the noun
   * @returns The ID of the added noun
   */
  addNoun(data: string | Vector, nounType: string, metadata?: T): Promise<string>

  /**
   * Search for text in the database
   * @param text The text to search for
   * @param limit Maximum number of results to return
   * @returns Search results
   */
  searchText(text: string, limit?: number): Promise<unknown[]>

  /**
   * @deprecated Use relate() instead
   * Create a relationship (verb) between two entities
   * @param sourceId The ID of the source entity
   * @param targetId The ID of the target entity
   * @param verbType The type of relationship
   * @param metadata Optional metadata about the relationship
   * @returns The ID of the created verb
   */
  addVerb(sourceId: string, targetId: string, verbType: string, metadata?: unknown): Promise<string>

  /**
   * Find entities similar to a given entity ID
   * @param id ID of the entity to find similar entities for
   * @param options Additional options
   * @returns Array of search results with similarity scores
   */
  findSimilar(id: string, options?: { limit?: number }): Promise<unknown[]>

  /**
   * Generate embedding vector from text
   * @param text The text to embed
   * @returns Vector representation of the text
   */
  embed(text: string): Promise<Vector>
}
