# Brainy Augmentations

Augmentations are the core extensibility mechanism in Brainy. They allow you to modify, enhance, and extend Brainy's behavior without changing the core code.

## Core Principle: One Interface, Infinite Possibilities

Every augmentation implements the same simple `BrainyAugmentation` interface:

```typescript
interface BrainyAugmentation {
  name: string
  timing: 'before' | 'after' | 'around' | 'replace'
  operations: string[]
  priority: number
  initialize(context): Promise<void>
  execute(operation, params, next): Promise<any>
}
```

This single interface can handle EVERYTHING - from adding AI capabilities to exposing APIs to replacing storage backends.

## Available Augmentations

### 🧠 Data Processing
Augmentations that enhance how data is processed and stored.

| Augmentation | Description | Timing | Status |
|-------------|-------------|--------|--------|
| **NeuralImportAugmentation** | AI-powered entity and relationship extraction | `before` | ✅ Production |
| **EntityRegistryAugmentation** | High-performance entity deduplication | `before` | ✅ Production |
| **BatchProcessingAugmentation** | Optimizes bulk operations | `around` | ✅ Production |
| **IntelligentVerbScoringAugmentation** | Learns relationship importance over time | `after` | ✅ Production |

### 🔌 External Connections (Synapses)
Connect Brainy to external services and data sources.

| Augmentation | Description | Timing | Status |
|-------------|-------------|--------|--------|
| **NotionSynapse** | Sync with Notion databases | `after` | 📝 Example |
| **SalesforceSynapse** | Connect to Salesforce CRM | `after` | 📝 Example |
| **SlackSynapse** | Import Slack conversations | `after` | 📝 Example |
| **GoogleDriveSynapse** | Sync Google Drive documents | `after` | 📝 Example |

### 🌐 API Exposure
Expose Brainy through various protocols.

| Augmentation | Description | Timing | Status |
|-------------|-------------|--------|--------|
| **APIServerAugmentation** | REST, WebSocket, and MCP server | `after` | ✅ Production |
| **GraphQLAugmentation** | GraphQL API endpoint | `after` | 🚧 Planned |
| **gRPCAugmentation** | gRPC service | `after` | 🚧 Planned |

### 💾 Storage Backends
Replace or enhance the storage layer.

| Augmentation | Description | Timing | Status |
|-------------|-------------|--------|--------|
| **S3StorageAugmentation** | Use S3 as storage backend | `replace` | 📝 Example |
| **RedisAugmentation** | Redis caching layer | `around` | 📝 Example |
| **PostgresAugmentation** | PostgreSQL persistence | `replace` | 📝 Example |

### 🔄 Real-time & Sync
Handle real-time updates and synchronization.

| Augmentation | Description | Timing | Status |
|-------------|-------------|--------|--------|
| **WebSocketConduitAugmentation** | WebSocket client connections | `after` | ⚠️ Legacy |
| **ServerSearchAugmentation** | Connect to remote Brainy servers | `after` | ⚠️ Legacy |
| **TeamCoordinationAugmentation** | Multi-agent synchronization | `after` | 📝 Example |

### 🛡️ Infrastructure
Core infrastructure and reliability features.

| Augmentation | Description | Timing | Status |
|-------------|-------------|--------|--------|
| **ConnectionPoolAugmentation** | Optimize cloud storage connections | `before` | ✅ Production |
| **RequestDeduplicatorAugmentation** | Prevent duplicate concurrent requests | `before` | ✅ Production |
| **TransactionAugmentation** | ACID transaction support | `around` | 🚧 Planned |
| **CacheAugmentation** | Multi-level caching | `around` | ✅ Production |

### 📊 Monitoring & Analytics
Track and analyze Brainy's behavior.

| Augmentation | Description | Timing | Status |
|-------------|-------------|--------|--------|
| **MetricsAugmentation** | Prometheus metrics | `after` | 📝 Example |
| **LoggingAugmentation** | Structured logging | `after` | 📝 Example |
| **TracingAugmentation** | Distributed tracing | `around` | 🚧 Planned |

### 🤖 AI & Chat
AI-powered interfaces and chat capabilities.

| Augmentation | Description | Timing | Status |
|-------------|-------------|--------|--------|
| **ChatInterfaceAugmentation** | Natural language interface | `before` | 📝 Example |
| **MCPAgentMemoryAugmentation** | AI agent memory via MCP | `after` | 📝 Example |
| **LLMQueryAugmentation** | LLM-enhanced queries | `before` | 📝 Example |

### 📈 Visualization
Visual representations of data.

| Augmentation | Description | Timing | Status |
|-------------|-------------|--------|--------|
| **GraphVisualizationAugmentation** | Real-time graph visualization | `after` | 📝 Example |
| **DashboardAugmentation** | Web-based dashboard | `after` | 🚧 Planned |

## Status Legend

- ✅ **Production**: Fully implemented and tested
- 📝 **Example**: Example implementation available
- 🚧 **Planned**: On the roadmap
- ⚠️ **Legacy**: Being replaced by newer augmentations

## Using Augmentations

### Zero-Config Approach

```typescript
const brain = new Brainy()

// Just register augmentations - they work automatically!
brain.augmentations.register(new EntityRegistryAugmentation())
brain.augmentations.register(new APIServerAugmentation())

await brain.init()
```

### With Configuration

```typescript
const brain = new Brainy()

brain.augmentations.register(
  new APIServerAugmentation({
    port: 8080,
    auth: { required: true }
  })
)

await brain.init()
```

## Creating Custom Augmentations

See [Creating Custom Augmentations](./creating-augmentations.md) for a complete guide.

Quick example:

```typescript
class MyAugmentation extends BaseAugmentation {
  readonly name = 'my-augmentation'
  readonly timing = 'after'
  readonly operations = ['add', 'search']
  readonly priority = 50
  
  async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
    console.log(`Before ${operation}`)
    const result = await next()
    console.log(`After ${operation}`)
    return result
  }
}
```

## Augmentation Timing

### `before`
Executes before the main operation. Used for:
- Input validation
- Data transformation
- Authentication checks

### `after`
Executes after the main operation. Used for:
- Broadcasting updates
- Syncing to external services
- Logging and metrics

### `around`
Wraps the main operation. Used for:
- Transactions
- Caching
- Error handling

### `replace`
Completely replaces the main operation. Used for:
- Alternative storage backends
- Mock implementations
- Proxy operations

## Priority System

Higher numbers execute first:
- **100**: Critical system operations
- **50**: Performance optimizations
- **10**: Enhancement features
- **1**: Optional features

## Related Documentation

- [API Server Augmentation](./api-server.md) - Complete API server documentation
- [Creating Augmentations](./creating-augmentations.md) - How to build your own
- [Augmentation Examples](../AUGMENTATION-EXAMPLES.md) - Real-world examples
- [Architecture Overview](../COMPLETE-ARCHITECTURE-VISION.md) - System architecture