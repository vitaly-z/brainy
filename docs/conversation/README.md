# Infinite Agent Memory - Conversation API

**Never lose context again.** Brainy's Conversation API provides infinite memory and context management for AI agents like Claude Code, enabling truly continuous conversations with semantic search, smart context retrieval, and automatic knowledge preservation.

## Overview

The Conversation API turns your agent interactions into a living knowledge graph where:
- **Every message is preserved** with semantic embeddings for instant retrieval
- **Context is automatically retrieved** using Triple Intelligence (vector + graph + metadata)
- **Similar conversations are discovered** through neural clustering
- **Code artifacts are linked** to the conversations that created them
- **Memory scales infinitely** to millions of messages with <100ms retrieval

## Quick Start

### Zero-Config Usage

```typescript
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy()  // Zero configuration!
await brain.init()

// Access conversation manager (lazy-loaded)
const conv = brain.conversation

// Save messages with automatic embedding and indexing
const messageId = await conv.saveMessage(
  "How do I implement JWT authentication?",
  "user",
  { conversationId: "conv_123" }
)

// Get relevant context with semantic search
const context = await conv.getRelevantContext("authentication implementation", {
  limit: 10,
  includeArtifacts: true
})

// Context includes:
// - Semantically similar messages
// - Recent related conversations
// - Linked code artifacts
// - Relevance scores and explanations
```

### Claude Code Integration (MCP)

One-time setup:

```bash
brainy conversation setup
```

That's it! Claude Code automatically:
- Saves every message with embeddings
- Retrieves relevant past context
- Links code artifacts to conversations
- Never loses context or momentum

## Core Concepts

### 1. Messages

Every message is a **semantic entity** with:
- **Content**: The actual message text
- **Role**: user, assistant, system, or tool
- **Embeddings**: Automatic vector representation
- **Metadata**: Timestamps, conversation ID, phase, confidence, etc.
- **Relationships**: Temporal links to previous/next messages

```typescript
const messageId = await conv.saveMessage(
  "Implement user authentication",
  "user",
  {
    conversationId: "conv_123",
    phase: "planning",
    confidence: 0.95,
    tags: ["authentication", "security"]
  }
)
```

### 2. Conversations

A conversation is a **collection of related messages**:
- Tracked by `conversationId`
- Contains temporal message sequence
- Stores aggregate metadata (tokens, duration, participants)
- Can span multiple sessions

```typescript
const thread = await conv.getConversationThread("conv_123", {
  includeArtifacts: true
})

console.log(`${thread.messages.length} messages, ${thread.metadata.totalTokens} tokens`)
```

### 3. Context Retrieval

Smart context retrieval uses **Triple Intelligence**:
- **Semantic**: Vector similarity to find related messages
- **Temporal**: Recency decay favors recent context
- **Graph**: Relationship traversal finds connected knowledge

```typescript
const context = await conv.getRelevantContext("how to validate JWT tokens", {
  limit: 10,
  maxTokens: 50000,
  relevanceThreshold: 0.7,
  weights: {
    semantic: 1.0,  // Prioritize meaning
    temporal: 0.5,  // Recent is relevant
    graph: 0.3      // Connected knowledge
  }
})
```

### 4. Artifacts

Code and files created during conversations are **first-class citizens**:
- Stored in Brainy's Virtual Filesystem
- Linked to messages via graph relationships
- Searchable by content and metadata
- Retrieved with context

```typescript
const artifactId = await conv.saveArtifact(
  '/auth/middleware.ts',
  codeContent,
  {
    conversationId: "conv_123",
    messageId: messageId,
    type: 'code',
    language: 'typescript'
  }
)
```

## API Reference

### ConversationManager

#### `saveMessage(content, role, options)`

Save a message with automatic embedding.

