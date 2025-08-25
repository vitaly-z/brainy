/**
 * Field Index for efficient field-based queries
 * Provides O(log n) lookups for field values and range queries
 */

import { VectorDocument } from '../coreTypes.js'

interface FieldIndexEntry {
  value: any
  ids: Set<string>
}

interface RangeQueryOptions {
  field: string
  min?: any
  max?: any
  includeMin?: boolean
  includeMax?: boolean
}

export class FieldIndex {
  // Inverted index: field -> value -> noun IDs
  private indices: Map<string, Map<any, Set<string>>> = new Map()
  
  // Sorted arrays for range queries: field -> sorted [value, ids] pairs
  private sortedIndices: Map<string, Array<[any, Set<string>]>> = new Map()
  
  // Track which fields are indexed
  private indexedFields: Set<string> = new Set()
  
  /**
   * Add a document to the field index
   */
  public add(id: string, metadata: Record<string, any>): void {
    if (!metadata) return
    
    for (const [field, value] of Object.entries(metadata)) {
      // Skip null/undefined values
      if (value === null || value === undefined) continue
      
      // Get or create field index
      if (!this.indices.has(field)) {
        this.indices.set(field, new Map())
        this.sortedIndices.set(field, [])
        this.indexedFields.add(field)
      }
      
      const fieldIndex = this.indices.get(field)!
      
      // Get or create value set
      if (!fieldIndex.has(value)) {
        fieldIndex.set(value, new Set())
      }
      
      // Add ID to value set
      fieldIndex.get(value)!.add(id)
      
      // Mark sorted index as dirty (needs rebuild)
      this.markSortedIndexDirty(field)
    }
  }
  
  /**
   * Remove a document from the field index
   */
  public remove(id: string, metadata: Record<string, any>): void {
    if (!metadata) return
    
    for (const [field, value] of Object.entries(metadata)) {
      if (value === null || value === undefined) continue
      
      const fieldIndex = this.indices.get(field)
      if (!fieldIndex) continue
      
      const valueSet = fieldIndex.get(value)
      if (!valueSet) continue
      
      valueSet.delete(id)
      
      // Clean up empty sets
      if (valueSet.size === 0) {
        fieldIndex.delete(value)
        this.markSortedIndexDirty(field)
      }
      
      // Clean up empty field indices
      if (fieldIndex.size === 0) {
        this.indices.delete(field)
        this.sortedIndices.delete(field)
        this.indexedFields.delete(field)
      }
    }
  }
  
  /**
   * Query for exact field value match
   * O(1) hash lookup
   */
  public queryExact(field: string, value: any): string[] {
    const fieldIndex = this.indices.get(field)
    if (!fieldIndex) return []
    
    const ids = fieldIndex.get(value)
    return ids ? Array.from(ids) : []
  }
  
  /**
   * Query for multiple values (IN operator)
   * O(k) where k is number of values
   */
  public queryIn(field: string, values: any[]): string[] {
    const fieldIndex = this.indices.get(field)
    if (!fieldIndex) return []
    
    const resultSet = new Set<string>()
    
    for (const value of values) {
      const ids = fieldIndex.get(value)
      if (ids) {
        for (const id of ids) {
          resultSet.add(id)
        }
      }
    }
    
    return Array.from(resultSet)
  }
  
  /**
   * Query for range of values
   * O(log n + m) where m is number of results
   */
  public queryRange(options: RangeQueryOptions): string[] {
    const { field, min, max, includeMin = true, includeMax = true } = options
    
    // Ensure sorted index is up to date
    this.ensureSortedIndex(field)
    
    const sortedIndex = this.sortedIndices.get(field)
    if (!sortedIndex || sortedIndex.length === 0) return []
    
    const resultSet = new Set<string>()
    
    // Binary search for start position
    let start = 0
    let end = sortedIndex.length - 1
    
    if (min !== undefined) {
      start = this.binarySearch(sortedIndex, min, includeMin)
    }
    
    if (max !== undefined) {
      end = this.binarySearchEnd(sortedIndex, max, includeMax)
    }
    
    // Collect all IDs in range
    for (let i = start; i <= end && i < sortedIndex.length; i++) {
      const [value, ids] = sortedIndex[i]
      
      // Check if value is in range
      if (min !== undefined) {
        const minCheck = includeMin ? value >= min : value > min
        if (!minCheck) continue
      }
      
      if (max !== undefined) {
        const maxCheck = includeMax ? value <= max : value < max
        if (!maxCheck) break
      }
      
      for (const id of ids) {
        resultSet.add(id)
      }
    }
    
    return Array.from(resultSet)
  }
  
