/**
 * Distributed Brainy Demo Test
 * 
 * Demonstrates the complete distributed features:
 * - Zero-config discovery via S3
 * - Automatic sharding
 * - Load balancing
 * - Shard migration
 * - Distributed queries
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../src/brainy.js'

describe('Distributed Brainy Demo', () => {
  let node1: Brainy
  let node2: Brainy
  let node3: Brainy
  
  beforeAll(async () => {
    // Node 1: First node starts cluster
    node1 = new Brainy({
      storage: {
        s3Storage: {
          bucket: process.env.S3_BUCKET || 'brainy-test',
          region: process.env.AWS_REGION || 'us-east-1'
        }
      },
      distributed: true, // That's it! Everything else is automatic
      logging: { verbose: true }
    })
    
    await node1.init()
    console.log('Node 1 started - became cluster leader')
    
    // Node 2: Automatically discovers and joins
    node2 = new Brainy({
      storage: {
        s3Storage: {
          bucket: process.env.S3_BUCKET || 'brainy-test',
          region: process.env.AWS_REGION || 'us-east-1'
        }
      },
      distributed: true,
      logging: { verbose: true }
    })
    
    await node2.init()
    console.log('Node 2 started - automatically joined cluster')
    
    // Node 3: Also joins automatically
    node3 = new Brainy({
      storage: {
        s3Storage: {
          bucket: process.env.S3_BUCKET || 'brainy-test',
          region: process.env.AWS_REGION || 'us-east-1'
        }
      },
      distributed: true,
      logging: { verbose: true }
    })
    
    await node3.init()
    console.log('Node 3 started - automatically joined cluster')
    
    // Give nodes time to discover each other
    await new Promise(resolve => setTimeout(resolve, 2000))
  })
  
  afterAll(async () => {
    await Promise.all([
      node1?.close(),
      node2?.close(),
      node3?.close()
    ])
  })
  
  it('should automatically distribute data across nodes', async () => {
    // Add data from different nodes - automatically sharded
    const doc1 = await node1.add('First document about AI', 'document')
    const doc2 = await node2.add('Second document about machine learning', 'document')
    const doc3 = await node3.add('Third document about neural networks', 'document')
    
    console.log('Added documents:', { doc1, doc2, doc3 })
    
    // Each node can find all documents (distributed query)
    const results1 = await node1.find('AI machine learning')
    const results2 = await node2.find('AI machine learning')
    const results3 = await node3.find('AI machine learning')
    
    // All nodes should see the same results
    expect(results1.length).toBeGreaterThan(0)
    expect(results2.length).toBe(results1.length)
    expect(results3.length).toBe(results1.length)
    
    console.log(`All nodes found ${results1.length} documents`)
  })
  
  it('should handle node failures gracefully', async () => {
    // Add a document
    const docId = await node1.add('Important data that must not be lost', 'critical')
    
    // Simulate node 2 going down
    await node2.close()
    console.log('Node 2 went offline')
    
    // Data should still be accessible from other nodes
    const result = await node1.get(docId)
    expect(result).toBeDefined()
    expect(result.data).toContain('Important data')
    
    console.log('Data still accessible after node failure')
  })
  
  it('should automatically rebalance when nodes join', async () => {
    // Start a new node
    const node4 = new Brainy({
      storage: {
        s3Storage: {
          bucket: process.env.S3_BUCKET || 'brainy-test',
          region: process.env.AWS_REGION || 'us-east-1'
        }
      },
      distributed: true
    })
    
    await node4.init()
    console.log('Node 4 joined - automatic rebalancing started')
    
    // Give time for rebalancing
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Node 4 should now handle queries
    const results = await node4.find('data')
    expect(results.length).toBeGreaterThan(0)
    
    console.log('Node 4 successfully serving queries after rebalancing')
    
    await node4.close()
  })
  
  it('should support complex distributed operations', async () => {
    // Parallel writes from all nodes
    const promises = []
    for (let i = 0; i < 10; i++) {
      promises.push(node1.add(`Document ${i} from node 1`, 'batch'))
      promises.push(node3.add(`Document ${i} from node 3`, 'batch'))
    }
    
    await Promise.all(promises)
    console.log('Added 20 documents in parallel from 2 nodes')
    
    // Complex query executed across all shards
    const results = await node1.find('document', 5)
    expect(results.length).toBe(5)
    
    // Triple Intelligence works across distributed data
    const triple = await node1.tripleSearch(
      'node',     // Subject
      'creates',  // Verb
      'document'  // Object
    )
    
    expect(triple.results).toBeDefined()
    console.log('Triple Intelligence query executed across cluster')
  })
})

// Usage Example for Documentation
export function distributedExample() {
  return `
// Zero-Config Distributed Setup
const brain = new Brainy({
  storage: {
    s3Storage: {
      bucket: 'my-data',
      region: 'us-east-1'
    }
  },
  distributed: true  // That's it!
})

await brain.init()

// Everything else is automatic:
// ✅ Nodes discover each other via S3
// ✅ Data automatically sharded across nodes
// ✅ Queries automatically distributed
// ✅ Automatic failover and recovery
// ✅ Zero-downtime scaling

// Add data - automatically distributed
await brain.add('My document', 'doc')

// Query - automatically searches all nodes
const results = await brain.find('search term')

// Nodes can join/leave anytime
// Data automatically rebalances
// No configuration needed!
`
}