**Parameters:**
- `content` (string): Message content
- `role` (MessageRole): 'user' | 'assistant' | 'system' | 'tool'
- `options` (SaveMessageOptions):
  - `conversationId?`: Conversation ID (auto-generated if not provided)
  - `sessionId?`: Session ID
  - `phase?`: Problem-solving phase
  - `confidence?`: Confidence score (0-1)
  - `artifacts?`: Array of artifact IDs
  - `toolsUsed?`: Array of tool names
  - `tags?`: Array of tags
  - `linkToPrevious?`: ID of previous message

**Returns:** `Promise<string>` - Message ID

**Example:**
```typescript
const id = await conv.saveMessage(
  "Implement authentication middleware",
  "assistant",
  {
    conversationId: "conv_123",
    phase: "implementation",
    confidence: 0.92,
    artifacts: ["middleware-id"],
    toolsUsed: ["write", "edit"],
    tags: ["authentication", "middleware"]
  }
)
```

#### `getRelevantContext(query, options)`

Retrieve relevant context with smart ranking.

**Parameters:**
- `query` (string | ContextRetrievalOptions): Query or full options
- `options?` (ContextRetrievalOptions):
  - `limit?`: Max messages (default: 10)
  - `maxTokens?`: Token budget (default: 50000)
  - `relevanceThreshold?`: Min score (default: 0.7)
  - `role?`: Filter by role
  - `phase?`: Filter by phase
  - `tags?`: Filter by tags
  - `timeRange?`: Time range filter
  - `weights?`: Scoring weights
  - `includeArtifacts?`: Include linked artifacts
  - `includeSimilarConversations?`: Include similar conversations

**Returns:** `Promise<ConversationContext>`

**Example:**
```typescript
const context = await conv.getRelevantContext({
  query: "JWT token validation",
  limit: 15,
  maxTokens: 60000,
  role: "assistant",
  phase: ["implementation", "testing"],
  tags: ["authentication"],
  includeArtifacts: true,
  includeSimilarConversations: true
})

console.log(`Found ${context.messages.length} relevant messages`)
console.log(`Total tokens: ${context.totalTokens}`)
console.log(`Query time: ${context.metadata.queryTime}ms`)
```

#### `searchMessages(options)`

Search messages with semantic similarity.

**Parameters:**
- `options` (ConversationSearchOptions):
  - `query`: Search query (required)
  - `limit?`: Max results (default: 10)
  - `role?`: Filter by role
  - `conversationId?`: Filter by conversation
  - `sessionId?`: Filter by session
  - `timeRange?`: Time range filter

**Returns:** `Promise<ConversationSearchResult[]>`

**Example:**
```typescript
const results = await conv.searchMessages({
  query: "authentication errors",
  limit: 20,
  role: "assistant",
  timeRange: {
    start: Date.now() - 7*24*60*60*1000 // Last 7 days
  }
})

for (const result of results) {
  console.log(`${result.message.role}: ${result.snippet}`)
  console.log(`Score: ${result.score}, Conv: ${result.conversationId}`)
}
```

#### `getConversationThread(conversationId, options)`

Get complete conversation thread.

**Parameters:**
- `conversationId` (string): Conversation ID
- `options?`:
  - `includeArtifacts?`: Include linked artifacts

**Returns:** `Promise<ConversationThread>`

**Example:**
```typescript
const thread = await conv.getConversationThread("conv_123", {
  includeArtifacts: true
})

console.log(`Conversation: ${thread.id}`)
console.log(`Messages: ${thread.metadata.messageCount}`)
console.log(`Duration: ${new Date(thread.metadata.endTime) - new Date(thread.metadata.startTime)}ms`)

for (const msg of thread.messages) {
  console.log(`[${msg.role}] ${msg.content}`)
}
```

#### `findSimilarConversations(conversationId, limit, threshold)`

Find similar past conversations.

**Parameters:**
- `conversationId` (string): Conversation to find similar to
- `limit?` (number): Max results (default: 5)
- `threshold?` (number): Min similarity (default: 0.7)

**Returns:** `Promise<Array<{id, relevance, metadata}>>`

