/**
 * Triple Intelligence Engine
 * Revolutionary unified search combining Vector + Graph + Field intelligence
 * 
 * This is Brainy's killer feature - no other database can do this!
 */

import { Vector, SearchResult } from '../coreTypes.js'
import { HNSWIndex } from '../hnsw/hnswIndex.js'
import { BrainyData } from '../brainyData.js'

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
  offset?: number  // Skip N results for pagination
  
  // Advanced options
  mode?: 'auto' | 'vector' | 'graph' | 'metadata' | 'fusion'  // Search mode
  boost?: 'recent' | 'popular' | 'verified' | string
  explain?: boolean
  threshold?: number
}

export interface TripleResult extends SearchResult {
  // Composite scores
  vectorScore?: number
  graphScore?: number
  fieldScore?: number
  fusionScore: number
  
  // Explanation
  explanation?: {
    plan: string
    timing: Record<string, number>
    boosts: string[]
  }
}

export interface QueryPlan {
  startWith: 'vector' | 'graph' | 'field'
  canParallelize: boolean
  estimatedCost: number
  steps: QueryStep[]
}

export interface QueryStep {
  type: 'vector' | 'graph' | 'field' | 'fusion'
  operation: string
  estimated: number
}

/**
 * The Triple Intelligence Engine
 * Unifies vector, graph, and field search into one beautiful API
 */
export class TripleIntelligenceEngine {
  private brain: BrainyData
  private planCache = new Map<string, QueryPlan>()
  
  constructor(brain: BrainyData) {
    this.brain = brain
    // Query history removed - unnecessary complexity for minimal gain
  }
  
