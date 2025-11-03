# Augmentation Examples - Import, Store, Export

This guide shows two complete workflows:
1. **Simple Handler** - Just import a new file type
2. **Full Augmentation** - Import + Store + Export (premium-ready)

---

## Workflow 1: Simple Handler (Import Only)

**Use case:** You want to import a new file type (e.g., CAD files) into Brainy's knowledge graph.

### Step 1: Create the Handler

```typescript
// src/handlers/CADHandler.ts
import { BaseFormatHandler } from '@soulcraft/brainy/augmentations/intelligentImport'
import type { FormatHandlerOptions, ProcessedData } from '@soulcraft/brainy/augmentations/intelligentImport'
import { parseCAD } from 'cad-parser' // Your parsing library

export class CADHandler extends BaseFormatHandler {
  readonly format = 'cad'

  canHandle(data: Buffer | string | { filename?: string; ext?: string }): boolean {
    if (typeof data === 'object' && 'filename' in data) {
      const mimeType = this.getMimeType(data)
      return this.mimeTypeMatches(mimeType, ['image/vnd.dwg', 'image/vnd.dxf'])
    }
    return false
  }

  async process(data: Buffer | string, options: FormatHandlerOptions): Promise<ProcessedData> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

    // Parse CAD file
    const cad = await parseCAD(buffer)

    // Extract entities for knowledge graph
    const entities = []

    // Document entity
    entities.push({
      type: 'CADDocument',
      filename: options.filename,
      units: cad.units,
      bounds: cad.bounds,
      version: cad.version
    })

    // Layer entities
    for (const layer of cad.layers) {
      entities.push({
        type: 'CADLayer',
        name: layer.name,
        color: layer.color,
        visible: layer.visible
      })
    }

    // Object entities
    for (const obj of cad.objects) {
      entities.push({
        type: 'CADObject',
        objectType: obj.type,
        layer: obj.layer,
        geometry: obj.geometry
      })
    }

    return {
      format: 'cad',
      data: entities,
      metadata: {
        rowCount: entities.length,
        fields: ['type', 'name', 'geometry'],
        processingTime: Date.now() - startTime,
        layerCount: cad.layers.length,
        objectCount: cad.objects.length
      },
      filename: options.filename
    }
  }
}
```

### Step 2: Register the Handler

```typescript
// src/index.ts
import { globalHandlerRegistry } from '@soulcraft/brainy/augmentations/intelligentImport'
import { CADHandler } from './handlers/CADHandler.js'

// Register handler globally
globalHandlerRegistry.registerHandler({
  name: 'cad',
  mimeTypes: ['image/vnd.dwg', 'image/vnd.dxf'],
  extensions: ['.dwg', '.dxf', '.dwf'],
  loader: async () => new CADHandler()
})
```

### Step 3: Use It

```typescript
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()

// Import CAD file - automatically routed to CADHandler
const result = await brain.import({
  type: 'file',
  data: cadFileBuffer,
  filename: 'floor-plan.dwg'
})

console.log(`Imported ${result.entities.length} CAD entities`)

// Query the imported data
const layers = await brain.find({ type: 'CADLayer' })
const objects = await brain.find({ type: 'CADObject', layer: 'WALLS' })
```

**That's it!** Simple handlers just import data. Brainy handles storage automatically.

---

## Workflow 2: Full Augmentation (Import + Store + Export)

**Use case:** You want a complete solution that imports project files, stores them with special logic, and exports results (e.g., React project analyzer).

### Step 1: Create the Augmentation

