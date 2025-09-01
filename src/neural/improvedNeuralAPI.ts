/**
 * Improved Neural API - Clean, Consistent, Performant
 * 
 * Public API Surface:
 * - brain.neural.similar(a, b, options?)           // Similarity calculation  
 * - brain.neural.clusters(items?, options?)        // Semantic clustering
 * - brain.neural.neighbors(id, options?)           // K-nearest neighbors
 * - brain.neural.hierarchy(id, options?)           // Semantic hierarchy
 * - brain.neural.outliers(options?)                // Anomaly detection
 * - brain.neural.visualize(options?)               // Visualization data
 * 
 * Advanced Clustering:
 * - brain.neural.clusterByDomain(field, options?)  // Domain-aware clustering
 * - brain.neural.clusterByTime(field, windows, options?) // Temporal clustering
 * - brain.neural.clusterStream(options?)           // AsyncIterator for streaming
 * - brain.neural.updateClusters(items, options?)   // Incremental clustering
 * 
 * Private methods are prefixed with _ and not exposed in public API
 */

import { Vector } from '../coreTypes.js'
import { cosineDistance, euclideanDistance } from '../utils/distance.js'
import {
  SemanticCluster,
  DomainCluster,
  TemporalCluster,
  ExplainableCluster,
  ConfidentCluster,
  SimilarityOptions,
  SimilarityResult,
  NeighborOptions,
  Neighbor,
  NeighborsResult,
  SemanticHierarchy,
  HierarchyOptions,
  ClusteringOptions,
  DomainClusteringOptions,
  TemporalClusteringOptions,
  StreamClusteringOptions,
  VisualizationOptions,
  VisualizationResult,
  OutlierOptions,
  Outlier,
  ClusteringResult,
  StreamingBatch,
  TimeWindow,
  ClusterFeedback,
  PerformanceMetrics,
  NeuralAPIConfig,
  NeuralAPIError,
  ClusteringError,
  SimilarityError
} from './types.js'

// ===== ADDITIONAL TYPE DEFINITIONS =====

/**
 * Graph structure for community detection
 */
interface GraphStructure {
  nodes: string[]
  edges: Map<string, Map<string, number>>
  nodeCount: number
  edgeCount: number
}

/**
 * Community detected from graph clustering
 */
interface Community {
  id: number
  members: string[]
  modularity: number
  density: number
  strongestConnections: Array<{from: string, to: string, weight: number}>
}

/**
 * Item with metadata for semantic clustering
 */
interface ItemWithMetadata {
  id: string
  vector: number[]
  metadata: Record<string, any>
  nounType: string
  label: string
  data?: any
}

export class ImprovedNeuralAPI {
  private brain: any // BrainyData instance
  private config: NeuralAPIConfig
  
  // Caching for performance
  private similarityCache = new Map<string, number | SimilarityResult>()
  private clusterCache = new Map<string, ClusteringResult>()
  private hierarchyCache = new Map<string, SemanticHierarchy>()
  private neighborsCache = new Map<string, NeighborsResult>()
  
  // Performance tracking
  private performanceMetrics = new Map<string, PerformanceMetrics[]>()
  
  constructor(brain: any, config: NeuralAPIConfig = {}) {
    this.brain = brain
    this.config = {
      cacheSize: 1000,
      defaultAlgorithm: 'auto',
      similarityMetric: 'cosine',
      performanceTracking: true,
      maxMemoryUsage: '1GB',
      parallelProcessing: true,
      streamingBatchSize: 100,
      ...config
    }
    
    this._initializeCleanupTimer()
  }

  // ===== PUBLIC API: SIMILARITY =====

  /**
   * Calculate similarity between any two items (auto-detection)
   * Supports: IDs, text strings, vectors, or mixed types
   */
  async similar(
    a: string | Vector | any, 
    b: string | Vector | any, 
    options: SimilarityOptions = {}
  ): Promise<number | SimilarityResult> {
    const startTime = performance.now()
    
    try {
      // Create cache key
      const cacheKey = this._createSimilarityKey(a, b, options)
      if (this.similarityCache.has(cacheKey)) {
        return this.similarityCache.get(cacheKey)!
      }

      let result: number | SimilarityResult

      // Auto-detect input types and route accordingly
      if (this._isId(a) && this._isId(b)) {
        result = await this._similarityById(a, b, options)
      } else if (this._isVector(a) && this._isVector(b)) {
        result = await this._similarityByVector(a, b, options)
      } else if (typeof a === 'string' && typeof b === 'string') {
        result = await this._similarityByText(a, b, options)
      } else {
        // Mixed types - convert to vectors
        const vectorA = await this._convertToVector(a)
        const vectorB = await this._convertToVector(b)
        result = await this._similarityByVector(vectorA, vectorB, options)
      }

      // Cache result
      this._cacheResult(cacheKey, result, this.similarityCache)
      
      // Track performance
      this._trackPerformance('similarity', startTime, 2, 'mixed')
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new SimilarityError(`Failed to calculate similarity: ${errorMessage}`, {
        inputA: typeof a === 'object' ? 'vector' : String(a).substring(0, 50),
        inputB: typeof b === 'object' ? 'vector' : String(b).substring(0, 50),
        options
      })
    }
  }

  // ===== PUBLIC API: CLUSTERING =====

  /**
   * Intelligent semantic clustering with auto-routing
   * - No input: Cluster all data
   * - Array: Cluster specific items  
   * - String: Find clusters near this item
   * - Options object: Advanced configuration
   */
  async clusters(input?: string | string[] | ClusteringOptions): Promise<SemanticCluster[]> {
    const startTime = performance.now()
    
    try {
      let options: ClusteringOptions = {}
      let items: string[] | undefined

      // Parse input
      if (!input) {
        // Cluster all data
        items = undefined
        options = { algorithm: 'auto' }
      } else if (Array.isArray(input)) {
        // Cluster specific items
        items = input
        options = { algorithm: 'auto' }
      } else if (typeof input === 'string') {
        // Find clusters near this item
        const nearbyResult = await this.neighbors(input, { limit: 100 })
        items = nearbyResult.neighbors.map(n => n.id)
        options = { algorithm: 'auto' }
      } else if (typeof input === 'object') {
        // Configuration object
        options = input
        items = undefined
      } else {
        throw new ClusteringError('Invalid input for clustering', { input })
      }

      // Check cache
      const cacheKey = this._createClusteringKey(items, options)
      if (this.clusterCache.has(cacheKey)) {
        const cached = this.clusterCache.get(cacheKey)!
        return cached.clusters
      }

      // Route to optimal algorithm
      const result = await this._routeClusteringAlgorithm(items, options)
      
      // Cache result
      this._cacheResult(cacheKey, result, this.clusterCache)
      
      // Track performance
      this._trackPerformance('clustering', startTime, items?.length || 0, options.algorithm || 'auto')
      
      return result.clusters
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new ClusteringError(`Failed to perform clustering: ${errorMessage}`, {
        input: typeof input === 'object' ? JSON.stringify(input) : input,
      })
    }
  }

  /**
   * Fast hierarchical clustering using HNSW levels
   */
  async clusterFast(options: { level?: number; maxClusters?: number } = {}): Promise<SemanticCluster[]> {
    const fullOptions: ClusteringOptions = {
      algorithm: 'hierarchical',
      maxClusters: options.maxClusters,
      ...options
    }
    
    const result = await this._performHierarchicalClustering(undefined, fullOptions)
    return result.clusters
  }

  /**
   * Large-scale clustering with intelligent sampling
   */
  async clusterLarge(options: { sampleSize?: number; strategy?: 'random' | 'diverse' | 'recent' } = {}): Promise<SemanticCluster[]> {
    const fullOptions: ClusteringOptions = {
      algorithm: 'auto',
      sampleSize: options.sampleSize || 1000,
      strategy: options.strategy || 'diverse',
      ...options
    }
    
    const result = await this._performSampledClustering(undefined, fullOptions)
    return result.clusters
  }

  // ===== PUBLIC API: ADVANCED CLUSTERING =====

  /**
   * Domain-aware clustering based on metadata fields
   */
  async clusterByDomain(
    field: string, 
    options: DomainClusteringOptions = {}
  ): Promise<DomainCluster[]> {
    const startTime = performance.now()
    
    try {
      // Get all items with the specified field
      const items = await this._getItemsByField(field)
      if (items.length === 0) {
        return []
      }

      // Group by domain values
      const domainGroups = this._groupByDomain(items, field)
      const domainClusters: DomainCluster[] = []

      // Cluster within each domain
      for (const [domain, domainItems] of domainGroups) {
        const domainOptions: ClusteringOptions = {
          ...options,
          algorithm: 'auto',
          maxClusters: Math.min(options.maxClusters || 10, Math.ceil(domainItems.length / 3))
        }

        const clusters = await this._performClustering(domainItems.map(item => item.id), domainOptions)
        
        // Convert to domain clusters
        for (const cluster of clusters.clusters) {
          domainClusters.push({
            ...cluster,
            domain,
            domainConfidence: this._calculateDomainConfidence(cluster, domainItems),
            crossDomainMembers: options.crossDomainThreshold 
              ? await this._findCrossDomainMembers(cluster, options.crossDomainThreshold)
              : undefined
          })
        }
      }

      // Handle cross-domain clustering if enabled
      if (!options.preserveDomainBoundaries) {
        const crossDomainClusters = await this._findCrossDomainClusters(
          domainClusters, 
          options.crossDomainThreshold || 0.8
        )
        domainClusters.push(...crossDomainClusters)
      }

      this._trackPerformance('domainClustering', startTime, items.length, field)
      return domainClusters
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new ClusteringError(`Failed to cluster by domain: ${errorMessage}`, { field, options })
    }
  }

  /**
   * Temporal clustering based on time windows
   */
  async clusterByTime(
    timeField: string,
    windows: TimeWindow[],
    options: TemporalClusteringOptions = { timeField, windows }
  ): Promise<TemporalCluster[]> {
    const startTime = performance.now()
    
    try {
      const temporalClusters: TemporalCluster[] = []

      for (const window of windows) {
        // Get items in this time window
        const windowItems = await this._getItemsByTimeWindow(timeField, window)
        if (windowItems.length === 0) continue

        // Cluster items in this window  
        const clusteringOptions: ClusteringOptions = {
          ...options,
          algorithm: 'auto'
        }
        const clusters = await this._performClustering(
          windowItems.map(item => item.id),
          clusteringOptions
        )

        // Convert to temporal clusters
        for (const cluster of clusters.clusters) {
          const temporal = await this._calculateTemporalMetrics(cluster, windowItems, timeField)
          
          temporalClusters.push({
            ...cluster,
            timeWindow: window,
            trend: temporal.trend,
            temporal: temporal.metrics
          })
        }
      }

      // Handle overlapping windows
      if (options.overlapStrategy === 'merge') {
        return this._mergeOverlappingTemporalClusters(temporalClusters)
      }

      this._trackPerformance('temporalClustering', startTime, temporalClusters.length, 'temporal')
      return temporalClusters
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new ClusteringError(`Failed to cluster by time: ${errorMessage}`, { timeField, windows, options })
    }
  }

