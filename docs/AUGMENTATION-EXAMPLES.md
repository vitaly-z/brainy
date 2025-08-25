# 🚀 Real-World Augmentation Examples

## 1. 💬 Chat Interface Augmentation
**"Talk to your data through natural language"**

```typescript
import { BaseAugmentation } from './brainyAugmentation.js'

export class ChatInterfaceAugmentation extends BaseAugmentation {
  readonly name = 'chat-interface'
  readonly timing = 'after' as const  // Process after operations
  readonly operations = ['search', 'add', 'delete'] as const
  readonly priority = 30  // Medium priority
  
  private chatHistory: Array<{role: string, content: string}> = []
  private llmClient: any  // User's chosen LLM
  
  protected async onInitialize(): Promise<void> {
    // User provides their own LLM
    this.llmClient = this.context.config.llmClient || null
    if (!this.llmClient) {
      this.log('Chat augmentation needs LLM client in config')
    }
  }
  
  async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
    // If params include natural language query
    if (params.chatQuery) {
      // Convert natural language to Brainy operations
      const intent = await this.parseIntent(params.chatQuery)
      
      // Transform params based on intent
      if (intent.type === 'search') {
        params.query = intent.query
        params.k = intent.limit || 10
      } else if (intent.type === 'add') {
        params.content = intent.content
        params.metadata = { ...params.metadata, source: 'chat' }
      }
      
      // Store in chat history
      this.chatHistory.push({
        role: 'user',
        content: params.chatQuery
      })
    }
    
    // Execute the operation
    const result = await next()
    
    // Generate conversational response
    if (params.chatQuery && this.llmClient) {
      const response = await this.generateResponse(operation, result)
      
      this.chatHistory.push({
        role: 'assistant', 
        content: response
      })
      
      // Enhance result with chat response
      return {
        ...result,
        chatResponse: response,
        chatHistory: this.chatHistory
      } as T
    }
    
    return result
  }
  
  private async parseIntent(query: string) {
    // Use Brainy's NLP patterns + LLM to understand intent
    const prompt = `Parse this query into a Brainy operation:
    Query: ${query}
    
    Return JSON with:
    - type: 'search' | 'add' | 'delete' | 'relate'
    - query: search terms or content
    - filters: any metadata filters
    - limit: number of results`
    
    const response = await this.llmClient.complete(prompt)
    return JSON.parse(response)
  }
  
  private async generateResponse(operation: string, result: any) {
    const prompt = `Generate a friendly response for this operation:
    Operation: ${operation}
    Result: ${JSON.stringify(result).slice(0, 500)}
    Chat History: ${JSON.stringify(this.chatHistory.slice(-3))}
    
    Be conversational and helpful.`
    
    return await this.llmClient.complete(prompt)
  }
}

// Usage:
const brain = new BrainyData({
  augmentations: [
    new ChatInterfaceAugmentation()
  ],
  llmClient: openai  // Bring your own LLM
})

// Now you can chat!
const result = await brain.search({
  chatQuery: "Show me all documents about project roadmap from last week"
})
console.log(result.chatResponse)  // "I found 5 documents about the project roadmap..."
```

## 2. 🤖 MCP Agent Memory Augmentation
**"Provide persistent memory for AI agents through MCP"**

