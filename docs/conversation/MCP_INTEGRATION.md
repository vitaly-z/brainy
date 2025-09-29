# MCP Integration - Claude Code Setup

**One command. Infinite memory.** This guide shows you how to give Claude Code infinite context and conversation history using Brainy's Model Control Protocol (MCP) integration.

## Quick Setup

### One-Time Configuration

```bash
# Install Brainy globally (if not already installed)
npm install -g @soulcraft/brainy

# Set up MCP server for Claude Code
brainy conversation setup
```

**That's it!** Claude Code now has infinite memory.

### What This Does

The setup command:
1. Creates `~/.brainy-memory/` directory
2. Initializes Brainy database with filesystem storage
3. Creates MCP server script
4. Registers server with Claude Code
5. Ready to use - no configuration needed

## How It Works

### Automatic Integration

Once set up, Claude Code **automatically**:

**On Every Message:**
- Saves your message with semantic embeddings
- Saves Claude's response with metadata
- Links code artifacts to conversations
- Tracks problem-solving phase and confidence
- Indexes everything for instant retrieval

**On Conversation Start:**
- Retrieves relevant past context
- Finds similar previous conversations
- Loads linked code artifacts
- Presents context to Claude seamlessly

**Result:** Claude never loses context or momentum, even across completely separate conversations.

### User Experience

**Before:**
```
You: "How do I implement JWT auth?"
Claude: [Implements authentication]

[Days later, new conversation]
You: "Can you fix the JWT token validation?"
Claude: "I don't have context about your JWT implementation..."
```

**After:**
```
You: "How do I implement JWT auth?"
Claude: [Implements authentication, saves to Brainy]

[Days later, new conversation]
You: "Can you fix the JWT token validation?"
Claude: "I found 3 related past conversations about JWT...
         Here's the implementation from /auth/middleware.ts..."
         [Full context automatically retrieved]
```

## MCP Tools

The MCP server exposes 6 conversation tools that Claude Code uses automatically:

### 1. conversation_save_message

Saves a message to conversation history.

**Used by:** Claude Code automatically after each message
**Parameters:**
- `content`: Message text
- `role`: 'user' | 'assistant' | 'system' | 'tool'
- `conversationId`: Conversation identifier
- `phase`: Problem-solving phase
- `confidence`: Confidence score
- `artifacts`: Array of artifact IDs
- `toolsUsed`: Tools used in this message

### 2. conversation_get_context

Retrieves relevant past context.

**Used by:** Claude Code at conversation start or when context is needed
**Parameters:**
- `query`: What to retrieve context for
- `limit`: Max messages (default: 10)
- `maxTokens`: Token budget (default: 50000)
- `relevanceThreshold`: Min similarity (default: 0.7)
- `includeArtifacts`: Include code/files
- `includeSimilarConversations`: Include similar past conversations

**Returns:**
- Ranked messages with relevance scores
- Linked artifacts
- Similar past conversations
- Metadata (query time, tokens, etc.)

### 3. conversation_search

Searches all conversations semantically.

**Used by:** When Claude needs to find specific past information
**Parameters:**
- `query`: Search query
- `role`: Filter by role
- `conversationId`: Filter by conversation
- `timeRange`: Time range filter

### 4. conversation_get_thread

Gets complete conversation thread.

**Used by:** When Claude needs full conversation history
**Parameters:**
- `conversationId`: Conversation ID
- `includeArtifacts`: Include linked artifacts

### 5. conversation_save_artifact

Saves code/file artifacts.

**Used by:** When Claude creates files
**Parameters:**
- `path`: File path
- `content`: File content
- `conversationId`: Conversation ID
- `messageId`: Message that created it
- `type`: 'code' | 'config' | 'data' | 'document'
- `language`: Programming language

### 6. conversation_find_similar

Finds similar past conversations.

**Used by:** For discovering related work
**Parameters:**
- `conversationId`: Conversation to find similar to
- `limit`: Max results
- `threshold`: Similarity threshold

## MCP Server Architecture

### Server Location

```
~/.brainy-memory/
├── mcp-server.js         # MCP server script
└── data/                 # Brainy database
    ├── nouns/           # Messages
    ├── verbs/           # Relationships
    └── index/           # Search indexes
```

### Server Script

The generated server script (`~/.brainy-memory/mcp-server.js`):

```javascript
import { Brainy } from '@soulcraft/brainy'
import { BrainyMCPService } from '@soulcraft/brainy'
import { MCPConversationToolset } from '@soulcraft/brainy'

// Initialize Brainy
const brain = new Brainy({
  storage: {
    type: 'filesystem',
    path: '~/.brainy-memory/data'
  },
  silent: true
})
await brain.init()

// Create MCP service
const mcpService = new BrainyMCPService(brain)
const conversationTools = new MCPConversationToolset(brain)

// Handle MCP requests via stdio
process.stdin.on('data', async (data) => {
  const request = JSON.parse(data.toString())

  let response
  if (request.toolName?.startsWith('conversation_')) {
    response = await conversationTools.handleRequest(request)
  } else {
    response = await mcpService.handleRequest(request)
  }

  process.stdout.write(JSON.stringify(response) + '\\n')
})
```

