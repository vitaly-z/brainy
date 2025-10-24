# Import Progress - Usage Examples

**How to Use Progress Tracking in Your Applications**

Brainy v4.5.0+ provides real-time progress tracking for **all 7 supported file formats** (CSV, PDF, Excel, JSON, Markdown, YAML, DOCX).

> **⚠️ KEY FEATURE:** The progress API is **100% standardized**. Write your progress handler ONCE and it works for ALL formats with zero format-specific code! See [Standard Import Progress API](./standard-import-progress.md) for the complete interface documentation.

---

## 🚀 Quick Start

### Basic Progress Tracking

```typescript
import { Brainy } from '@soulcraft/brainy'
import * as fs from 'fs'

const brain = await Brainy.create()

// Import with progress tracking
const result = await brain.import(fs.readFileSync('large-file.xlsx'), {
  onProgress: (progress) => {
    console.log(`Progress: ${progress.stage}`)
    console.log(`  Message: ${progress.message}`)
    console.log(`  Entities: ${progress.entities || 0}`)
    console.log(`  Relationships: ${progress.relationships || 0}`)
  }
})

console.log(`Import complete: ${result.entities.length} entities created`)
```

**Expected Output:**
```
Progress: detecting
  Message: Detecting format...
  Entities: 0
  Relationships: 0
Progress: extracting
  Message: Loading Excel workbook...
  Entities: 0
  Relationships: 0
Progress: extracting
  Message: Reading sheet: Sales (1/3)
  Entities: 0
  Relationships: 0
Progress: extracting
  Message: Parsing Excel (33%)
  Entities: 0
  Relationships: 0
Progress: extracting
  Message: Reading sheet: Products (2/3)
  Entities: 0
  Relationships: 0
... (more progress updates)
Progress: complete
  Message: Import complete
  Entities: 1523
  Relationships: 892
Import complete: 1523 entities created
```

---

## 🎯 Universal Progress Handler (Works for ALL Formats)

The examples below show format-specific messages, but **you don't need format-specific code**! The `ImportProgress` interface is the same for all formats:

```typescript
// ONE HANDLER FOR ALL FORMATS!
function universalProgressHandler(progress) {
  console.log(`[${progress.stage}] ${progress.message}`)

  if (progress.processed && progress.total) {
    console.log(`  Progress: ${progress.processed}/${progress.total}`)
  }

  if (progress.entities || progress.relationships) {
    console.log(`  Extracted: ${progress.entities || 0} entities, ${progress.relationships || 0} relationships`)
  }

  if (progress.throughput && progress.eta) {
    console.log(`  Rate: ${progress.throughput.toFixed(1)}/sec, ETA: ${Math.round(progress.eta/1000)}s`)
  }
}

// Use it for ANY format!
await brain.import(csvBuffer, { onProgress: universalProgressHandler })
await brain.import(pdfBuffer, { onProgress: universalProgressHandler })
await brain.import(excelBuffer, { onProgress: universalProgressHandler })
await brain.import(jsonBuffer, { onProgress: universalProgressHandler })
await brain.import(markdownString, { onProgress: universalProgressHandler })
await brain.import(yamlBuffer, { onProgress: universalProgressHandler })
await brain.import(docxBuffer, { onProgress: universalProgressHandler })
```

---

## 📊 What Different Formats Look Like (Same Handler!)

The examples below show **what messages look like** for different formats using the **same universal handler** above.

### CSV Import (Row-by-Row Progress)

```typescript
await brain.import(csvBuffer, {
  format: 'csv',
  onProgress: (progress) => {
    if (progress.stage === 'extracting') {
      // CSV reports: "Parsing CSV (45%)", "Extracted 1000 rows", etc.
      console.log(progress.message)
    }
  }
})
```

**CSV Progress Messages:**
- ✅ "Detecting CSV encoding and delimiter..."
- ✅ "Parsing CSV rows (delimiter: ",")"
- ✅ "Parsed 75%"  (via bytes processed)
- ✅ "Extracted 1000 rows"
- ✅ "Converting types: 5000/10000 rows..."
- ✅ "CSV processing complete: 10000 rows"

---

### PDF Import (Page-by-Page Progress)

```typescript
await brain.import(pdfBuffer, {
  format: 'pdf',
  onProgress: (progress) => {
    // PDF reports exact page numbers
    console.log(progress.message)
    // Example: "Processing page 5 of 23"
  }
})
```

**PDF Progress Messages:**
- ✅ "Loading PDF document..."
- ✅ "Processing 23 pages..."
- ✅ "Processing page 5 of 23"
- ✅ "Parsed 22%" (via bytes processed)
- ✅ "Extracted 156 items from PDF"
- ✅ "PDF complete: 23 pages, 156 items extracted"

---

### Excel Import (Sheet-by-Sheet Progress)

```typescript
await brain.import(excelBuffer, {
  format: 'excel',
  onProgress: (progress) => {
    // Excel reports sheet names
    console.log(progress.message)
    // Example: "Reading sheet: Q2 Sales (2/5)"
  }
})
```

**Excel Progress Messages:**
- ✅ "Loading Excel workbook..."
- ✅ "Processing 3 sheets..."
- ✅ "Reading sheet: Sales (1/3)"
- ✅ "Parsing Excel (33%)" (via bytes processed)
- ✅ "Extracted 5234 rows from Excel"
- ✅ "Excel complete: 3 sheets, 5234 rows"