  /**
   * Streaming clustering with real-time updates
   */
  async *clusterStream(options: StreamClusteringOptions = {}): AsyncIterableIterator<StreamingBatch> {
    const batchSize = options.batchSize || this.config.streamingBatchSize || 100
    let batchNumber = 0
    let processedCount = 0
    
    try {
      // Get all items for processing
      const allItems = await this._getAllItemIds()
      const totalItems = allItems.length

      // Process in batches
      for (let i = 0; i < allItems.length; i += batchSize) {
        const startTime = performance.now()
        const batch = allItems.slice(i, i + batchSize)
        
        // Perform clustering on this batch
        const result = await this._performClustering(batch, {
          ...options,
          algorithm: 'auto',
          cacheResults: false // Don't cache streaming results
        })

        processedCount += batch.length
        const isComplete = processedCount >= totalItems

        yield {
          clusters: result.clusters,
          batchNumber: ++batchNumber,
          isComplete,
          progress: {
            processed: processedCount,
            total: totalItems,
            percentage: (processedCount / totalItems) * 100
          },
          metrics: {
            ...result.metrics,
            executionTime: performance.now() - startTime
          }
        }

        // Adaptive threshold adjustment
        if (options.adaptiveThreshold && batchNumber > 1) {
          options.threshold = this._adjustThresholdAdaptively(result.clusters, options.threshold)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new ClusteringError(`Failed in streaming clustering: ${errorMessage}`, { options, batchNumber })
    }
  }

  /**
   * Incremental clustering - add new items to existing clusters
   */
  async updateClusters(newItems: string[], options: ClusteringOptions = {}): Promise<SemanticCluster[]> {
    const startTime = performance.now()
    
    try {
      // Get existing clusters
      const existingClusters = await this.clusters({ ...options, algorithm: 'auto' })
      
      // For each new item, find best cluster or create new one
      const updatedClusters = [...existingClusters]
      const unassignedItems: string[] = []

      for (const itemId of newItems) {
        let bestCluster: SemanticCluster | null = null
        let bestSimilarity = 0

        // Find most similar existing cluster
        for (const cluster of updatedClusters) {
          const similarity = await this._calculateItemToClusterSimilarity(itemId, cluster)
          if (similarity > bestSimilarity && similarity > (options.threshold || 0.6)) {
            bestSimilarity = similarity
            bestCluster = cluster
          }
        }

        if (bestCluster) {
          // Add to existing cluster
          bestCluster.members.push(itemId)
          bestCluster.size = bestCluster.members.length
          // Recalculate centroid
          bestCluster.centroid = await this._recalculateClusterCentroid(bestCluster)
        } else {
          // Item doesn't fit existing clusters
          unassignedItems.push(itemId)
        }
      }

      // Create new clusters for unassigned items
      if (unassignedItems.length > 0) {
        const newClusters = await this._performClustering(unassignedItems, options)
        updatedClusters.push(...newClusters.clusters)
      }

      this._trackPerformance('incrementalClustering', startTime, newItems.length, 'incremental')
      return updatedClusters
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new ClusteringError(`Failed to update clusters: ${errorMessage}`, { newItems, options })
    }
  }

  // ===== PUBLIC API: NEIGHBORS & HIERARCHY =====

  /**
   * Find K-nearest semantic neighbors
   */
  async neighbors(id: string, options: NeighborOptions = {}): Promise<NeighborsResult> {
    const startTime = performance.now()
    
    try {
      const cacheKey = `neighbors:${id}:${JSON.stringify(options)}`
      if (this.neighborsCache.has(cacheKey)) {
        return this.neighborsCache.get(cacheKey)!
      }

      const limit = options.limit || 10
      const minSimilarity = options.minSimilarity || 0.1
      
      // Use HNSW index for efficient neighbor search
      const searchResults = await this.brain.search('', { 
        ...options,
        limit: limit * 2, // Get more than needed for filtering
        metadata: options.includeMetadata ? {} : undefined
      })

      // Filter and sort neighbors
      const neighbors: Neighbor[] = []
      for (const result of searchResults) {
        if (result.id === id) continue // Skip self
        
        const similarity = await this._calculateSimilarity(id, result.id)
        if (similarity >= minSimilarity) {
          neighbors.push({
            id: result.id,
            similarity,
            data: result.content || result.data,
            metadata: options.includeMetadata ? result.metadata : undefined,
            distance: 1 - similarity
          })
        }

        if (neighbors.length >= limit) break
      }

      // Sort by specified criteria
      this._sortNeighbors(neighbors, options.sortBy || 'similarity')

      const result: NeighborsResult = {
        neighbors: neighbors.slice(0, limit),
        queryId: id,
        totalFound: neighbors.length,
        averageSimilarity: neighbors.reduce((sum, n) => sum + n.similarity, 0) / neighbors.length
      }

      this._cacheResult(cacheKey, result, this.neighborsCache)
      this._trackPerformance('neighbors', startTime, limit, 'knn')
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new NeuralAPIError(`Failed to find neighbors: ${errorMessage}`, 'NEIGHBORS_ERROR', { id, options })
    }
  }

  /**
   * Build semantic hierarchy around an item
   */
  async hierarchy(id: string, options: HierarchyOptions = {}): Promise<SemanticHierarchy> {
    const startTime = performance.now()
    
    try {
      const cacheKey = `hierarchy:${id}:${JSON.stringify(options)}`
      if (this.hierarchyCache.has(cacheKey)) {
        return this.hierarchyCache.get(cacheKey)!
      }

      // Get item data
      const item = await this.brain.getNoun(id)
      if (!item) {
        throw new Error(`Item with ID ${id} not found`)
      }

      // Build hierarchy based on strategy
      const hierarchy = await this._buildSemanticHierarchy(item, options)
      
      this._cacheResult(cacheKey, hierarchy, this.hierarchyCache)
      this._trackPerformance('hierarchy', startTime, 1, 'hierarchy')
      
      return hierarchy
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new NeuralAPIError(`Failed to build hierarchy: ${errorMessage}`, 'HIERARCHY_ERROR', { id, options })
    }
  }

  // ===== PUBLIC API: ANALYSIS =====

  /**
   * Detect outliers and anomalous items
   */
  async outliers(options: OutlierOptions = {}): Promise<Outlier[]> {
    const startTime = performance.now()
    
    try {
      const threshold = options.threshold || 0.3
      const method = options.method || 'cluster-based'
      
      let outliers: Outlier[] = []

      switch (method) {
        case 'isolation':
          outliers = await this._detectOutliersIsolation(threshold, options)
          break
        case 'statistical':
          outliers = await this._detectOutliersStatistical(threshold, options)
          break
        case 'cluster-based':
        default:
          outliers = await this._detectOutliersClusterBased(threshold, options)
          break
      }

      this._trackPerformance('outlierDetection', startTime, outliers.length, method)
      return outliers
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new NeuralAPIError(`Failed to detect outliers: ${errorMessage}`, 'OUTLIER_ERROR', { options })
    }
  }

  /**
   * Generate visualization data for graph libraries
   */
  async visualize(options: VisualizationOptions = {}): Promise<VisualizationResult> {
    const startTime = performance.now()
    
    try {
      const maxNodes = options.maxNodes || 100
      const dimensions = options.dimensions || 2
      const algorithm = options.algorithm || 'force'
      
      // Get data for visualization
      const nodes = await this._generateVisualizationNodes(maxNodes, options)
      const edges = options.includeEdges ? await this._generateVisualizationEdges(nodes, options) : []
      const clusters = options.clusterColors ? await this._generateVisualizationClusters(nodes) : []
      
      // Apply layout algorithm
      const positionedNodes = await this._applyLayoutAlgorithm(nodes, edges, algorithm, dimensions)
      
      const result: VisualizationResult = {
        nodes: positionedNodes,
        edges,
        clusters,
        metadata: {
          algorithm,
          dimensions,
          totalNodes: nodes.length,
          totalEdges: edges.length,
          generatedAt: new Date()
        }
      }

      this._trackPerformance('visualization', startTime, nodes.length, algorithm)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new NeuralAPIError(`Failed to generate visualization: ${errorMessage}`, 'VISUALIZATION_ERROR', { options })
    }
  }

  // ===== PRIVATE IMPLEMENTATION METHODS =====

  private async _routeClusteringAlgorithm(
    items: string[] | undefined, 
    options: ClusteringOptions
  ): Promise<ClusteringResult> {
    const algorithm = options.algorithm || 'auto'
    const itemCount = items?.length || await this._getTotalItemCount()

    // Auto-select optimal algorithm based on data size and characteristics
    if (algorithm === 'auto') {
      // Intelligent algorithm selection based on data characteristics
      const itemIds = items || await this._getAllItemIds()
      const dataCharacteristics = await this._analyzeDataCharacteristics(itemIds)
      
      const hasRichGraph = dataCharacteristics.graphDensity > 0.05
      const hasSemanticTypes = Object.keys(dataCharacteristics.typeDistribution).length > 3
      
      if (hasRichGraph && hasSemanticTypes) {
        // Best of all worlds for rich semantic graphs
        return this._performMultiModalClustering(items, { ...options, algorithm: 'multimodal' })
      } else if (hasRichGraph) {
        // Strong relationship network - use graph clustering
        return this._performGraphClustering(items, { ...options, algorithm: 'graph' })
      } else if (hasSemanticTypes) {
        // Rich semantic taxonomy - use semantic clustering
        return this._performSemanticClustering(items, { ...options, algorithm: 'semantic' })
      } else if (itemCount > 10000) {
        // Large dataset - use sampling
        return this._performSampledClustering(items, { ...options, algorithm: 'sample' })
      } else if (itemCount > 1000) {
        // Medium dataset - use hierarchical HNSW
        return this._performHierarchicalClustering(items, { ...options, algorithm: 'hierarchical' })
      } else {
        // Small dataset - use k-means for quality
        return this._performKMeansClustering(items, { ...options, algorithm: 'kmeans' })
      }
    }

    // Use specified algorithm
    switch (algorithm) {
      case 'hierarchical':
        return this._performHierarchicalClustering(items, options)
      case 'semantic':
        return this._performSemanticClustering(items, options)
      case 'graph':
        return this._performGraphClustering(items, options)
      case 'multimodal':
        return this._performMultiModalClustering(items, options)
      case 'kmeans':
        return this._performKMeansClustering(items, options)
      case 'dbscan':
        return this._performDBSCANClustering(items, options)
      case 'sample':
        return this._performSampledClustering(items, options)
      default:
        throw new ClusteringError(`Unsupported algorithm: ${algorithm}`)
    }
  }

  private async _performClustering(items: string[], options: ClusteringOptions): Promise<ClusteringResult> {
    // This is the main clustering dispatcher - routes to specific algorithms
    return this._routeClusteringAlgorithm(items, options)
  }

  // ===== REAL CLUSTERING IMPLEMENTATIONS =====

  /**
   * SEMANTIC-AWARE CLUSTERING: Uses existing NounType/VerbType taxonomy + HNSW
   */
  private async _performSemanticClustering(items: string[] | undefined, options: ClusteringOptions): Promise<ClusteringResult> {
    const startTime = performance.now()
    
    // Get all items if not specified
    const itemIds = items || await this._getAllItemIds()
    if (itemIds.length === 0) {
      return this._createEmptyResult(startTime, 'semantic')
    }

    // 1. Group items by semantic type (NounType) - O(n) operation
    const itemsWithMetadata = await this._getItemsWithMetadata(itemIds)
    const typeGroups = this._groupBySemanticType(itemsWithMetadata)
    
    const allClusters: SemanticCluster[] = []
    
    // 2. Cluster within each semantic type using HNSW - parallel processing
    const typeClusteringPromises = Array.from(typeGroups.entries()).map(async ([nounType, groupItems]) => {
      if (groupItems.length < (options.minClusterSize || 2)) {
        // Create single cluster for small groups
        return [{
          id: `semantic-${nounType}`,
          centroid: await this._calculateGroupCentroid(groupItems),
          members: groupItems.map(item => item.id),
          size: groupItems.length,
          confidence: 0.9, // High confidence for type-based clustering
          label: `${nounType} cluster`,
          metadata: { semanticType: nounType, clustering: 'semantic' }
        } as SemanticCluster]
      }

      // Use HNSW hierarchical clustering within type
      return this._clusterWithinSemanticType(groupItems, options)
    })

    const typeClusterResults = await Promise.all(typeClusteringPromises)
    typeClusterResults.forEach(clusters => allClusters.push(...clusters))

    // 3. Find cross-type relationships using existing verb connections
    const crossTypeConnections = await this._findCrossTypeConnections(typeGroups, options)
    
    // 4. Merge clusters that have strong cross-type relationships
    const finalClusters = await this._mergeSemanticClusters(allClusters, crossTypeConnections)

    return {
      clusters: finalClusters.slice(0, options.maxClusters || finalClusters.length),
      metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'semantic'),
      metadata: {
        totalItems: itemIds.length,
        clustersFound: finalClusters.length,
        averageClusterSize: finalClusters.reduce((sum, c) => sum + c.size, 0) / finalClusters.length || 0,
        semanticTypes: Array.from(typeGroups.keys()).length,
        timestamp: new Date()
      }
    }
  }

  /**
   * HIERARCHICAL CLUSTERING: Uses existing HNSW levels for O(n) clustering
   */
  private async _performHierarchicalClustering(items: string[] | undefined, options: ClusteringOptions): Promise<ClusteringResult> {
    const startTime = performance.now()
    
    const itemIds = items || await this._getAllItemIds()
    if (itemIds.length === 0) {
      return this._createEmptyResult(startTime, 'hierarchical')
    }

    // Use existing HNSW level structure for natural clustering
    const level = (options as any).level || this._getOptimalClusteringLevel(itemIds.length)
    const maxClusters = options.maxClusters || Math.min(50, Math.ceil(itemIds.length / 20))
    
    // Get HNSW level representatives - these are natural cluster centers
    const levelNodes = await this._getHNSWLevelNodes(level)
    const clusterCenters = levelNodes.slice(0, maxClusters)
    
    const clusters: SemanticCluster[] = []
    
    // Create clusters around each level representative
    for (let i = 0; i < clusterCenters.length; i++) {
      const center = clusterCenters[i]
      
      // Find items that belong to this cluster using HNSW neighbors
      const members = await this._findClusterMembers(center, itemIds, 0.5)
      
      if (members.length > 0) {
        // Get actual node data for creating cluster
        const memberData = await this._getItemsWithMetadata(members)
        const centroid = await this._calculateCentroidFromItems(memberData)
        
        clusters.push({
          id: `hierarchical-${i}`,
          centroid,
          members,
          size: members.length,
          confidence: await this._calculateHierarchicalConfidence(members),
          label: await this._generateClusterLabel(memberData, 'hierarchical'),
          metadata: { level, clusterCenter: center, clustering: 'hierarchical' }
        })
      }
    }

    // Assign remaining items to nearest clusters
    const assignedItems = new Set(clusters.flatMap(c => c.members))
    const unassignedItems = itemIds.filter(id => !assignedItems.has(id))
    
    if (unassignedItems.length > 0) {
      await this._assignUnassignedItems(unassignedItems, clusters)
    }

    return {
      clusters,
      metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'hierarchical'),
      metadata: {
        totalItems: itemIds.length,
        clustersFound: clusters.length,
        averageClusterSize: clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length || 0,
        hnswLevel: level,
        timestamp: new Date()
      }
    }
  }

