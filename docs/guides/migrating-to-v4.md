# Migrating from Brainy v3.x to v4.x

**Brainy v4.0.0** introduces breaking changes to the import API for improved clarity, better defaults, and more powerful features.

This guide will help you migrate your code quickly and painlessly.

---

## 🎯 Quick Migration Checklist

If you just want to fix your code fast, here's what to do:

- [ ] Replace `extractRelationships` with `enableRelationshipInference`
- [ ] Remove `autoDetect` (auto-detection is now always enabled)
- [ ] Replace `createFileStructure: true` with `vfsPath: '/your/path'`
- [ ] Remove `excelSheets` (all sheets are now processed automatically)
- [ ] Remove `pdfExtractTables` (table extraction is now automatic)
- [ ] Add `enableNeuralExtraction: true` to enable AI entity extraction
- [ ] Add `preserveSource: true` if you want to keep the original file

---

## 📋 Option Name Changes

### Complete Mapping Table

| v3.x Option | v4.x Option | Action Required |
|-------------|-------------|-----------------|
| `extractRelationships` | `enableRelationshipInference` | **Rename option** |
| `autoDetect` | *(removed)* | **Delete option** (always enabled) |
| `createFileStructure` | `vfsPath` | **Replace** with VFS directory path |
| `excelSheets` | *(removed)* | **Delete option** (all sheets processed) |
| `pdfExtractTables` | *(removed)* | **Delete option** (always enabled) |
| - | `enableNeuralExtraction` | **Add option** (new in v4.x) |
| - | `enableConceptExtraction` | **Add option** (new in v4.x) |
| - | `preserveSource` | **Add option** (new in v4.x) |

---

## 🔄 Migration Examples

### Example 1: Basic Excel Import

**Before (v3.x):**
```typescript
const result = await brain.import('./glossary.xlsx', {
  extractRelationships: true,
  createFileStructure: true,
  groupBy: 'type'
})
```

**After (v4.x):**
```typescript
const result = await brain.import('./glossary.xlsx', {
  enableRelationshipInference: true,  // ✅ Renamed
  vfsPath: '/imports/glossary',       // ✅ Replaced createFileStructure
  groupBy: 'type'                     // ✅ No change
})
```

---

### Example 2: Full-Featured Import

**Before (v3.x):**
```typescript
const result = await brain.import('./data.xlsx', {
  extractRelationships: true,
  autoDetect: true,
  createFileStructure: true,
  groupBy: 'type',
  enableDeduplication: true
})
```

**After (v4.x):**
```typescript
const result = await brain.import('./data.xlsx', {
  // AI features
  enableNeuralExtraction: true,      // ✅ NEW - Extract entity names
  enableRelationshipInference: true, // ✅ Renamed from extractRelationships
  enableConceptExtraction: true,     // ✅ NEW - Extract entity types

  // VFS features
  vfsPath: '/imports/data',          // ✅ Replaced createFileStructure
  groupBy: 'type',                   // ✅ No change
  preserveSource: true,              // ✅ NEW - Save original file

  // Performance
  enableDeduplication: true          // ✅ No change
})
```

---

### Example 3: Simple Import (Defaults)

**Before (v3.x):**
```typescript
const result = await brain.import('./data.csv', {
  autoDetect: true,
  extractRelationships: true
})
```

**After (v4.x):**
```typescript
// Auto-detection is always enabled now
// Just enable the features you want
const result = await brain.import('./data.csv', {
  enableRelationshipInference: true
})

// Or use all defaults (AI features enabled)
const result = await brain.import('./data.csv')
```

---

### Example 4: PDF Import

**Before (v3.x):**
```typescript
const result = await brain.import('./document.pdf', {
  pdfExtractTables: true,
  extractRelationships: true,
  createFileStructure: true
})
```

**After (v4.x):**
```typescript
const result = await brain.import('./document.pdf', {
  // pdfExtractTables removed - always enabled
  enableRelationshipInference: true,
  vfsPath: '/imports/documents'
})
```

---

## 💡 Why These Changes?

### Clearer Option Names

