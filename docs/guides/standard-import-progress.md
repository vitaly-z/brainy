# Standard Import Progress API

## ✅ Build Once, Works for ALL Formats

**Brainy provides a 100% standardized progress API** - write your UI/tool once, and it works for all 7 supported formats (CSV, PDF, Excel, JSON, Markdown, YAML, DOCX) with **zero format-specific code**.

---

## 🎯 The Standard Interface

### One Interface for Everything

```typescript
import { Brainy } from '@soulcraft/brainy'

const brain = await Brainy.create()

// THIS CODE WORKS FOR ALL 7 FORMATS - NO FORMAT-SPECIFIC LOGIC NEEDED!
await brain.import(anyBuffer, {
  onProgress: (progress) => {
    // Standard fields - ALWAYS available regardless of format
    console.log(progress.stage)          // Current stage
    console.log(progress.message)        // Human-readable status

    // Optional fields - available when relevant
    console.log(progress.processed)      // Items processed so far
    console.log(progress.total)          // Total items (if known)
    console.log(progress.entities)       // Entities extracted
    console.log(progress.relationships)  // Relationships inferred
    console.log(progress.throughput)     // Items/sec (during extraction)
    console.log(progress.eta)            // Time remaining in ms
  }
})
```

### The Complete Interface

```typescript
interface ImportProgress {
  // === ALWAYS PRESENT ===

  /** High-level stage (5 stages for all formats) */
  stage: 'detecting' | 'extracting' | 'storing-vfs' | 'storing-graph' | 'complete'

  /** Human-readable status message */
  message: string

  // === AVAILABLE WHEN RELEVANT ===

  /** Items processed (rows, pages, nodes, etc.) */
  processed?: number

  /** Total items to process (if known ahead of time) */
  total?: number

  /** Entities extracted so far */
  entities?: number

  /** Relationships inferred so far */
  relationships?: number

  /** Processing rate (items per second) */
  throughput?: number

  /** Estimated time remaining (milliseconds) */
  eta?: number

  /** Whether data is queryable at this point (v4.2.0+) */
  queryable?: boolean
}
```

---

## 🎨 Generic UI Components

### React Progress Component (Works for ALL Formats)

```typescript
import { useState } from 'react'
import { Brainy } from '@soulcraft/brainy'

function UniversalImportProgress({ file }: { file: File }) {
  const [progress, setProgress] = useState({
    stage: 'idle',
    message: 'Ready to import',
    percent: 0,
    entities: 0,
    relationships: 0
  })

  const handleImport = async () => {
    const buffer = await file.arrayBuffer()
    const brain = await Brainy.create()

    await brain.import(Buffer.from(buffer), {
      // THIS WORKS FOR CSV, PDF, EXCEL, JSON, MARKDOWN, YAML, DOCX!
      onProgress: (p) => {
        setProgress({
          stage: p.stage,
          message: p.message,

          // Calculate percentage from stage + processed/total
          percent: calculatePercent(p),

          entities: p.entities || 0,
          relationships: p.relationships || 0
        })
      }
    })
  }

  // Helper: Calculate percentage from progress
  function calculatePercent(p: ImportProgress): number {
    // Use processed/total if available
    if (p.processed && p.total) {
      return Math.round((p.processed / p.total) * 100)
    }

    // Otherwise estimate from stage
    const stagePercents = {
      detecting: 5,
      extracting: 50,
      'storing-vfs': 80,
      'storing-graph': 90,
      complete: 100
    }
    return stagePercents[p.stage] || 0
  }

  return (
    <div className="import-progress">
      {/* Stage Indicator */}
      <div className="stages">
        {['detecting', 'extracting', 'storing-vfs', 'storing-graph', 'complete'].map(s => (
          <span
            key={s}
            className={progress.stage === s ? 'active' : ''}
          >
            {s}
          </span>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="progress-bar">
        <div style={{ width: `${progress.percent}%` }} />
      </div>

      {/* Status Message (format-specific but always readable) */}
      <p className="message">{progress.message}</p>

      {/* Counts */}
      <div className="counts">
        <span>Entities: {progress.entities}</span>
        <span>Relationships: {progress.relationships}</span>
      </div>
    </div>
  )
}
```

**This component works perfectly for:**
- ✅ CSV files with 10,000 rows
- ✅ PDF documents with 200 pages
- ✅ Excel workbooks with 5 sheets
- ✅ JSON files with nested structures
- ✅ Markdown documents with sections
- ✅ YAML configuration files
- ✅ DOCX documents with paragraphs

