/**
 * Projection Registry
 *
 * Central registry for all projection strategies
 * Manages strategy lookup and execution
 */

import { ProjectionStrategy } from './ProjectionStrategy.js'
import { Brainy } from '../../brainy.js'
import { VirtualFileSystem } from '../VirtualFileSystem.js'
import { VFSEntity } from '../types.js'

/**
 * Registry for projection strategies
 * Allows dynamic registration and lookup of strategies
 */
export class ProjectionRegistry {
  private strategies = new Map<string, ProjectionStrategy>()

  /**
   * Register a projection strategy
   * @param strategy - The strategy to register
   * @throws Error if strategy with same name already registered
   */
  register(strategy: ProjectionStrategy): void {
    if (this.strategies.has(strategy.name)) {
      throw new Error(`Projection strategy '${strategy.name}' is already registered`)
    }

    this.strategies.set(strategy.name, strategy)
  }

  /**
   * Get a projection strategy by name
   * @param name - Strategy name
   * @returns The strategy or undefined if not found
   */
  get(name: string): ProjectionStrategy | undefined {
    return this.strategies.get(name)
  }

  /**
   * Check if a strategy is registered
   * @param name - Strategy name
   */
  has(name: string): boolean {
    return this.strategies.has(name)
  }

  /**
   * List all registered strategy names
   */
  listDimensions(): string[] {
    return Array.from(this.strategies.keys())
  }

  /**
   * Get count of registered strategies
   */
  count(): number {
    return this.strategies.size
  }

  /**
   * Resolve a dimension value to entity IDs
   * Convenience method that looks up strategy and calls resolve()
   *
   * @param dimension - The semantic dimension
   * @param value - The value to resolve
   * @param brain - REAL Brainy instance
   * @param vfs - REAL VirtualFileSystem instance
   * @returns Array of entity IDs
   * @throws Error if dimension not registered
   */
  async resolve(
    dimension: string,
    value: any,
    brain: Brainy,
    vfs: VirtualFileSystem
  ): Promise<string[]> {
    const strategy = this.get(dimension)

    if (!strategy) {
      throw new Error(`Unknown projection dimension: ${dimension}. Registered dimensions: ${this.listDimensions().join(', ')}`)
    }

    // Call REAL strategy resolve method
    return await strategy.resolve(brain, vfs, value)
  }

  /**
   * List entities in a dimension
   * Convenience method for strategies that support listing
   *
   * @param dimension - The semantic dimension
   * @param brain - REAL Brainy instance
   * @param vfs - REAL VirtualFileSystem instance
   * @param limit - Max results
   * @returns Array of VFSEntity
   * @throws Error if dimension not registered or doesn't support listing
   */
  async list(
    dimension: string,
    brain: Brainy,
    vfs: VirtualFileSystem,
    limit?: number
  ): Promise<VFSEntity[]> {
    const strategy = this.get(dimension)

    if (!strategy) {
      throw new Error(`Unknown projection dimension: ${dimension}`)
    }

    if (!strategy.list) {
      throw new Error(`Projection '${dimension}' does not support listing`)
    }

    return await strategy.list(brain, vfs, limit)
  }

  /**
   * Unregister a strategy
   * Useful for testing or dynamic strategy management
   *
   * @param name - Strategy name to remove
   * @returns true if removed, false if not found
   */
  unregister(name: string): boolean {
    return this.strategies.delete(name)
  }

  /**
   * Clear all registered strategies
   * Useful for testing
   */
  clear(): void {
    this.strategies.clear()
  }

  /**
   * Get all registered strategies
   * Returns a copy to prevent external modification
   */
  getAll(): ProjectionStrategy[] {
    return Array.from(this.strategies.values())
  }
}