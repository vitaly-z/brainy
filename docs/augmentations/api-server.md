# API Server Augmentation

## Overview

The `APIServerAugmentation` is a powerful augmentation that exposes your Brainy instance through REST, WebSocket, and MCP (Model Context Protocol) APIs. It transforms Brainy into a full-featured API server with zero configuration required.

## Features

### 🌐 REST API
Complete CRUD operations and advanced queries through HTTP endpoints.

### 🔌 WebSocket Server
Real-time bidirectional communication with automatic operation broadcasting.

### 🧠 MCP Integration
Built-in Model Context Protocol support for AI agent communication.

### 📊 Operation Broadcasting
Automatically broadcasts all Brainy operations to subscribed WebSocket clients.

### 🔒 Optional Security
Built-in authentication and rate limiting when needed.

## Installation

The APIServerAugmentation is included in Brainy core. No additional installation required.

For Node.js environments, you may want to install optional dependencies:
```bash
npm install express cors ws
```

## Zero-Config Usage

```typescript
import { Brainy } from 'brainy'
import { APIServerAugmentation } from 'brainy/augmentations'

const brain = new Brainy()

// Register the API server augmentation
brain.augmentations.register(new APIServerAugmentation())

await brain.init()

// Server is now running at http://localhost:3000
console.log('API Server ready!')
console.log('REST: http://localhost:3000/api/*')
console.log('WebSocket: ws://localhost:3000/ws')
console.log('MCP: http://localhost:3000/api/mcp')
```

## Configuration Options

While zero-config works great, you can customize the server:

```typescript
const apiServer = new APIServerAugmentation({
  enabled: true,           // Enable/disable the server
  port: 3000,             // HTTP port
  host: '0.0.0.0',        // Bind address
  
  cors: {
    origin: '*',          // CORS allowed origins
    credentials: true     // Allow credentials
  },
  
  auth: {
    required: false,      // Require authentication
    apiKeys: [],         // Valid API keys
    bearerTokens: []     // Valid bearer tokens
  },
  
  rateLimit: {
    windowMs: 60000,     // Rate limit window (ms)
    max: 100            // Max requests per window
  }
})
```

## REST API Endpoints

### Health Check
```http
GET /health
```
Returns server status and basic metrics.

### Search
```http
POST /api/search
Content-Type: application/json

{
  "query": "search text",
  "limit": 10,
  "options": {}
}
```

### Add Data
```http
POST /api/add
Content-Type: application/json

{
  "content": "data to add",
  "metadata": {
    "key": "value"
  }
}
```

### Get by ID
```http
GET /api/get/:id
```

### Delete
```http
DELETE /api/delete/:id
```

### Create Relationship
```http
POST /api/relate
Content-Type: application/json

{
  "source": "id1",
  "target": "id2",
  "verb": "relates_to",
  "metadata": {}
}
```

### Complex Queries
```http
POST /api/find
Content-Type: application/json

{
  "where": { "type": "document" },
  "like": "machine learning",
  "limit": 10
}
```

### Clustering
```http
POST /api/cluster
Content-Type: application/json

{
  "algorithm": "kmeans",
  "options": {
    "k": 5
  }
}
```

### Statistics
```http
GET /api/stats
```

### Operation History
```http
GET /api/history
```

## WebSocket API

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3000/ws')

ws.onopen = () => {
  console.log('Connected to Brainy WebSocket')
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  console.log('Received:', msg)
}
```

### Subscribe to Operations
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  operations: ['all']  // or specific: ['add', 'search', 'delete']
}))
```

### Search via WebSocket
```javascript
ws.send(JSON.stringify({
  type: 'search',
  query: 'your search',
  limit: 10,
  requestId: 'unique-id'
}))
```

### Add Data via WebSocket
```javascript
ws.send(JSON.stringify({
  type: 'add',
  content: 'data to add',
  metadata: {},
  requestId: 'unique-id'
}))
```

### Operation Broadcasts
When subscribed, you'll receive real-time updates:
```javascript
{
  "type": "operation",
  "operation": "add",
  "params": { /* sanitized parameters */ },
  "timestamp": 1234567890,
  "duration": 15
}
```

## MCP (Model Context Protocol)

The MCP endpoint allows AI agents to interact with Brainy:

