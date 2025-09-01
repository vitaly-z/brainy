/**
 * API Server Example
 * 
 * This example shows how to expose Brainy through REST, WebSocket, and MCP APIs
 * using the APIServerAugmentation.
 * 
 * Zero-config philosophy: Just create and register the augmentation!
 */

import { BrainyData } from '../src/index.js'
import { APIServerAugmentation } from '../src/augmentations/apiServerAugmentation.js'

async function main() {
  // 1. Create Brainy with zero config
  const brain = new BrainyData()
  await brain.init()
  
  // 2. Add some sample data
  await brain.addNoun("The quick brown fox", 'Content', { type: "sentence", category: "animals" })
  await brain.addNoun("Machine learning models", 'Content', { type: "tech", category: "AI" })
  await brain.addNoun("Natural language processing", 'Content', { type: "tech", category: "NLP" })
  
  // 3. Create and register the API Server augmentation
  const apiServer = new APIServerAugmentation({
    port: 3000,
    host: 'localhost'
  })
  
  // Register the augmentation with Brainy
  brain.augmentations.register(apiServer)
  
  // Initialize augmentations with Brainy context
  await brain.augmentations.initialize({
    brain,
    log: (msg: string, level?: string) => console.log(`[${level || 'info'}] ${msg}`),
    config: {}
  })
  
  console.log('🚀 Brainy API Server is running!')
  console.log('📡 REST API: http://localhost:3000')
  console.log('🔌 WebSocket: ws://localhost:3000/ws')
  console.log('🧠 MCP: http://localhost:3000/api/mcp')
  console.log('')
  console.log('Try these endpoints:')
  console.log('  GET  http://localhost:3000/health')
  console.log('  POST http://localhost:3000/api/search')
  console.log('       Body: { "query": "fox", "limit": 10 }')
  console.log('  POST http://localhost:3000/api/add')
  console.log('       Body: { "content": "New data", "metadata": {} }')
  console.log('')
  console.log('Press Ctrl+C to stop the server')
}

// Run the example
main().catch(console.error)

/**
 * Example REST API calls:
 * 
 * # Health check
 * curl http://localhost:3000/health
 * 
 * # Search
 * curl -X POST http://localhost:3000/api/search \
 *   -H "Content-Type: application/json" \
 *   -d '{"query": "fox", "limit": 5}'
 * 
 * # Add data
 * curl -X POST http://localhost:3000/api/add \
 *   -H "Content-Type: application/json" \
 *   -d '{"content": "The cat sat on the mat", "metadata": {"type": "sentence"}}'
 * 
 * # Get by ID
 * curl http://localhost:3000/api/get/[id]
 * 
 * # Statistics
 * curl http://localhost:3000/api/stats
 */

/**
 * Example WebSocket client (browser):
 * 
 * const ws = new WebSocket('ws://localhost:3000/ws')
 * 
 * ws.onopen = () => {
 *   // Subscribe to all operations
 *   ws.send(JSON.stringify({
 *     type: 'subscribe',
 *     operations: ['all']
 *   }))
 *   
 *   // Perform a search
 *   ws.send(JSON.stringify({
 *     type: 'search',
 *     query: 'fox',
 *     limit: 5,
 *     requestId: '123'
 *   }))
 * }
 * 
 * ws.onmessage = (event) => {
 *   const msg = JSON.parse(event.data)
 *   console.log('Received:', msg)
 * }
 */