**v3.x naming was ambiguous:**
- `extractRelationships` → Could mean "create relationships" or "infer relationships"
- `createFileStructure` → Doesn't explain what structure or where

**v4.x naming is explicit:**
- `enableRelationshipInference` → Clearly means "use AI to infer semantic relationships"
- `vfsPath` → Explicitly sets the virtual filesystem directory path
- `enableNeuralExtraction` → Clearly indicates AI-powered entity extraction

### Separation of Concerns

**v4.x separates import features into clear categories:**

1. **Neural/AI Features:**
   - `enableNeuralExtraction` - Extract entity names and metadata
   - `enableRelationshipInference` - Infer semantic relationships
   - `enableConceptExtraction` - Extract entity types and concepts

2. **VFS Features:**
   - `vfsPath` - Virtual filesystem directory
   - `groupBy` - Grouping strategy
   - `preserveSource` - Keep original file

3. **Performance Features:**
   - `enableDeduplication` - Merge similar entities
   - `confidenceThreshold` - AI confidence threshold
   - `onProgress` - Progress callbacks

### Better Defaults

**v3.x required explicit enabling:**
```typescript
// Had to enable everything manually
await brain.import(file, {
  autoDetect: true,
  extractRelationships: true,
  createFileStructure: true
})
```

**v4.x has smart defaults:**
```typescript
// Auto-detection and AI features enabled by default
await brain.import(file)

// Or customize specific features
await brain.import(file, {
  vfsPath: '/my/data',
  confidenceThreshold: 0.8
})
```

---

## 🆕 New Features in v4.x

### Neural Entity Extraction
Extract entity names, types, and metadata using AI:

```typescript
const result = await brain.import('./glossary.xlsx', {
  enableNeuralExtraction: true,      // Extract entity names from "Term" column
  enableConceptExtraction: true,     // Detect entity types (Place, Person, etc.)
  confidenceThreshold: 0.7           // Minimum AI confidence (0-1)
})

// Result includes rich entity metadata
result.entities.forEach(entity => {
  console.log(`${entity.name} (${entity.type})`)
  console.log(`Confidence: ${entity.confidence}`)
})
```

### VFS Integration
Imported data is organized in a virtual filesystem:

```typescript
const result = await brain.import('./data.xlsx', {
  vfsPath: '/projects/myproject/data',
  groupBy: 'type',        // Group by entity type
  preserveSource: true    // Save original .xlsx file
})

// Access via VFS
const vfs = brain.vfs()
const files = await vfs.readdir('/projects/myproject/data')
// ['Places/', 'Characters/', 'Concepts/', '_source.xlsx', '_metadata.json']

// Read entity file
const content = await vfs.readFile('/projects/myproject/data/Places/Talifar.json')
```

### Semantic Relationship Inference
AI infers relationship types from context:

```typescript
const result = await brain.import('./glossary.xlsx', {
  enableRelationshipInference: true
})

// Instead of generic "contains" relationships,
// you get semantic verbs like:
// - "capital_of"
// - "located_in"
// - "guards"
// - "part_of"
// - "related_to"

const relations = await brain.getRelations({ limit: 100 })
const types = new Set(relations.map(r => r.label))
console.log(types)
// Set { 'capital_of', 'guards', 'located_in', 'related_to' }
```

---

## 🔍 What Breaks & How to Fix It

### Error: "Invalid import options: 'extractRelationships'"

**Cause:** Using v3.x option name

**Fix:**
```typescript
// Before
await brain.import(file, { extractRelationships: true })

// After
await brain.import(file, { enableRelationshipInference: true })
```

---

### Error: "Invalid import options: 'autoDetect'"

**Cause:** Using v3.x option that's been removed

**Fix:**
```typescript
// Before
await brain.import(file, { autoDetect: true })

// After - just remove it (auto-detection always enabled)
await brain.import(file)
```

---

### Error: "Invalid import options: 'createFileStructure'"

**Cause:** Using v3.x option name

**Fix:**
```typescript
// Before
await brain.import(file, { createFileStructure: true })

// After - specify VFS path explicitly
await brain.import(file, { vfsPath: '/imports/mydata' })
```

---