---

### JSON Import (Node Traversal)

```typescript
await brain.import(jsonBuffer, {
  format: 'json',
  onProgress: (progress) => {
    // JSON reports every 10 nodes
    console.log(`Processed ${progress.processed} nodes, found ${progress.entities} entities`)
  }
})
```

---

### Markdown Import (Section-by-Section)

```typescript
await brain.import(markdownString, {
  format: 'markdown',
  onProgress: (progress) => {
    console.log(`Section ${progress.processed}/${progress.total}`)
  }
})
```

---

## 🎯 Building Progress UI Components

### React Progress Bar

```typescript
function ImportProgress({ file }: { file: File }) {
  const [progress, setProgress] = useState({
    stage: 'idle',
    message: '',
    percent: 0,
    entities: 0,
    relationships: 0
  })

  const handleImport = async () => {
    const buffer = await file.arrayBuffer()

    await brain.import(Buffer.from(buffer), {
      onProgress: (p) => {
        setProgress({
          stage: p.stage,
          message: p.message,
          // Estimate percentage from stage
          percent: {
            detecting: 10,
            extracting: 50,
            'storing-vfs': 80,
            'storing-graph': 90,
            complete: 100
          }[p.stage] || 0,
          entities: p.entities || 0,
          relationships: p.relationships || 0
        })
      }
    })
  }

  return (
    <div>
      <ProgressBar value={progress.percent} />
      <p>{progress.message}</p>
      <p>Entities: {progress.entities} | Relationships: {progress.relationships}</p>
    </div>
  )
}
```

---

### CLI Progress Spinner

```typescript
import ora from 'ora'

const spinner = ora('Starting import...').start()

await brain.import(buffer, {
  onProgress: (progress) => {
    spinner.text = progress.message

    if (progress.stage === 'complete') {
      spinner.succeed(`Import complete: ${progress.entities} entities`)
    }
  }
})
```

**CLI Output:**
```
⠋ Detecting format...
⠙ Loading Excel workbook...
⠹ Reading sheet: Sales (1/3)
⠸ Parsing Excel (33%)
⠼ Reading sheet: Products (2/3)
...
✔ Import complete: 1523 entities
```

---

### Progress Dashboard with ETA

```typescript
let startTime = Date.now()
let lastUpdate = startTime

await brain.import(buffer, {
  onProgress: (progress) => {
    const elapsed = Date.now() - startTime
    const rate = progress.entities / (elapsed / 1000)  // entities/sec

    console.clear()
    console.log('Import Progress Dashboard')
    console.log('========================')
    console.log(`Stage: ${progress.stage}`)
    console.log(`Status: ${progress.message}`)
    console.log(`Entities: ${progress.entities}`)
    console.log(`Relationships: ${progress.relationships}`)
    console.log(`Rate: ${rate.toFixed(1)} entities/sec`)
    console.log(`Elapsed: ${(elapsed / 1000).toFixed(1)}s`)
  }
})
```

---

## 🔧 Advanced: Format-Specific Optimization

### Detecting Format to Show Appropriate Progress

```typescript
const formatMessages = {
  csv: (p) => `CSV: ${p.message}`,
  pdf: (p) => `PDF: ${p.message}`,
  excel: (p) => `Excel: ${p.message}`,
  json: (p) => `JSON: ${p.processed} nodes, ${p.entities} entities`,
  markdown: (p) => `Markdown: Section ${p.processed}/${p.total}`,
  yaml: (p) => `YAML: ${p.processed} nodes`,
  docx: (p) => `DOCX: ${p.processed} paragraphs`
}

await brain.import(buffer, {
  onProgress: (progress) => {
    // Format is available in progress.stage metadata
    const message = formatMessages[detectedFormat]?.(progress) || progress.message
    console.log(message)
  }
})
```

---

## ⚡ Performance Tips

### Throttle UI Updates

```typescript
let lastUIUpdate = 0
const THROTTLE_MS = 100  // Update UI max once per 100ms

await brain.import(buffer, {
  onProgress: (progress) => {
    const now = Date.now()
    if (now - lastUIUpdate < THROTTLE_MS && progress.stage !== 'complete') {
      return  // Skip this update
    }

    lastUIUpdate = now
    updateUI(progress)  // Only update every 100ms
  }
})
```

**Note:** Brainy already throttles progress callbacks internally, but additional UI throttling can help with heavy rendering.

---

## 📝 Summary

✅ **All 7 formats** have consistent progress reporting
✅ **Real-time updates** during long imports (no more "0%" hangs)
✅ **Contextual messages** show exactly what's happening
✅ **Build reliable tools** with standardized progress callbacks
✅ **Workshop team problem SOLVED** - users see progress throughout import

**Files Modified:**
- 3 handlers: `csvHandler.ts`, `pdfHandler.ts`, `excelHandler.ts`
- 7 importers: `SmartCSVImporter.ts`, `SmartPDFImporter.ts`, `SmartExcelImporter.ts`, `SmartJSONImporter.ts`, `SmartMarkdownImporter.ts`, `SmartYAMLImporter.ts`, `SmartDOCXImporter.ts`

**Result:** Comprehensive, consistent progress tracking across ALL import formats!