**Example:**
```typescript
const similar = await conv.findSimilarConversations("conv_123", 5, 0.75)

for (const s of similar) {
  console.log(`Similar conversation: ${s.id}`)
  console.log(`Relevance: ${s.relevance.toFixed(2)}`)
}
```

#### `getConversationThemes(conversationId)`

Discover themes via clustering.

**Parameters:**
- `conversationId` (string): Conversation ID

**Returns:** `Promise<ConversationTheme[]>`

**Example:**
```typescript
const themes = await conv.getConversationThemes("conv_123")

for (const theme of themes) {
  console.log(`Theme: ${theme.label}`)
  console.log(`Messages: ${theme.messages.length}`)
  console.log(`Coherence: ${theme.coherence}`)
}
```

#### `saveArtifact(path, content, options)`

Save code/file artifact.

**Parameters:**
- `path` (string): VFS path
- `content` (string | Buffer): File content
- `options` (ArtifactOptions):
  - `conversationId`: Conversation ID (required)
  - `messageId?`: Message ID to link
  - `type?`: 'code' | 'config' | 'data' | 'document' | 'other'
  - `language?`: Programming language
  - `description?`: Artifact description

**Returns:** `Promise<string>` - Artifact ID

**Example:**
```typescript
const artifactId = await conv.saveArtifact(
  '/auth/jwt-middleware.ts',
  middlewareCode,
  {
    conversationId: "conv_123",
    messageId: messageId,
    type: 'code',
    language: 'typescript',
    description: 'JWT authentication middleware'
  }
)
```

#### `getConversationStats(conversationId?)`

Get conversation statistics.

**Parameters:**
- `conversationId?` (string): Optional conversation to filter

**Returns:** `Promise<ConversationStats>`

**Example:**
```typescript
const stats = await conv.getConversationStats()

console.log(`Total conversations: ${stats.totalConversations}`)
console.log(`Total messages: ${stats.totalMessages}`)
console.log(`Total tokens: ${stats.totalTokens}`)
console.log(`By role:`, stats.roles)
console.log(`By phase:`, stats.phases)
```

#### `exportConversation(conversationId)`

Export conversation to JSON.

**Returns:** `Promise<any>` - Serializable conversation object

#### `importConversation(data)`

Import conversation from JSON.

**Returns:** `Promise<string>` - New conversation ID

## Advanced Usage

### Custom Relevance Weights

Fine-tune context retrieval:

```typescript
const context = await conv.getRelevantContext(query, {
  weights: {
    semantic: 0.6,  // Less weight on exact matching
    temporal: 0.8,  // More weight on recent messages
    graph: 0.4      // Moderate weight on relationships
  }
})
```

### Phase-Based Filtering

Track problem-solving progress:

```typescript
const planningMessages = await conv.searchMessages({
  query: "authentication approach",
  role: "assistant",
  phase: ["planning", "analysis"]
})
```

### Time-Based Analysis

Analyze conversation evolution:

```typescript
const recentContext = await conv.getRelevantContext(query, {
  timeRange: {
    start: Date.now() - 24*60*60*1000  // Last 24 hours
  }
})
```

### Multi-Session Conversations

Track across sessions:

```typescript
// Session 1
await conv.saveMessage(content1, "user", {
  conversationId: "conv_123",
  sessionId: "session_1"
})

// Session 2 (different day)
await conv.saveMessage(content2, "user", {
  conversationId: "conv_123",  // Same conversation!
  sessionId: "session_2"
})
```

## Performance

- **Message save**: <50ms (with embedding)
- **Context retrieval**: <100ms (10 messages)
- **Search**: <150ms (1000s of messages)
- **Theme clustering**: <500ms
- **Scales to**: 10M+ messages
- **Storage**: Efficient vector + graph storage

## Next Steps

- [MCP Integration Guide](./MCP_INTEGRATION.md) - Claude Code setup
- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Examples](./EXAMPLES.md) - Code examples and patterns
- [Advanced Features](./ADVANCED.md) - Advanced usage and optimization