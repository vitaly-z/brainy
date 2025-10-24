# Import Progress Implementation Guide
**For Developers: How to Add Progress Tracking to ANY File Handler**

> This guide shows the **standard pattern** for implementing rich progress tracking in Brainy import handlers. Follow this template for **all 7 supported formats** (CSV, PDF, Excel, JSON, Markdown, YAML, DOCX) or any future file format.

---

## 📊 Supported Formats & Consistent Progress Reporting

> **⚠️ IMPORTANT FOR DEVELOPERS:** The public API (`ImportProgress`) is 100% standardized across all formats. You can build ONE progress handler that works for CSV, PDF, Excel, JSON, Markdown, YAML, and DOCX with **zero format-specific code**. See [Standard Import Progress API](./standard-import-progress.md) for details.

**ALL 7 formats now have consistent, standardized progress reporting** for building reliable import tools:

| Format | Category | Progress Points | File Location | Status |
|--------|----------|-----------------|---------------|--------|
| **CSV** | Tabular | Parsing → Row extraction → Type conversion → Complete | `handlers/csvHandler.ts` + `SmartCSVImporter.ts` | ✅ Complete |
| **PDF** | Document | Loading → Page-by-page → Item extraction → Complete | `handlers/pdfHandler.ts` + `SmartPDFImporter.ts` | ✅ Complete |
| **Excel** | Tabular | Loading → Sheet-by-sheet → Row extraction → Type conversion → Complete | `handlers/excelHandler.ts` + `SmartExcelImporter.ts` | ✅ Complete |
| **JSON** | Structured | Parsing → Node traversal (every 10 nodes) → Complete | `SmartJSONImporter.ts` | ✅ Complete |
| **Markdown** | Document | Parsing → Section-by-section → Complete | `SmartMarkdownImporter.ts` | ✅ Complete |
| **YAML** | Structured | Parsing → Node traversal (every 10 nodes) → Complete | `SmartYAMLImporter.ts` | ✅ Complete |
| **DOCX** | Document | Parsing → Paragraph-by-paragraph (every 10) → Complete | `SmartDOCXImporter.ts` | ✅ Complete |

### The Standard Public API

**Developers calling `brain.import()` see ONE standardized interface** regardless of format:

```typescript
// THE PUBLIC API - Same for ALL 7 formats!
brain.import(buffer, {
  onProgress: (progress: ImportProgress) => {
    // These fields work for CSV, PDF, Excel, JSON, Markdown, YAML, DOCX
    progress.stage          // 'detecting' | 'extracting' | 'storing-vfs' | 'storing-graph' | 'complete'
    progress.message        // Human-readable status (varies by format, always readable)
    progress.processed      // Items processed (optional)
    progress.total          // Total items (optional)
    progress.entities       // Entities extracted (optional)
    progress.relationships  // Relationships inferred (optional)
    progress.throughput     // Items/sec (optional, during extraction)
    progress.eta            // Time remaining in ms (optional)
  }
})
```

**Internal Implementation** (for developers adding new format handlers):

The table below shows how formats implement progress *internally*. Normal developers don't need to know this - they just use the standard `ImportProgress` interface above!

```typescript
// Internal: Binary formats use handler hooks (you added these!)
interface FormatHandlerProgressHooks {
  onBytesProcessed?: (bytes: number) => void
  onCurrentItem?: (message: string) => void
  onDataExtracted?: (count: number, total?: number) => void
}

// Internal: Text formats use importer callbacks
interface ImporterProgressCallback {
  onProgress?: (stats: { processed, total, entities, relationships }) => void
}

// Both are converted to ImportProgress by ImportCoordinator!
```

### Developer Benefits

✅ **Consistent API** - Same pattern across all 7 formats
✅ **Throttled Updates** - Progress reported every 10-1000 items (no spam)
✅ **Contextual Messages** - "Processing page 5 of 23", "Reading sheet: Sales (2/5)"
✅ **Real-time Estimates** - Users see progress during long imports
✅ **Build Monitoring Tools** - Reliable progress data for UIs, dashboards, CLI tools

---

## 🎯 Overview