```typescript
// @yourcompany/brainy-react-analyzer

import { BaseAugmentation, type AugmentationContext } from '@soulcraft/brainy'
import { BaseFormatHandler } from '@soulcraft/brainy/augmentations/intelligentImport'
import type { ProcessedData } from '@soulcraft/brainy/augmentations/intelligentImport'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'

/**
 * React Project Analyzer Augmentation
 *
 * Features:
 * - Import: Parse React components, extract props, hooks, imports
 * - Store: Create relationships between components
 * - Export: Generate component diagram, dependency graph
 */
export class ReactAnalyzerAugmentation extends BaseAugmentation {
  readonly name = 'react-analyzer'
  readonly timing = 'before' as const
  readonly operations = ['import', 'export'] as any[]
  readonly priority = 75

  private handler: ReactComponentHandler

  constructor(config = {}) {
    super(config)
    this.handler = new ReactComponentHandler()
  }

  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // IMPORT: Parse React files
    if (operation === 'import' && this.isReactFile(params)) {
      return this.handleImport(params, next)
    }

    // EXPORT: Generate diagrams/reports
    if (operation === 'export' && params.format === 'react-diagram') {
      return this.handleExport(params, next)
    }

    return next()
  }

  private isReactFile(params: any): boolean {
    const filename = params.filename || ''
    return (
      (filename.endsWith('.tsx') || filename.endsWith('.jsx')) &&
      params.data?.includes('React')
    )
  }

  private async handleImport<T>(params: any, next: () => Promise<T>): Promise<T> {
    // Parse React component
    const processed = await this.handler.process(params.data, params.options)

    // Enrich with relationships
    params.data = processed.data
    params.metadata = {
      ...params.metadata,
      reactAnalysis: processed.metadata
    }

    // Continue to next augmentation/storage
    const result = await next()

    // Post-process: Create component relationships
    await this.createComponentRelationships(processed, result)

    return result
  }

  private async createComponentRelationships(
    processed: ProcessedData,
    result: any
  ): Promise<void> {
    const brain = this.getBrain()
    if (!brain) return

    // Find the component entity that was created
    const component = processed.data.find(d => d.type === 'ReactComponent')
    if (!component) return

    // Create relationships for imports
    for (const imp of component.imports || []) {
      // Find or create imported component
      const imported = await brain.findOne({
        type: 'ReactComponent',
        name: imp.name
      })

      if (imported) {
        // Create "Imports" relationship
        await brain.createRelation({
          source: result.entities[0].id,
          verb: 'Imports',
          target: imported.id,
          metadata: {
            importPath: imp.path,
            importType: imp.type
          }
        })
      }
    }

    // Create relationships for prop types
    for (const prop of component.props || []) {
      if (prop.typeRef) {
        const typeEntity = await brain.findOne({
          type: 'TypeDefinition',
          name: prop.typeRef
        })

        if (typeEntity) {
          await brain.createRelation({
            source: result.entities[0].id,
            verb: 'UsesPropType',
            target: typeEntity.id
          })
        }
      }
    }
  }

  private async handleExport<T>(params: any, next: () => Promise<T>): Promise<T> {
    const brain = this.getBrain()
    if (!brain) return next()

    // Query all React components
    const components = await brain.find({ type: 'ReactComponent' })

    // Build dependency graph
    const graph = await this.buildDependencyGraph(components)

    // Generate diagram
    const diagram = this.generateMermaidDiagram(graph)

    return {
      format: 'react-diagram',
      diagram,
      components: components.length,
      dependencies: graph.edges.length
    } as T
  }

  private async buildDependencyGraph(components: any[]): Promise<any> {
    const brain = this.getBrain()
    const nodes = components.map(c => ({
      id: c.id,
      name: c.name,
      props: c.props
    }))

    const edges = []
    for (const component of components) {
      const imports = await brain.getRelated(component.id, 'Imports')
      for (const imp of imports) {
        edges.push({
          from: component.id,
          to: imp.id,
          type: 'imports'
        })
      }
    }

    return { nodes, edges }
  }

  private generateMermaidDiagram(graph: any): string {
    let mermaid = 'graph TD\n'

    for (const node of graph.nodes) {
      mermaid += `  ${node.id}[${node.name}]\n`
    }

    for (const edge of graph.edges) {
      mermaid += `  ${edge.from} --> ${edge.to}\n`
    }

    return mermaid
  }
}

/**
 * React Component Handler
 */
class ReactComponentHandler extends BaseFormatHandler {
  readonly format = 'react'

  canHandle(data: any): boolean {
    if (typeof data === 'object' && 'filename' in data) {
      return data.filename?.match(/\.(tsx|jsx)$/) !== null
    }
    return false
  }

  async process(data: Buffer | string, options: any): Promise<ProcessedData> {
    const code = Buffer.isBuffer(data) ? data.toString('utf-8') : data

    // Parse with Babel
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    })

    // Extract component info
    const components: any[] = []
    const imports: any[] = []
    const exports: any[] = []

    traverse(ast, {
      // Detect function components
      FunctionDeclaration(path) {
        if (this.isReactComponent(path.node)) {
          components.push({
            type: 'ReactComponent',
            name: path.node.id?.name,
            componentType: 'function',
            props: this.extractProps(path),
            hooks: this.extractHooks(path),
            state: this.extractState(path)
          })
        }
      },

      // Detect class components
      ClassDeclaration(path) {
        if (this.isReactClassComponent(path.node)) {
          components.push({
            type: 'ReactComponent',
            name: path.node.id.name,
            componentType: 'class',
            props: this.extractClassProps(path),
            state: this.extractClassState(path),
            lifecycle: this.extractLifecycleMethods(path)
          })
        }
      },

      // Extract imports
      ImportDeclaration(path) {
        imports.push({
          type: 'Import',
          from: path.node.source.value,
          imports: path.node.specifiers.map(s => ({
            name: s.local.name,
            imported: t.isImportSpecifier(s) ? s.imported.name : null
          }))
        })
      },

      // Extract exports
      ExportNamedDeclaration(path) {
        exports.push({
          type: 'Export',
          name: path.node.declaration?.id?.name
        })
      }
    })

    // Enrich components with import info
    for (const component of components) {
      component.imports = imports
      component.exports = exports.find(e => e.name === component.name)
    }

    return {
      format: 'react',
      data: components,
      metadata: {
        rowCount: components.length,
        fields: ['type', 'name', 'props', 'hooks'],
        processingTime: Date.now() - startTime,
        componentCount: components.length,
        importCount: imports.length,
        exportCount: exports.length
      },
      filename: options.filename
    }
  }

  private isReactComponent(node: any): boolean {
    // Check if function returns JSX
    return node.body?.body?.some(stmt =>
      t.isReturnStatement(stmt) && this.isJSX(stmt.argument)
    )
  }

  private isJSX(node: any): boolean {
    return t.isJSXElement(node) || t.isJSXFragment(node)
  }

  private extractProps(path: any): any[] {
    const params = path.node.params
    if (params.length === 0) return []

    const propsParam = params[0]
    if (t.isObjectPattern(propsParam)) {
      return propsParam.properties.map(p => ({
        name: p.key.name,
        type: p.typeAnnotation?.typeAnnotation?.type
      }))
    }

    return []
  }

  private extractHooks(path: any): string[] {
    const hooks: string[] = []

    path.traverse({
      CallExpression(hookPath) {
        const callee = hookPath.node.callee
        if (t.isIdentifier(callee) && callee.name.startsWith('use')) {
          hooks.push(callee.name)
        }
      }
    })

    return hooks
  }

  private extractState(path: any): any[] {
    const stateVars: any[] = []

    path.traverse({
      CallExpression(hookPath) {
        if (
          t.isIdentifier(hookPath.node.callee) &&
          hookPath.node.callee.name === 'useState'
        ) {
          const parent = hookPath.parent
          if (t.isVariableDeclarator(parent) && t.isArrayPattern(parent.id)) {
            const [stateVar] = parent.id.elements
            if (t.isIdentifier(stateVar)) {
              stateVars.push({
                name: stateVar.name,
                initialValue: hookPath.node.arguments[0]
              })
            }
          }
        }
      }
    })

    return stateVars
  }
}
```