```http
POST /api/mcp
Content-Type: application/json

{
  "method": "search",
  "params": {
    "query": "find documents about AI"
  }
}
```

## Authentication

When authentication is enabled:

### API Key
```http
GET /api/stats
X-API-Key: your-api-key
```

### Bearer Token
```http
GET /api/stats
Authorization: Bearer your-token
```

## Environment Support

### Node.js ✅
Full support with Express, WebSocket, and all features.

### Deno 🚧
Planned support using Deno.serve() or oak framework.

### Browser/Service Worker 🚧
Planned support for intercepting fetch() calls locally.

## How It Works

The APIServerAugmentation hooks into Brainy's augmentation pipeline:

1. **Timing**: Executes `after` operations complete
2. **Operations**: Monitors `all` operations
3. **Broadcasting**: Sends operation details to subscribed clients
4. **History**: Maintains operation history (last 1000 operations)

## Example: Multi-Client Sync

```typescript
// Server
const brain = new Brainy()
brain.augmentations.register(new APIServerAugmentation())
await brain.init()

// Client 1 - WebSocket subscriber
const ws1 = new WebSocket('ws://localhost:3000/ws')
ws1.onopen = () => {
  ws1.send(JSON.stringify({
    type: 'subscribe',
    operations: ['add', 'delete']
  }))
}
ws1.onmessage = (e) => {
  console.log('Client 1 received update:', JSON.parse(e.data))
}

// Client 2 - REST API user
fetch('http://localhost:3000/api/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'New data',
    metadata: { source: 'client2' }
  })
})
// Client 1 automatically receives notification!
```

## Performance Considerations

- **Operation History**: Limited to last 1000 operations
- **WebSocket Heartbeat**: Every 30 seconds
- **Client Timeout**: 60 seconds of inactivity
- **Parameter Sanitization**: Sensitive fields removed, large content truncated
- **Rate Limiting**: In-memory tracking (use Redis in production)

## Security Notes

1. **Default Configuration**: No auth, open CORS - suitable for development
2. **Production**: Enable auth, configure CORS, use HTTPS
3. **Sensitive Data**: Parameters are sanitized before broadcasting
4. **Rate Limiting**: Basic in-memory implementation included

## Comparison with Previous Implementations

The APIServerAugmentation unifies and replaces:
- `BrainyMCPBroadcast` - Node-specific WebSocket/HTTP server
- `WebSocketConduitAugmentation` - WebSocket client functionality  
- `ServerSearchAugmentations` - Remote Brainy connections

Benefits of the unified approach:
- Single augmentation for all API needs
- Consistent interface across protocols
- Automatic operation broadcasting
- Environment-aware implementation
- Zero-configuration philosophy

## Advanced Usage

### Custom Operation Filtering

```typescript
class FilteredAPIServer extends APIServerAugmentation {
  shouldExecute(operation: string, params: any): boolean {
    // Don't broadcast sensitive operations
    if (operation === 'delete' && params.sensitive) {
      return false
    }
    return true
  }
}
```

### Integration with Other Augmentations

```typescript
const brain = new Brainy()

// Stack augmentations for complete system
brain.augmentations.register(new EntityRegistryAugmentation()) // Dedup
brain.augmentations.register(new APIServerAugmentation())      // API

await brain.init()
// All augmentations work together seamlessly!
```

## Troubleshooting

### Server won't start
- Check if port is already in use
- Verify Node.js dependencies are installed: `npm install express cors ws`
- Check console for error messages

### WebSocket connections drop
- Ensure heartbeat responses are handled
- Check for proxy/firewall issues
- Verify CORS configuration

### Authentication not working
- Ensure `auth.required` is set to `true`
- Verify API keys or bearer tokens are correctly configured
- Check request headers are properly formatted

## Future Enhancements

- [ ] Deno server implementation
- [ ] Service Worker implementation  
- [ ] GraphQL endpoint
- [ ] gRPC support
- [ ] Built-in SSL/TLS
- [ ] Redis-based rate limiting
- [ ] Prometheus metrics endpoint
- [ ] OpenAPI/Swagger documentation

## Related Documentation

- [Augmentation System Overview](../AUGMENTATION-SYSTEM.md)
- [BrainyAugmentation Interface](./brainy-augmentation.md)
- [MCP Integration](../mcp/README.md)
- [Zero-Config Philosophy](../ZERO-CONFIG.md)