  /**
   * The magic happens here - one query to rule them all
   */
  async find(query: TripleQuery): Promise<TripleResult[]> {
    const startTime = Date.now()
    
    // Generate optimal query plan
    const plan = await this.optimizeQuery(query)
    
    // Execute based on plan
    let results: TripleResult[]
    
    if (plan.canParallelize) {
      // Run all three paths in parallel for maximum speed
      results = await this.parallelSearch(query, plan)
    } else {
      // Progressive filtering for efficiency
      results = await this.progressiveSearch(query, plan)
    }
    
    // Apply boosts if requested
    if (query.boost) {
      results = this.applyBoosts(results, query.boost)
    }
    
    // Add explanations if requested
    if (query.explain) {
      const timing = Date.now() - startTime
      results = this.addExplanations(results, plan, timing)
    }
    
    // Query history removed - no learning needed
    
    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit)
    }
    
    return results
  }
  
  /**
   * Generate optimal execution plan based on query shape
   */
  private async optimizeQuery(query: TripleQuery): Promise<QueryPlan> {
    // Short-circuit optimization for single-signal queries
    const hasVector = !!(query.like || query.similar)
    const hasGraph = !!(query.connected)
    const hasField = !!(query.where && Object.keys(query.where).length > 0)
    const signalCount = [hasVector, hasGraph, hasField].filter(Boolean).length
    
    // Single signal - skip fusion entirely!
    if (signalCount === 1) {
      const singleType = hasVector ? 'vector' : hasGraph ? 'graph' : 'field'
      return {
        startWith: singleType,
        canParallelize: false,
        estimatedCost: 1,
        steps: [{
          type: singleType,
          operation: 'direct', // Direct execution, no fusion
          estimated: 50
        }]
      }
    }
    // Check cache first
    const cacheKey = JSON.stringify(query)
    if (this.planCache.has(cacheKey)) {
      return this.planCache.get(cacheKey)!
    }
    
    // Multiple operations - optimize
    let plan: QueryPlan
    
    if (hasField && this.isSelectiveFilter(query.where!)) {
      // Start with field filter if it's selective
      plan = {
        startWith: 'field',
        canParallelize: false,
        estimatedCost: 2,
        steps: [
          { type: 'field', operation: 'filter', estimated: 50 },
          { type: hasVector ? 'vector' : 'graph', operation: 'search', estimated: 200 },
          { type: 'fusion', operation: 'rank', estimated: 50 }
        ]
      }
    } else if (hasVector && hasGraph) {
      // Parallelize vector and graph for speed
      plan = {
        startWith: 'vector',
        canParallelize: true,
        estimatedCost: 3,
        steps: [
          { type: 'vector', operation: 'search', estimated: 150 },
          { type: 'graph', operation: 'traverse', estimated: 150 },
          { type: 'field', operation: 'filter', estimated: 50 },
          { type: 'fusion', operation: 'rank', estimated: 100 }
        ]
      }
    } else {
      // Default progressive plan
      plan = {
        startWith: 'vector',
        canParallelize: false,
        estimatedCost: 2,
        steps: [
          { type: 'vector', operation: 'search', estimated: 150 },
          { type: hasGraph ? 'graph' : 'field', operation: 'filter', estimated: 100 },
          { type: 'fusion', operation: 'rank', estimated: 50 }
        ]
      }
    }
    
    // Query history removed - use default plan
    
    this.planCache.set(cacheKey, plan)
    return plan
  }
  
  /**
   * Execute searches in parallel for maximum speed
   */
  private async parallelSearch(query: TripleQuery, plan: QueryPlan): Promise<TripleResult[]> {
    // Check for single-signal optimization
    if (plan.steps.length === 1 && plan.steps[0].operation === 'direct') {
      // Skip fusion for single signal queries
      const results = await this.executeSingleSignal(query, plan.steps[0].type)
      return results.map(r => ({
        ...r,
        fusionScore: r.score || 1.0,
        score: r.score || 1.0
      }))
    }
    const tasks: Promise<any>[] = []
    
    // Vector search
    if (query.like || query.similar) {
      tasks.push(this.vectorSearch(query.like || query.similar, query.limit))
    }
    
    // Graph traversal
    if (query.connected) {
      tasks.push(this.graphTraversal(query.connected))
    }
    
    // Field filtering  
    if (query.where) {
      tasks.push(this.fieldFilter(query.where))
    }
    
    // Run all in parallel
    const results = await Promise.all(tasks)
    
    // Fusion ranking combines all signals
    return this.fusionRank(results, query)
  }
  
  /**
   * Progressive filtering for efficiency
   */
  private async progressiveSearch(query: TripleQuery, plan: QueryPlan): Promise<TripleResult[]> {
    let candidates: any[] = []
    
    for (const step of plan.steps) {
      switch (step.type) {
        case 'field':
          if (candidates.length === 0) {
            // Initial field filter
            candidates = await this.fieldFilter(query.where!)
          } else {
            // Filter existing candidates
            candidates = this.applyFieldFilter(candidates, query.where!)
          }
          break
          
        case 'vector':
          if (candidates.length === 0) {
            // Initial vector search
            const results = await this.vectorSearch(query.like || query.similar!, query.limit)
            candidates = results
          } else {
            // Vector search within candidates
            candidates = await this.vectorSearchWithin(query.like || query.similar!, candidates)
          }
          break
          
        case 'graph':
          if (candidates.length === 0) {
            // Initial graph traversal
            candidates = await this.graphTraversal(query.connected!)
          } else {
            // Graph expansion from candidates
            candidates = await this.graphExpand(candidates, query.connected!)
          }
          break
          
        case 'fusion':
          // Final fusion ranking
          return this.fusionRank([candidates], query)
      }
    }
    
    return candidates as TripleResult[]
  }
  
  /**
   * Vector similarity search
   */
  private async vectorSearch(query: string | Vector | any, limit?: number): Promise<any[]> {
    // Use clean internal vector search to avoid circular dependency
    // This is the proper architecture: find() uses internal methods, not public search()
    return (this.brain as any)._internalVectorSearch(query, limit || 100)
  }
  
  /**
   * Graph traversal
   */
  private async graphTraversal(connected: any): Promise<any[]> {
    const results: any[] = []
    
    // Get starting nodes
    const startNodes = connected.from ? 
      (Array.isArray(connected.from) ? connected.from : [connected.from]) :
      connected.to ?
      (Array.isArray(connected.to) ? connected.to : [connected.to]) :
      []
    
    // Traverse graph
    for (const nodeId of startNodes) {
      // Get verbs connected to this node (both as source and target)
      const [sourceVerbs, targetVerbs] = await Promise.all([
        this.brain.getVerbsBySource(nodeId),
        this.brain.getVerbsByTarget(nodeId)
      ])
      const allVerbs = [...sourceVerbs, ...targetVerbs]
      const connections = allVerbs.map((v: any) => ({
        id: v.targetId === nodeId ? v.sourceId : v.targetId,
        type: v.type,
        score: v.weight || 0.5
      }))
      results.push(...connections)
    }
    
    return results
  }
  
  /**
   * Field-based filtering
   */
  private async fieldFilter(where: Record<string, any>): Promise<any[]> {
    // CRITICAL OPTIMIZATION: Use MetadataIndex directly for O(log n) performance!
    // NOT vector search which would be O(n) and slow
    
    if (!where || Object.keys(where).length === 0) {
      // Return all items (should use a more efficient method)
      const allNouns = (this.brain as any).index.getNouns()
      return Array.from(allNouns.keys()).slice(0, 1000).map(id => ({ id, score: 1.0 }))
    }
    
    // Use the MetadataIndex directly for FAST field queries!
    // This uses B-tree indexes for O(log n) range queries
    // and hash indexes for O(1) exact matches
    const matchingIds = await (this.brain as any).metadataIndex?.getIdsForFilter(where) || []
    
    // Convert to result format with metadata
    const results = []
    for (const id of matchingIds.slice(0, 1000)) {
      const noun = await (this.brain as any).getNoun(id)
      if (noun) {
        results.push({
          id,
          score: 1.0, // Field matches are binary - either match or don't
          metadata: noun.metadata || {}
        })
      }
    }
    
    return results
  }
  
  /**
   * Fusion ranking combines all signals
   */
  private fusionRank(resultSets: any[][], query: TripleQuery): TripleResult[] {
    // PERFORMANCE CRITICAL: When metadata filters are present, use INTERSECTION not UNION
    // This ensures O(log n) performance with millions of items
    
    // Determine which result sets we have based on query
    let vectorResultsIdx = -1
    let graphResultsIdx = -1
    let metadataResultsIdx = -1
    let currentIdx = 0
    
    if (query.like || query.similar) {
      vectorResultsIdx = currentIdx++
    }
    if (query.connected) {
      graphResultsIdx = currentIdx++
    }
    if (query.where) {
      metadataResultsIdx = currentIdx++
    }
    
    // If we have metadata filters AND other searches, apply intersection
    if (metadataResultsIdx >= 0 && resultSets.length > 1) {
      const metadataResults = resultSets[metadataResultsIdx]
      
      // CRITICAL: If metadata filter returned no results, entire query should return empty
      // This ensures correct behavior for non-matching filters
      if (metadataResults.length === 0) {
        // Return empty results immediately
        return []
      }
      
      const metadataIds = new Set(metadataResults.map(r => r.id || r))
      
      // Filter ALL other result sets to only include items that match metadata
      for (let i = 0; i < resultSets.length; i++) {
        if (i !== metadataResultsIdx) {
          resultSets[i] = resultSets[i].filter(r => metadataIds.has(r.id || r))
        }
      }
    }
    
    // Combine and deduplicate results
    const allResults = new Map<string, TripleResult>()
    
    // Need to capture indices for closure
    const vectorIdx = vectorResultsIdx
    const graphIdx = graphResultsIdx
    const metadataIdx = metadataResultsIdx
    
    // Process each result set
    resultSets.forEach((results, index) => {
      const weight = 1.0 / resultSets.length
      
      results.forEach(r => {
        const id = r.id || r
        
        if (!allResults.has(id)) {
          allResults.set(id, {
            ...r,
            id,
            vectorScore: 0,
            graphScore: 0,
            fieldScore: 0,
            fusionScore: 0
          })
        }
        
        const result = allResults.get(id)!
        
        // Assign scores based on source (using the indices we calculated)
        if (index === vectorIdx) {
          result.vectorScore = r.score || 1.0
        } else if (index === graphIdx) {
          result.graphScore = r.score || 1.0
        } else if (index === metadataIdx) {
          result.fieldScore = r.score || 1.0
        }
      })
    })
    
    // Calculate fusion scores
    const results = Array.from(allResults.values())
    results.forEach(r => {
      // Weighted combination of signals
      const vectorWeight = (query.like || query.similar) ? 0.4 : 0
      const graphWeight = query.connected ? 0.3 : 0
      const fieldWeight = query.where ? 0.3 : 0
      
      // Normalize weights
      const totalWeight = vectorWeight + graphWeight + fieldWeight
      
      if (totalWeight > 0) {
        r.fusionScore = (
          (r.vectorScore || 0) * vectorWeight +
          (r.graphScore || 0) * graphWeight +
          (r.fieldScore || 0) * fieldWeight
        ) / totalWeight
      } else {
        r.fusionScore = r.score || 0
      }
    })
    
    // Sort by fusion score
    results.sort((a, b) => b.fusionScore - a.fusionScore)
    
    return results
  }
  
  /**
   * Check if a filter is selective enough to use first
   */
  private isSelectiveFilter(where: Record<string, any>): boolean {
    // Heuristic: filters with exact matches or small ranges are selective
    for (const [key, value] of Object.entries(where)) {
      if (typeof value === 'object' && value !== null) {
        // Check for operators that are selective
        if (value.equals || value.is || value.oneOf) {
          return true
        }
        if (value.between && Array.isArray(value.between)) {
          const [min, max] = value.between
          if (typeof min === 'number' && typeof max === 'number') {
            // Small numeric range is selective
            if ((max - min) / Math.max(Math.abs(min), Math.abs(max), 1) < 0.1) {
              return true
            }
          }
        }
      } else {
        // Exact match is selective
        return true
      }
    }
    return false
  }
  
  /**
   * Apply field filter to existing candidates
   */
  private applyFieldFilter(candidates: any[], where: Record<string, any>): any[] {
    return candidates.filter(c => {
      for (const [key, condition] of Object.entries(where)) {
        const value = c.metadata?.[key] ?? c[key]
        
        if (typeof condition === 'object' && condition !== null) {
          // Handle operators
          for (const [op, operand] of Object.entries(condition)) {
            if (!this.checkCondition(value, op, operand)) {
              return false
            }
          }
        } else {
          // Direct equality
          if (value !== condition) {
            return false
          }
        }
      }
      return true
    })
  }
  
  /**
   * Check a single condition
   */
  private checkCondition(value: any, operator: string, operand: any): boolean {
    switch (operator) {
      case 'equals':
      case 'is':
        return value === operand
      case 'greaterThan':
        return value > operand
      case 'lessThan':
        return value < operand
      case 'oneOf':
        return Array.isArray(operand) && operand.includes(value)
      case 'contains':
        return Array.isArray(value) && value.includes(operand)
      default:
        return true
    }
  }
  
  /**
   * Vector search within specific candidates
   */
  private async vectorSearchWithin(query: any, candidates: any[]): Promise<any[]> {
    const ids = candidates.map(c => c.id || c)
    return this.brain.searchWithinItems(query, ids, candidates.length)
  }
  
  /**
   * Expand graph from candidates
   */
  private async graphExpand(candidates: any[], connected: any): Promise<any[]> {
    const expanded: any[] = []
    
    for (const candidate of candidates) {
      // Get verbs connected to this candidate
      const nodeId = candidate.id || candidate
      const [sourceVerbs, targetVerbs] = await Promise.all([
        this.brain.getVerbsBySource(nodeId),
        this.brain.getVerbsByTarget(nodeId)
      ])
      const allVerbs = [...sourceVerbs, ...targetVerbs]
      const connections = allVerbs.map((v: any) => ({
        id: v.targetId === nodeId ? v.sourceId : v.targetId,
        type: v.type,
        score: v.weight || 0.5
      }))
      expanded.push(...connections)
    }
    
    return expanded
  }
  
  /**
   * Apply boost strategies
   */
  private applyBoosts(results: TripleResult[], boost: string): TripleResult[] {
    return results.map(r => {
      let boostFactor = 1.0
      
      switch (boost) {
        case 'recent':
          // Boost recent items
          const age = Date.now() - (r.metadata?.timestamp || 0)
          boostFactor = Math.exp(-age / (30 * 24 * 60 * 60 * 1000)) // 30-day half-life
          break
          
        case 'popular':
          // Boost by view count or connections
          boostFactor = Math.log10((r.metadata?.views || 0) + 10) / 2
          break
          
        case 'verified':
          // Boost verified content
          boostFactor = r.metadata?.verified ? 1.5 : 1.0
          break
      }
      
      return {
        ...r,
        fusionScore: r.fusionScore * boostFactor
      }
    })
  }
  
  /**
   * Add query explanations for debugging
   */
  private addExplanations(results: TripleResult[], plan: QueryPlan, totalTime: number): TripleResult[] {
    return results.map(r => ({
      ...r,
      explanation: {
        plan: plan.steps.map(s => `${s.type}:${s.operation}`).join(' → '),
        timing: {
          total: totalTime,
          ...plan.steps.reduce((acc, step) => ({
            ...acc,
            [step.type]: step.estimated
          }), {})
        },
        boosts: []
      }
    }))
  }
  
  // Query learning removed - unnecessary complexity
  
  /**
   * Optimize plan based on historical patterns
   */
  // Query optimization from history removed
  
  /**
   * Execute single signal query without fusion
   */
  private async executeSingleSignal(query: TripleQuery, type: string): Promise<any[]> {
    switch (type) {
      case 'vector':
        return this.vectorSearch(query.like || query.similar!, query.limit)
      case 'graph':
        return this.graphTraversal(query.connected!)
      case 'field':
        return this.fieldFilter(query.where!)
      default:
        return []
    }
  }
  
  /**
   * Clear query optimization cache
   */
  clearCache(): void {
    this.planCache.clear()
  }
  
  /**
   * Get optimization statistics
   */
  getStats(): any {
    return {
      cachedPlans: this.planCache.size,
      historySize: 0 // Query history removed
    }
  }
}

// Export a beautiful, simple API
export async function find(brain: BrainyData, query: TripleQuery): Promise<TripleResult[]> {
  const engine = new TripleIntelligenceEngine(brain)
  return engine.find(query)
}