```typescript
import { BaseAugmentation } from './brainyAugmentation.js'
import { Server } from '@modelcontextprotocol/sdk'

export class MCPAgentMemoryAugmentation extends BaseAugmentation {
  readonly name = 'mcp-agent-memory'
  readonly timing = 'around' as const  // Wrap operations
  readonly operations = ['all'] as const  // Monitor everything
  readonly priority = 70  // High priority
  
  private mcpServer: Server
  private agentSessions: Map<string, any> = new Map()
  
  protected async onInitialize(): Promise<void> {
    // Initialize MCP server
    this.mcpServer = new Server({
      name: 'brainy-memory',
      version: '1.0.0'
    })
    
    // Register MCP tools for agents
    this.mcpServer.setRequestHandler('tools/list', () => ({
      tools: [
        {
          name: 'remember',
          description: 'Store information in long-term memory',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              category: { type: 'string' },
              importance: { type: 'number' }
            }
          }
        },
        {
          name: 'recall',
          description: 'Retrieve information from memory',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              category: { type: 'string' },
              limit: { type: 'number' }
            }
          }
        },
        {
          name: 'forget',
          description: 'Remove information from memory',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              category: { type: 'string' }
            }
          }
        }
      ]
    }))
    
    // Handle tool calls from agents
    this.mcpServer.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params
      
      switch (name) {
        case 'remember':
          return await this.rememberForAgent(args)
        case 'recall':
          return await this.recallForAgent(args)
        case 'forget':
          return await this.forgetForAgent(args)
        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    })
    
    // Start MCP server
    await this.mcpServer.connect(process.stdin, process.stdout)
    this.log('MCP Agent Memory server started')
  }
  
  async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
    // Extract agent context if present
    const agentId = params.metadata?._agentId || 'default'
    const sessionId = params.metadata?._sessionId
    
    // Track agent operations
    if (agentId && sessionId) {
      if (!this.agentSessions.has(sessionId)) {
        this.agentSessions.set(sessionId, {
          agentId,
          startTime: Date.now(),
          operations: []
        })
      }
      
      const session = this.agentSessions.get(sessionId)
      session.operations.push({
        operation,
        params: { ...params },
        timestamp: Date.now()
      })
    }
    
    // Execute with agent context
    const result = await next()
    
    // Auto-remember important operations
    if (operation === 'add' && agentId) {
      await this.autoRemember(agentId, params, result)
    }
    
    return result
  }
  
  private async rememberForAgent(args: any) {
    // Store in Brainy with agent-specific metadata
    const id = await this.context.brain.add(args.content, {
      _agentMemory: true,
      _agentId: args.agentId || 'default',
      category: args.category,
      importance: args.importance || 0.5,
      timestamp: new Date().toISOString()
    })
    
    return {
      content: [
        {
          type: 'text',
          text: `Remembered with ID: ${id}`
        }
      ]
    }
  }
  
  private async recallForAgent(args: any) {
    // Search agent's memories
    const results = await this.context.brain.search(args.query, args.limit || 10, {
      where: {
        _agentMemory: true,
        _agentId: args.agentId || 'default',
        category: args.category
      }
    })
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }
      ]
    }
  }
  
  private async forgetForAgent(args: any) {
    // Remove specific memories
    const results = await this.context.brain.find({
      where: {
        _agentMemory: true,
        _agentId: args.agentId || 'default',
        category: args.category
      }
    })
    
    for (const item of results) {
      await this.context.brain.delete(item.id)
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `Forgot ${results.length} memories`
        }
      ]
    }
  }
  
  private async autoRemember(agentId: string, params: any, result: any) {
    // Automatically remember important information
    if (params.metadata?.important) {
      await this.context.brain.add(params.content, {
        ...params.metadata,
        _agentMemory: true,
        _agentId: agentId,
        _autoRemembered: true,
        _originalOperation: 'add',
        _resultId: result
      })
    }
  }
}

// Usage:
const brain = new BrainyData({
  augmentations: [
    new MCPAgentMemoryAugmentation()
  ]
})

// Now AI agents can use Brainy as memory through MCP!
// Agents connect via MCP and use remember/recall/forget tools
```

## 3. 🌐 API Server Augmentation
**"Expose Brainy through REST, WebSocket, and MCP APIs"**

```typescript
import { BaseAugmentation } from './brainyAugmentation.js'
import { BrainyMCPService } from '../mcp/brainyMCPService.js'

export class APIServerAugmentation extends BaseAugmentation {
  readonly name = 'api-server'
  readonly timing = 'after' as const
  readonly operations = ['all'] as ('all')[]
  readonly priority = 5  // Low priority, runs after other augmentations
  
  private httpServer: any
  private wsServer: any
  private mcpService: BrainyMCPService
  
  protected async onInitialize(): Promise<void> {
    // Initialize MCP service
    this.mcpService = new BrainyMCPService(this.context.brain)
    
    // Start HTTP server with REST endpoints
    await this.startHTTPServer()
    
    // Start WebSocket server for real-time
    await this.startWebSocketServer()
    
    this.log(`API Server running on port ${this.config.port || 3000}`)
  }
  
  async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
    const result = await next()
    
    // Broadcast operation to WebSocket clients
    this.broadcast({
      type: 'operation',
      operation,
      params: this.sanitizeParams(params),
      timestamp: Date.now()
    })
    
    return result
  }
  
  private async startHTTPServer() {
    // REST endpoints: /api/search, /api/add, /api/get/:id, etc.
    // MCP endpoint: /api/mcp
    // Health check: /health
  }
  
  private async startWebSocketServer() {
    // WebSocket for real-time subscriptions
    // Clients can subscribe to specific operations
  }
}

// Usage:
const brain = new BrainyData()
brain.augmentations.register(new APIServerAugmentation({ port: 3000 }))
await brain.init()

// Now access Brainy via:
// - REST: http://localhost:3000/api/*
// - WebSocket: ws://localhost:3000/ws
// - MCP: http://localhost:3000/api/mcp
```

## 4. 📊 Graph Visualization Augmentation
**"Real-time graph visualization with clustering"**

