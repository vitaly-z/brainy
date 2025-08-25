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
    direction?: 'in' | 'out' | 'both'
  }
  
  // Field/Attribute search
  where?: Record<string, any>
  
  // Advanced options
  limit?: number
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
  private queryHistory?: BrainyData // For self-optimization
  private planCache = new Map<string, QueryPlan>()
  
  constructor(brain: BrainyData, enableSelfOptimization = true) {
    this.brain = brain
    
    if (enableSelfOptimization) {
      // Brainy uses Brainy to optimize Brainy!
      // But prevent infinite recursion by disabling writeOnly mode
      this.queryHistory = new BrainyData({ writeOnly: true })
      this.queryHistory.init()
    }
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
    
    // Learn from this query for future optimization
    if (this.queryHistory) {
      await this.learnFromQuery(query, results, Date.now() - startTime)
    }
    
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
    
    // Learn from history if available
    if (this.queryHistory) {
      plan = await this.optimizeFromHistory(query, plan)
    }
    
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
    return this.brain.search(query, limit || 100)
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
    // Use BrainyData's advanced metadata filtering capabilities
    // Convert Triple Intelligence 'where' clauses to metadata filter format
    
    if (!where || Object.keys(where).length === 0) {
      return this.brain.search('*', 1000) // Return all if no filter
    }
    
    // Convert Brain Patterns (like {year: {greaterThan: 2020}}) to search metadata filters
    const metadata: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(where)) {
      if (typeof value === 'object' && value !== null) {
        // Handle Brain Pattern operators
        if (value.greaterThan !== undefined) {
          metadata[`${key}:`] = `>${value.greaterThan}`
        } else if (value.greaterEqual !== undefined) {
          metadata[`${key}:`] = `>=${value.greaterEqual}`
        } else if (value.lessThan !== undefined) {
          metadata[`${key}:`] = `<${value.lessThan}`
        } else if (value.lessEqual !== undefined) {
          metadata[`${key}:`] = `<=${value.lessEqual}`
        } else if (value.equals !== undefined) {
          metadata[key] = value.equals
        } else {
          // Direct object comparison
          metadata[key] = value
        }
      } else {
        // Direct value comparison
        metadata[key] = value
      }
    }
    
    return this.brain.search('*', 1000, { metadata })
  }
  
  /**
   * Fusion ranking combines all signals
   */
  private fusionRank(resultSets: any[][], query: TripleQuery): TripleResult[] {
    // Combine and deduplicate results
    const allResults = new Map<string, TripleResult>()
    
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
        
        // Assign scores based on source
        if (index === 0 && (query.like || query.similar)) {
          result.vectorScore = r.score || 1.0
        } else if (index === 1 && query.connected) {
          result.graphScore = r.score || 1.0
        } else if (query.where) {
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
  
  /**
   * Learn from query execution for future optimization
   */
  private async learnFromQuery(query: TripleQuery, results: TripleResult[], executionTime: number): Promise<void> {
    if (!this.queryHistory) return
    
    // Store query pattern and performance
    await this.queryHistory.addNoun(
      query, // Query itself becomes the vector
      {
        timestamp: Date.now(),
        executionTime,
        resultCount: results.length,
        performance: Math.min(1.0, 100 / executionTime), // Faster = better
        queryShape: {
          hasVector: !!(query.like || query.similar),
          hasGraph: !!query.connected,
          hasField: !!query.where
        }
      }
    )
  }
  
  /**
   * Optimize plan based on historical patterns
   */
  private async optimizeFromHistory(query: TripleQuery, defaultPlan: QueryPlan): Promise<QueryPlan> {
    if (!this.queryHistory) return defaultPlan
    
    // Check if the brain is initialized before searching
    if (!this.brain.initialized) return defaultPlan
    
    // Find similar successful queries
    const similar = await this.queryHistory.search(query, 5, {
      metadata: { performance: { greaterThan: 0.8 } }
    })
    
    if (similar.length === 0) return defaultPlan
    
    // Average the successful execution patterns
    // This is simplified - real implementation would be more sophisticated
    const successfulPlans = similar
      .map(s => s.metadata.queryShape)
      .filter(Boolean)
    
    // For now, just return the default plan
    // Real implementation would merge and optimize
    return defaultPlan
  }
  
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
      historySize: this.queryHistory ? this.queryHistory.size : 0
    }
  }
}

// Export a beautiful, simple API
export async function find(brain: BrainyData, query: TripleQuery): Promise<TripleResult[]> {
  const engine = new TripleIntelligenceEngine(brain)
  return engine.find(query)
}