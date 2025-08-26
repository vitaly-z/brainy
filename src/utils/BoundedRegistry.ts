/**
 * Bounded Registry with LRU eviction
 * Prevents unbounded memory growth in production
 */
export class BoundedRegistry<T> {
  private items = new Map<T, number>() // item -> last accessed timestamp
  private readonly maxSize: number
  
  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize
  }
  
  /**
   * Add item to registry, evicting oldest if at capacity
   */
  add(item: T): void {
    // Update timestamp if already exists
    if (this.items.has(item)) {
      this.items.delete(item) // Remove to re-add at end
      this.items.set(item, Date.now())
      return
    }
    
    // Evict oldest if at capacity
    if (this.items.size >= this.maxSize) {
      const oldest = this.items.entries().next().value
      if (oldest) {
        this.items.delete(oldest[0])
      }
    }
    
    this.items.set(item, Date.now())
  }
  
  /**
   * Check if item exists
   */
  has(item: T): boolean {
    return this.items.has(item)
  }
  
  /**
   * Get all items
   */
  getAll(): T[] {
    return Array.from(this.items.keys())
  }
  
  /**
   * Get size
   */
  get size(): number {
    return this.items.size
  }
  
  /**
   * Clear all items
   */
  clear(): void {
    this.items.clear()
  }
}