  /**
   * Query with complex where clause
   */
  public query(where: Record<string, any>): string[] {
    const resultSets: Set<string>[] = []
    
    for (const [field, condition] of Object.entries(where)) {
      let fieldResults: string[] = []
      
      if (typeof condition === 'object' && condition !== null) {
        // Handle operators
        if (condition.equals !== undefined) {
          fieldResults = this.queryExact(field, condition.equals)
        } else if (condition.in !== undefined && Array.isArray(condition.in)) {
          fieldResults = this.queryIn(field, condition.in)
        } else if (condition.greaterThan !== undefined || condition.lessThan !== undefined) {
          fieldResults = this.queryRange({
            field,
            min: condition.greaterThan,
            max: condition.lessThan,
            includeMin: false,
            includeMax: false
          })
        } else if (condition.greaterEqual !== undefined || condition.lessEqual !== undefined) {
          fieldResults = this.queryRange({
            field,
            min: condition.greaterEqual,
            max: condition.lessEqual,
            includeMin: true,
            includeMax: true
          })
        } else if (condition.between !== undefined && Array.isArray(condition.between)) {
          fieldResults = this.queryRange({
            field,
            min: condition.between[0],
            max: condition.between[1],
            includeMin: true,
            includeMax: true
          })
        } else if (condition.exists !== undefined) {
          // Return all IDs that have this field
          if (condition.exists) {
            const fieldIndex = this.indices.get(field)
            if (fieldIndex) {
              const allIds = new Set<string>()
              for (const ids of fieldIndex.values()) {
                for (const id of ids) {
                  allIds.add(id)
                }
              }
              fieldResults = Array.from(allIds)
            }
          }
        }
      } else {
        // Direct value match
        fieldResults = this.queryExact(field, condition)
      }
      
      if (fieldResults.length > 0) {
        resultSets.push(new Set(fieldResults))
      } else {
        // If any field has no matches, intersection will be empty
        return []
      }
    }
    
    // Intersect all result sets (AND operation)
    if (resultSets.length === 0) return []
    if (resultSets.length === 1) return Array.from(resultSets[0])
    
    let intersection = resultSets[0]
    for (let i = 1; i < resultSets.length; i++) {
      const nextSet = resultSets[i]
      const newIntersection = new Set<string>()
      
      // Use smaller set for iteration (optimization)
      const [smaller, larger] = intersection.size <= nextSet.size 
        ? [intersection, nextSet] 
        : [nextSet, intersection]
      
      for (const id of smaller) {
        if (larger.has(id)) {
          newIntersection.add(id)
        }
      }
      
      intersection = newIntersection
      
      // Early exit if intersection is empty
      if (intersection.size === 0) return []
    }
    
    return Array.from(intersection)
  }
  
  /**
   * Mark sorted index as needing rebuild
   */
  private markSortedIndexDirty(field: string): void {
    // For now, we'll rebuild on demand
    // Could optimize with a dirty flag if needed
  }
  
  /**
   * Ensure sorted index is up to date for a field
   */
  private ensureSortedIndex(field: string): void {
    const fieldIndex = this.indices.get(field)
    if (!fieldIndex) return
    
    // Rebuild sorted index from hash index
    const sorted: Array<[any, Set<string>]> = []
    
    for (const [value, ids] of fieldIndex.entries()) {
      sorted.push([value, ids])
    }
    
    // Sort by value (handles numbers, strings, dates)
    sorted.sort((a, b) => {
      const aVal = a[0]
      const bVal = b[0]
      
      if (aVal < bVal) return -1
      if (aVal > bVal) return 1
      return 0
    })
    
    this.sortedIndices.set(field, sorted)
  }
  
  /**
   * Binary search for start position (inclusive)
   */
  private binarySearch(sorted: Array<[any, Set<string>]>, target: any, inclusive: boolean): number {
    let left = 0
    let right = sorted.length - 1
    let result = sorted.length
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const midVal = sorted[mid][0]
      
      if (inclusive ? midVal >= target : midVal > target) {
        result = mid
        right = mid - 1
      } else {
        left = mid + 1
      }
    }
    
    return result
  }
  
  /**
   * Binary search for end position (inclusive)
   */
  private binarySearchEnd(sorted: Array<[any, Set<string>]>, target: any, inclusive: boolean): number {
    let left = 0
    let right = sorted.length - 1
    let result = -1
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const midVal = sorted[mid][0]
      
      if (inclusive ? midVal <= target : midVal < target) {
        result = mid
        left = mid + 1
      } else {
        right = mid - 1
      }
    }
    
    return result
  }
  
  /**
   * Debug method to inspect index contents
   */
  public debugIndex(field?: string): any {
    if (field) {
      const fieldIndex = this.indices.get(field)
      if (!fieldIndex) return { error: 'Field not found', field }
      
      const values: any[] = []
      for (const [value, ids] of fieldIndex.entries()) {
        values.push({ value, type: typeof value, ids: Array.from(ids) })
      }
      return { field, values }
    }
    
    const allFields: any = {}
    for (const [field, fieldIndex] of this.indices.entries()) {
      allFields[field] = []
      for (const [value, ids] of fieldIndex.entries()) {
        allFields[field].push({ value, type: typeof value, ids: Array.from(ids) })
      }
    }
    return allFields
  }
  
  /**
   * Get statistics about the index
   */
  public getStats(): {
    indexedFields: number
    totalValues: number
    totalMappings: number
  } {
    let totalValues = 0
    let totalMappings = 0
    
    for (const fieldIndex of this.indices.values()) {
      totalValues += fieldIndex.size
      for (const ids of fieldIndex.values()) {
        totalMappings += ids.size
      }
    }
    
    return {
      indexedFields: this.indexedFields.size,
      totalValues,
      totalMappings
    }
  }
  
  /**
   * Clear all indices
   */
  public clear(): void {
    this.indices.clear()
    this.sortedIndices.clear()
    this.indexedFields.clear()
  }
}