As of v4.5.0, Brainy supports comprehensive, multi-dimensional progress tracking for imports:
- **Bytes processed** (always available, most deterministic)
- **Entities extracted** (AI extraction phase)
- **Stage-specific metrics** (parsing: MB/s, extraction: entities/s)
- **Time estimates** (remaining time, total time)
- **Context information** ("Processing page 5 of 23")

All handlers follow a simple, consistent pattern using **progress hooks**.

---

## 📋 The Progress Hooks Pattern

### 1. Progress Hooks Interface

```typescript
export interface FormatHandlerProgressHooks {
  /**
   * Report bytes processed
   * Call this as you read/parse the file
   */
  onBytesProcessed?: (bytes: number) => void

  /**
   * Set current processing context
   * Examples: "Processing page 5", "Reading sheet: Q2 Sales"
   */
  onCurrentItem?: (item: string) => void

  /**
   * Report structured data extraction progress
   * Examples: "Extracted 100 rows", "Parsed 50 paragraphs"
   */
  onDataExtracted?: (count: number, total?: number) => void
}
```

### 2. Handler Options (Automatic)

Progress hooks are automatically passed to your handler via `FormatHandlerOptions`:

```typescript
export interface FormatHandlerOptions {
  // ... existing options ...

  /**
   * Progress hooks (v4.5.0)
   * Handlers call these to report progress during processing
   */
  progressHooks?: FormatHandlerProgressHooks

  /**
   * Total file size in bytes (v4.5.0)
   * Used for progress percentage calculation
   */
  totalBytes?: number
}
```

**You don't need to modify FormatHandlerOptions** - it's already done!

### 3. Standard Implementation Pattern

Every handler follows these 5 steps:

```typescript
async process(data: Buffer | string, options: FormatHandlerOptions): Promise<ProcessedData> {
  const progressHooks = options.progressHooks  // Step 1: Get hooks

  // Step 2: Report initial progress
  if (progressHooks?.onCurrentItem) {
    progressHooks.onCurrentItem('Starting import...')
  }

  // Step 3: Report bytes as you process
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
  if (progressHooks?.onBytesProcessed) {
    progressHooks.onBytesProcessed(0)  // Start
  }

  // ... do parsing ...

  if (progressHooks?.onBytesProcessed) {
    progressHooks.onBytesProcessed(buffer.length)  // Complete
  }

  // Step 4: Report data extraction
  if (progressHooks?.onDataExtracted) {
    progressHooks.onDataExtracted(data.length, data.length)
  }

  // Step 5: Report completion
  if (progressHooks?.onCurrentItem) {
    progressHooks.onCurrentItem(`Complete: ${data.length} items processed`)
  }

  return { format, data, metadata }
}
```

---

## 📚 Complete Example: CSV Handler

Here's the **ACTUAL implementation** from CSV handler showing all the key progress points:

```typescript
async process(data: Buffer | string, options: FormatHandlerOptions): Promise<ProcessedData> {
  const startTime = Date.now()
  const progressHooks = options.progressHooks  // ✅ Step 1

  // Convert to buffer if string
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8')
  const totalBytes = buffer.length

  // ✅ Step 2: Report start
  if (progressHooks?.onBytesProcessed) {
    progressHooks.onBytesProcessed(0)
  }
  if (progressHooks?.onCurrentItem) {
    progressHooks.onCurrentItem('Detecting CSV encoding and delimiter...')
  }

  // Detect encoding
  const detectedEncoding = options.encoding || this.detectEncodingSafe(buffer)
  const text = buffer.toString(detectedEncoding as BufferEncoding)

  // Detect delimiter
  const delimiter = options.csvDelimiter || this.detectDelimiter(text)

  // ✅ Progress update: Parsing phase
  if (progressHooks?.onCurrentItem) {
    progressHooks.onCurrentItem(`Parsing CSV rows (delimiter: "${delimiter}")...`)
  }

  // Parse CSV
  const records = parse(text, { /* options */ })

  // ✅ Step 3: Report bytes processed (entire file parsed)
  if (progressHooks?.onBytesProcessed) {
    progressHooks.onBytesProcessed(totalBytes)
  }

  const data = Array.isArray(records) ? records : [records]

  // ✅ Step 4: Report data extraction
  if (progressHooks?.onDataExtracted) {
    progressHooks.onDataExtracted(data.length, data.length)
  }
  if (progressHooks?.onCurrentItem) {
    progressHooks.onCurrentItem(`Extracted ${data.length} rows, inferring types...`)
  }

  // Type inference and conversion
  const fields = data.length > 0 ? Object.keys(data[0]) : []
  const types = this.inferFieldTypes(data)

  const convertedData = data.map((row, index) => {
    const converted = this.convertRow(row, types)

    // ✅ Progress update every 1000 rows (avoid spam)
    if (progressHooks?.onCurrentItem && index > 0 && index % 1000 === 0) {
      progressHooks.onCurrentItem(`Converting types: ${index}/${data.length} rows...`)
    }

    return converted
  })

  // ✅ Step 5: Report completion
  if (progressHooks?.onCurrentItem) {
    progressHooks.onCurrentItem(`CSV processing complete: ${convertedData.length} rows`)
  }

  return {
    format: this.format,
    data: convertedData,
    metadata: { /* ... */ }
  }
}
```