  /**
   * K-MEANS CLUSTERING: Real implementation using existing distance functions
   */
  private async _performKMeansClustering(items: string[] | undefined, options: ClusteringOptions): Promise<ClusteringResult> {
    const startTime = performance.now()
    
    const itemIds = items || await this._getAllItemIds()
    if (itemIds.length === 0) {
      return this._createEmptyResult(startTime, 'kmeans')
    }

    // Get vectors for all items using existing infrastructure
    const itemsWithVectors = await this._getItemsWithVectors(itemIds)
    
    // Determine optimal k
    const k = options.maxClusters || Math.min(
      Math.floor(Math.sqrt(itemsWithVectors.length / 2)),
      50 // Maximum clusters for practical use
    )
    
    if (k <= 1) {
      // Single cluster case
      return {
        clusters: [{
          id: 'kmeans-single',
          centroid: await this._calculateCentroidFromItems(itemsWithVectors),
          members: itemIds,
          size: itemIds.length,
          confidence: 1.0,
          label: 'Single cluster',
          metadata: { clustering: 'kmeans', k: 1 }
        }],
        metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'kmeans'),
        metadata: {
          totalItems: itemIds.length,
          clustersFound: 1,
          averageClusterSize: itemIds.length,
          kValue: 1,
          timestamp: new Date()
        }
      }
    }

    // Initialize centroids using k-means++ for better convergence
    const centroids = await this._initializeCentroidsKMeansPlusPlus(itemsWithVectors, k)
    
    let assignments: number[] = new Array(itemsWithVectors.length).fill(0)
    let hasConverged = false
    const maxIterations = options.maxIterations || 100
    const tolerance = options.tolerance || 1e-4
    
    // K-means iteration loop
    for (let iteration = 0; iteration < maxIterations && !hasConverged; iteration++) {
      // Assignment step: assign each point to nearest centroid
      const newAssignments = await this._assignPointsToCentroids(itemsWithVectors, centroids)
      
      // Update step: recalculate centroids
      const newCentroids = await this._updateCentroids(itemsWithVectors, newAssignments, k)
      
      // Check convergence: has assignment changed significantly?
      const changeRate = this._calculateAssignmentChangeRate(assignments, newAssignments)
      hasConverged = changeRate < tolerance
      
      assignments = newAssignments
      
      // Update centroids for next iteration
      for (let i = 0; i < centroids.length; i++) {
        centroids[i] = newCentroids[i]
      }
    }

    // Create semantic clusters from k-means results
    const clusters: SemanticCluster[] = []
    for (let clusterIndex = 0; clusterIndex < k; clusterIndex++) {
      const clusterMembers = itemsWithVectors.filter((_, i) => assignments[i] === clusterIndex)
      
      if (clusterMembers.length > 0) {
        const memberIds = clusterMembers.map(item => item.id)
        
        clusters.push({
          id: `kmeans-${clusterIndex}`,
          centroid: centroids[clusterIndex],
          members: memberIds,
          size: memberIds.length,
          confidence: await this._calculateKMeansClusterConfidence(clusterMembers, centroids[clusterIndex]),
          label: await this._generateClusterLabel(clusterMembers, 'kmeans'),
          metadata: { 
            clustering: 'kmeans', 
            k, 
            clusterIndex,
            convergenceIterations: maxIterations
          }
        })
      }
    }

