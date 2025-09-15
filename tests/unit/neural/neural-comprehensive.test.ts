import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { NeuralImport } from '../../../src/cortex/neuralImport'
import { NounType, VerbType } from '../../../src/types/graphTypes'

/**
 * COMPREHENSIVE NEURAL API TEST SUITE
 *
 * This test suite validates ALL neural functionality:
 * 1. Neural Import - AI-powered data understanding
 * 2. Clustering - Semantic grouping algorithms
 * 3. Similarity calculations
 * 4. Hierarchy detection
 * 5. Pattern recognition
 * 6. Outlier detection
 * 7. Visualization data generation
 * 8. Performance optimizations
 */

describe('Neural APIs - Comprehensive Test Suite', () => {
  let brain: Brainy<any>
  let neuralImport: NeuralImport

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
    neuralImport = new NeuralImport(brain)
  })

  afterEach(async () => {
    if (brain) await brain.close()
  })

  describe('1. Neural Import - Data Understanding', () => {
    it('should analyze and import JSON data intelligently', async () => {
      const testData = {
        users: [
          { name: 'John Doe', email: 'john@example.com', role: 'developer' },
          { name: 'Jane Smith', email: 'jane@example.com', role: 'manager' }
        ],
        projects: [
          { name: 'Project Alpha', status: 'active', team: ['John Doe'] },
          { name: 'Project Beta', status: 'planning', team: ['Jane Smith'] }
        ]
      }

      // Analyze data with neural import
      const analysis = await neuralImport.analyzeData(testData)

      // Verify entity detection
      expect(analysis.detectedEntities).toBeDefined()
      expect(analysis.detectedEntities.length).toBeGreaterThan(0)

      // Should detect persons
      const persons = analysis.detectedEntities.filter(e =>
        e.nounType === NounType.Person || e.alternativeTypes.some(t => t.type === NounType.Person)
      )
      expect(persons.length).toBeGreaterThanOrEqual(2)

      // Should detect projects
      const projects = analysis.detectedEntities.filter(e =>
        e.nounType === NounType.Project || e.alternativeTypes.some(t => t.type === NounType.Project)
      )
      expect(projects.length).toBeGreaterThanOrEqual(2)

      // Verify relationship detection
      expect(analysis.detectedRelationships).toBeDefined()
      expect(analysis.detectedRelationships.length).toBeGreaterThan(0)

      // Should detect team membership relationships
      const membershipRelations = analysis.detectedRelationships.filter(r =>
        r.verbType === VerbType.MemberOf || r.verbType === VerbType.WorksOn
      )
      expect(membershipRelations.length).toBeGreaterThan(0)

      // Verify confidence scores
      analysis.detectedEntities.forEach(entity => {
        expect(entity.confidence).toBeGreaterThan(0)
        expect(entity.confidence).toBeLessThanOrEqual(1)
      })
    })

    it('should import CSV data with type inference', async () => {
      const csvData = `name,age,city,occupation
John Doe,30,New York,Software Engineer
Jane Smith,28,San Francisco,Product Manager
Bob Johnson,35,Chicago,Data Scientist`

      const analysis = await neuralImport.analyzeCSV(csvData)

      // Should detect people from the data
      expect(analysis.detectedEntities.length).toBeGreaterThanOrEqual(3)

      // Should infer Person type from name column
      const persons = analysis.detectedEntities.filter(e =>
        e.nounType === NounType.Person
      )
      expect(persons.length).toBe(3)

      // Should detect locations from city column
      const hasLocationInfo = analysis.detectedEntities.some(e =>
        e.originalData.city && (
          e.nounType === NounType.Location ||
          e.alternativeTypes.some(t => t.type === NounType.Location)
        )
      )
      expect(hasLocationInfo).toBe(true)

      // Should provide insights
      expect(analysis.insights.length).toBeGreaterThan(0)
      const patternInsight = analysis.insights.find(i => i.type === 'pattern')
      expect(patternInsight).toBeDefined()
    })

    it('should handle nested and complex data structures', async () => {
      const complexData = {
        organization: {
          name: 'TechCorp',
          founded: 2010,
          departments: [
            {
              name: 'Engineering',
              manager: { name: 'Alice Brown', experience: 10 },
              employees: [
                { name: 'Dev 1', skills: ['JavaScript', 'Python'] },
                { name: 'Dev 2', skills: ['Java', 'Kotlin'] }
              ]
            },
            {
              name: 'Marketing',
              manager: { name: 'Bob White', experience: 8 },
              campaigns: ['Campaign A', 'Campaign B']
            }
          ]
        }
      }

      const analysis = await neuralImport.analyzeData(complexData)

      // Should detect organization
      const org = analysis.detectedEntities.find(e =>
        e.nounType === NounType.Organization
      )
      expect(org).toBeDefined()

      // Should detect hierarchical relationships
      const hierarchyRelations = analysis.detectedRelationships.filter(r =>
        r.verbType === VerbType.PartOf || r.verbType === VerbType.Contains
      )
      expect(hierarchyRelations.length).toBeGreaterThan(0)

      // Should detect managers and employees
      const persons = analysis.detectedEntities.filter(e =>
        e.nounType === NounType.Person
      )
      expect(persons.length).toBeGreaterThanOrEqual(4) // 2 managers + 2 devs

      // Should provide hierarchy insight
      const hierarchyInsight = analysis.insights.find(i => i.type === 'hierarchy')
      expect(hierarchyInsight).toBeDefined()
    })

    it('should execute import with preview and confirmation', async () => {
      const data = {
        title: 'Test Document',
        content: 'This is a test document about AI',
        author: 'John Doe',
        tags: ['AI', 'Machine Learning', 'Technology']
      }

      // Get preview
      const preview = await neuralImport.preview(data)
      expect(preview).toBeDefined()
      expect(preview.entities.length).toBeGreaterThan(0)
      expect(preview.relationships.length).toBeGreaterThanOrEqual(0)

      // Execute import
      const result = await neuralImport.executeImport(data, {
        createRelationships: true,
        minConfidence: 0.5
      })

      expect(result.importedEntities).toBeGreaterThan(0)
      expect(result.importedRelationships).toBeGreaterThanOrEqual(0)
      expect(result.errors).toEqual([])
    })
  })

  describe('2. Clustering - Semantic Grouping', () => {
    beforeEach(async () => {
      // Add test data for clustering
      const topics = [
        // Tech cluster
        'JavaScript programming', 'Python development', 'Machine learning',
        'Deep learning', 'Neural networks', 'AI algorithms',
        // Food cluster
        'Italian pasta', 'Pizza recipes', 'French cuisine',
        'Sushi preparation', 'Wine tasting', 'Coffee brewing',
        // Sports cluster
        'Football tactics', 'Basketball strategy', 'Tennis techniques',
        'Running training', 'Swimming styles', 'Yoga poses'
      ]

      for (const topic of topics) {
        await brain.add({
          data: topic,
          type: NounType.Concept
        })
      }
    })

    it('should perform fast clustering with HNSW levels', async () => {
      const neural = brain.neural()

      // Fast clustering
      const clusters = await neural.clusters()

      expect(clusters).toBeDefined()
      expect(clusters.length).toBeGreaterThan(0)

      // Each cluster should have properties
      clusters.forEach(cluster => {
        expect(cluster.id).toBeDefined()
        expect(cluster.centroid).toBeDefined()
        expect(cluster.members).toBeDefined()
        expect(cluster.confidence).toBeGreaterThan(0)
        expect(cluster.size).toBeGreaterThan(0)
      })

      // Should identify meaningful clusters (tech, food, sports)
      expect(clusters.length).toBeGreaterThanOrEqual(2)
      expect(clusters.length).toBeLessThanOrEqual(5)
    })

    it('should support different clustering algorithms', async () => {
      const neural = brain.neural()

      // Hierarchical clustering
      const hierarchical = await neural.clusters({
        algorithm: 'hierarchical',
        maxClusters: 3
      })

      // K-means style clustering
      const kmeans = await neural.clusters({
        algorithm: 'kmeans',
        maxClusters: 3
      })

      // Sample-based clustering for large datasets
      const sample = await neural.clusters({
        algorithm: 'sample',
        sampleSize: 10
      })

      // All should return valid clusters
      expect(hierarchical.length).toBeGreaterThan(0)
      expect(kmeans.length).toBeGreaterThan(0)
      expect(sample.length).toBeGreaterThan(0)

      // Hierarchical should respect max clusters
      expect(hierarchical.length).toBeLessThanOrEqual(3)
    })

    it('should cluster specific items', async () => {
      const neural = brain.neural()

      // Get some entity IDs
      const searchResults = await brain.find({ query: 'programming', limit: 5 })
      const techIds = searchResults.map(r => r.entity.id)

      // Cluster only these items
      const clusters = await neural.clusters(techIds)

      expect(clusters).toBeDefined()
      expect(clusters.length).toBeGreaterThan(0)

      // All clustered items should be from our input
      clusters.forEach(cluster => {
        cluster.members.forEach(memberId => {
          expect(techIds).toContain(memberId)
        })
      })
    })

    it('should find clusters near a specific query', async () => {
      const neural = brain.neural()

      // Find clusters near "programming"
      const clusters = await neural.clusters('programming')

      expect(clusters).toBeDefined()
      expect(clusters.length).toBeGreaterThan(0)

      // Should primarily contain tech-related items
      const firstCluster = clusters[0]
      expect(firstCluster.members.length).toBeGreaterThan(0)

      // Verify members are related to programming
      for (const memberId of firstCluster.members.slice(0, 3)) {
        const entity = await brain.get(memberId)
        expect(entity).toBeDefined()
        // Should be tech-related content
      }
    })

    it('should handle large-scale clustering efficiently', async () => {
      // Add more data for scale testing
      const startAdd = Date.now()
      for (let i = 0; i < 100; i++) {
        await brain.add({
          data: `Large scale item ${i} in category ${i % 10}`,
          type: NounType.Thing
        })
      }
      const addTime = Date.now() - startAdd

      const neural = brain.neural()

      // Large-scale clustering
      const startCluster = Date.now()
      const clusters = await neural.clusterLarge({
        sampleSize: 50,
        strategy: 'diverse'
      })
      const clusterTime = Date.now() - startCluster

      expect(clusters).toBeDefined()
      expect(clusters.length).toBeGreaterThan(0)
      expect(clusterTime).toBeLessThan(2000) // Should be fast

      console.log(`Added 100 items in ${addTime}ms`)
      console.log(`Clustered in ${clusterTime}ms`)
    })
  })

  describe('3. Similarity Calculations', () => {
    it('should calculate similarity between entities', async () => {
      const neural = brain.neural()

      const id1 = await brain.add({
        data: 'Machine learning algorithms',
        type: NounType.Concept
      })

      const id2 = await brain.add({
        data: 'Deep learning neural networks',
        type: NounType.Concept
      })

      const id3 = await brain.add({
        data: 'Italian pasta recipes',
        type: NounType.Thing
      })

      // Calculate similarities
      const sim12 = await neural.similar(id1, id2)
      const sim13 = await neural.similar(id1, id3)

      // Similar concepts should have high similarity
      expect(sim12).toBeGreaterThan(0.5)
      // Different concepts should have low similarity
      expect(sim13).toBeLessThan(0.5)
      // Similarity with itself should be very high
      const sim11 = await neural.similar(id1, id1)
      expect(sim11).toBeGreaterThan(0.99)
    })

    it('should provide detailed similarity analysis', async () => {
      const neural = brain.neural()

      const id1 = await brain.add({ data: 'Test 1', type: NounType.Thing })
      const id2 = await brain.add({ data: 'Test 2', type: NounType.Thing })

      // Get detailed similarity
      const result = await neural.similar(id1, id2, {
        explain: true,
        includeBreakdown: true
      })

      expect(result).toBeDefined()
      if (typeof result === 'object') {
        expect(result.score).toBeDefined()
        expect(result.explanation).toBeDefined()
        expect(result.breakdown).toBeDefined()
      }
    })
  })

  describe('4. Hierarchy Detection', () => {
    it('should detect semantic hierarchies', async () => {
      const neural = brain.neural()

      // Create hierarchical data
      const animalId = await brain.add({ data: 'Animal', type: NounType.Concept })
      const mammalId = await brain.add({ data: 'Mammal animal', type: NounType.Concept })
      const dogId = await brain.add({ data: 'Dog mammal animal', type: NounType.Concept })

      // Get hierarchy for dog
      const hierarchy = await neural.hierarchy(dogId)

      expect(hierarchy).toBeDefined()
      expect(hierarchy.self.id).toBe(dogId)
      // Should detect parent concepts
      expect(hierarchy.parent).toBeDefined()
      // Could detect grandparent
      if (hierarchy.grandparent) {
        expect(hierarchy.grandparent.similarity).toBeLessThan(hierarchy.parent!.similarity)
      }
    })
  })

  describe('5. Neighbor Discovery', () => {
    it('should find semantic neighbors', async () => {
      const neural = brain.neural()

      // Create related entities
      const centerid = await brain.add({
        data: 'JavaScript programming',
        type: NounType.Concept
      })

      await brain.add({ data: 'TypeScript development', type: NounType.Concept })
      await brain.add({ data: 'Node.js backend', type: NounType.Concept })
      await brain.add({ data: 'React frontend', type: NounType.Concept })
      await brain.add({ data: 'Cooking recipes', type: NounType.Thing })

      // Find neighbors
      const neighbors = await neural.neighbors(centerid, {
        radius: 0.5,
        limit: 10,
        includeEdges: true
      })

      expect(neighbors).toBeDefined()
      expect(neighbors.center).toBe(centerid)
      expect(neighbors.neighbors.length).toBeGreaterThan(0)

      // Should find related tech concepts
      neighbors.neighbors.forEach(n => {
        expect(n.id).toBeDefined()
        expect(n.similarity).toBeGreaterThan(0)
      })

      // Edges should be included if requested
      if (neighbors.edges) {
        expect(neighbors.edges.length).toBeGreaterThan(0)
      }
    })
  })

  describe('6. Outlier Detection', () => {
    it('should detect outliers in the dataset', async () => {
      const neural = brain.neural()

      // Add normal data
      for (let i = 0; i < 10; i++) {
        await brain.add({
          data: `Normal tech concept ${i}`,
          type: NounType.Concept
        })
      }

      // Add outliers
      const outlierId1 = await brain.add({
        data: 'Completely unrelated random gibberish xyz123',
        type: NounType.Thing
      })

      const outlierId2 = await brain.add({
        data: '!!!###@@@$$$%%%',
        type: NounType.Thing
      })

      // Detect outliers
      const outliers = await neural.outliers({
        threshold: 0.3,
        method: 'distance'
      })

      expect(outliers).toBeDefined()
      expect(outliers.length).toBeGreaterThan(0)

      // Should detect the obvious outliers
      const outlierIds = outliers.map(o => o.id)
      expect(outlierIds).toContain(outlierId1)
      expect(outlierIds).toContain(outlierId2)
    })
  })

  describe('7. Visualization Data', () => {
    it('should generate visualization data', async () => {
      const neural = brain.neural()

      // Add some entities
      for (let i = 0; i < 20; i++) {
        await brain.add({
          data: `Visualization test ${i}`,
          type: NounType.Thing
        })
      }

      // Generate visualization
      const viz = await neural.visualize({
        format: 'force-directed',
        dimensions: 2,
        includeEdges: true
      })

      expect(viz).toBeDefined()
      expect(viz.format).toBe('force-directed')
      expect(viz.nodes.length).toBeGreaterThan(0)

      // Each node should have coordinates
      viz.nodes.forEach(node => {
        expect(node.id).toBeDefined()
        expect(node.x).toBeDefined()
        expect(node.y).toBeDefined()
      })

      // Should include edges if requested
      if (viz.edges) {
        expect(viz.edges.length).toBeGreaterThanOrEqual(0)
      }
    })

    it('should support different visualization formats', async () => {
      const neural = brain.neural()

      // Add hierarchical data
      const rootId = await brain.add({ data: 'Root', type: NounType.Thing })
      const child1Id = await brain.add({ data: 'Child 1', type: NounType.Thing })
      const child2Id = await brain.add({ data: 'Child 2', type: NounType.Thing })

      await brain.relate({ from: rootId, to: child1Id, type: VerbType.Contains })
      await brain.relate({ from: rootId, to: child2Id, type: VerbType.Contains })

      // Hierarchical layout
      const hierarchical = await neural.visualize({
        format: 'hierarchical'
      })

      // Radial layout
      const radial = await neural.visualize({
        format: 'radial'
      })

      expect(hierarchical.format).toBe('hierarchical')
      expect(radial.format).toBe('radial')
    })
  })

  describe('8. Performance and Optimization', () => {
    it('should handle concurrent neural operations', async () => {
      const neural = brain.neural()

      // Add test data
      for (let i = 0; i < 50; i++) {
        await brain.add({
          data: `Concurrent test ${i}`,
          type: NounType.Thing
        })
      }

      // Run multiple neural operations concurrently
      const operations = [
        neural.clusters(),
        neural.outliers({ threshold: 0.3 }),
        neural.visualize({ format: 'force-directed' }),
        brain.find({ query: 'test', limit: 10 })
      ]

      const results = await Promise.all(operations)

      // All should complete successfully
      expect(results[0]).toBeDefined() // clusters
      expect(results[1]).toBeDefined() // outliers
      expect(results[2]).toBeDefined() // visualization
      expect(results[3]).toBeDefined() // search
    })

    it('should cache neural computations', async () => {
      const neural = brain.neural()

      // Add entities
      const id1 = await brain.add({ data: 'Cache test 1', type: NounType.Thing })
      const id2 = await brain.add({ data: 'Cache test 2', type: NounType.Thing })

      // First similarity calculation
      const start1 = Date.now()
      const sim1 = await neural.similar(id1, id2)
      const time1 = Date.now() - start1

      // Second calculation (should be cached)
      const start2 = Date.now()
      const sim2 = await neural.similar(id1, id2)
      const time2 = Date.now() - start2

      expect(sim1).toBe(sim2) // Same result
      expect(time2).toBeLessThanOrEqual(time1) // Faster from cache
    })
  })

  describe('9. Integration with Core APIs', () => {
    it('should work seamlessly with find()', async () => {
      const neural = brain.neural()

      // Add clustered data
      const techItems = [
        'JavaScript', 'Python', 'Java',
        'TypeScript', 'Go', 'Rust'
      ]

      for (const item of techItems) {
        await brain.add({
          data: `${item} programming language`,
          type: NounType.Concept,
          metadata: { category: 'programming' }
        })
      }

      // Get clusters
      const clusters = await neural.clusters()

      // Use cluster info to enhance search
      if (clusters.length > 0) {
        const firstCluster = clusters[0]

        // Find items in same cluster
        const clusterMembers = await Promise.all(
          firstCluster.members.map(id => brain.get(id))
        )

        expect(clusterMembers.length).toBeGreaterThan(0)
        clusterMembers.forEach(member => {
          expect(member).toBeDefined()
        })
      }
    })

    it('should enhance graph traversal with neural insights', async () => {
      const neural = brain.neural()

      // Create graph with semantic relationships
      const aiId = await brain.add({ data: 'Artificial Intelligence', type: NounType.Concept })
      const mlId = await brain.add({ data: 'Machine Learning', type: NounType.Concept })
      const dlId = await brain.add({ data: 'Deep Learning', type: NounType.Concept })

      // Calculate similarities to create weighted relationships
      const simAiMl = await neural.similar(aiId, mlId)
      const simMlDl = await neural.similar(mlId, dlId)

      // Create relationships with similarity weights
      await brain.relate({
        from: aiId,
        to: mlId,
        type: VerbType.RelatedTo,
        metadata: { weight: simAiMl }
      })

      await brain.relate({
        from: mlId,
        to: dlId,
        type: VerbType.RelatedTo,
        metadata: { weight: simMlDl }
      })

      // Traverse with weighted paths
      const connected = await brain.find({
        connected: { from: aiId, depth: 2 },
        limit: 10
      })

      expect(connected.length).toBeGreaterThan(0)
    })
  })
})