### Step 2: Package as NPM Module

```json
// package.json
{
  "name": "@yourcompany/brainy-react-analyzer",
  "version": "1.0.0",
  "description": "React project analyzer for Brainy",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "keywords": ["brainy", "react", "analyzer", "augmentation"],
  "peerDependencies": {
    "@soulcraft/brainy": "^5.2.0"
  },
  "dependencies": {
    "@babel/parser": "^7.23.0",
    "@babel/traverse": "^7.23.0",
    "@babel/types": "^7.23.0"
  }
}
```

### Step 3: Use the Augmentation

```typescript
// Install
// npm install @yourcompany/brainy-react-analyzer

import { Brainy } from '@soulcraft/brainy'
import { ReactAnalyzerAugmentation } from '@yourcompany/brainy-react-analyzer'

const brain = new Brainy()

// Add augmentation
brain.addAugmentation(new ReactAnalyzerAugmentation())

await brain.init()

// Import React project
await brain.import({
  type: 'directory',
  path: '/path/to/react-project/src',
  recursive: true
})

// Query components
const components = await brain.find({ type: 'ReactComponent' })
console.log(`Found ${components.length} React components`)

// Find component dependencies
const appComponent = await brain.findOne({ type: 'ReactComponent', name: 'App' })
const imports = await brain.getRelated(appComponent.id, 'Imports')
console.log(`App component imports:`, imports.map(c => c.name))

// Export diagram
const diagram = await brain.export({
  format: 'react-diagram'
})
console.log(diagram.diagram) // Mermaid diagram
```

