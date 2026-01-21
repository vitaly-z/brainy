# Brainy Integrations

Connect Brainy to spreadsheets, BI tools, and external systems with zero configuration.

## Quick Start

```typescript
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy({ integrations: true })
await brain.init()

// That's it! Your endpoints are ready:
console.log(brain.hub.endpoints)
// { odata: '/odata', sheets: '/sheets', sse: '/events', webhooks: '/webhooks' }
```

## Supported Tools

| Tool | Protocol | How to Connect |
|------|----------|----------------|
| Excel | OData | Data → Get Data → From OData Feed → `http://your-server/odata` |
| Power BI | OData | Get Data → OData Feed → `http://your-server/odata` |
| Tableau | OData | Connect → OData → `http://your-server/odata` |
| Google Sheets | REST | Install Apps Script add-on (see below) |
| Any SSE Client | SSE | `new EventSource('http://your-server/events')` |

---

## Excel (Power Query)

### Connect in 3 clicks:

1. **Data** tab → **Get Data** → **From Other Sources** → **From OData Feed**
2. Enter URL: `http://your-server/odata`
3. Click **OK** → **Load**

### Query Options

Excel Power Query supports OData query parameters:

```
/odata/Entities?$filter=Type eq 'person'&$top=100
/odata/Entities?$select=Id,Type,Metadata_name
/odata/Entities?$orderby=CreatedAt desc
/odata/Entities?$search=machine learning
```

### Refresh Data

- Manual: **Data** → **Refresh All**
- Automatic: **Query Properties** → Set refresh interval

---

## Power BI

### Connect:

1. **Get Data** → **OData Feed**
2. Enter URL: `http://your-server/odata`
3. Select tables: `Entities`, `Relationships`
4. Click **Load**

### Advanced

Power BI DirectQuery is supported for real-time data.

---

## Tableau

### Connect:

1. **Connect** → **To a Server** → **OData**
2. Enter: `http://your-server/odata`
3. Drag tables to canvas

---

## Google Sheets

### Setup (5 minutes):

1. Open your Google Sheet
2. **Extensions** → **Apps Script**
3. Delete existing code
4. Copy `integrations/google-sheets/Code.gs` into the editor
5. Create new file `Sidebar.html`, paste from `integrations/google-sheets/Sidebar.html`
6. **Project Settings** → **Script properties** → Add:
   - `BRAINY_URL` = `http://your-server`
7. Save and refresh spreadsheet

### Custom Functions:

```
=BRAINY_QUERY("type:person", 100)     // Query entities
=BRAINY_GET("entity-id")               // Get one entity
=BRAINY_SIMILAR("machine learning", 5) // Semantic search
=BRAINY_RELATIONS("entity-id", "from") // Get relationships
```

### Sidebar:

**Extensions** → **Brainy** → **Open Sidebar**

- Search and insert results
- Add new entities
- Sync selected range to Brainy

---

## Real-Time Streaming (SSE)

### JavaScript:

```javascript
const source = new EventSource('http://your-server/events')

source.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log('Change:', data)
}

// Filter by type
const filtered = new EventSource('http://your-server/events?types=noun&operations=create,update')
```

### Query Parameters:

- `types` - Entity types: `noun`, `verb`, `vfs`
- `operations` - Operations: `create`, `update`, `delete`
- `nounTypes` - Filter by noun type: `person`, `document`, etc.

---

## Webhooks

Push events to external URLs:

```typescript
const brain = new Brainy({ integrations: true })
await brain.init()

// Register a webhook
await brain.hub.webhooks?.register({
  url: 'https://your-app.com/webhook',
  events: { entityTypes: ['noun'], operations: ['create', 'update'] },
  secret: 'your-hmac-secret'  // optional, for signature verification
})
```

### Webhook Payload:

```json
{
  "events": [
    {
      "id": "event-123",
      "type": "noun",
      "operation": "create",
      "entityId": "entity-456",
      "timestamp": 1704067200000
    }
  ],
  "deliveredAt": 1704067201000
}
```

