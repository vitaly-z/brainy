import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../src/brainy'

describe('CRITICAL: Real-World Neural Matching Validation', () => {
  let brainy: Brainy

  beforeAll(async () => {
    brainy = new Brainy({
      storage: { type: 'memory' }
    })
    await brainy.init()
  })

  afterAll(async () => {
    await brainy.close()
  })

  describe('Real-World Data Operations', () => {
    it('should correctly add and find users', async () => {
      const users = [
        { id: 'user1', name: 'John Doe', email: 'john@example.com', role: 'developer' },
        { id: 'user2', name: 'Jane Smith', email: 'jane@example.com', role: 'designer' },
        { id: 'user3', name: 'Bob Johnson', email: 'bob@example.com', role: 'manager' },
        { id: 'user4', name: 'Alice Brown', email: 'alice@example.com', role: 'developer' },
        { id: 'user5', name: 'Charlie Wilson', email: 'charlie@example.com', role: 'tester' }
      ]

      for (const user of users) {
        await brainy.add({ data: user, type: 'person', id: user.id })
      }

      const developers = await brainy.find({
        where: { role: 'developer' }
      })

      expect(developers.length).toBe(2)
      expect(developers.map((d: any) => d.name)).toContain('John Doe')
      expect(developers.map((d: any) => d.name)).toContain('Alice Brown')
    })

    it('should correctly handle products and pricing', async () => {
      const products = [
        { id: 'prod1', name: 'iPhone 15', price: 999, category: 'electronics' },
        { id: 'prod2', name: 'MacBook Pro', price: 2499, category: 'electronics' },
        { id: 'prod3', name: 'AirPods', price: 249, category: 'electronics' },
        { id: 'prod4', name: 'Office Chair', price: 599, category: 'furniture' },
        { id: 'prod5', name: 'Standing Desk', price: 899, category: 'furniture' }
      ]

      for (const product of products) {
        await brainy.add({ data: product, type: 'product', id: product.id })
      }

      const expensiveProducts = await brainy.find({
        where: { price: { greaterThan: 500 } }
      })

      expect(expensiveProducts.length).toBe(3)
      
      const electronics = await brainy.find({
        where: { category: 'electronics' }
      })

      expect(electronics.length).toBe(3)
    })

    it('should handle organizations and locations', async () => {
      const orgs = [
        { id: 'org1', name: 'Microsoft', location: 'Seattle', industry: 'technology', type: 'Organization' },
        { id: 'org2', name: 'Google', location: 'Mountain View', industry: 'technology', type: 'Organization' },
        { id: 'org3', name: 'JPMorgan', location: 'New York', industry: 'finance', type: 'Organization' },
        { id: 'org4', name: 'Tesla', location: 'Austin', industry: 'automotive', type: 'Organization' },
        { id: 'org5', name: 'Amazon', location: 'Seattle', industry: 'technology', type: 'Organization' }
      ]

      for (const org of orgs) {
        await brainy.add(org)
      }

      const seattleCompanies = await brainy.find({
        where: { location: 'Seattle' }
      })

      expect(seattleCompanies.length).toBe(2)
      expect(seattleCompanies.map((c: any) => c.name)).toContain('Microsoft')
      expect(seattleCompanies.map((c: any) => c.name)).toContain('Amazon')
    })
  })

  describe('Semantic Search Accuracy', () => {
    beforeAll(async () => {
      const documents = [
        { id: 'doc1', content: 'JavaScript programming tutorial for beginners', tags: ['programming', 'web'], type: 'Document' },
        { id: 'doc2', content: 'Python data science and machine learning guide', tags: ['programming', 'ml'], type: 'Document' },
        { id: 'doc3', content: 'Building scalable microservices with Kubernetes', tags: ['devops', 'cloud'], type: 'Document' },
        { id: 'doc4', content: 'React.js component patterns and best practices', tags: ['programming', 'web'], type: 'Document' },
        { id: 'doc5', content: 'Database optimization techniques for PostgreSQL', tags: ['database', 'performance'], type: 'Document' },
        { id: 'doc6', content: 'AWS cloud architecture design principles', tags: ['cloud', 'architecture'], type: 'Document' },
        { id: 'doc7', content: 'Mobile app development with React Native', tags: ['mobile', 'programming'], type: 'Document' },
        { id: 'doc8', content: 'GraphQL API design and implementation', tags: ['api', 'web'], type: 'Document' },
        { id: 'doc9', content: 'Docker containerization best practices', tags: ['devops', 'containers'], type: 'Document' },
        { id: 'doc10', content: 'TypeScript advanced type system features', tags: ['programming', 'typescript'], type: 'Document' }
      ]

      for (const doc of documents) {
        await brainy.add(doc)
      }
    })

    it('should find semantically similar documents', async () => {
      const webDevResults = await brainy.find({
        query: 'web development frameworks',
        limit: 3
      })

      expect(webDevResults.length).toBeGreaterThan(0)
      expect(webDevResults.length).toBeLessThanOrEqual(3)
      
      const foundContent = webDevResults.map((r: any) => r.content).join(' ')
      expect(foundContent.toLowerCase()).toMatch(/javascript|react|web|api/i)
    })

    it('should find AI/ML related content', async () => {
      const mlResults = await brainy.find({
        query: 'artificial intelligence and machine learning',
        limit: 3
      })

      expect(mlResults.length).toBeGreaterThan(0)
      
      const foundContent = mlResults.map((r: any) => r.content).join(' ')
      expect(foundContent.toLowerCase()).toMatch(/python|machine learning|data science/i)
    })

    it('should find DevOps related content', async () => {
      const devopsResults = await brainy.find({
        query: 'container orchestration and deployment',
        limit: 3
      })

      expect(devopsResults.length).toBeGreaterThan(0)
      
      const foundContent = devopsResults.map((r: any) => r.content).join(' ')
      expect(foundContent.toLowerCase()).toMatch(/kubernetes|docker|container/i)
    })
  })

  describe('Graph Relationships', () => {
    it('should create and query relationships', async () => {
      await brainy.add({ id: 'john', name: 'John', type: 'Person' })
      await brainy.add({ id: 'acme', name: 'Acme Corp', type: 'Organization' })
      await brainy.add({ id: 'proj1', name: 'Project Alpha', type: 'Project' })

      await brainy.relate({
        from: 'john',
        to: 'acme',
        type: 'WorksAt',
        metadata: { since: 2020 }
      })

      await brainy.relate({
        from: 'john',
        to: 'proj1',
        type: 'Manages',
        metadata: { role: 'lead' }
      })

      const johnsRelations = await brainy.getRelations({
        from: 'john'
      })
      expect(johnsRelations.length).toBe(2)

      const acmeRelations = await brainy.getRelations({
        to: 'acme'
      })
      expect(acmeRelations.length).toBe(1)
    })

    it('should handle complex relationship queries', async () => {
      await brainy.add({ id: 'alice', name: 'Alice', type: 'Person' })
      await brainy.add({ id: 'bob', name: 'Bob', type: 'Person' })
      await brainy.add({ id: 'proj2', name: 'Project Beta', type: 'Project' })
      await brainy.add({ id: 'proj3', name: 'Project Gamma', type: 'Project' })

      await brainy.relate({
        from: 'alice',
        to: 'bob',
        type: 'CollaboratesWith',
        metadata: { since: 2021 }
      })

      await brainy.relate({
        from: 'alice',
        to: 'proj2',
        type: 'Contributes',
        metadata: { commits: 150 }
      })

      await brainy.relate({
        from: 'bob',
        to: 'proj2',
        type: 'Contributes',
        metadata: { commits: 200 }
      })

      await brainy.relate({
        from: 'alice',
        to: 'proj3',
        type: 'Leads',
        metadata: { startDate: '2023-01-01' }
      })

      const aliceRelations = await brainy.getRelations({
        from: 'alice'
      })
      expect(aliceRelations.length).toBeGreaterThanOrEqual(3)

      const proj2Relations = await brainy.getRelations({
        to: 'proj2'
      })
      expect(proj2Relations.length).toBe(2)
    })
  })

  describe('Metadata Filtering', () => {
    it('should filter by complex metadata', async () => {
      const items = [
        { id: 'm1', content: 'Item 1', status: 'active', priority: 1, tags: ['urgent'], type: 'Task' },
        { id: 'm2', content: 'Item 2', status: 'active', priority: 2, tags: ['normal'], type: 'Task' },
        { id: 'm3', content: 'Item 3', status: 'inactive', priority: 1, tags: ['archived'], type: 'Task' },
        { id: 'm4', content: 'Item 4', status: 'active', priority: 3, tags: ['low'], type: 'Task' },
        { id: 'm5', content: 'Item 5', status: 'pending', priority: 1, tags: ['urgent'], type: 'Task' }
      ]

      for (const item of items) {
        await brainy.add(item)
      }

      const activeUrgent = await brainy.find({
        where: {
          status: 'active',
          priority: 1
        }
      })

      expect(activeUrgent.length).toBe(1)
      expect(activeUrgent[0].id).toBe('m1')

      const urgentTasks = await brainy.find({
        where: {
          tags: { contains: 'urgent' }
        }
      })

      expect(urgentTasks.length).toBe(2)
    })

    it('should handle range queries on metadata', async () => {
      const events = [
        { id: 'e1', name: 'Event 1', date: '2024-01-15', attendees: 50, type: 'Event' },
        { id: 'e2', name: 'Event 2', date: '2024-02-20', attendees: 150, type: 'Event' },
        { id: 'e3', name: 'Event 3', date: '2024-03-10', attendees: 75, type: 'Event' },
        { id: 'e4', name: 'Event 4', date: '2024-04-05', attendees: 200, type: 'Event' },
        { id: 'e5', name: 'Event 5', date: '2024-05-01', attendees: 30, type: 'Event' }
      ]

      for (const event of events) {
        await brainy.add(event)
      }

      const largeEvents = await brainy.find({
        where: {
          attendees: { greaterThan: 100 }
        }
      })

      expect(largeEvents.length).toBe(2)

      const q1Events = await brainy.find({
        where: {
          date: { greaterThan: '2024-01-01', lessThan: '2024-04-01' }
        }
      })

      expect(q1Events.length).toBe(3)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty queries gracefully', async () => {
      const emptyResults = await brainy.find({
        query: '',
        limit: 5
      })

      expect(emptyResults).toBeDefined()
      expect(Array.isArray(emptyResults)).toBe(true)
    })

    it('should handle non-existent IDs', async () => {
      const notFound = await brainy.get('non-existent-id')
      expect(notFound).toBeNull()

      const relations = await brainy.getRelations({
        from: 'non-existent-id'
      })
      expect(relations).toEqual([])
    })

    it('should handle duplicate IDs', async () => {
      await brainy.add({ id: 'dup1', content: 'First', type: 'Item' })
      await brainy.add({ id: 'dup1', content: 'Second', type: 'Item' })

      const item = await brainy.get('dup1')
      expect(item?.content).toBe('Second')
    })

    it('should handle special characters in content', async () => {
      const specialItems = [
        { id: 'sp1', content: 'Test with émojis 😊🎉🚀', type: 'Message' },
        { id: 'sp2', content: 'HTML <script>alert("test")</script> tags', type: 'Message' },
        { id: 'sp3', content: 'Special chars: @#$%^&*(){}[]|\\', type: 'Message' },
        { id: 'sp4', content: 'Unicode: 你好世界 مرحبا بالعالم', type: 'Message' }
      ]

      for (const item of specialItems) {
        await brainy.add(item)
      }

      const retrieved = await brainy.get('sp1')
      expect(retrieved?.content).toContain('😊')

      const htmlItem = await brainy.get('sp2')
      expect(htmlItem?.content).toContain('<script>')
    })

    it('should handle very large batch operations', async () => {
      const batchSize = 100
      const items = Array.from({ length: batchSize }, (_, i) => ({
        id: `batch-${i}`,
        content: `Batch item ${i}`,
        index: i,
        type: 'Item'
      }))

      const startTime = Date.now()
      
      const result = await brainy.addMany({ items })
      
      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(10000)
      expect(result.successful).toBe(batchSize)

      const midItem = await brainy.get('batch-50')
      expect(midItem?.index).toBe(50)
    })
  })

  describe('Performance Benchmarks', () => {
    it('should handle 1000 items efficiently', async () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: `perf-${i}`,
        content: `Performance test item ${i} with some random text`,
        category: i % 10,
        timestamp: Date.now(),
        type: 'Item'
      }))

      const insertStart = Date.now()
      await brainy.addMany({ items })
      const insertTime = Date.now() - insertStart

      expect(insertTime).toBeLessThan(30000)
      console.log(`Insert 1000 items: ${insertTime}ms (${insertTime/1000}ms per item)`)

      const searchStart = Date.now()
      const searchResults = await brainy.find({
        query: 'performance test',
        limit: 10
      })
      const searchTime = Date.now() - searchStart

      expect(searchResults.length).toBeGreaterThan(0)
      expect(searchTime).toBeLessThan(1000)
      console.log(`Vector search: ${searchTime}ms`)

      const filterStart = Date.now()
      const filtered = await brainy.find({
        where: { category: 5 }
      })
      const filterTime = Date.now() - filterStart

      expect(filtered.length).toBe(100)
      expect(filterTime).toBeLessThan(500)
      console.log(`Metadata filter: ${filterTime}ms`)
    })

    it('should scale with concurrent operations', async () => {
      const concurrentOps = 50
      const operations = []

      const startTime = Date.now()

      for (let i = 0; i < concurrentOps; i++) {
        operations.push(
          brainy.add({
            id: `concurrent-${i}`,
            content: `Concurrent operation ${i}`,
            type: 'Item'
          })
        )
      }

      for (let i = 0; i < concurrentOps; i++) {
        operations.push(
          brainy.find({
            query: 'concurrent',
            limit: 5
          })
        )
      }

      await Promise.all(operations)
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(10000)
      console.log(`100 concurrent operations: ${elapsed}ms`)
    })
  })

  describe('Similar Items Search', () => {
    it('should find similar items correctly', async () => {
      const techArticles = [
        { id: 'tech1', content: 'Modern JavaScript frameworks like React and Vue', type: 'Article' },
        { id: 'tech2', content: 'Building responsive web applications with CSS Grid', type: 'Article' },
        { id: 'tech3', content: 'Node.js backend development best practices', type: 'Article' },
        { id: 'tech4', content: 'Machine learning algorithms in Python', type: 'Article' },
        { id: 'tech5', content: 'Database indexing strategies for performance', type: 'Article' }
      ]

      for (const article of techArticles) {
        await brainy.add(article)
      }

      const similarToReact = await brainy.similar({
        to: 'tech1',
        limit: 3
      })

      expect(similarToReact.length).toBeGreaterThan(0)
      expect(similarToReact[0].id).not.toBe('tech1')
    })
  })
})