### Key Progress Points in CSV Handler

| Progress Point | Hook Used | Message Example |
|----------------|-----------|-----------------|
| **Start** | `onCurrentItem` | "Detecting CSV encoding and delimiter..." |
| **Start bytes** | `onBytesProcessed(0)` | 0 bytes |
| **Parsing** | `onCurrentItem` | "Parsing CSV rows (delimiter: \",\")..." |
| **Bytes complete** | `onBytesProcessed(totalBytes)` | All bytes read |
| **Data extracted** | `onDataExtracted(count, total)` | Number of rows extracted |
| **Type conversion** | `onCurrentItem` (every 1000 rows) | "Converting types: 5000/10000 rows..." |
| **Complete** | `onCurrentItem` | "CSV processing complete: 10000 rows" |

---

## 📖 Implementation Guide by File Type

### Supported Formats

Brainy supports **7 file formats** with full progress tracking:

**Binary Formats** (use handlers):
1. **CSV** - Row-by-row parsing with type inference
2. **PDF** - Page-by-page extraction with table detection
3. **Excel** - Sheet-by-sheet processing with formula evaluation

**Text/Structured Formats** (parse inline):
4. **JSON** - Recursive traversal of nested structures
5. **Markdown** - Section-by-section with heading extraction
6. **YAML** - Hierarchical traversal with relationship inference
7. **DOCX** - Paragraph-by-paragraph with structure analysis

---

### PDF Handler (Multi-Page)

```typescript
async process(data: Buffer, options: FormatHandlerOptions): Promise<ProcessedData> {
  const progressHooks = options.progressHooks
  const totalBytes = data.length

  // Report start
  if (progressHooks?.onCurrentItem) {
    progressHooks.onCurrentItem('Loading PDF document...')
  }

  const pdfDoc = await loadPDF(data)
  const totalPages = pdfDoc.numPages

  const extractedData: any[] = []
  let bytesProcessed = 0

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    // ✅ Report current page
    if (progressHooks?.onCurrentItem) {
      progressHooks.onCurrentItem(`Processing page ${pageNum} of ${totalPages}`)
    }

    const page = await pdfDoc.getPage(pageNum)
    const text = await page.getTextContent()
    extractedData.push(this.processPageText(text))

    // ✅ Estimate bytes processed (pages are sequential)
    bytesProcessed = Math.floor((pageNum / totalPages) * totalBytes)
    if (progressHooks?.onBytesProcessed) {
      progressHooks.onBytesProcessed(bytesProcessed)
    }

    // ✅ Report extraction progress
    if (progressHooks?.onDataExtracted) {
      progressHooks.onDataExtracted(pageNum, totalPages)
    }
  }

  // Final progress
  if (progressHooks?.onBytesProcessed) {
    progressHooks.onBytesProcessed(totalBytes)
  }
  if (progressHooks?.onCurrentItem) {
    progressHooks.onCurrentItem(`PDF complete: ${totalPages} pages processed`)
  }

  return { format: 'pdf', data: extractedData, metadata: { /* ... */ } }
}
```