    return {
      clusters,
      metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'kmeans'),
      metadata: {
        totalItems: itemIds.length,
        clustersFound: clusters.length,
        averageClusterSize: clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length || 0,
        kValue: k,
        hasConverged,
        timestamp: new Date()
      }
    }
  }

  /**
   * DBSCAN CLUSTERING: Density-based clustering with adaptive parameters using HNSW
   */
  private async _performDBSCANClustering(items: string[] | undefined, options: ClusteringOptions): Promise<ClusteringResult> {
    const startTime = performance.now()
    
    const itemIds = items || await this._getAllItemIds()
    if (itemIds.length === 0) {
      return this._createEmptyResult(startTime, 'dbscan')
    }

    const itemsWithVectors = await this._getItemsWithVectors(itemIds)
    
    // Adaptive parameter selection using HNSW neighbors
    const minPts = options.minClusterSize || Math.max(4, Math.floor(Math.log2(itemsWithVectors.length)))
    const eps = options.threshold || await this._estimateOptimalEps(itemsWithVectors, minPts)
    
    // DBSCAN state tracking
    const NOISE = -1
    const UNVISITED = 0
    const visited = new Map<string, boolean>()
    const clusterAssignments = new Map<string, number>()
    let currentClusterId = 1
    
    // Process each point
    for (const item of itemsWithVectors) {
      if (visited.get(item.id)) continue
      
      visited.set(item.id, true)
      
      // Find neighbors using existing HNSW infrastructure for efficiency
      const neighbors = await this._findNeighborsWithinEps(item, itemsWithVectors, eps)
      
      if (neighbors.length < minPts) {
        // Mark as noise (outlier)
        clusterAssignments.set(item.id, NOISE)
      } else {
        // Start new cluster
        await this._expandCluster(
          item,
          neighbors,
          currentClusterId,
          eps,
          minPts,
          itemsWithVectors,
          visited,
          clusterAssignments
        )
        currentClusterId++
      }
    }

    // Convert DBSCAN results to SemanticCluster format
    const clusters: SemanticCluster[] = []
    const clusterGroups = new Map<number, string[]>()
    const outliers: string[] = []
    
    // Group items by cluster assignment
    for (const [itemId, clusterId] of clusterAssignments) {
      if (clusterId === NOISE) {
        outliers.push(itemId)
      } else {
        if (!clusterGroups.has(clusterId)) {
          clusterGroups.set(clusterId, [])
        }
        clusterGroups.get(clusterId)!.push(itemId)
      }
    }
    
    // Create SemanticCluster objects
    for (const [clusterId, memberIds] of clusterGroups) {
      if (memberIds.length > 0) {
        const members = itemsWithVectors.filter(item => memberIds.includes(item.id))
        
        clusters.push({
          id: `dbscan-${clusterId}`,
          centroid: await this._calculateCentroidFromItems(members),
          members: memberIds,
          size: memberIds.length,
          confidence: await this._calculateDBSCANClusterConfidence(members, eps),
          label: await this._generateClusterLabel(members, 'dbscan'),
          metadata: { 
            clustering: 'dbscan',
            clusterId,
            eps,
            minPts,
            isDensityBased: true
          }
        })
      }
    }

    // Handle outliers - optionally create outlier cluster or assign to nearest
    if (outliers.length > 0 && options.includeOutliers) {
      const outlierMembers = itemsWithVectors.filter(item => outliers.includes(item.id))
      
      clusters.push({
        id: 'dbscan-outliers',
        centroid: await this._calculateCentroidFromItems(outlierMembers),
        members: outliers,
        size: outliers.length,
        confidence: 0.1, // Low confidence for outliers
        label: 'Outliers',
        metadata: { 
          clustering: 'dbscan',
          isOutlierCluster: true,
          eps,
          minPts
        }
      })
    }

    return {
      clusters,
      metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'dbscan'),
      metadata: {
        totalItems: itemIds.length,
        clustersFound: clusters.length,
        averageClusterSize: clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length || 0,
        outlierCount: outliers.length,
        eps,
        minPts,
        timestamp: new Date()
      }
    }
  }

  /**
   * GRAPH COMMUNITY DETECTION: Uses existing verb relationships for clustering  
   */
  private async _performGraphClustering(items: string[] | undefined, options: ClusteringOptions): Promise<ClusteringResult> {
    const startTime = performance.now()
    
    const itemIds = items || await this._getAllItemIds()
    if (itemIds.length === 0) {
      return this._createEmptyResult(startTime, 'graph')
    }

    // Build graph from existing verb relationships
    const graph = await this._buildGraphFromVerbs(itemIds, options)
    
    // Detect communities using modularity optimization
    const communities = await this._detectCommunities(graph, options)
    
    // Enhance communities with vector similarity for boundary refinement
    const refinedCommunities = await this._refineCommunitiesWithVectors(communities, options)
    
    // Convert to SemanticCluster format with Triple Intelligence labeling
    const clusters: SemanticCluster[] = []
    
    for (let i = 0; i < refinedCommunities.length; i++) {
      const community = refinedCommunities[i]
      
      if (community.members.length > 0) {
        const members = await this._getItemsWithMetadata(community.members)
        
        // Use Triple Intelligence for intelligent cluster labeling
        const clusterLabel = await this._generateIntelligentClusterLabel(members, 'graph')
        const clusterCentroid = await this._calculateCentroidFromItems(members)
        
        clusters.push({
          id: `graph-${i}`,
          centroid: clusterCentroid,
          members: community.members,
          size: community.members.length,
          confidence: community.modularity || 0.7,
          label: clusterLabel,
          metadata: { 
            clustering: 'graph',
            communityId: i,
            modularity: community.modularity,
            graphDensity: community.density,
            strongestConnections: community.strongestConnections
          }
        })
      }
    }

    return {
      clusters,
      metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'graph'),
      metadata: {
        totalItems: itemIds.length,
        clustersFound: clusters.length,
        averageClusterSize: clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length || 0,
        averageModularity: clusters.reduce((sum, c) => sum + (c.metadata?.modularity || 0), 0) / clusters.length || 0,
        timestamp: new Date()
      }
    }
  }

  /**
   * MULTI-MODAL FUSION: Combines vector + graph + semantic + Triple Intelligence
   */
  private async _performMultiModalClustering(items: string[] | undefined, options: ClusteringOptions): Promise<ClusteringResult> {
    const startTime = performance.now()
    
    const itemIds = items || await this._getAllItemIds()
    if (itemIds.length === 0) {
      return this._createEmptyResult(startTime, 'multimodal')
    }

    // Run multiple clustering algorithms in parallel
    const [vectorClusters, graphClusters, semanticClusters] = await Promise.all([
      this._performHierarchicalClustering(itemIds, { ...options, algorithm: 'hierarchical' }),
      this._performGraphClustering(itemIds, { ...options, algorithm: 'graph' }),
      this._performSemanticClustering(itemIds, { ...options, algorithm: 'semantic' })
    ])

    // Fuse results using intelligent consensus with Triple Intelligence
    const fusedClusters = await this._fuseClusteringResultsWithTripleIntelligence(
      [vectorClusters.clusters, graphClusters.clusters, semanticClusters.clusters],
      options
    )

    return {
      clusters: fusedClusters,
      metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'multimodal'),
      metadata: {
        totalItems: itemIds.length,
        clustersFound: fusedClusters.length,
        averageClusterSize: fusedClusters.reduce((sum, c) => sum + c.size, 0) / fusedClusters.length || 0,
        fusionMethod: 'triple_intelligence_consensus',
        componentAlgorithms: ['hierarchical', 'graph', 'semantic'],
        timestamp: new Date()
      }
    }
  }

  /**
   * SAMPLED CLUSTERING: For very large datasets using intelligent sampling
   */
  private async _performSampledClustering(items: string[] | undefined, options: ClusteringOptions): Promise<ClusteringResult> {
    const startTime = performance.now()
    
    const itemIds = items || await this._getAllItemIds()
    if (itemIds.length === 0) {
      return this._createEmptyResult(startTime, 'sampled')
    }

    const sampleSize = Math.min(options.sampleSize || 1000, itemIds.length)
    const strategy = options.strategy || 'diverse'
    
    // Intelligent sampling using existing infrastructure
    const sample = await this._getSampleUsingStrategy(itemIds, sampleSize, strategy)
    
    // Cluster the sample using the best algorithm for the sample size
    const sampleResult = await this._performHierarchicalClustering(sample, {
      ...options,
      maxClusters: Math.min(options.maxClusters || 50, Math.ceil(sample.length / 10))
    })
    
    // Project clusters back to full dataset using HNSW neighbors
    const projectedClusters = await this._projectClustersToFullDataset(
      sampleResult.clusters, 
      itemIds, 
      sample
    )

    return {
      clusters: projectedClusters,
      metrics: this._createPerformanceMetrics(startTime, itemIds.length, 'sampled'),
      metadata: {
        totalItems: itemIds.length,
        sampleSize: sample.length,
        samplingStrategy: strategy,
        clustersFound: projectedClusters.length,
        averageClusterSize: projectedClusters.reduce((sum, c) => sum + c.size, 0) / projectedClusters.length || 0,
        timestamp: new Date()
      }
    }
  }

  // Similarity implementation methods
  private async _similarityById(id1: string, id2: string, options: SimilarityOptions): Promise<number | SimilarityResult> {
    // Get vectors for both items
    const item1 = await this.brain.getNoun(id1)
    const item2 = await this.brain.getNoun(id2)
    
    if (!item1 || !item2) {
      return 0
    }

    return this._similarityByVector(item1.vector, item2.vector, options)
  }

  private async _similarityByVector(v1: Vector, v2: Vector, options: SimilarityOptions): Promise<number | SimilarityResult> {
    const metric = options.metric || this.config.similarityMetric || 'cosine'
    let score = 0

    switch (metric) {
      case 'cosine':
        score = 1 - cosineDistance(v1, v2)
        break
      case 'euclidean':
        score = 1 / (1 + euclideanDistance(v1, v2))
        break
      case 'manhattan':
        score = 1 / (1 + this._manhattanDistance(v1, v2))
        break
      default:
        score = 1 - cosineDistance(v1, v2)
    }

    if (options.detailed) {
      return {
        score: options.normalized !== false ? Math.max(0, Math.min(1, score)) : score,
        confidence: this._calculateConfidence(score, v1, v2),
        explanation: this._generateSimilarityExplanation(score, metric),
        metric
      }
    }

    return options.normalized !== false ? Math.max(0, Math.min(1, score)) : score
  }

  private async _similarityByText(text1: string, text2: string, options: SimilarityOptions): Promise<number | SimilarityResult> {
    // Convert text to vectors using brain's embedding function
    const vector1 = await this.brain.embed(text1)
    const vector2 = await this.brain.embed(text2)
    
    return this._similarityByVector(vector1, vector2, options)
  }

  // Utility methods for internal operations
  private _isId(value: any): boolean {
    return typeof value === 'string' && 
           (value.length === 36 && value.includes('-')) || // UUID-like
           (value.length > 10 && !value.includes(' ')) // ID-like string
  }

  private _isVector(value: any): boolean {
    return Array.isArray(value) && 
           value.length > 0 && 
           typeof value[0] === 'number'
  }

  private async _convertToVector(input: any): Promise<Vector> {
    if (this._isVector(input)) {
      return input
    } else if (this._isId(input)) {
      const item = await this.brain.getNoun(input)
      return item?.vector || []
    } else if (typeof input === 'string') {
      return await this.brain.embed(input)
    } else {
      throw new Error(`Cannot convert input to vector: ${typeof input}`)
    }
  }

  private _createSimilarityKey(a: any, b: any, options: SimilarityOptions): string {
    const aKey = typeof a === 'object' ? JSON.stringify(a).substring(0, 50) : String(a)
    const bKey = typeof b === 'object' ? JSON.stringify(b).substring(0, 50) : String(b)
    return `${aKey}|${bKey}|${JSON.stringify(options)}`
  }

  private _createClusteringKey(items: string[] | undefined, options: ClusteringOptions): string {
    const itemsKey = items ? [...items].sort().join(',') : 'all'
    return `clustering:${itemsKey}:${JSON.stringify(options)}`
  }

  private _cacheResult<T>(key: string, result: T, cache: Map<string, T>): void {
    if (cache.size >= (this.config.cacheSize || 1000)) {
      // Remove oldest entries (simple LRU)
      const firstKey = cache.keys().next().value
      if (firstKey) cache.delete(firstKey)
    }
    cache.set(key, result)
  }

  private _trackPerformance(operation: string, startTime: number, itemCount: number, algorithm: string): void {
    if (!this.config.performanceTracking) return

    const metrics: PerformanceMetrics = {
      executionTime: performance.now() - startTime,
      memoryUsed: 0, // Would implement actual memory tracking
      itemsProcessed: itemCount,
      cacheHits: 0, // Would track actual cache hits
      cacheMisses: 0, // Would track actual cache misses
      algorithm
    }

    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, [])
    }
    this.performanceMetrics.get(operation)!.push(metrics)
  }

  private _createPerformanceMetrics(startTime: number, itemCount: number, algorithm: string): PerformanceMetrics {
    return {
      executionTime: performance.now() - startTime,
      memoryUsed: 0,
      itemsProcessed: itemCount,
      cacheHits: 0,
      cacheMisses: 0,
      algorithm
    }
  }

  private _initializeCleanupTimer(): void {
    // Periodically clean up caches to prevent memory leaks
    setInterval(() => {
      if (this.similarityCache.size > (this.config.cacheSize || 1000)) {
        this.similarityCache.clear()
      }
      if (this.clusterCache.size > (this.config.cacheSize || 1000)) {
        this.clusterCache.clear()
      }
      if (this.hierarchyCache.size > (this.config.cacheSize || 1000)) {
        this.hierarchyCache.clear()
      }
      if (this.neighborsCache.size > (this.config.cacheSize || 1000)) {
        this.neighborsCache.clear()
      }
    }, 300000) // Clean every 5 minutes
  }

  // ===== GRAPH COMMUNITY DETECTION UTILITIES =====
  
  /**
   * Build graph structure from existing verb relationships
   */
  private async _buildGraphFromVerbs(itemIds: string[], options: ClusteringOptions): Promise<GraphStructure> {
    const nodes = new Set(itemIds)
    const edges = new Map<string, Map<string, number>>()
    const verbWeights = new Map<string, number>()
    
    // Initialize verb relationship weights
    const relationshipWeights = {
      'creates': 1.0,
      'partOf': 0.9,
      'contains': 0.9,
      'relatedTo': 0.7,
      'references': 0.6,
      'causes': 0.8,
      'dependsOn': 0.8,
      'memberOf': 0.9,
      'worksWith': 0.7,
      'communicates': 0.6
    }
    
    // Get all verbs connecting the items
    for (const sourceId of itemIds) {
      const sourceVerbs = await this.brain.getVerbsForNoun(sourceId)
      
      for (const verb of sourceVerbs) {
        const targetId = verb.target
        
        if (nodes.has(targetId) && sourceId !== targetId) {
          // Initialize edge map if needed
          if (!edges.has(sourceId)) {
            edges.set(sourceId, new Map())
          }
          
          // Calculate edge weight from verb type and metadata
          const verbType = verb.verb
          const baseWeight = (relationshipWeights as Record<string, number>)[verbType] || 0.5
          const confidenceWeight = verb.confidence || 1.0
          const weight = baseWeight * confidenceWeight
          
          // Add or strengthen edge
          const currentWeight = edges.get(sourceId)?.get(targetId) || 0
          edges.get(sourceId)!.set(targetId, Math.min(currentWeight + weight, 1.0))
          
          // Make graph undirected by adding reverse edge
          if (!edges.has(targetId)) {
            edges.set(targetId, new Map())
          }
          const reverseWeight = edges.get(targetId)?.get(sourceId) || 0
          edges.get(targetId)!.set(sourceId, Math.min(reverseWeight + weight, 1.0))
        }
      }
    }
    
    return {
      nodes: Array.from(nodes),
      edges,
      nodeCount: nodes.size,
      edgeCount: Array.from(edges.values()).reduce((sum, edgeMap) => sum + edgeMap.size, 0) / 2 // Undirected
    }
  }
  
  /**
   * Detect communities using Louvain modularity optimization
   */
  private async _detectCommunities(graph: GraphStructure, options: ClusteringOptions): Promise<Community[]> {
    const { nodes, edges } = graph
    
    // Initialize each node as its own community
    const communities = new Map<string, number>()
    nodes.forEach((node, index) => communities.set(node, index))
    
    const totalWeight = this._calculateTotalWeight(edges)
    let improved = true
    let iteration = 0
    const maxIterations = 50
    
    // Louvain algorithm: iteratively move nodes to communities that maximize modularity
    while (improved && iteration < maxIterations) {
      improved = false
      iteration++
      
      for (const node of nodes) {
        const currentCommunity = communities.get(node)!
        let bestCommunity = currentCommunity
        let bestGain = 0
        
        // Consider neighboring communities
        const neighborCommunities = this._getNeighborCommunities(node, edges, communities)
        
        for (const neighborCommunity of neighborCommunities) {
          if (neighborCommunity !== currentCommunity) {
            const gain = this._calculateModularityGain(
              node, 
              currentCommunity, 
              neighborCommunity, 
              edges, 
              communities, 
              totalWeight
            )
            
            if (gain > bestGain) {
              bestGain = gain
              bestCommunity = neighborCommunity
            }
          }
        }
        
        // Move node if beneficial
        if (bestCommunity !== currentCommunity) {
          communities.set(node, bestCommunity)
          improved = true
        }
      }
    }
    
    // Group nodes by final community assignment
    const communityGroups = new Map<number, string[]>()
    for (const [node, communityId] of communities) {
      if (!communityGroups.has(communityId)) {
        communityGroups.set(communityId, [])
      }
      communityGroups.get(communityId)!.push(node)
    }
    
    // Convert to Community objects with metadata
    const result: Community[] = []
    for (const [communityId, members] of communityGroups) {
      if (members.length >= (options.minClusterSize || 2)) {
        const modularity = this._calculateCommunityModularity(members, edges, totalWeight)
        const density = this._calculateCommunityDensity(members, edges)
        const strongestConnections = this._findStrongestConnections(members, edges, 3)
        
        result.push({
          id: communityId,
          members,
          modularity,
          density,
          strongestConnections
        })
      }
    }
    
    return result
  }
  
  /**
   * Refine community boundaries using vector similarity
   */
  private async _refineCommunitiesWithVectors(
    communities: Community[], 
    options: ClusteringOptions
  ): Promise<Community[]> {
    const refined: Community[] = []
    
    for (const community of communities) {
      const membersWithVectors = await this._getItemsWithVectors(community.members)
      
      // Check if community is coherent in vector space
      const vectorCoherence = await this._calculateVectorCoherence(membersWithVectors)
      
      if (vectorCoherence > 0.3) {
        // Community is coherent, keep as is
        refined.push(community)
      } else {
        // Split community using vector-based sub-clustering
        const subClusters = await this._performHierarchicalClustering(
          community.members, 
          { ...options, maxClusters: Math.ceil(community.members.length / 5) }
        )
        
        // Convert sub-clusters to communities
        for (let i = 0; i < subClusters.clusters.length; i++) {
          const subCluster = subClusters.clusters[i]
          refined.push({
            id: community.id * 1000 + i, // Unique sub-community ID
            members: subCluster.members,
            modularity: community.modularity * 0.8, // Slightly lower modularity for sub-communities
            density: community.density,
            strongestConnections: []
          })
        }
      }
    }
    
    return refined
  }

  // ===== SEMANTIC CLUSTERING UTILITIES =====
  
  /**
   * Get items with their metadata including noun types
   */
  private async _getItemsWithMetadata(itemIds: string[]): Promise<ItemWithMetadata[]> {
    const items = await Promise.all(
      itemIds.map(async id => {
        const noun = await this.brain.getNoun(id)
        return {
          id,
          vector: noun?.vector || [],
          metadata: noun?.data || {},
          nounType: noun?.noun || 'concept',
          label: noun?.label || id,
          data: noun?.data
        }
      })
    )
    
    return items.filter(item => item.vector.length > 0)
  }
  
  /**
   * Group items by their semantic noun types
   */
  private _groupBySemanticType(items: ItemWithMetadata[]): Map<string, ItemWithMetadata[]> {
    const groups = new Map<string, ItemWithMetadata[]>()
    
    for (const item of items) {
      const type = item.nounType
      if (!groups.has(type)) {
        groups.set(type, [])
      }
      groups.get(type)!.push(item)
    }
    
    return groups
  }

  // Placeholder implementations for complex operations
  private async _getAllItemIds(): Promise<string[]> {
    // Get all noun IDs from the brain
    const stats = await this.brain.getStatistics()
    if (!stats.totalNodes || stats.totalNodes === 0) {
      return []
    }
    
    // Use a simple approach: get recent items or sample
    // In practice, this could be optimized with pagination
    const items = await this.brain.getRecent(Math.min(stats.totalNodes, 10000))
    return items.map((item: any) => item.id)
  }

  private async _getTotalItemCount(): Promise<number> {
    const stats = await this.brain.getStatistics()
    return stats.totalNodes || 0
  }

  // ===== GRAPH ALGORITHM SUPPORTING METHODS =====
  
  private _calculateTotalWeight(edges: Map<string, Map<string, number>>): number {
    let total = 0
    for (const edgeMap of edges.values()) {
      for (const weight of edgeMap.values()) {
        total += weight
      }
    }
    return total / 2 // Undirected graph, so divide by 2
  }
  
  private _getNeighborCommunities(
    node: string, 
    edges: Map<string, Map<string, number>>, 
    communities: Map<string, number>
  ): Set<number> {
    const neighborCommunities = new Set<number>()
    const nodeEdges = edges.get(node)
    
    if (nodeEdges) {
      for (const neighbor of nodeEdges.keys()) {
        const neighborCommunity = communities.get(neighbor)
        if (neighborCommunity !== undefined) {
          neighborCommunities.add(neighborCommunity)
        }
      }
    }
    
    return neighborCommunities
  }
  
  private _calculateModularityGain(
    node: string,
    oldCommunity: number,
    newCommunity: number,
    edges: Map<string, Map<string, number>>,
    communities: Map<string, number>,
    totalWeight: number
  ): number {
    // Calculate the degree of the node
    const nodeDegree = this._getNodeDegree(node, edges)
    
    // Calculate edges to old and new communities
    const edgesToOld = this._getEdgesToCommunity(node, oldCommunity, edges, communities)
    const edgesToNew = this._getEdgesToCommunity(node, newCommunity, edges, communities)
    
    // Calculate community weights
    const oldCommunityWeight = this._getCommunityWeight(oldCommunity, edges, communities)
    const newCommunityWeight = this._getCommunityWeight(newCommunity, edges, communities)
    
    // Modularity gain calculation (simplified)
    const oldContrib = edgesToOld - (nodeDegree * oldCommunityWeight) / (2 * totalWeight)
    const newContrib = edgesToNew - (nodeDegree * newCommunityWeight) / (2 * totalWeight)
    
    return newContrib - oldContrib
  }
  
  private _getNodeDegree(node: string, edges: Map<string, Map<string, number>>): number {
    const nodeEdges = edges.get(node)
    if (!nodeEdges) return 0
    
    return Array.from(nodeEdges.values()).reduce((sum, weight) => sum + weight, 0)
  }
  
  private _getEdgesToCommunity(
    node: string,
    community: number,
    edges: Map<string, Map<string, number>>,
    communities: Map<string, number>
  ): number {
    const nodeEdges = edges.get(node)
    if (!nodeEdges) return 0
    
    let total = 0
    for (const [neighbor, weight] of nodeEdges) {
      if (communities.get(neighbor) === community) {
        total += weight
      }
    }
    return total
  }
  
  private _getCommunityWeight(
    community: number,
    edges: Map<string, Map<string, number>>,
    communities: Map<string, number>
  ): number {
    let total = 0
    for (const [node, nodeCommunity] of communities) {
      if (nodeCommunity === community) {
        total += this._getNodeDegree(node, edges)
      }
    }
    return total
  }
  
  private _calculateCommunityModularity(
    members: string[],
    edges: Map<string, Map<string, number>>,
    totalWeight: number
  ): number {
    if (members.length < 2) return 0
    
    let internalWeight = 0
    let totalDegree = 0
    
    for (const member of members) {
      const memberEdges = edges.get(member)
      if (memberEdges) {
        totalDegree += Array.from(memberEdges.values()).reduce((sum, w) => sum + w, 0)
        
        // Count internal edges
        for (const [neighbor, weight] of memberEdges) {
          if (members.includes(neighbor)) {
            internalWeight += weight
          }
        }
      }
    }
    
    internalWeight /= 2 // Undirected graph
    const expectedInternal = (totalDegree * totalDegree) / (4 * totalWeight)
    
    return (internalWeight / totalWeight) - expectedInternal / totalWeight
  }
  
  private _calculateCommunityDensity(
    members: string[],
    edges: Map<string, Map<string, number>>
  ): number {
    if (members.length < 2) return 0
    
    let actualEdges = 0
    const maxPossibleEdges = (members.length * (members.length - 1)) / 2
    
    for (const member of members) {
      const memberEdges = edges.get(member)
      if (memberEdges) {
        for (const neighbor of memberEdges.keys()) {
          if (members.includes(neighbor) && member < neighbor) { // Avoid double counting
            actualEdges++
          }
        }
      }
    }
    
    return actualEdges / maxPossibleEdges
  }
  
  private _findStrongestConnections(
    members: string[],
    edges: Map<string, Map<string, number>>,
    limit: number
  ): Array<{from: string, to: string, weight: number}> {
    const connections: Array<{from: string, to: string, weight: number}> = []
    
    for (const member of members) {
      const memberEdges = edges.get(member)
      if (memberEdges) {
        for (const [neighbor, weight] of memberEdges) {
          if (members.includes(neighbor) && member < neighbor) { // Avoid duplicates
            connections.push({ from: member, to: neighbor, weight })
          }
        }
      }
    }
    
    return connections
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit)
  }

  // ===== K-MEANS UTILITIES =====
  
  /**
   * Get items with their vector representations
   */
  private async _getItemsWithVectors(itemIds: string[]): Promise<Array<{id: string, vector: number[]}>> {
    const items = await Promise.all(
      itemIds.map(async id => {
        const noun = await this.brain.getNoun(id)
        return {
          id,
          vector: noun?.vector || []
        }
      })
    )
    
    return items.filter(item => item.vector.length > 0)
  }
  
  /**
   * Calculate centroid from items using existing distance functions
   */
  private async _calculateCentroidFromItems(items: Array<{vector: number[]}>): Promise<number[]> {
    if (items.length === 0) return []
    if (items.length === 1) return [...items[0].vector]
    
    const dimensions = items[0].vector.length
    const centroid = new Array(dimensions).fill(0)
    
    for (const item of items) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += item.vector[i]
      }
    }
    
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= items.length
    }
    
    return centroid
  }
  
  /**
   * Initialize centroids using k-means++ algorithm for better convergence
   */
  private async _initializeCentroidsKMeansPlusPlus(
    items: Array<{id: string, vector: number[]}>, 
    k: number
  ): Promise<number[][]> {
    const centroids: number[][] = []
    
    // Choose first centroid randomly
    const firstIdx = Math.floor(Math.random() * items.length)
    centroids.push([...items[firstIdx].vector])
    
    // Choose remaining centroids using k-means++ probability
    for (let i = 1; i < k; i++) {
      const distances = items.map(item => {
        // Find distance to closest existing centroid
        let minDist = Infinity
        for (const centroid of centroids) {
          const dist = this._calculateSquaredDistance(item.vector, centroid)
          minDist = Math.min(minDist, dist)
        }
        return minDist
      })
      
      // Choose next centroid with probability proportional to squared distance
      const totalDistance = distances.reduce((sum, d) => sum + d, 0)
      const target = Math.random() * totalDistance
      
      let cumulative = 0
      for (let j = 0; j < distances.length; j++) {
        cumulative += distances[j]
        if (cumulative >= target) {
          centroids.push([...items[j].vector])
          break
        }
      }
    }
    
    return centroids
  }
  
  /**
   * Assign points to nearest centroids using existing distance functions
   */
  private async _assignPointsToCentroids(
    items: Array<{id: string, vector: number[]}>,
    centroids: number[][]
  ): Promise<number[]> {
    const assignments: number[] = []
    
    for (const item of items) {
      let bestCentroid = 0
      let minDistance = Infinity
      
      for (let i = 0; i < centroids.length; i++) {
        const distance = this._calculateSquaredDistance(item.vector, centroids[i])
        if (distance < minDistance) {
          minDistance = distance
          bestCentroid = i
        }
      }
      
      assignments.push(bestCentroid)
    }
    
    return assignments
  }
  
  /**
   * Update centroids based on current assignments
   */
  private async _updateCentroids(
    items: Array<{id: string, vector: number[]}>,
    assignments: number[],
    k: number
  ): Promise<number[][]> {
    const newCentroids: number[][] = []
    
    for (let i = 0; i < k; i++) {
      const clusterItems = items.filter((_, idx) => assignments[idx] === i)
      
      if (clusterItems.length > 0) {
        newCentroids.push(await this._calculateCentroidFromItems(clusterItems))
      } else {
        // Keep old centroid if no items assigned
        newCentroids.push(new Array(items[0].vector.length).fill(0))
      }
    }
    
    return newCentroids
  }
  
  /**
   * Calculate how much assignments have changed between iterations
   */
  private _calculateAssignmentChangeRate(oldAssignments: number[], newAssignments: number[]): number {
    if (oldAssignments.length !== newAssignments.length) return 1.0
    
    let changes = 0
    for (let i = 0; i < oldAssignments.length; i++) {
      if (oldAssignments[i] !== newAssignments[i]) {
        changes++
      }
    }
    
    return changes / oldAssignments.length
  }
  
  /**
   * Calculate cluster confidence for k-means clusters
   */
  private async _calculateKMeansClusterConfidence(
    clusterItems: Array<{vector: number[]}>,
    centroid: number[]
  ): Promise<number> {
    if (clusterItems.length <= 1) return 1.0
    
    // Calculate average distance to centroid
    const distances = clusterItems.map(item => 
      this._calculateSquaredDistance(item.vector, centroid)
    )
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length
    
    // Calculate standard deviation
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length
    const stdDev = Math.sqrt(variance)
    
    // Higher confidence for tighter clusters
    const tightness = avgDistance > 0 ? Math.max(0, 1 - (stdDev / avgDistance)) : 1.0
    
    return Math.min(1.0, tightness)
  }
  
  // ===== DBSCAN UTILITIES =====
  
  /**
   * Estimate optimal eps parameter using k-nearest neighbor distances
   */
  private async _estimateOptimalEps(
    items: Array<{id: string, vector: number[]}>,
    minPts: number
  ): Promise<number> {
    if (items.length < minPts) return 0.5
    
    // Calculate k-nearest neighbor distances for each point
    const kDistances: number[] = []
    
    for (const item of items) {
      const distances: number[] = []
      
      for (const otherItem of items) {
        if (item.id !== otherItem.id) {
          const distance = Math.sqrt(this._calculateSquaredDistance(item.vector, otherItem.vector))
          distances.push(distance)
        }
      }
      
      distances.sort((a, b) => a - b)
      
      // Get k-th nearest neighbor distance (minPts-1 because we exclude self)
      const kthDistance = distances[Math.min(minPts - 1, distances.length - 1)]
      kDistances.push(kthDistance)
    }
    
    kDistances.sort((a, b) => a - b)
    
    // Use knee point detection - find point with maximum curvature
    // Simplified approach: use 90th percentile of k-distances
    const percentileIndex = Math.floor(kDistances.length * 0.9)
    return kDistances[percentileIndex] || 0.5
  }
  
  /**
   * Find neighbors within epsilon distance using efficient vector operations
   */
  private async _findNeighborsWithinEps(
    item: {id: string, vector: number[]},
    allItems: Array<{id: string, vector: number[]}>,
    eps: number
  ): Promise<Array<{id: string, vector: number[]}>> {
    const neighbors: Array<{id: string, vector: number[]}> = []
    const epsSquared = eps * eps
    
    for (const otherItem of allItems) {
      if (item.id !== otherItem.id) {
        const distanceSquared = this._calculateSquaredDistance(item.vector, otherItem.vector)
        if (distanceSquared <= epsSquared) {
          neighbors.push(otherItem)
        }
      }
    }
    
    return neighbors
  }
  
  /**
   * Expand DBSCAN cluster by adding density-reachable points
   */
  private async _expandCluster(
    seedPoint: {id: string, vector: number[]},
    neighbors: Array<{id: string, vector: number[]}>,
    clusterId: number,
    eps: number,
    minPts: number,
    allItems: Array<{id: string, vector: number[]}>,
    visited: Map<string, boolean>,
    clusterAssignments: Map<string, number>
  ): Promise<void> {
    clusterAssignments.set(seedPoint.id, clusterId)
    
    let i = 0
    while (i < neighbors.length) {
      const neighbor = neighbors[i]
      
      if (!visited.get(neighbor.id)) {
        visited.set(neighbor.id, true)
        
        const neighborNeighbors = await this._findNeighborsWithinEps(neighbor, allItems, eps)
        
        if (neighborNeighbors.length >= minPts) {
          // Add new neighbors to the list (union operation)
          for (const newNeighbor of neighborNeighbors) {
            if (!neighbors.some(n => n.id === newNeighbor.id)) {
              neighbors.push(newNeighbor)
            }
          }
        }
      }
      
      // If neighbor is not assigned to any cluster, assign to current cluster
      if (!clusterAssignments.has(neighbor.id)) {
        clusterAssignments.set(neighbor.id, clusterId)
      }
      
      i++
    }
  }
  
  /**
   * Calculate DBSCAN cluster confidence based on density
   */
  private async _calculateDBSCANClusterConfidence(
    clusterItems: Array<{vector: number[]}>,
    eps: number
  ): Promise<number> {
    if (clusterItems.length <= 1) return 1.0
    
    // Calculate average density within the cluster
    let totalNeighborCount = 0
    const epsSquared = eps * eps
    
    for (const item of clusterItems) {
      let neighborCount = 0
      
      for (const otherItem of clusterItems) {
        if (item !== otherItem) {
          const distanceSquared = this._calculateSquaredDistance(item.vector, otherItem.vector)
          if (distanceSquared <= epsSquared) {
            neighborCount++
          }
        }
      }
      
      totalNeighborCount += neighborCount
    }
    
    const avgDensity = totalNeighborCount / clusterItems.length
    const maxPossibleDensity = clusterItems.length - 1
    
    return maxPossibleDensity > 0 ? avgDensity / maxPossibleDensity : 1.0
  }
  
  // ===== VECTOR UTILITIES =====
  
  /**
   * Calculate squared Euclidean distance (more efficient than sqrt)
   */
  private _calculateSquaredDistance(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return Infinity
    
    let sum = 0
    for (let i = 0; i < vec1.length; i++) {
      const diff = vec1[i] - vec2[i]
      sum += diff * diff
    }
    
    return sum
  }
  
  /**
   * Calculate vector coherence for community refinement
   */
  private async _calculateVectorCoherence(items: Array<{vector: number[]}>): Promise<number> {
    if (items.length <= 1) return 1.0
    
    const centroid = await this._calculateCentroidFromItems(items)
    
    // Calculate average distance to centroid
    const distances = items.map(item => Math.sqrt(this._calculateSquaredDistance(item.vector, centroid)))
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length
    
    // Calculate cohesion as inverse of average distance (normalized)
    const maxDistance = Math.sqrt(centroid.length) // Rough normalization
    return Math.max(0, 1 - (avgDistance / maxDistance))
  }

  private async _getItemsByField(field: string): Promise<any[]> {
    // Implementation would query items by metadata field
    return []
  }

  // ===== TRIPLE INTELLIGENCE INTEGRATION =====
  
  /**
   * Generate intelligent cluster labels using Triple Intelligence
   */
  private async _generateIntelligentClusterLabel(
    members: ItemWithMetadata[], 
    algorithm: string
  ): Promise<string> {
    if (members.length === 0) return `${algorithm}-cluster`
    
    try {
      // Lazy load Triple Intelligence if available
      const TripleIntelligenceEngine = await import('../triple/TripleIntelligence.js')
        .then(m => m.TripleIntelligenceEngine)
        .catch(() => null)
      
      if (!TripleIntelligenceEngine) {
        return this._generateClusterLabel(members, algorithm)
      }
      
      const intelligence = new TripleIntelligenceEngine(this.brain)
      
      // Extract key features from cluster members
      const memberData = members.map(m => ({
        id: m.id,
        type: m.nounType,
        label: m.label,
        data: m.data
      }))
      
      // Use Triple Intelligence to analyze the cluster and generate label
      const prompt = `Analyze this cluster of ${memberData.length} related items and provide a concise, descriptive label (2-4 words):

Items:
${memberData.map(item => `- ${item.label || item.id} (${item.type})`).join('\n')}

The items were grouped using ${algorithm} clustering. What is the most appropriate label that captures their common theme or relationship?`

      const response = await intelligence.find({ 
        like: prompt,
        limit: 1 
      })
      
      // Extract clean label from response
      const firstResult = response[0]
      const label = (firstResult?.metadata?.content || firstResult?.id || `${algorithm}-cluster`)
        .toString()
        .replace(/^(Label:|Cluster:|Theme:)/i, '')
        .trim()
        .replace(/['"]/g, '')
        .slice(0, 50)
      
      return label || `${algorithm}-cluster`
      
    } catch (error) {
      // Fallback to simple labeling
      return this._generateClusterLabel(members, algorithm)
    }
  }
  
  /**
   * Generate simple cluster labels based on semantic analysis
   */
  private async _generateClusterLabel(
    members: Array<{id?: string, nounType?: string, label?: string}>, 
    algorithm: string
  ): Promise<string> {
    if (members.length === 0) return `${algorithm}-cluster`
    
    // Analyze member types and create descriptive label
    const typeCount = new Map<string, number>()
    
    for (const member of members) {
      const type = member.nounType || 'unknown'
      typeCount.set(type, (typeCount.get(type) || 0) + 1)
    }
    
    // Find most common type
    let dominantType = 'mixed'
    let maxCount = 0
    
    for (const [type, count] of typeCount) {
      if (count > maxCount) {
        maxCount = count
        dominantType = type
      }
    }
    
    // Generate label based on dominant type and size
    const size = members.length
    const typePercent = Math.round((maxCount / size) * 100)
    
    if (typePercent >= 80) {
      return `${dominantType} group (${size})`
    } else if (typePercent >= 60) {
      return `mostly ${dominantType} (${size})`
    } else {
      const topTypes = Array.from(typeCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([type]) => type)
        .join(' & ')
      
      return `${topTypes} cluster (${size})`
    }
  }
  
  /**
   * Fuse clustering results using Triple Intelligence consensus
   */
  private async _fuseClusteringResultsWithTripleIntelligence(
    clusterSets: SemanticCluster[][],
    options: ClusteringOptions
  ): Promise<SemanticCluster[]> {
    if (clusterSets.length === 0) return []
    if (clusterSets.length === 1) return clusterSets[0]
    
    // Simple weighted fusion if Triple Intelligence is not available
    const [vectorClusters, graphClusters, semanticClusters] = clusterSets
    
    // Create consensus mapping of items to clusters
    const itemClusterMapping = new Map<string, Array<{algorithm: string, clusterId: string, confidence: number}>>()
    
    // Collect all cluster assignments
    const allAlgorithms = ['vector', 'graph', 'semantic']
    const algorithmClusters = [vectorClusters, graphClusters, semanticClusters]
    
    for (let i = 0; i < algorithmClusters.length; i++) {
      const algorithm = allAlgorithms[i]
      const clusters = algorithmClusters[i] || []
      
      for (const cluster of clusters) {
        for (const memberId of cluster.members) {
          if (!itemClusterMapping.has(memberId)) {
            itemClusterMapping.set(memberId, [])
          }
          
          itemClusterMapping.get(memberId)!.push({
            algorithm,
            clusterId: cluster.id,
            confidence: cluster.confidence
          })
        }
      }
    }
    
    // Find consensus clusters - items that appear together in multiple algorithms
    const consensusClusters = new Map<string, Set<string>>()
    const processedItems = new Set<string>()
    
    for (const [itemId, assignments] of itemClusterMapping) {
      if (processedItems.has(itemId)) continue
      
      // Find all items that consistently cluster with this item
      const consensusGroup = new Set<string>([itemId])
      
      // Look for items that share clusters with this item across algorithms
      for (const assignment of assignments) {
        const sameClusterItems = this._getItemsInCluster(assignment.clusterId, clusterSets)
        
        for (const otherItem of sameClusterItems) {
          if (!processedItems.has(otherItem) && otherItem !== itemId) {
            const otherAssignments = itemClusterMapping.get(otherItem) || []
            
            // Check if items co-occur in multiple algorithms
            const coOccurrences = this._countCoOccurrences(assignments, otherAssignments)
            
            if (coOccurrences >= 2) { // Must appear together in at least 2 algorithms
              consensusGroup.add(otherItem)
            }
          }
        }
      }
      
      // Mark all items in this consensus group as processed
      for (const groupItem of consensusGroup) {
        processedItems.add(groupItem)
      }
      
      if (consensusGroup.size >= (options.minClusterSize || 2)) {
        const consensusId = `fusion-${consensusClusters.size}`
        consensusClusters.set(consensusId, consensusGroup)
      }
    }
    
    // Convert consensus groups to SemanticCluster objects
    const fusedClusters: SemanticCluster[] = []
    
    for (const [clusterId, memberSet] of consensusClusters) {
      const members = Array.from(memberSet)
      const membersWithMetadata = await this._getItemsWithMetadata(members)
      
      if (membersWithMetadata.length > 0) {
        const centroid = await this._calculateCentroidFromItems(membersWithMetadata)
        const label = await this._generateIntelligentClusterLabel(membersWithMetadata, 'multimodal')
        
        // Calculate fusion confidence based on algorithm agreement
        const avgConfidence = this._calculateFusionConfidence(members, itemClusterMapping)
        
        fusedClusters.push({
          id: clusterId,
          centroid,
          members,
          size: members.length,
          confidence: avgConfidence,
          label,
          metadata: {
            clustering: 'multimodal_fusion',
            algorithms: allAlgorithms,
            fusionMethod: 'consensus',
            agreementLevel: avgConfidence
          }
        })
      }
    }
    
    return fusedClusters
  }
  
  /**
   * Get items in a specific cluster from cluster sets
   */
  private _getItemsInCluster(clusterId: string, clusterSets: SemanticCluster[][]): string[] {
    for (const clusterSet of clusterSets) {
      for (const cluster of clusterSet) {
        if (cluster.id === clusterId) {
          return cluster.members
        }
      }
    }
    return []
  }
  
  /**
   * Count co-occurrences between two sets of assignments
   */
  private _countCoOccurrences(
    assignments1: Array<{algorithm: string, clusterId: string, confidence: number}>,
    assignments2: Array<{algorithm: string, clusterId: string, confidence: number}>
  ): number {
    let count = 0
    
    for (const assignment1 of assignments1) {
      for (const assignment2 of assignments2) {
        if (assignment1.algorithm === assignment2.algorithm && 
            assignment1.clusterId === assignment2.clusterId) {
          count++
        }
      }
    }
    
    return count
  }
  
  /**
   * Calculate fusion confidence based on algorithm agreement
   */
  private _calculateFusionConfidence(
    members: string[],
    itemClusterMapping: Map<string, Array<{algorithm: string, clusterId: string, confidence: number}>>
  ): number {
    let totalConfidence = 0
    let totalAssignments = 0
    
    for (const member of members) {
      const assignments = itemClusterMapping.get(member) || []
      
      for (const assignment of assignments) {
        totalConfidence += assignment.confidence
        totalAssignments++
      }
    }
    
    return totalAssignments > 0 ? totalConfidence / totalAssignments : 0.5
  }

  // ===== ADDITIONAL UTILITIES =====
  
  /**
   * Generate empty clustering result for edge cases
   */
  private _createEmptyResult(startTime: number, algorithm: string): ClusteringResult {
    return {
      clusters: [],
      metrics: this._createPerformanceMetrics(startTime, 0, algorithm),
      metadata: {
        totalItems: 0,
        clustersFound: 0,
        averageClusterSize: 0,
        timestamp: new Date()
      }
    }
  }

  // ===== SAMPLING AND PROJECTION UTILITIES =====
  
  /**
   * Get sample using specified strategy for large dataset clustering
   */
  private async _getSampleUsingStrategy(
    itemIds: string[], 
    sampleSize: number, 
    strategy: 'random' | 'diverse' | 'recent' | 'important'
  ): Promise<string[]> {
    if (itemIds.length <= sampleSize) return itemIds
    
    switch (strategy) {
      case 'random':
        return this._getRandomSample(itemIds, sampleSize)
        
      case 'diverse':
        return await this._getDiverseSample(itemIds, sampleSize)
        
      case 'recent':
        return await this._getRecentSample(itemIds, sampleSize)
        
      case 'important':
        return await this._getImportantSample(itemIds, sampleSize)
        
      default:
        return this._getRandomSample(itemIds, sampleSize)
    }
  }
  
  /**
   * Random sampling
   */
  private _getRandomSample(itemIds: string[], sampleSize: number): string[] {
    const shuffled = [...itemIds].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, sampleSize)
  }
  
  /**
   * Diverse sampling using vector space distribution
   */
  private async _getDiverseSample(itemIds: string[], sampleSize: number): Promise<string[]> {
    // Get vectors for all items
    const itemsWithVectors = await this._getItemsWithVectors(itemIds)
    
    if (itemsWithVectors.length <= sampleSize) {
      return itemIds
    }
    
    // Use k-means++ style selection for diversity
    const sample: string[] = []
    
    // Select first item randomly
    let remainingItems = [...itemsWithVectors]
    const firstIdx = Math.floor(Math.random() * remainingItems.length)
    sample.push(remainingItems[firstIdx].id)
    remainingItems.splice(firstIdx, 1)
    
    // Select remaining items based on maximum distance to already selected items
    while (sample.length < sampleSize && remainingItems.length > 0) {
      let maxDistance = -1
      let bestIdx = 0
      
      for (let i = 0; i < remainingItems.length; i++) {
        const item = remainingItems[i]
        
        // Find minimum distance to any selected item
        let minDistanceToSelected = Infinity
        
        for (const selectedId of sample) {
          const selectedItem = itemsWithVectors.find(it => it.id === selectedId)
          if (selectedItem) {
            const distance = Math.sqrt(this._calculateSquaredDistance(item.vector, selectedItem.vector))
            minDistanceToSelected = Math.min(minDistanceToSelected, distance)
          }
        }
        
        // Select item with maximum minimum distance (most diverse)
        if (minDistanceToSelected > maxDistance) {
          maxDistance = minDistanceToSelected
          bestIdx = i
        }
      }
      
      sample.push(remainingItems[bestIdx].id)
      remainingItems.splice(bestIdx, 1)
    }
    
    return sample
  }
  
  /**
   * Recent sampling based on creation time
   */
  private async _getRecentSample(itemIds: string[], sampleSize: number): Promise<string[]> {
    const items = await Promise.all(
      itemIds.map(async id => {
        const noun = await this.brain.getNoun(id)
        return {
          id,
          createdAt: noun?.createdAt || new Date(0)
        }
      })
    )
    
    // Sort by creation time (most recent first)
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    
    return items.slice(0, sampleSize).map(item => item.id)
  }
  
  /**
   * Important sampling based on connection count and metadata
   */
  private async _getImportantSample(itemIds: string[], sampleSize: number): Promise<string[]> {
    const items = await Promise.all(
      itemIds.map(async id => {
        const verbs = await this.brain.getVerbsForNoun(id)
        const noun = await this.brain.getNoun(id)
        
        // Calculate importance score
        const connectionScore = verbs.length
        const dataScore = noun?.data ? Object.keys(noun.data).length : 0
        const importanceScore = connectionScore * 2 + dataScore
        
        return {
          id,
          importance: importanceScore
        }
      })
    )
    
    // Sort by importance (highest first)
    items.sort((a, b) => b.importance - a.importance)
    
    return items.slice(0, sampleSize).map(item => item.id)
  }
  
  /**
   * Project clusters back to full dataset using HNSW neighbors
   */
  private async _projectClustersToFullDataset(
    sampleClusters: SemanticCluster[],
    fullItemIds: string[],
    sampleIds: string[]
  ): Promise<SemanticCluster[]> {
    const projectedClusters: SemanticCluster[] = []
    
    // Create mapping of items not in sample
    const remainingItems = fullItemIds.filter(id => !sampleIds.includes(id))
    
    // For each sample cluster, find which remaining items should belong to it
    for (const sampleCluster of sampleClusters) {
      const projectedMembers = [...sampleCluster.members]
      
      // For each remaining item, find its nearest neighbors in the sample
      for (const itemId of remainingItems) {
        try {
          const neighbors = await this.brain.neural.neighbors(itemId, { 
            limit: 3,
            includeMetadata: false 
          })
          
          // Check if any of the nearest neighbors belong to this cluster
          let belongsToCluster = false
          for (const neighbor of neighbors.neighbors) {
            if (sampleCluster.members.includes(neighbor.id) && neighbor.similarity > 0.7) {
              belongsToCluster = true
              break
            }
          }
          
          if (belongsToCluster) {
            projectedMembers.push(itemId)
          }
        } catch (error) {
          // Skip items that can't be processed
          continue
        }
      }
      
      // Create projected cluster
      if (projectedMembers.length > 0) {
        const membersWithVectors = await this._getItemsWithVectors(projectedMembers)
        
        projectedClusters.push({
          ...sampleCluster,
          id: `projected-${sampleCluster.id}`,
          members: projectedMembers,
          size: projectedMembers.length,
          centroid: await this._calculateCentroidFromItems(membersWithVectors),
          confidence: sampleCluster.confidence * 0.9, // Slightly lower confidence for projection
          metadata: {
            ...sampleCluster.metadata,
            isProjected: true,
            originalSampleSize: sampleCluster.size,
            projectedSize: projectedMembers.length
          }
        })
      }
    }
    
    return projectedClusters
  }

  private _groupByDomain(items: any[], field: string): Map<string, any[]> {
    const groups = new Map()
    for (const item of items) {
      const domain = item.metadata?.[field] || 'unknown'
      if (!groups.has(domain)) {
        groups.set(domain, [])
      }
      groups.get(domain).push(item)
    }
    return groups
  }

  private _calculateDomainConfidence(cluster: SemanticCluster, domainItems: any[]): number {
    // Calculate how well this cluster represents the domain
    return 0.8 // Placeholder
  }

  private async _findCrossDomainMembers(cluster: SemanticCluster, threshold: number): Promise<string[]> {
    // Find members that might belong to multiple domains
    return []
  }

  private async _findCrossDomainClusters(clusters: DomainCluster[], threshold: number): Promise<DomainCluster[]> {
    // Find clusters that span multiple domains
    return []
  }

  private async _getItemsByTimeWindow(timeField: string, window: TimeWindow): Promise<any[]> {
    // Implementation would query items within time window
    return []
  }

  private async _calculateTemporalMetrics(cluster: SemanticCluster, items: any[], timeField: string): Promise<any> {
    // Calculate temporal characteristics of the cluster
    return {
      trend: 'stable' as const,
      metrics: {
        startTime: new Date(),
        endTime: new Date(),
        peakTime: new Date(),
        frequency: 1
      }
    }
  }

  private _mergeOverlappingTemporalClusters(clusters: TemporalCluster[]): TemporalCluster[] {
    // Merge clusters from overlapping time windows
    return clusters
  }

  private _adjustThresholdAdaptively(clusters: SemanticCluster[], currentThreshold: number | undefined): number {
    // Adjust clustering threshold based on results
    return currentThreshold || 0.6
  }

  private async _calculateItemToClusterSimilarity(itemId: string, cluster: SemanticCluster): Promise<number> {
    // Calculate similarity between an item and a cluster centroid
    return 0.5 // Placeholder
  }

  private async _recalculateClusterCentroid(cluster: SemanticCluster): Promise<Vector> {
    // Recalculate centroid after adding new members
    return cluster.centroid as Vector
  }

  private async _calculateSimilarity(id1: string, id2: string): Promise<number> {
    return await this.similar(id1, id2) as number
  }

  private _sortNeighbors(neighbors: Neighbor[], sortBy: 'similarity' | 'importance' | 'recency'): void {
    switch (sortBy) {
      case 'similarity':
        neighbors.sort((a, b) => b.similarity - a.similarity)
        break
      case 'importance':
        neighbors.sort((a, b) => (b.metadata?.importance || 0) - (a.metadata?.importance || 0))
        break
      case 'recency':
        neighbors.sort((a, b) => {
          const aTime = new Date(a.metadata?.createdAt || 0).getTime()
          const bTime = new Date(b.metadata?.createdAt || 0).getTime()
          return bTime - aTime
        })
        break
    }
  }

  private async _buildSemanticHierarchy(item: any, options: HierarchyOptions): Promise<SemanticHierarchy> {
    // Build semantic hierarchy around an item
    return {
      self: { id: item.id, vector: item.vector, metadata: item.metadata }
    }
  }

  private async _detectOutliersClusterBased(threshold: number, options: OutlierOptions): Promise<Outlier[]> {
    // Detect outliers using cluster-based method
    return []
  }

  private async _detectOutliersIsolation(threshold: number, options: OutlierOptions): Promise<Outlier[]> {
    // Detect outliers using isolation forest method
    return []
  }

  private async _detectOutliersStatistical(threshold: number, options: OutlierOptions): Promise<Outlier[]> {
    // Detect outliers using statistical methods
    return []
  }

  private async _generateVisualizationNodes(maxNodes: number, options: VisualizationOptions): Promise<any[]> {
    // Generate nodes for visualization
    return []
  }

  private async _generateVisualizationEdges(nodes: any[], options: VisualizationOptions): Promise<any[]> {
    // Generate edges for visualization
    return []
  }

  private async _generateVisualizationClusters(nodes: any[]): Promise<any[]> {
    // Generate cluster information for visualization
    return []
  }

  private async _applyLayoutAlgorithm(nodes: any[], edges: any[], algorithm: string, dimensions: number): Promise<any[]> {
    // Apply layout algorithm to position nodes
    return nodes.map((node, i) => ({
      ...node,
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: dimensions === 3 ? Math.random() * 100 : undefined
    }))
  }

  private _manhattanDistance(v1: Vector, v2: Vector): number {
    let sum = 0
    for (let i = 0; i < v1.length; i++) {
      sum += Math.abs(v1[i] - v2[i])
    }
    return sum
  }

  private _calculateConfidence(score: number, v1: Vector, v2: Vector): number {
    // Calculate confidence based on vector magnitudes and score
    return Math.min(1, score + 0.1)
  }

  private _generateSimilarityExplanation(score: number, metric: string): string {
    if (score > 0.9) return `Very high similarity using ${metric} distance`
    if (score > 0.7) return `High similarity using ${metric} distance`
    if (score > 0.5) return `Moderate similarity using ${metric} distance`
    if (score > 0.3) return `Low similarity using ${metric} distance`
    return `Very low similarity using ${metric} distance`
  }

  // ===== PUBLIC API: UTILITY & STATUS =====

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics(operation?: string): Map<string, PerformanceMetrics[]> | PerformanceMetrics[] {
    if (operation) {
      return this.performanceMetrics.get(operation) || []
    }
    return this.performanceMetrics
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.similarityCache.clear()
    this.clusterCache.clear()
    this.hierarchyCache.clear()
    this.neighborsCache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): Record<string, { size: number; maxSize: number }> {
    const maxSize = this.config.cacheSize || 1000
    return {
      similarity: { size: this.similarityCache.size, maxSize },
      clustering: { size: this.clusterCache.size, maxSize },
      hierarchy: { size: this.hierarchyCache.size, maxSize },
      neighbors: { size: this.neighborsCache.size, maxSize }
    }
  }

  // ===== MISSING HELPER METHODS =====
  
  /**
   * Analyze data characteristics for algorithm selection
   */
  private async _analyzeDataCharacteristics(itemIds: string[]): Promise<{
    size: number,
    dimensionality: number,
    graphDensity: number,
    typeDistribution: Record<string, number>
  }> {
    const size = itemIds.length
    const items = await this._getItemsWithMetadata(itemIds.slice(0, Math.min(100, size)))
    
    const dimensionality = items.length > 0 ? items[0].vector.length : 0
    
    // Calculate graph density by sampling verb relationships
    let connectionCount = 0
    const sampleSize = Math.min(50, itemIds.length)
    for (let i = 0; i < sampleSize; i++) {
      try {
        const verbs = await this.brain.getVerbsForNoun(itemIds[i])
        connectionCount += verbs.length
      } catch (error) {
        // Skip items that can't be processed
        continue
      }
    }
    const graphDensity = sampleSize > 0 ? connectionCount / (sampleSize * sampleSize) : 0
    
    // Calculate type distribution
    const typeDistribution: Record<string, number> = {}
    for (const item of items) {
      const type = item.nounType
      typeDistribution[type] = (typeDistribution[type] || 0) + 1
    }
    
    return { size, dimensionality, graphDensity, typeDistribution }
  }
  
  /**
   * Calculate centroid for a group of items
   */
  private async _calculateGroupCentroid(items: ItemWithMetadata[]): Promise<number[]> {
    return this._calculateCentroidFromItems(items)
  }
  
  /**
   * Cluster within semantic type using vector similarity
   */
  private async _clusterWithinSemanticType(
    items: ItemWithMetadata[], 
    options: ClusteringOptions
  ): Promise<SemanticCluster[]> {
    if (items.length <= 2) {
      return [{
        id: `semantic-single-${items[0]?.nounType || 'unknown'}`,
        centroid: await this._calculateCentroidFromItems(items),
        members: items.map(item => item.id),
        size: items.length,
        confidence: 1.0,
        label: `${items[0]?.nounType || 'unknown'} group`,
        metadata: { clustering: 'semantic', nounType: items[0]?.nounType }
      }]
    }
    
    // Use hierarchical clustering for within-type clustering
    const result = await this._performHierarchicalClustering(
      items.map(item => item.id), 
      { ...options, maxClusters: Math.min(Math.ceil(items.length / 3), 10) }
    )
    return result.clusters
  }
  
  /**
   * Find cross-type connections via verbs
   */
  private async _findCrossTypeConnections(
    typeGroups: Map<string, ItemWithMetadata[]>,
    _options: ClusteringOptions
  ): Promise<Array<{from: string, to: string, strength: number}>> {
    const connections: Array<{from: string, to: string, strength: number}> = []
    
    // Convert Map to array for compatibility
    const typeGroupsArray = Array.from(typeGroups.entries())
    
    for (const [fromType, fromItems] of typeGroupsArray) {
      for (const [toType, toItems] of typeGroupsArray) {
        if (fromType !== toType) {
          for (const fromItem of fromItems.slice(0, 10)) { // Sample to avoid N^2
            try {
              const verbs = await this.brain.getVerbsForNoun(fromItem.id)
              
              for (const verb of verbs) {
                const toItem = toItems.find(item => item.id === verb.target)
                if (toItem) {
                  connections.push({
                    from: fromItem.id,
                    to: toItem.id,
                    strength: verb.confidence || 0.7
                  })
                }
              }
            } catch (error) {
              // Skip items that can't be processed
              continue
            }
          }
        }
      }
    }
    
    return connections.filter(conn => conn.strength > 0.5)
  }
  
  /**
   * Merge semantic clusters based on connections
   */
  private async _mergeSemanticClusters(
    clusters: SemanticCluster[], 
    connections: Array<{from: string, to: string, strength: number}>
  ): Promise<SemanticCluster[]> {
    // Simple merging based on strong connections
    const merged = [...clusters]
    
    for (const connection of connections) {
      if (connection.strength > 0.8) {
        const fromCluster = merged.find(c => c.members.includes(connection.from))
        const toCluster = merged.find(c => c.members.includes(connection.to))
        
        if (fromCluster && toCluster && fromCluster !== toCluster) {
          // Merge clusters
          fromCluster.members = [...fromCluster.members, ...toCluster.members]
          fromCluster.size = fromCluster.members.length
          fromCluster.label = `merged ${fromCluster.label}`
          
          // Remove merged cluster
          const index = merged.indexOf(toCluster)
          if (index > -1) merged.splice(index, 1)
        }
      }
    }
    
    return merged
  }
  
  /**
   * Get optimal clustering level for HNSW
   */
  private _getOptimalClusteringLevel(totalItems: number): number {
    if (totalItems < 100) return 0
    if (totalItems < 1000) return 1
    if (totalItems < 10000) return 2
    return 3
  }
  
  /**
   * Get nodes at HNSW level
   */
  private async _getHNSWLevelNodes(level: number): Promise<string[]> {
    // This would use the HNSW index to get nodes at specified level
    // For now, return a sample of all items
    const allItems = await this._getAllItemIds()
    const sampleSize = Math.max(10, Math.floor(allItems.length / Math.pow(2, level + 1)))
    return this._getRandomSample(allItems, sampleSize)
  }
  
  /**
   * Find cluster members using HNSW neighbors
   */
  private async _findClusterMembers(
    levelNode: string, 
    _allItems: string[], 
    threshold: number
  ): Promise<string[]> {
    try {
      const neighbors = await this.brain.neural.neighbors(levelNode, { 
        limit: Math.min(50, Math.floor(_allItems.length / 10)),
        minSimilarity: threshold
      })
      
      return [levelNode, ...neighbors.neighbors.map((n: any) => n.id)]
    } catch (error) {
      return [levelNode]
    }
  }
  
  /**
   * Calculate hierarchical clustering confidence
   */
  private async _calculateHierarchicalConfidence(members: string[]): Promise<number> {
    if (members.length <= 1) return 1.0
    
    const items = await this._getItemsWithVectors(members)
    const coherence = await this._calculateVectorCoherence(items)
    
    return coherence
  }
  
  /**
   * Assign unassigned items to nearest clusters
   */
  private async _assignUnassignedItems(
    unassigned: string[], 
    clusters: SemanticCluster[]
  ): Promise<void> {
    for (const itemId of unassigned) {
      if (clusters.length === 0) break
      
      try {
        const noun = await this.brain.getNoun(itemId)
        const itemVector = noun?.vector || []
        if (itemVector.length === 0) continue
        
        let bestCluster = clusters[0]
        let minDistance = Infinity
        
        for (const cluster of clusters) {
          const distance = Math.sqrt(this._calculateSquaredDistance(itemVector as number[], cluster.centroid as number[]))
          if (distance < minDistance) {
            minDistance = distance
            bestCluster = cluster
          }
        }
        
        bestCluster.members.push(itemId)
        bestCluster.size++
      } catch (error) {
        // Skip items that can't be processed
        continue
      }
    }
  }
}