**No format detection needed. No format-specific rendering. Just works.**

---

### CLI Progress Indicator (Works for ALL Formats)

```typescript
import ora from 'ora'
import { Brainy } from '@soulcraft/brainy'

async function importWithProgress(filePath: string) {
  const spinner = ora('Starting import...').start()
  const brain = await Brainy.create()

  try {
    await brain.import(filePath, {
      // THIS WORKS FOR ALL 7 FORMATS!
      onProgress: (p) => {
        // Update spinner text with current message
        spinner.text = p.message

        // Add counts if available
        if (p.entities || p.relationships) {
          spinner.text += ` (${p.entities || 0} entities, ${p.relationships || 0} relationships)`
        }

        // Add throughput/ETA if available (during extraction)
        if (p.throughput && p.eta) {
          const etaSec = Math.round(p.eta / 1000)
          spinner.text += ` [${p.throughput.toFixed(1)}/sec, ETA: ${etaSec}s]`
        }

        // Change spinner when complete
        if (p.stage === 'complete') {
          spinner.succeed(p.message)
        }
      }
    })
  } catch (error) {
    spinner.fail(`Import failed: ${error.message}`)
  }
}

// Works for ANY format!
await importWithProgress('data.csv')
await importWithProgress('document.pdf')
await importWithProgress('workbook.xlsx')
await importWithProgress('config.yaml')
```

**CLI Output (same code, different formats):**

```bash
# CSV Import
⠋ Detecting format...
⠙ Parsing CSV rows (delimiter: ",")
⠹ Extracting entities from csv (45 rows/sec, ETA: 120s) (150 entities, 45 relationships)
⠸ Extracting entities from csv (45 rows/sec, ETA: 60s) (750 entities, 223 relationships)
✔ Import complete (1350 entities, 401 relationships)

# PDF Import
⠋ Detecting format...
⠙ Loading PDF document...
⠹ Processing page 5 of 23
⠸ Extracting entities from pdf (2.5 pages/sec, ETA: 30s) (45 entities, 12 relationships)
✔ Import complete (156 entities, 89 relationships)

# Excel Import
⠋ Detecting format...
⠙ Loading Excel workbook...
⠹ Reading sheet: Sales (2/5)
⠸ Extracting entities from excel (120 rows/sec, ETA: 45s) (500 entities, 234 relationships)
✔ Import complete (2340 entities, 892 relationships)
```

**Same code. Different formats. Perfect progress for all.**

---

### Dashboard with Real-Time Stats (Works for ALL Formats)

```typescript
function ImportDashboard() {
  const [stats, setStats] = useState({
    stage: '',
    message: '',
    elapsed: 0,
    entities: 0,
    relationships: 0,
    throughput: 0,
    eta: 0
  })

  const startTime = Date.now()

  const handleImport = async (file: File) => {
    await brain.import(await file.arrayBuffer(), {
      // UNIVERSAL PROGRESS HANDLER - WORKS FOR ALL FORMATS!
      onProgress: (p) => {
        setStats({
          stage: p.stage,
          message: p.message,
          elapsed: Date.now() - startTime,
          entities: p.entities || 0,
          relationships: p.relationships || 0,
          throughput: p.throughput || 0,
          eta: p.eta || 0
        })
      }
    })
  }

  return (
    <div className="dashboard">
      <h2>Import Progress</h2>

      <div className="metric">
        <label>Stage</label>
        <value>{stats.stage}</value>
      </div>

      <div className="metric">
        <label>Status</label>
        <value>{stats.message}</value>
      </div>

      <div className="metric">
        <label>Elapsed</label>
        <value>{(stats.elapsed / 1000).toFixed(1)}s</value>
      </div>

      <div className="metric">
        <label>Entities</label>
        <value>{stats.entities.toLocaleString()}</value>
      </div>

      <div className="metric">
        <label>Relationships</label>
        <value>{stats.relationships.toLocaleString()}</value>
      </div>

      {stats.throughput > 0 && (
        <div className="metric">
          <label>Throughput</label>
          <value>{stats.throughput.toFixed(1)} items/sec</value>
        </div>
      )}

      {stats.eta > 0 && (
        <div className="metric">
          <label>ETA</label>
          <value>{(stats.eta / 1000).toFixed(0)}s</value>
        </div>
      )}
    </div>
  )
}
```