### Excel Handler (Multi-Sheet)

```typescript
async process(data: Buffer, options: FormatHandlerOptions): Promise<ProcessedData> {
  const progressHooks = options.progressHooks
  const totalBytes = data.length

  // Load workbook
  if (progressHooks?.onCurrentItem) {
    progressHooks.onCurrentItem('Loading Excel workbook...')
  }

  const workbook = XLSX.read(data)
  const sheetNames = options.excelSheets === 'all'
    ? workbook.SheetNames
    : (options.excelSheets || [workbook.SheetNames[0]])

  const allData: any[] = []
  let bytesProcessed = 0

  for (let i = 0; i < sheetNames.length; i++) {
    const sheetName = sheetNames[i]

    // ✅ Report current sheet
    if (progressHooks?.onCurrentItem) {
      progressHooks.onCurrentItem(`Reading sheet: ${sheetName} (${i + 1}/${sheetNames.length})`)
    }

    const sheet = workbook.Sheets[sheetName]
    const sheetData = XLSX.utils.sheet_to_json(sheet)
    allData.push(...sheetData)

    // ✅ Estimate bytes processed (sheets processed sequentially)
    bytesProcessed = Math.floor(((i + 1) / sheetNames.length) * totalBytes)
    if (progressHooks?.onBytesProcessed) {
      progressHooks.onBytesProcessed(bytesProcessed)
    }

    // ✅ Report data extraction
    if (progressHooks?.onDataExtracted) {
      progressHooks.onDataExtracted(allData.length, undefined) // Total unknown until done
    }
  }

  // Final progress
  if (progressHooks?.onBytesProcessed) {
    progressHooks.onBytesProcessed(totalBytes)
  }
  if (progressHooks?.onCurrentItem) {
    progressHooks.onCurrentItem(`Excel complete: ${sheetNames.length} sheets, ${allData.length} rows`)
  }

  return { format: 'xlsx', data: allData, metadata: { /* ... */ } }
}
```

### JSON Importer (Recursive Traversal)

```typescript
async extract(data: any, options: SmartJSONOptions = {}): Promise<SmartJSONResult> {
  // ✅ Report parsing start
  options.onProgress?.({ processed: 0, entities: 0, relationships: 0 })

  // Parse JSON if string
  let jsonData = typeof data === 'string' ? JSON.parse(data) : data

  // ✅ Report parsing complete
  options.onProgress?.({ processed: 0, entities: 0, relationships: 0 })

  // Traverse and extract (reports progress every 10 nodes)
  const entities: ExtractedJSONEntity[] = []
  const relationships: ExtractedJSONRelationship[] = []
  let nodesProcessed = 0

  await this.traverseJSON(
    jsonData,
    entities,
    relationships,
    () => {
      nodesProcessed++
      if (nodesProcessed % 10 === 0) {
        options.onProgress?.({
          processed: nodesProcessed,
          entities: entities.length,
          relationships: relationships.length
        })
      }
    }
  )

  // ✅ Report completion
  options.onProgress?.({
    processed: nodesProcessed,
    entities: entities.length,
    relationships: relationships.length
  })

  return { nodesProcessed, entitiesExtracted: entities.length, ... }
}
```

### Markdown Importer (Section-Based)

```typescript
async extract(markdown: string, options: SmartMarkdownOptions = {}): Promise<SmartMarkdownResult> {
  // ✅ Report parsing start
  options.onProgress?.({ processed: 0, total: 0, entities: 0, relationships: 0 })

  // Parse markdown into sections
  const parsedSections = this.parseMarkdown(markdown, options)

  // ✅ Report parsing complete
  options.onProgress?.({ processed: 0, total: parsedSections.length, entities: 0, relationships: 0 })

  // Process each section (reports progress after each section)
  const sections: MarkdownSection[] = []
  for (let i = 0; i < parsedSections.length; i++) {
    const section = await this.processSection(parsedSections[i], options)
    sections.push(section)

    options.onProgress?.({
      processed: i + 1,
      total: parsedSections.length,
      entities: sections.reduce((sum, s) => sum + s.entities.length, 0),
      relationships: sections.reduce((sum, s) => sum + s.relationships.length, 0)
    })
  }

  // ✅ Report completion
  options.onProgress?.({
    processed: sections.length,
    total: sections.length,
    entities: sections.reduce((sum, s) => sum + s.entities.length, 0),
    relationships: sections.reduce((sum, s) => sum + s.relationships.length, 0)
  })

  return { sectionsProcessed: sections.length, ... }
}
```

