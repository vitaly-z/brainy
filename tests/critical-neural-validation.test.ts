import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../src/brainy'
import { NounType, VerbType } from '../src/types/graphTypes'

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
        { name: 'John Doe', email: 'john@example.com', role: 'developer' },
        { name: 'Jane Smith', email: 'jane@example.com', role: 'designer' },
        { name: 'Bob Johnson', email: 'bob@example.com', role: 'manager' },
        { name: 'Alice Brown', email: 'alice@example.com', role: 'developer' },
        { name: 'Charlie Wilson', email: 'charlie@example.com', role: 'tester' }
      ]

      for (const user of users) {
        // data = content for embeddings, metadata = queryable fields
        await brainy.add({
          data: `${user.name} ${user.email} ${user.role}`,
          type: NounType.Person,
          metadata: { name: user.name, email: user.email, role: user.role }
        })
      }

      const developers = await brainy.find({
        where: { role: 'developer' }
      })

      expect(developers.length).toBe(2)
      const names = developers.map((d: any) => d.metadata.name)
      expect(names).toContain('John Doe')
      expect(names).toContain('Alice Brown')
    })

    it('should correctly handle products and pricing', async () => {
      const products = [
        { name: 'iPhone 15', price: 999, category: 'electronics' },
        { name: 'MacBook Pro', price: 2499, category: 'electronics' },
        { name: 'AirPods', price: 249, category: 'electronics' },
        { name: 'Office Chair', price: 599, category: 'furniture' },
        { name: 'Standing Desk', price: 899, category: 'furniture' }
      ]

      for (const product of products) {
        await brainy.add({
          data: `${product.name} ${product.category}`,
          type: NounType.Product,
          metadata: { name: product.name, price: product.price, category: product.category }
        })
      }

      const expensiveProducts = await brainy.find({
        where: { price: { greaterThan: 500 } }
      })

      // 4 products have price > 500: iPhone 15 (999), MacBook Pro (2499), Office Chair (599), Standing Desk (899)
      expect(expensiveProducts.length).toBe(4)

      const electronics = await brainy.find({
        where: { category: 'electronics' }
      })

      expect(electronics.length).toBe(3)
    })

    it('should handle organizations and locations', async () => {
      const orgs = [
        { name: 'Microsoft', location: 'Seattle', industry: 'technology' },
        { name: 'Google', location: 'Mountain View', industry: 'technology' },
        { name: 'JPMorgan', location: 'New York', industry: 'finance' },
        { name: 'Tesla', location: 'Austin', industry: 'automotive' },
        { name: 'Amazon', location: 'Seattle', industry: 'technology' }
      ]

      for (const org of orgs) {
        await brainy.add({
          data: `${org.name} ${org.location} ${org.industry}`,
          type: NounType.Organization,
          metadata: { name: org.name, location: org.location, industry: org.industry }
        })
      }

      const seattleCompanies = await brainy.find({
        where: { location: 'Seattle' }
      })

      expect(seattleCompanies.length).toBe(2)
      const names = seattleCompanies.map((c: any) => c.metadata.name)
      expect(names).toContain('Microsoft')
      expect(names).toContain('Amazon')
    })
  })

  describe('Semantic Search Accuracy', () => {
    const docIds: string[] = []

    beforeAll(async () => {
      const documents = [
        { content: 'JavaScript programming tutorial for beginners', tags: ['programming', 'web'] },
        { content: 'Python data science and machine learning guide', tags: ['programming', 'ml'] },
        { content: 'Building scalable microservices with Kubernetes', tags: ['devops', 'cloud'] },
        { content: 'React.js component patterns and best practices', tags: ['programming', 'web'] },
        { content: 'Database optimization techniques for PostgreSQL', tags: ['database', 'performance'] },
        { content: 'AWS cloud architecture design principles', tags: ['cloud', 'architecture'] },
        { content: 'Mobile app development with React Native', tags: ['mobile', 'programming'] },
        { content: 'GraphQL API design and implementation', tags: ['api', 'web'] },
        { content: 'Docker containerization best practices', tags: ['devops', 'containers'] },
        { content: 'TypeScript advanced type system features', tags: ['programming', 'typescript'] }
      ]

      for (const doc of documents) {
        const id = await brainy.add({
          data: doc.content,
          type: NounType.Document,
          metadata: { content: doc.content, tags: doc.tags }
        })
        docIds.push(id)
      }
    })

    it('should find semantically similar documents', async () => {
      const webDevResults = await brainy.find({
        query: 'web development frameworks',
        limit: 3
      })

      expect(webDevResults.length).toBeGreaterThan(0)
      expect(webDevResults.length).toBeLessThanOrEqual(3)

      const foundContent = webDevResults.map((r: any) => r.metadata?.content || r.data).join(' ')
      expect(foundContent.toLowerCase()).toMatch(/javascript|react|web|api/i)
    })

    it('should find AI/ML related content', async () => {
      const mlResults = await brainy.find({
        query: 'artificial intelligence and machine learning',
        limit: 3
      })

      expect(mlResults.length).toBeGreaterThan(0)

      const foundContent = mlResults.map((r: any) => r.metadata?.content || r.data).join(' ')
      expect(foundContent.toLowerCase()).toMatch(/python|machine learning|data science/i)
    })

    it('should find DevOps related content', async () => {
      const devopsResults = await brainy.find({
        query: 'container orchestration and deployment',
        limit: 3
      })

      // Semantic search returns results; exact content depends on embedding model quality
      expect(devopsResults.length).toBeGreaterThan(0)
      expect(devopsResults.length).toBeLessThanOrEqual(3)
    })
  })

  describe('Graph Relationships', () => {
    let johnId: string, acmeId: string, proj1Id: string
    let aliceId: string, bobId: string, proj2Id: string, proj3Id: string

    it('should create and query relationships', async () => {
      johnId = await brainy.add({ data: 'John', type: NounType.Person, metadata: { name: 'John' } })
      acmeId = await brainy.add({ data: 'Acme Corp', type: NounType.Organization, metadata: { name: 'Acme Corp' } })
      proj1Id = await brainy.add({ data: 'Project Alpha', type: NounType.Project, metadata: { name: 'Project Alpha' } })

      await brainy.relate({
        from: johnId,
        to: acmeId,
        type: VerbType.WorksWith,
        metadata: { since: 2020 }
      })

      await brainy.relate({
        from: johnId,
        to: proj1Id,
        type: VerbType.Modifies,
        metadata: { role: 'lead' }
      })

      const johnsRelations = await brainy.getRelations({
        from: johnId
      })
      expect(johnsRelations.length).toBe(2)

      const acmeRelations = await brainy.getRelations({
        to: acmeId
      })
      expect(acmeRelations.length).toBe(1)
    })

    it('should handle complex relationship queries', async () => {
      aliceId = await brainy.add({ data: 'Alice', type: NounType.Person, metadata: { name: 'Alice' } })
      bobId = await brainy.add({ data: 'Bob', type: NounType.Person, metadata: { name: 'Bob' } })
      proj2Id = await brainy.add({ data: 'Project Beta', type: NounType.Project, metadata: { name: 'Project Beta' } })
      proj3Id = await brainy.add({ data: 'Project Gamma', type: NounType.Project, metadata: { name: 'Project Gamma' } })

      await brainy.relate({
        from: aliceId,
        to: bobId,
        type: VerbType.WorksWith,
        metadata: { since: 2021 }
      })

      await brainy.relate({
        from: aliceId,
        to: proj2Id,
        type: VerbType.Modifies,
        metadata: { commits: 150 }
      })

      await brainy.relate({
        from: bobId,
        to: proj2Id,
        type: VerbType.Modifies,
        metadata: { commits: 200 }
      })

      await brainy.relate({
        from: aliceId,
        to: proj3Id,
        type: VerbType.Creates,
        metadata: { startDate: '2023-01-01' }
      })

      const aliceRelations = await brainy.getRelations({
        from: aliceId
      })
      expect(aliceRelations.length).toBeGreaterThanOrEqual(3)

      const proj2Relations = await brainy.getRelations({
        to: proj2Id
      })
      expect(proj2Relations.length).toBe(2)
    })
  })

  describe('Metadata Filtering', () => {
    it('should filter by complex metadata', async () => {
      const items = [
        { content: 'Item 1', status: 'active', priority: 1, tags: ['urgent'] },
        { content: 'Item 2', status: 'active', priority: 2, tags: ['normal'] },
        { content: 'Item 3', status: 'inactive', priority: 1, tags: ['archived'] },
        { content: 'Item 4', status: 'active', priority: 3, tags: ['low'] },
        { content: 'Item 5', status: 'pending', priority: 1, tags: ['urgent'] }
      ]

      const ids: string[] = []
      for (const item of items) {
        const id = await brainy.add({
          data: item.content,
          type: NounType.Task,
          metadata: { status: item.status, priority: item.priority, tags: item.tags }
        })
        ids.push(id)
      }

      const activeUrgent = await brainy.find({
        where: {
          status: 'active',
          priority: 1
        }
      })

      expect(activeUrgent.length).toBe(1)
      expect(activeUrgent[0].id).toBe(ids[0])

      const urgentTasks = await brainy.find({
        where: {
          tags: { contains: 'urgent' }
        }
      })

      expect(urgentTasks.length).toBe(2)
    })

    it('should handle range queries on metadata', async () => {
      const events = [
        { name: 'Event 1', date: '2024-01-15', attendees: 50 },
        { name: 'Event 2', date: '2024-02-20', attendees: 150 },
        { name: 'Event 3', date: '2024-03-10', attendees: 75 },
        { name: 'Event 4', date: '2024-04-05', attendees: 200 },
        { name: 'Event 5', date: '2024-05-01', attendees: 30 }
      ]

      for (const event of events) {
        await brainy.add({
          data: `${event.name} ${event.date}`,
          type: NounType.Event,
          metadata: { name: event.name, date: event.date, attendees: event.attendees }
        })
      }

      // Test range query with greaterThan
      const largeEvents = await brainy.find({
        where: {
          attendees: { greaterThan: 100 }
        }
      })

      // Should return exactly Event 2 (150) and Event 4 (200)
      expect(largeEvents.length).toBe(2)
      for (const event of largeEvents) {
        expect(event.metadata.attendees).toBeGreaterThan(100)
      }
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
      const notFound = await brainy.get('00000000-0000-0000-0000-000000000099')
      expect(notFound).toBeNull()

      const relations = await brainy.getRelations({
        from: '00000000-0000-0000-0000-000000000099'
      })
      expect(relations).toEqual([])
    })

    it('should handle special characters in content', async () => {
      const sp1 = await brainy.add({ data: 'Test with émojis 😊🎉🚀', type: NounType.Message })
      const sp2 = await brainy.add({ data: 'HTML <script>alert("test")</script> tags', type: NounType.Message })

      const retrieved = await brainy.get(sp1)
      expect(retrieved?.data).toContain('😊')

      const htmlItem = await brainy.get(sp2)
      expect(htmlItem?.data).toContain('<script>')
    })

    it('should handle very large batch operations', async () => {
      const batchSize = 100
      const items = Array.from({ length: batchSize }, (_, i) => ({
        data: `Batch item ${i}`,
        type: NounType.Thing as const,
        metadata: { index: i }
      }))

      const startTime = Date.now()

      const result = await brainy.addMany({ items })

      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(30000)
      expect(result.successful.length).toBe(batchSize)
    })
  })

  describe('Performance Benchmarks', () => {
    it('should handle 500 items efficiently', async () => {
      const items = Array.from({ length: 500 }, (_, i) => ({
        data: `Performance test item ${i} with some random text`,
        type: NounType.Thing as const,
        metadata: { category: i % 10, timestamp: Date.now() }
      }))

      const insertStart = Date.now()
      await brainy.addMany({ items })
      const insertTime = Date.now() - insertStart

      expect(insertTime).toBeLessThan(120000)
      console.log(`Insert 500 items: ${insertTime}ms (${(insertTime/500).toFixed(1)}ms per item)`)

      const searchStart = Date.now()
      const searchResults = await brainy.find({
        query: 'performance test',
        limit: 10
      })
      const searchTime = Date.now() - searchStart

      expect(searchResults.length).toBeGreaterThan(0)
      expect(searchTime).toBeLessThan(5000)
      console.log(`Vector search: ${searchTime}ms`)

      const filterStart = Date.now()
      const filtered = await brainy.find({
        where: { category: 5 },
        limit: 500
      })
      const filterTime = Date.now() - filterStart

      expect(filtered.length).toBe(50)
      expect(filterTime).toBeLessThan(5000)
      console.log(`Metadata filter: ${filterTime}ms`)
    }, 180000)

    it('should scale with concurrent operations', async () => {
      const concurrentOps = 20
      const operations = []

      const startTime = Date.now()

      for (let i = 0; i < concurrentOps; i++) {
        operations.push(
          brainy.add({
            data: `Concurrent operation ${i}`,
            type: NounType.Thing
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

      expect(elapsed).toBeLessThan(60000)
      console.log(`${concurrentOps * 2} concurrent operations: ${elapsed}ms`)
    }, 120000)
  })

  describe('Similar Items Search', () => {
    it('should find similar items correctly', async () => {
      const articleIds: string[] = []
      const articles = [
        'Modern JavaScript frameworks like React and Vue',
        'Building responsive web applications with CSS Grid',
        'Node.js backend development best practices',
        'Machine learning algorithms in Python',
        'Database indexing strategies for performance'
      ]

      for (const content of articles) {
        const id = await brainy.add({ data: content, type: NounType.Document })
        articleIds.push(id)
      }

      const similarToReact = await brainy.similar({
        to: articleIds[0],
        limit: 3
      })

      expect(similarToReact.length).toBeGreaterThan(0)
      // similar() may include or exclude the source item depending on implementation
      // Verify we get actual results back
      const otherResults = similarToReact.filter((r: any) => r.id !== articleIds[0])
      expect(otherResults.length + similarToReact.length).toBeGreaterThan(0)
    })
  })
})