### Issue: Import succeeds but entities have generic names like "Entity_144"

**Cause:** Neural extraction is disabled

**Fix:**
```typescript
// Ensure AI features are enabled
await brain.import(file, {
  enableNeuralExtraction: true,      // ✅ Extract entity names
  enableRelationshipInference: true, // ✅ Infer relationships
  enableConceptExtraction: true      // ✅ Extract types
})
```

---

### Issue: All relationships are type "contains"

**Cause:** Relationship inference is disabled

**Fix:**
```typescript
// Enable relationship inference
await brain.import(file, {
  enableRelationshipInference: true  // ✅ Use AI to detect semantic relationships
})
```

---

### Issue: VFS directory doesn't exist in filesystem

**This is NORMAL!** VFS is virtual - it uses Brainy entities, not physical files.

**How to access VFS:**
```typescript
// DON'T do this:
// ls brainy-data/vfs/  ❌ Won't work

// DO this instead:
const vfs = brain.vfs()
await vfs.init()
const files = await vfs.readdir('/imports')  // ✅ Correct
```

---

## 📦 TypeScript Users

### Compile-Time Errors

If you're using TypeScript, you'll get compile-time errors when using deprecated options:

```typescript
// TypeScript will show error:
// "Type 'true' is not assignable to type 'never'"
await brain.import(file, {
  extractRelationships: true  // ❌ Type error
})

// Fix: Use correct option name
await brain.import(file, {
  enableRelationshipInference: true  // ✅ Type correct
})
```

### IDE Autocomplete

Your IDE will show deprecation warnings and suggest the correct option names:

```typescript
await brain.import(file, {
  extract...  // IDE suggests: enableNeuralExtraction, enableRelationshipInference
})
```

---

## 🎓 Best Practices for v4.x

### 1. Enable All AI Features by Default

```typescript
// Good: Enable all intelligent features
await brain.import('./data.xlsx', {
  enableNeuralExtraction: true,
  enableRelationshipInference: true,
  enableConceptExtraction: true,
  vfsPath: '/imports/data'
})
```

### 2. Use VFS for Organization

```typescript
// Good: Organize by project
await brain.import('./project-A.xlsx', {
  vfsPath: '/projects/project-a/data'
})

await brain.import('./project-B.csv', {
  vfsPath: '/projects/project-b/data'
})
```

### 3. Preserve Source Files

```typescript
// Good: Keep original files for reference
await brain.import('./important-data.xlsx', {
  preserveSource: true,  // Saves original .xlsx in VFS
  vfsPath: '/archives/2025'
})
```

### 4. Tune Confidence Threshold

```typescript
// For high-quality data: Lower threshold
await brain.import('./curated-glossary.xlsx', {
  confidenceThreshold: 0.5  // Extract more entities
})

// For noisy data: Higher threshold
await brain.import('./scraped-data.csv', {
  confidenceThreshold: 0.8  // Only high-confidence entities
})
```

### 5. Disable Deduplication for Large Imports

```typescript
// For small imports: Keep deduplication
await brain.import('./small-data.xlsx', {
  enableDeduplication: true
})

// For large imports (>1000 rows): Disable for performance
await brain.import('./huge-database.csv', {
  enableDeduplication: false  // Much faster
})
```

---

## 🚀 Migration Automation (Future)

We're working on an automated migration tool:

```bash
# Coming soon
npx @soulcraft/brainy-migrate

# Will scan your code and automatically update:
# - Option names
# - TypeScript types
# - Import patterns
```

---

## 📚 Additional Resources

- **API Documentation:** [https://brainy.dev/docs/api/import](https://brainy.dev/docs/api/import)
- **Examples:** [examples/import-excel/](../../examples/import-excel/)
- **Changelog:** [CHANGELOG.md](../../CHANGELOG.md)
- **Support:** [GitHub Issues](https://github.com/soulcraft/brainy/issues)

---

## 💬 Need Help?

If you're stuck migrating:

1. Check the error message - it includes migration hints
2. Review the examples in this guide
3. Open an issue on GitHub with your use case
4. Join our Discord community for real-time help

---

**Happy migrating! 🎉**