### YAML Importer (Hierarchical)

```typescript
async extract(yamlContent: string | Buffer, options: SmartYAMLOptions = {}): Promise<SmartYAMLResult> {
  // ✅ Report parsing start
  options.onProgress?.({ processed: 0, entities: 0, relationships: 0 })

  // Parse YAML
  const yamlString = typeof yamlContent === 'string' ? yamlContent : yamlContent.toString('utf-8')
  const data = yaml.load(yamlString)

  // ✅ Report parsing complete
  options.onProgress?.({ processed: 0, entities: 0, relationships: 0 })

  // Traverse YAML structure (reports progress every 10 nodes)
  // ... similar to JSON traversal ...

  // ✅ Report completion (already implemented)
  options.onProgress?.({
    processed: nodesProcessed,
    entities: entities.length,
    relationships: relationships.length
  })

  return { nodesProcessed, entitiesExtracted: entities.length, ... }
}
```

### DOCX Importer (Paragraph-Based)

```typescript
async extract(buffer: Buffer, options: SmartDOCXOptions = {}): Promise<SmartDOCXResult> {
  // ✅ Report parsing start
  options.onProgress?.({ processed: 0, entities: 0, relationships: 0 })

  // Extract text and HTML using Mammoth
  const textResult = await mammoth.extractRawText({ buffer })
  const htmlResult = await mammoth.convertToHtml({ buffer })

  // ✅ Report parsing complete
  options.onProgress?.({ processed: 0, entities: 0, relationships: 0 })

  // Process paragraphs (reports progress every 10 paragraphs)
  const paragraphs = textResult.value.split(/\n\n+/).filter(p => p.trim().length >= minLength)

  for (let i = 0; i < paragraphs.length; i++) {
    await this.processParagraph(paragraphs[i])

    if (i % 10 === 0) {
      options.onProgress?.({
        processed: i + 1,
        entities: entities.length,
        relationships: relationships.length
      })
    }
  }

  // ✅ Report completion (already implemented)
  options.onProgress?.({
    processed: paragraphs.length,
    entities: entities.length,
    relationships: relationships.length
  })

  return { paragraphsProcessed: paragraphs.length, ... }
}
```

---

## 🎯 Best Practices

### 1. Always Check if Hooks Exist

Progress hooks are **optional**. Always check before calling:

```typescript
// ✅ Good - safe
if (progressHooks?.onBytesProcessed) {
  progressHooks.onBytesProcessed(bytes)
}

// ❌ Bad - will crash if hooks undefined
progressHooks.onBytesProcessed(bytes)  // TypeError!
```

### 2. Report Bytes at Start and End

```typescript
// ✅ Good - clear start and end
progressHooks?.onBytesProcessed(0)              // Start
// ... processing ...
progressHooks?.onBytesProcessed(totalBytes)     // End

// ❌ Bad - no clear boundaries
// ... just start processing without reporting start
```

### 3. Throttle Frequent Updates

```typescript
// ✅ Good - report every 1000 items
for (let i = 0; i < items.length; i++) {
  processItem(items[i])

  if (i > 0 && i % 1000 === 0) {
    progressHooks?.onCurrentItem(`Processing: ${i}/${items.length}`)
  }
}

// ❌ Bad - report EVERY item (spam!)
for (let i = 0; i < items.length; i++) {
  processItem(items[i])
  progressHooks?.onCurrentItem(`Processing: ${i}/${items.length}`)  // 1M callbacks!
}
```

### 4. Provide Contextual Messages