```typescript
import { BaseAugmentation } from './brainyAugmentation.js'
import { WebSocketServer } from 'ws'

export class GraphVisualizationAugmentation extends BaseAugmentation {
  readonly name = 'graph-visualization'
  readonly timing = 'after' as const
  readonly operations = ['all'] as const  // Monitor all changes
  readonly priority = 20
  
  private wsServer: WebSocketServer
  private graphState: {
    nodes: Map<string, any>
    edges: Map<string, any>
    clusters: Map<string, Set<string>>
  }
  private clients: Set<any> = new Set()
  
  protected async onInitialize(): Promise<void> {
    // Initialize WebSocket server for real-time updates
    this.wsServer = new WebSocketServer({ 
      port: this.context.config.visualizationPort || 8080 
    })
    
    this.graphState = {
      nodes: new Map(),
      edges: new Map(),
      clusters: new Map()
    }
    
    // Load initial graph state
    await this.loadGraphState()
    
    // Handle client connections
    this.wsServer.on('connection', (ws) => {
      this.clients.add(ws)
      
      // Send initial state
      ws.send(JSON.stringify({
        type: 'init',
        data: this.serializeGraphState()
      }))
      
      // Handle client messages
      ws.on('message', async (message) => {
        const msg = JSON.parse(message.toString())
        await this.handleClientMessage(msg, ws)
      })
      
      ws.on('close', () => {
        this.clients.delete(ws)
      })
    })
    
    // Start clustering in background
    this.startClusteringWorker()
    
    this.log('Graph visualization server started on port ' + 
             (this.context.config.visualizationPort || 8080))
  }
  
  async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
    const result = await next()
    
    // Update graph state based on operation
    switch (operation) {
      case 'add':
      case 'addNoun':
        await this.handleNodeAdded(result, params)
        break
        
      case 'relate':
      case 'addVerb':
        await this.handleEdgeAdded(params)
        break
        
      case 'delete':
        await this.handleNodeDeleted(params)
        break
        
      case 'search':
        await this.handleSearchPerformed(params, result)
        break
    }
    
    return result
  }
  
  private async handleNodeAdded(id: string, data: any) {
    // Add node to graph
    const node = {
      id,
      label: data.content?.slice(0, 50) || id,
      type: data.metadata?.type || 'default',
      metadata: data.metadata,
      position: this.calculatePosition(id),
      clusterId: null
    }
    
    this.graphState.nodes.set(id, node)
    
    // Broadcast to clients
    this.broadcast({
      type: 'nodeAdded',
      data: node
    })
    
    // Trigger re-clustering
    this.scheduleReClustering()
  }
  
  private async handleEdgeAdded(params: any) {
    const edge = {
      id: `${params.source}-${params.verb}-${params.target}`,
      source: params.source,
      target: params.target,
      label: params.verb,
      weight: params.weight || 1
    }
    
    this.graphState.edges.set(edge.id, edge)
    
    this.broadcast({
      type: 'edgeAdded',
      data: edge
    })
  }
  
  private async handleSearchPerformed(params: any, results: any) {
    // Highlight search results in visualization
    const highlightNodes = results.map((r: any) => r.id)
    
    this.broadcast({
      type: 'highlight',
      data: {
        nodes: highlightNodes,
        query: params.query,
        duration: 5000  // Highlight for 5 seconds
      }
    })
  }
  
  private async loadGraphState() {
    // Load all nodes (nouns)
    const nouns = await this.context.brain.getAllNouns()
    for (const noun of nouns) {
      this.graphState.nodes.set(noun.id, {
        id: noun.id,
        label: noun.content?.slice(0, 50) || noun.id,
        type: noun.type,
        metadata: noun.metadata,
        position: this.calculatePosition(noun.id)
      })
    }
    
    // Load all edges (verbs/relationships)
    const verbs = await this.context.brain.getAllVerbs()
    for (const verb of verbs) {
      this.graphState.edges.set(verb.id, {
        id: verb.id,
        source: verb.source,
        target: verb.target,
        label: verb.type,
        weight: verb.weight
      })
    }
    
    // Initial clustering
    await this.performClustering()
  }
  
  private async performClustering() {
    // Use Brainy's clustering capabilities
    const clusteringResult = await this.context.brain.cluster({
      algorithm: 'hierarchical',
      threshold: 0.7
    })
    
    // Update cluster state
    this.graphState.clusters.clear()
    for (const [clusterId, nodeIds] of Object.entries(clusteringResult)) {
      this.graphState.clusters.set(clusterId, new Set(nodeIds as string[]))
      
      // Update nodes with cluster IDs
      for (const nodeId of nodeIds as string[]) {
        const node = this.graphState.nodes.get(nodeId)
        if (node) {
          node.clusterId = clusterId
        }
      }
    }
    
    // Broadcast cluster update
    this.broadcast({
      type: 'clustersUpdated',
      data: this.serializeClusters()
    })
  }
  
  private startClusteringWorker() {
    // Re-cluster periodically or when graph changes significantly
    setInterval(async () => {
      if (this.graphState.nodes.size > 0) {
        await this.performClustering()
      }
    }, 30000)  // Every 30 seconds
  }
  
  private scheduleReClustering = (() => {
    let timeout: NodeJS.Timeout
    return () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => this.performClustering(), 5000)
    }
  })()
  
  private calculatePosition(id: string) {
    // Simple force-directed layout position
    const hash = id.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    return {
      x: (hash % 1000) - 500,
      y: ((hash * 7) % 1000) - 500
    }
  }
  
  private broadcast(message: any) {
    const data = JSON.stringify(message)
    for (const client of this.clients) {
      client.send(data)
    }
  }
  
  private async handleClientMessage(msg: any, ws: any) {
    switch (msg.type) {
      case 'requestClustering':
        await this.performClustering()
        break
        
      case 'search':
        const results = await this.context.brain.search(msg.query)
        ws.send(JSON.stringify({
          type: 'searchResults',
          data: results
        }))
        break
        
      case 'getNodeDetails':
        const node = await this.context.brain.get(msg.nodeId)
        ws.send(JSON.stringify({
          type: 'nodeDetails',
          data: node
        }))
        break
        
      case 'expandNode':
        const connections = await this.context.brain.getConnections(msg.nodeId)
        ws.send(JSON.stringify({
          type: 'nodeConnections',
          data: connections
        }))
        break
    }
  }
  
  private serializeGraphState() {
    return {
      nodes: Array.from(this.graphState.nodes.values()),
      edges: Array.from(this.graphState.edges.values()),
      clusters: this.serializeClusters()
    }
  }
  
  private serializeClusters() {
    const clusters: any = {}
    for (const [id, nodeIds] of this.graphState.clusters) {
      clusters[id] = Array.from(nodeIds)
    }
    return clusters
  }
  
  protected async onShutdown() {
    this.wsServer.close()
    this.clients.clear()
  }
}

// Usage:
const brain = new BrainyData({
  augmentations: [
    new GraphVisualizationAugmentation()
  ],
  visualizationPort: 8080
})

// Now connect a web-based graph viz tool to ws://localhost:8080
// It receives real-time updates as data changes!
```