### Claude Code Configuration

Located at `~/.config/claude-code/mcp-servers.json`:

```json
{
  "brainy-memory": {
    "command": "node",
    "args": ["~/.brainy-memory/mcp-server.js"],
    "env": {
      "NODE_ENV": "production"
    }
  }
}
```

## Advanced Configuration

### Custom Storage Location

Edit `~/.brainy-memory/mcp-server.js`:

```javascript
const brain = new Brainy({
  storage: {
    type: 'filesystem',
    path: '/path/to/custom/location'
  }
})
```

### Cloud Storage (Multi-Device Sync)

Use S3-compatible storage for sync across machines:

```javascript
const brain = new Brainy({
  storage: {
    type: 's3',
    bucket: 'my-brainy-memory',
    region: 'us-east-1'
  }
})
```

**Requirements:** Set AWS credentials in environment:
```bash
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=yyy
```

### Memory Storage (Testing)

For testing or temporary use:

```javascript
const brain = new Brainy({
  storage: { type: 'memory' }
})
```

**Note:** Memory storage is lost on server restart.

### Context Retrieval Options

Customize context retrieval behavior:

```javascript
const context = await conversationManager.getRelevantContext(query, {
  limit: 15,                  // More messages
  maxTokens: 80000,          // Larger context window
  relevanceThreshold: 0.6,   // Lower threshold = more results
  weights: {
    semantic: 0.7,           // Adjust relevance weights
    temporal: 0.6,
    graph: 0.4
  }
})
```

## Troubleshooting

### Server Not Starting

**Check logs:**
```bash
# Server writes to stderr
tail -f ~/.brainy-memory/server.log
```

**Common issues:**
1. **Node version**: Requires Node.js 22 LTS
2. **Permissions**: Ensure ~/.brainy-memory is writable
3. **Port conflicts**: MCP uses stdio, no ports needed

### Claude Code Not Using Memory

**Verify setup:**
```bash
# Check MCP server is registered
cat ~/.config/claude-code/mcp-servers.json

# Test server manually
echo '{"type":"system_info","infoType":"version","requestId":"test","version":"1.0.0"}' | node ~/.brainy-memory/mcp-server.js
```

**Expected output:**
```json
{"success":true,"requestId":"test","version":"1.0.0","data":{"version":"1.0.0"}}
```

### Memory Not Persisting

**Check storage:**
```bash
# Verify data directory exists
ls -la ~/.brainy-memory/data/

# Check database files
du -sh ~/.brainy-memory/data/
```

**If empty:** Server may be using memory storage. Check `mcp-server.js` configuration.

### Performance Issues

**Optimize database:**
```bash
# Rebuild indexes
brainy conversation stats  # This triggers index optimization
```

**Check size:**
```bash
# Show storage usage
du -sh ~/.brainy-memory/
```

**If too large:** Consider cloud storage or compaction strategies.

## CLI Commands

Manage conversations via CLI:

### View Statistics

```bash
brainy conversation stats
```

Output:
```
📊 Conversation Statistics

Overall:
  Conversations: 42
  Messages: 1,337
  Total Tokens: 567,890
  Avg Messages/Conversation: 31.8
  Avg Tokens/Message: 425.1

By Role:
  user: 650
  assistant: 687

By Phase:
  implementation: 423
  planning: 201
  testing: 98
```

### Search Messages

```bash
brainy conversation search -q "authentication" -l 10
```

### Get Context

```bash
brainy conversation context -q "JWT token validation" -l 15
```

### View Thread

```bash
brainy conversation thread -c conv_abc123
```

### Export Conversation

```bash
brainy conversation export -c conv_abc123 -o backup.json
```

### Import Conversation

```bash
brainy conversation import -o backup.json
```

## Security & Privacy

### Local-First by Default

- All data stored locally in `~/.brainy-memory/`
- No external services or APIs
- Complete privacy and control

### Data Encryption

For sensitive conversations, use encrypted filesystem:

```bash
# Create encrypted volume
hdiutil create -size 1g -encryption AES-256 -volname BrainyMemory ~/brainy-secure.dmg

# Mount and use
hdiutil attach ~/brainy-secure.dmg
brainy conversation setup --path /Volumes/BrainyMemory
```

### Access Control

MCP server runs with your user permissions. No additional authentication needed for local use.

## Next Steps

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Examples](./EXAMPLES.md) - Usage examples and patterns
- [Advanced Features](./ADVANCED.md) - Advanced configuration and optimization

## Support

Issues or questions:
- GitHub: [soulcraftlabs/brainy/issues](https://github.com/soulcraftlabs/brainy/issues)
- Documentation: [docs.brainy.ai](https://docs.brainy.ai)