```typescript
// ✅ Good - specific and helpful
progressHooks?.onCurrentItem('Parsing CSV rows (delimiter: ",")')
progressHooks?.onCurrentItem('Processing page 5 of 23')
progressHooks?.onCurrentItem('Reading sheet: Q2 Sales Data')

// ❌ Bad - vague
progressHooks?.onCurrentItem('Processing...')
progressHooks?.onCurrentItem('Working...')
```

### 5. Report Data Extraction with Totals (if known)

```typescript
// ✅ Good - total known
progressHooks?.onDataExtracted(100, 1000)  // 100 of 1000 rows

// ✅ Also good - total unknown (streaming)
progressHooks?.onDataExtracted(100, undefined)  // 100 rows so far

// ✅ Also good - complete
progressHooks?.onDataExtracted(1000, 1000)  // All 1000 rows
```

---

## 🔧 Testing Your Handler

### Manual Test

```typescript
import { CSVHandler } from './csvHandler.js'
import * as fs from 'fs'

const handler = new CSVHandler()
const data = fs.readFileSync('./test.csv')

const result = await handler.process(data, {
  filename: 'test.csv',
  progressHooks: {
    onBytesProcessed: (bytes) => {
      console.log(`Bytes: ${bytes}`)
    },
    onCurrentItem: (item) => {
      console.log(`Status: ${item}`)
    },
    onDataExtracted: (count, total) => {
      console.log(`Extracted: ${count}${total ? `/${total}` : ''}`)
    }
  }
})

console.log(`Complete: ${result.data.length} rows`)
```

### Expected Output

```
Status: Detecting CSV encoding and delimiter...
Bytes: 0
Status: Parsing CSV rows (delimiter: ",")...
Bytes: 52438
Extracted: 1000/1000
Status: Extracted 1000 rows, inferring types...
Status: CSV processing complete: 1000 rows
Complete: 1000 rows
```

---

## 📊 Progress Flow Diagram

```
User Imports File
       ↓
ImportManager
       ↓
Creates ProgressTracker
       ↓
Calls Handler.process() with progressHooks
       ↓
Handler Reports Progress:
  ├─ onBytesProcessed(0)          → ProgressTracker → overall_progress calculated
  ├─ onCurrentItem("Parsing...")  → ProgressTracker → stage_message updated
  ├─ onBytesProcessed(bytes)      → ProgressTracker → bytes_per_second calculated
  ├─ onDataExtracted(count)       → ProgressTracker → entities_extracted updated
  └─ onCurrentItem("Complete")    → ProgressTracker → final progress
       ↓
ProgressTracker emits to callback (throttled 100ms)
       ↓
User sees:
  "Overall: 45% | PARSING | 12.5 MB/s | Parsing CSV rows..."
```

---

## ✅ Checklist for New Handlers

When implementing a new file format handler:

- [ ] Get `progressHooks` from `options`
- [ ] Get `totalBytes` (if available)
- [ ] Report `onBytesProcessed(0)` at start
- [ ] Report `onCurrentItem()` for key stages
- [ ] Report `onBytesProcessed()` as you process
- [ ] Report `onDataExtracted()` when you extract data
- [ ] Throttle frequent updates (every 1000 items max)
- [ ] Report `onBytesProcessed(totalBytes)` at end
- [ ] Report final `onCurrentItem()` with summary
- [ ] Test with progress callback to verify output

---

## 🎓 Summary

**The Pattern (5 Steps)**:
1. Get `progressHooks` from options
2. Report start (`onBytesProcessed(0)`, `onCurrentItem("Starting...")`)
3. Report progress as you process (`onBytesProcessed(bytes)`, `onCurrentItem("Page 5...")`)
4. Report data extraction (`onDataExtracted(count, total)`)
5. Report completion (`onBytesProcessed(totalBytes)`, `onCurrentItem("Complete")`)

**Always Check**: `progressHooks?.method()`

**Throttle**: Report every N items, not every single item

**Context**: Provide specific, helpful messages

**Testing**: Use manual test with console.log callbacks

---

**This pattern makes it trivial to add progress tracking to ANY file format. Copy this template and adapt for your handler!**
