import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrainyData } from '../src/index.js'
import { NeuralAPI } from '../src/neural/neuralAPI.js'

describe('Neural Clustering and Analysis', () => {
  let db: BrainyData | null = null
  let neural: NeuralAPI | null = null
  
  // Helper to create test vectors with semantic meaning
  const createTestVector = (seed: number = 0, category: 'tech' | 'food' | 'travel' = 'tech') => {
    const base = new Array(384).fill(0).map((_, i) => Math.sin(i + seed) * 0.5)
    // Add category-specific bias to create natural clusters
    const bias = category === 'tech' ? 0.1 : category === 'food' ? -0.1 : 0
    return base.map(v => v + bias)
  }
  
  beforeEach(async () => {
    db = new BrainyData()
    await db.init()
    neural = new NeuralAPI(db)
  })
  
  afterEach(async () => {
    if (db) {
      await db.cleanup?.()
      db = null
    }
    neural = null
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  })
  
  describe('Similarity Calculation', () => {
    beforeEach(async () => {
      // Add test data with different categories
      await db!.add(createTestVector(1, 'tech'), { id: 'tech1', data: 'JavaScript programming' })
      await db!.add(createTestVector(2, 'tech'), { id: 'tech2', data: 'Python development' })
      await db!.add(createTestVector(3, 'food'), { id: 'food1', data: 'Italian cuisine' })
      await db!.add(createTestVector(4, 'food'), { id: 'food2', data: 'French cooking' })
      await db!.add(createTestVector(5, 'travel'), { id: 'travel1', data: 'Paris vacation' })
    })
    
    it('should calculate similarity between IDs', async () => {
      const similarity = await neural!.similarity('tech1', 'tech2')
      
      expect(typeof similarity).toBe('number')
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
      
      // Tech items should be more similar to each other
      const crossCategorySim = await neural!.similarity('tech1', 'food1')
      expect(similarity).toBeGreaterThan(crossCategorySim)
    })
    
    it('should calculate similarity between text strings', async () => {
      const similarity = await neural!.similarity(
        'JavaScript programming',
        'TypeScript development'
      )
      
      expect(typeof similarity).toBe('number')
      expect(similarity).toBeGreaterThan(0.5) // Should be somewhat similar
    })
    
    it('should calculate similarity between vectors', async () => {
      const vector1 = createTestVector(10, 'tech')
      const vector2 = createTestVector(11, 'tech')
      
      const similarity = await neural!.similarity(vector1, vector2)
      
      expect(typeof similarity).toBe('number')
      expect(similarity).toBeGreaterThan(0.8) // Similar vectors
    })
    
    it('should return detailed similarity result when requested', async () => {
      const result = await neural!.similarity('tech1', 'tech2', { detailed: true })
      
      expect(typeof result).toBe('object')
      if (typeof result === 'object') {
        expect(result).toHaveProperty('score')
        expect(result).toHaveProperty('confidence')
        expect(result).toHaveProperty('explanation')
      }
    })
  })
  
  describe('Clustering Operations', () => {
    beforeEach(async () => {
      // Create natural clusters
      // Tech cluster
      for (let i = 0; i < 10; i++) {
        await db!.add(createTestVector(i, 'tech'), { 
          id: `tech${i}`, 
          data: `Tech item ${i}`,
          category: 'technology'
        })
      }
      
      // Food cluster
      for (let i = 0; i < 8; i++) {
        await db!.add(createTestVector(i + 100, 'food'), { 
          id: `food${i}`, 
          data: `Food item ${i}`,
          category: 'cuisine'
        })
      }
      
      // Travel cluster
      for (let i = 0; i < 6; i++) {
        await db!.add(createTestVector(i + 200, 'travel'), { 
          id: `travel${i}`, 
          data: `Travel item ${i}`,
          category: 'destination'
        })
      }
    })
    
    it('should find semantic clusters automatically', async () => {
      const clusters = await neural!.clusters()
      
      expect(Array.isArray(clusters)).toBe(true)
      expect(clusters.length).toBeGreaterThan(0)
      
      // Each cluster should have required properties
      for (const cluster of clusters) {
        expect(cluster).toHaveProperty('id')
        expect(cluster).toHaveProperty('centroid')
        expect(cluster).toHaveProperty('members')
        expect(Array.isArray(cluster.members)).toBe(true)
      }
    })
    
    it('should cluster specific items', async () => {
      const techItems = ['tech1', 'tech2', 'tech3', 'tech4']
      const clusters = await neural!.clusters(techItems)
      
      expect(Array.isArray(clusters)).toBe(true)
      
      // Should create cluster(s) from provided items
      const allMembers = clusters.flatMap(c => c.members)
      for (const item of techItems) {
        expect(allMembers).toContain(item)
      }
    })
    
    it('should find clusters near a specific item', async () => {
      const clusters = await neural!.clusters('tech1')
      
      expect(Array.isArray(clusters)).toBe(true)
      
      // Should find cluster containing tech1
      const techCluster = clusters.find(c => c.members.includes('tech1'))
      expect(techCluster).toBeDefined()
      
      // Tech cluster should contain other tech items
      if (techCluster) {
        expect(techCluster.members.some(m => m.startsWith('tech'))).toBe(true)
      }
    })
    
    it('should support fast hierarchical clustering', async () => {
      const clusters = await neural!.clusters({
        algorithm: 'hierarchical',
        maxClusters: 3
      })
      
      expect(Array.isArray(clusters)).toBe(true)
      expect(clusters.length).toBeLessThanOrEqual(3)
    })
    
    it('should handle large-scale clustering with sampling', async () => {
      // Add more items for large-scale test
      for (let i = 100; i < 200; i++) {
        await db!.add(createTestVector(i), { id: `item${i}` })
      }
      
      const clusters = await neural!.clusters({
        algorithm: 'sample',
        sampleSize: 50
      })
      
      expect(Array.isArray(clusters)).toBe(true)
      expect(clusters.length).toBeGreaterThan(0)
    })
  })
  
  describe('Semantic Neighbors', () => {
    beforeEach(async () => {
      // Create a semantic network
      await db!.add(createTestVector(1), { id: 'center', data: 'Center node' })
      
      // Close neighbors
      for (let i = 1; i <= 5; i++) {
        await db!.add(createTestVector(1.1 * i), { 
          id: `close${i}`, 
          data: `Close neighbor ${i}` 
        })
      }
      
      // Distant items
      for (let i = 1; i <= 3; i++) {
        await db!.add(createTestVector(100 * i), { 
          id: `far${i}`, 
          data: `Distant item ${i}` 
        })
      }
    })
    
    it('should find semantic neighbors', async () => {
      const neighbors = await neural!.neighbors('center', { limit: 5 })
      
      expect(Array.isArray(neighbors)).toBe(true)
      expect(neighbors.length).toBeLessThanOrEqual(5)
      
      // Should include close neighbors
      const neighborIds = neighbors.map(n => n.id)
      expect(neighborIds.some(id => id.startsWith('close'))).toBe(true)
      
      // Should not include distant items in top 5
      expect(neighborIds.some(id => id.startsWith('far'))).toBe(false)
    })
    
    it('should respect similarity radius', async () => {
      const neighbors = await neural!.neighbors('center', { 
        radius: 0.1, // Very tight radius
        limit: 10 
      })
      
      // Should only include very similar items
      for (const neighbor of neighbors) {
        expect(neighbor.similarity).toBeGreaterThan(0.9)
      }
    })
  })
  
  describe('Semantic Hierarchy', () => {
    beforeEach(async () => {
      // Create hierarchical structure
      await db!.add(createTestVector(1), { id: 'root', data: 'Root concept' })
      await db!.add(createTestVector(2), { id: 'child1', data: 'Child 1' })
      await db!.add(createTestVector(3), { id: 'child2', data: 'Child 2' })
      await db!.add(createTestVector(4), { id: 'grandchild1', data: 'Grandchild 1' })
    })
    
    it('should build semantic hierarchy', async () => {
      const hierarchy = await neural!.hierarchy('grandchild1')
      
      expect(hierarchy).toHaveProperty('self')
      expect(hierarchy.self.id).toBe('grandchild1')
      
      // Should have parent and potentially grandparent
      if (hierarchy.parent) {
        expect(hierarchy.parent).toHaveProperty('id')
        expect(hierarchy.parent).toHaveProperty('similarity')
      }
    })
    
    it('should find semantic siblings', async () => {
      const hierarchy = await neural!.hierarchy('child1')
      
      if (hierarchy.siblings) {
        expect(Array.isArray(hierarchy.siblings)).toBe(true)
        // child2 should be a sibling
        const sibling = hierarchy.siblings.find(s => s.id === 'child2')
        expect(sibling).toBeDefined()
      }
    })
  })
  
  describe('Visualization', () => {
    beforeEach(async () => {
      // Add interconnected data
      for (let i = 0; i < 20; i++) {
        await db!.add(createTestVector(i), { 
          id: `node${i}`, 
          data: `Node ${i}` 
        })
      }
    })
    
    it('should generate visualization data', async () => {
      const viz = await neural!.visualize({ maxNodes: 10 })
      
      expect(viz).toHaveProperty('nodes')
      expect(viz).toHaveProperty('edges')
      
      expect(Array.isArray(viz.nodes)).toBe(true)
      expect(Array.isArray(viz.edges)).toBe(true)
      
      // Should respect maxNodes
      expect(viz.nodes.length).toBeLessThanOrEqual(10)
      
      // Each node should have required properties
      for (const node of viz.nodes) {
        expect(node).toHaveProperty('id')
        expect(node).toHaveProperty('x')
        expect(node).toHaveProperty('y')
      }
      
      // Each edge should connect existing nodes
      for (const edge of viz.edges) {
        expect(edge).toHaveProperty('source')
        expect(edge).toHaveProperty('target')
        expect(edge).toHaveProperty('weight')
        
        const sourceExists = viz.nodes.some(n => n.id === edge.source)
        const targetExists = viz.nodes.some(n => n.id === edge.target)
        expect(sourceExists).toBe(true)
        expect(targetExists).toBe(true)
      }
    })
    
    it('should support 3D visualization', async () => {
      const viz = await neural!.visualize({ 
        maxNodes: 10,
        dimensions: 3 
      })
      
      // Nodes should have z coordinate for 3D
      for (const node of viz.nodes) {
        expect(node).toHaveProperty('z')
      }
    })
  })
  
  describe('Performance and Caching', () => {
    it('should cache similarity calculations', async () => {
      await db!.add(createTestVector(1), { id: 'item1' })
      await db!.add(createTestVector(2), { id: 'item2' })
      
      // First calculation
      const start1 = performance.now()
      const sim1 = await neural!.similarity('item1', 'item2')
      const time1 = performance.now() - start1
      
      // Second calculation (should be cached)
      const start2 = performance.now()
      const sim2 = await neural!.similarity('item1', 'item2')
      const time2 = performance.now() - start2
      
      expect(sim1).toBe(sim2)
      expect(time2).toBeLessThan(time1 * 0.5) // Cached should be much faster
    })
    
    it('should cache cluster results', async () => {
      // Add test data
      for (let i = 0; i < 50; i++) {
        await db!.add(createTestVector(i), { id: `item${i}` })
      }
      
      // First clustering
      const start1 = performance.now()
      const clusters1 = await neural!.clusters()
      const time1 = performance.now() - start1
      
      // Second clustering (should be cached)
      const start2 = performance.now()
      const clusters2 = await neural!.clusters()
      const time2 = performance.now() - start2
      
      expect(clusters1.length).toBe(clusters2.length)
      expect(time2).toBeLessThan(time1 * 0.5) // Cached should be much faster
    })
  })
  
  describe('Error Handling', () => {
    it('should handle invalid IDs gracefully', async () => {
      const similarity = await neural!.similarity('nonexistent1', 'nonexistent2')
      expect(similarity).toBe(0) // Should return 0 for non-existent items
    })
    
    it('should handle empty clustering gracefully', async () => {
      const emptyNeural = new NeuralAPI(db!)
      const clusters = await emptyNeural.clusters()
      
      expect(Array.isArray(clusters)).toBe(true)
      expect(clusters.length).toBe(0)
    })
    
    it('should handle invalid clustering input', async () => {
      await expect(
        neural!.clusters(123 as any) // Invalid input type
      ).rejects.toThrow('Invalid input for clustering')
    })
  })
})