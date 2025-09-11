/**
 * Triple Intelligence Types
 * Defines the query and result types for Triple Intelligence
 * 
 * The actual implementation is in TripleIntelligenceSystem
 */

import { Vector, SearchResult } from '../coreTypes.js'

export interface TripleQuery {
  // Vector/Semantic search
  like?: string | Vector | any
  similar?: string | Vector | any
  
  // Graph/Relationship search  
  connected?: {
    to?: string | string[]
    from?: string | string[]
    type?: string | string[]
    depth?: number
    maxDepth?: number  // Maximum traversal depth
    direction?: 'in' | 'out' | 'both'
  }
  
  // Field/Attribute search
  where?: Record<string, any>
  
  // Pagination options (NEW for 2.0)
  limit?: number
  offset?: number
  
  // Advanced options (NEW for 2.0)
  explain?: boolean  // Include explanation of how results were found
  boost?: {
    vector?: number   // Weight for vector similarity (default 1.0)
    graph?: number    // Weight for graph connections (default 1.0)
    field?: number    // Weight for field matches (default 1.0)
  }
}

export interface TripleResult {
  id: string
  score: number
  entity?: any
  explanation?: {
    vectorScore?: number
    graphScore?: number
    fieldScore?: number
    path?: string[]
  }
}

export interface QueryPlan {
  strategy: 'parallel' | 'progressive'
  steps: Array<{
    type: 'vector' | 'graph' | 'field'
    cost: number
    expected: number
  }>
  canParallelize: boolean
  estimatedCost: number
}

/**
 * @deprecated Use brain.getTripleIntelligence() directly to get TripleIntelligenceSystem
 */
export type TripleIntelligenceEngine = any