## 4. 🌐 Multi-Agent Team Coordination
**"Multiple AI agents sharing knowledge and coordinating tasks"**

```typescript
export class TeamCoordinationAugmentation extends BaseAugmentation {
  readonly name = 'team-coordination'
  readonly timing = 'around' as const
  readonly operations = ['all'] as const
  readonly priority = 85
  
  private agents: Map<string, AgentState> = new Map()
  private tasks: Map<string, Task> = new Map()
  private sharedMemory: Map<string, any> = new Map()
  
  async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
    const agentId = params.metadata?._agentId
    
    if (agentId) {
      // Track agent activity
      this.updateAgentState(agentId, operation, params)
      
      // Check if operation needs coordination
      if (await this.needsCoordination(operation, params)) {
        return await this.coordinatedExecute(agentId, operation, params, next)
      }
    }
    
    return next()
  }
  
  private async coordinatedExecute<T>(
    agentId: string,
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // Acquire distributed lock
    const lockId = await this.acquireLock(operation, params)
    
    try {
      // Check shared memory for related work
      const relatedWork = await this.findRelatedWork(params)
      if (relatedWork) {
        params.metadata._relatedWork = relatedWork
      }
      
      // Execute with team context
      const result = await next()
      
      // Update shared memory
      await this.updateSharedMemory(agentId, operation, params, result)
      
      // Notify other agents
      await this.notifyTeam(agentId, operation, result)
      
      return result
    } finally {
      await this.releaseLock(lockId)
    }
  }
}
```

## 🎯 Key Patterns

All these augmentations follow the same pattern:

1. **Extend BaseAugmentation**
2. **Define timing & operations**
3. **Initialize resources** in `onInitialize()`
4. **Intercept operations** in `execute()`
5. **Clean up** in `onShutdown()`

They can:
- **Add APIs** (REST, WebSocket, MCP)
- **Transform data** (chat queries → operations)
- **Coordinate agents** (distributed locking, shared memory)
- **Visualize in real-time** (WebSocket broadcasts)
- **Integrate any service** (LLMs, databases, APIs)

The beauty is they all use the **same simple interface** but achieve vastly different goals!