### Signature Verification:

Webhooks include `X-Brainy-Signature` header with HMAC-SHA256 signature.

---

## Server Examples

### Minimal (in-memory):

```typescript
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy({ integrations: true })
await brain.init()

// Add some data
await brain.add({ type: 'Person', metadata: { name: 'Alice' } })

// Get connection instructions
console.log(brain.hub.getInstructions())
```

### Express:

```typescript
import express from 'express'
import { Brainy } from '@soulcraft/brainy'

const app = express()
const brain = new Brainy({
  storage: { type: 'filesystem', options: { basePath: './data' } },
  integrations: true
})
await brain.init()

app.use(express.json())

// Route all integrations
app.all(['/odata/*', '/sheets/*', '/events/*'], async (req, res) => {
  const response = await brain.hub.handleRequest({
    method: req.method,
    path: req.path,
    query: req.query as Record<string, string>,
    headers: req.headers as Record<string, string>,
    body: req.body
  })

  res.status(response.status).set(response.headers)
  if (response.body) res.json(response.body)
  else res.end()
})

app.listen(3000, () => {
  console.log('Brainy server ready!')
  console.log('Excel/Power BI: http://localhost:3000/odata')
  console.log('Google Sheets: http://localhost:3000/sheets')
  console.log('SSE Stream: http://localhost:3000/events')
})
```

### Hono (Cloudflare Workers):

```typescript
import { Hono } from 'hono'
import { Brainy } from '@soulcraft/brainy'

const app = new Hono()

const brain = new Brainy({
  storage: { type: 'memory' },
  integrations: true
})
await brain.init()

app.all('/odata/*', async (c) => {
  const response = await brain.hub.handleRequest({
    method: c.req.method,
    path: c.req.path,
    query: Object.fromEntries(new URL(c.req.url).searchParams),
    headers: Object.fromEntries(c.req.raw.headers),
    body: await c.req.json().catch(() => undefined)
  })
  return c.json(response.body, response.status)
})

export default app
```

---

## Configuration

### Custom Base Path:

```typescript
const brain = new Brainy({
  integrations: { basePath: '/api/v1' }
})
await brain.init()

// Endpoints become:
// /api/v1/odata
// /api/v1/sheets
// /api/v1/events
```

### Select Integrations:

```typescript
// Only OData and Sheets
const brain = new Brainy({
  integrations: { enable: ['odata', 'sheets'] }
})
await brain.init()
```

### Per-Integration Config:

```typescript
const brain = new Brainy({
  integrations: {
    config: {
      odata: { basePath: '/data' },
      sse: { heartbeatInterval: 15000 }
    }
  }
})
await brain.init()
```

---

## Troubleshooting

### Excel: "Can't connect to OData feed"
- Ensure server is running and accessible
- Check firewall settings
- Try opening URL in browser first

### Google Sheets: "Brainy URL not configured"
- Add `BRAINY_URL` in Apps Script → Project Settings → Script properties

### Power BI: "Invalid OData"
- Ensure `$metadata` endpoint returns valid XML
- Try: `http://your-server/odata/$metadata`

### SSE: "Connection dropped"
- Check network/proxy timeout settings
- The integration sends heartbeats every 30 seconds by default

---

## API Reference

### OData Endpoints

```
GET  /odata/$metadata      - Schema (XML)
GET  /odata/Entities       - List entities
GET  /odata/Entities('id') - Get entity
GET  /odata/Relationships  - List relationships
POST /odata/Entities       - Create entity
```

### Sheets Endpoints

```
GET  /sheets/query?q=...&limit=100  - Query entities
GET  /sheets/entity/:id             - Get entity
GET  /sheets/similar?text=...&k=10  - Semantic search
POST /sheets/add                    - Add entity
```

### SSE Endpoint

```
GET /events                           - All events
GET /events?types=noun                - Filter by type
GET /events?operations=create,update  - Filter by operation
```