### Step 4: Premium Licensing (Optional)

```typescript
// Add license checking
export class ReactAnalyzerAugmentation extends BaseAugmentation {
  private licenseKey?: string

  constructor(config: { licenseKey?: string } = {}) {
    super(config)
    this.licenseKey = config.licenseKey
  }

  async onInitialize(): Promise<void> {
    if (!this.licenseKey) {
      throw new Error('React Analyzer requires a license key. Get one at https://yourcompany.com/brainy-react')
    }

    // Verify license
    const valid = await this.verifyLicense(this.licenseKey)
    if (!valid) {
      throw new Error('Invalid license key')
    }

    this.log('React Analyzer initialized successfully')
  }

  private async verifyLicense(key: string): Promise<boolean> {
    // Check with your license server
    const response = await fetch('https://api.yourcompany.com/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, product: 'brainy-react-analyzer' })
    })

    const data = await response.json()
    return data.valid
  }
}

// Usage with license
brain.addAugmentation(new ReactAnalyzerAugmentation({
  licenseKey: 'YOUR-LICENSE-KEY'
}))
```

---

## Comparison: Handler vs Augmentation

| Feature | Simple Handler | Full Augmentation |
|---------|---------------|-------------------|
| **Import** | ✅ Yes (automatic) | ✅ Yes (with custom logic) |
| **Storage** | ✅ Automatic (Brainy core) | ✅ Custom logic + relationships |
| **Export** | ❌ No | ✅ Yes (custom formats) |
| **Relationships** | ❌ No | ✅ Yes (create custom relationships) |
| **Premium licensing** | ❌ Difficult | ✅ Easy (augmentation-level) |
| **Custom operations** | ❌ Import only | ✅ Any operation |
| **Complexity** | Low (50-100 lines) | Medium (200-500 lines) |

### When to use Handler:
- Just need to import a new file type
- Don't need custom export
- Don't need special relationships
- Simple use case

### When to use Augmentation:
- Need import + export workflow
- Need custom relationship logic
- Want premium licensing capability
- Complex business logic
- Multiple operations (import + export + query)

---

## More Examples

### Example: Python Project Analyzer

```typescript
class PythonAnalyzerAugmentation extends BaseAugmentation {
  // Import Python files, extract classes/functions
  // Create relationships between modules
  // Export: Dependency diagram, call graph
}
```

### Example: Database Schema Sync

```typescript
class DatabaseSyncAugmentation extends BaseAugmentation {
  // Import: Parse SQL schema
  // Store: Tables, columns, relationships
  // Export: Generate migration scripts
}
```

### Example: API Documentation Generator

```typescript
class APIDocAugmentation extends BaseAugmentation {
  // Import: Parse TypeScript types
  // Store: Endpoints, parameters, responses
  // Export: OpenAPI spec, Markdown docs
}
```

---

## See Also

- [FORMAT_HANDLERS.md](./FORMAT_HANDLERS.md) - Creating format handlers
- [AUGMENTATIONS.md](./AUGMENTATIONS.md) - Augmentation system details
- [ImageHandler source](../../src/augmentations/intelligentImport/handlers/imageHandler.ts) - Handler example
- [IntelligentImportAugmentation source](../../src/augmentations/intelligentImport/IntelligentImportAugmentation.ts) - Augmentation example
