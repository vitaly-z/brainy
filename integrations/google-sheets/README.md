# Brainy Google Sheets Add-on

Two-way sync between Brainy and Google Sheets.

## Quick Setup

1. Open your Google Sheet
2. Go to **Extensions → Apps Script**
3. Delete any existing code
4. Copy and paste `Code.gs` into the editor
5. Create a new HTML file called `Sidebar.html` and paste the content
6. Go to **Project Settings** (gear icon) → **Script properties**
7. Add property: `BRAINY_URL` = your Brainy server URL (e.g., `http://localhost:3000`)
8. Save and refresh your spreadsheet

## Custom Functions

Use these directly in cells:

### `=BRAINY_QUERY(query, limit)`
Query entities using semantic search or type filter.

```
=BRAINY_QUERY("machine learning", 10)
=BRAINY_QUERY("type:person", 100)
```

### `=BRAINY_GET(id)`
Get a single entity by ID.

```
=BRAINY_GET("entity-uuid-here")
```

### `=BRAINY_SIMILAR(text, limit)`
Find semantically similar entities.

```
=BRAINY_SIMILAR("artificial intelligence research", 5)
```

### `=BRAINY_RELATIONS(entityId, direction)`
Get relationships for an entity.

```
=BRAINY_RELATIONS("entity-id", "from")
=BRAINY_RELATIONS("entity-id", "to")
=BRAINY_RELATIONS("entity-id", "both")
```

### `=BRAINY_TYPES()`
List all available entity types.

### `=BRAINY_RELATION_TYPES()`
List all available relationship types.

## Sidebar

Open via **Brainy → Open Sidebar** menu:

- **Search**: Query entities and insert results into the sheet
- **Add**: Create new entities with a form
- **Sync**: Sync selected range to Brainy (add or update)

## Authentication

If your Brainy server requires authentication:

1. Go to **Project Settings → Script properties**
2. Add property: `BRAINY_API_KEY` = your API key

## Real-Time Sync

For real-time updates, enable SSE in your Brainy server:

```javascript
brain.augmentations.register(new SSEIntegration())
```

The sidebar will automatically show changes as they happen.

## Troubleshooting

### "Brainy URL not configured"
Add the `BRAINY_URL` script property in Apps Script settings.

### "Connection failed"
- Check that your Brainy server is running
- Ensure the URL is correct (include port if needed)
- For local development, use ngrok or similar to expose localhost

### Custom functions not appearing
- Refresh the spreadsheet
- Wait a few seconds (Apps Script can be slow to register)
- Check the Apps Script execution log for errors

## Server Setup

The simplest way to enable all integrations:

```javascript
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy({ integrations: true })
await brain.init()

console.log(brain.hub.endpoints)
// { odata: '/odata', sheets: '/sheets', sse: '/events', webhooks: '/webhooks' }
```

With Express:

```javascript
import express from 'express'
import { Brainy } from '@soulcraft/brainy'

const app = express()
const brain = new Brainy({ integrations: true })
await brain.init()

// Route all integration requests
app.use(express.json())
app.all(['/odata/*', '/sheets/*', '/events/*'], async (req, res) => {
  const response = await brain.hub.handleRequest({
    method: req.method,
    path: req.path,
    query: req.query,
    headers: req.headers,
    body: req.body
  })

  if (response.isSSE) {
    // Handle SSE stream
    res.setHeader('Content-Type', 'text/event-stream')
    // ... streaming logic
  } else {
    res.status(response.status).set(response.headers).json(response.body)
  }
})

app.listen(3000)
```