**This dashboard shows live stats for ANY format** - CSV, PDF, Excel, JSON, Markdown, YAML, DOCX.

---

## 📊 What Messages Look Like (Format-Specific Text, Standard Fields)

While the **fields are standardized**, the **message text** varies by format to be most helpful:

```typescript
// CSV Import Messages
"Detecting format..."
"Parsing CSV rows (delimiter: ",")"
"Extracted 1000 rows, inferring types..."
"Extracting entities from csv (45 rows/sec, ETA: 120s)..."
"Creating VFS structure..."
"Import complete"

// PDF Import Messages
"Detecting format..."
"Loading PDF document..."
"Processing page 5 of 23"
"Extracting entities from pdf (2.5 pages/sec, ETA: 30s)..."
"Creating VFS structure..."
"Import complete"

// Excel Import Messages
"Detecting format..."
"Loading Excel workbook..."
"Reading sheet: Sales (2/5)"
"Extracting entities from excel (120 rows/sec, ETA: 45s)..."
"Creating VFS structure..."
"Import complete"
```

**Key Point:** You can display `progress.message` directly in your UI **without parsing it**. It's always human-readable and contextually appropriate.

---

## ✅ The 5 Standard Stages (Same for ALL Formats)

Every import goes through these 5 stages in order:

| Stage | Duration | Description | Fields Available |
|-------|----------|-------------|------------------|
| **detecting** | ~1% | Format detection | `stage`, `message` |
| **extracting** | ~70% | Parse file + AI extraction | `stage`, `message`, `processed`, `total`, `entities`, `relationships`, `throughput`, `eta` |
| **storing-vfs** | ~5% | Create file structure | `stage`, `message` |
| **storing-graph** | ~20% | Create graph nodes | `stage`, `message`, `entities`, `relationships` |
| **complete** | ~1% | Finalize | `stage`, `message`, `entities`, `relationships` |

**These 5 stages are the same whether you're importing:**
- A 10MB CSV file with 50,000 rows
- A 200-page PDF document
- A 5-sheet Excel workbook
- A nested JSON structure
- A Markdown document
- A YAML configuration
- A DOCX document

---

## 🎯 Why This Matters

### Build Tools That Work for Everything

```typescript
// ONE progress handler for your entire application
function universalProgressHandler(progress: ImportProgress) {
  // Update UI (works for all formats)
  updateProgressBar(progress)
  updateStatusText(progress.message)
  updateCounts(progress.entities, progress.relationships)

  // Log to analytics (works for all formats)
  analytics.track('import_progress', {
    stage: progress.stage,
    processed: progress.processed,
    total: progress.total
  })

  // Send to monitoring (works for all formats)
  monitoring.gauge('import.entities', progress.entities)
  monitoring.gauge('import.throughput', progress.throughput)
}

// Use it everywhere
await brain.import(csvFile, { onProgress: universalProgressHandler })
await brain.import(pdfFile, { onProgress: universalProgressHandler })
await brain.import(excelFile, { onProgress: universalProgressHandler })
await brain.import(jsonFile, { onProgress: universalProgressHandler })
```

### No Format Detection Needed

```typescript
// ❌ DON'T DO THIS (format-specific handling)
if (format === 'csv') {
  // CSV-specific progress code
} else if (format === 'pdf') {
  // PDF-specific progress code
} else if (format === 'excel') {
  // Excel-specific progress code
}

// ✅ DO THIS (universal handling)
onProgress: (p) => {
  // Works for ALL formats!
  updateUI(p.stage, p.message, p.entities, p.relationships)
}
```

---

## 📝 Summary

✅ **100% Standardized** - Same `ImportProgress` interface for all 7 formats
✅ **Build Once** - Your progress UI works for CSV, PDF, Excel, JSON, Markdown, YAML, DOCX
✅ **No Format Detection** - No need to check file type in your progress handler
✅ **Human-Readable Messages** - Display `progress.message` directly, no parsing needed
✅ **Standard Fields** - `stage`, `processed`, `total`, `entities`, `relationships` work everywhere
✅ **Optional Enhancements** - `throughput`, `eta` available during extraction (all formats)

**The Workshop team (and any developer) can now build monitoring tools, dashboards, CLIs, and UIs that work perfectly for all import formats with zero format-specific code!**
