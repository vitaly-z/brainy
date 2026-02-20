---
title: Installation
slug: getting-started/installation
public: true
category: getting-started
template: guide
order: 1
description: Install Brainy with npm, bun, yarn, or pnpm. Works in Node.js 22+, Bun 1.0+, and browser (OPFS). TypeScript included.
next:
  - getting-started/quick-start
  - concepts/zero-config
---

# Installation

## Requirements

- **Node.js 22+** or **Bun 1.0+**
- TypeScript is optional — Brainy ships with full type definitions

## Install

```bash
npm install @soulcraft/brainy
```

Or with your preferred package manager:

```bash
bun add @soulcraft/brainy
yarn add @soulcraft/brainy
pnpm add @soulcraft/brainy
```

## Verify

```javascript
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()

console.log('Brainy ready.')
```

## Native Acceleration (Optional)

For production workloads, add Cortex for Rust-accelerated SIMD distance calculations, vector quantization, and native embeddings:

```bash
npm install @soulcraft/cortex
```

```javascript
import { Brainy } from '@soulcraft/brainy'
import { registerCortex } from '@soulcraft/cortex'

registerCortex()  // activates native acceleration globally

const brain = new Brainy()
await brain.init()
```

Cortex delivers a **5.2x geometric mean speedup** — see [Brainy vs Cortex](/docs/cortex/comparison) for measured benchmarks.

## Browser (OPFS)

Brainy works in the browser using the Origin Private File System:

```javascript
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy({ storage: 'opfs' })
await brain.init()
```

No server required. Data persists across page refreshes in the browser's private storage.

## TypeScript

Brainy ships with full TypeScript types. No `@types/` package needed:

```typescript
import { Brainy, NounType, VerbType } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()

const id = await brain.add({
  data: 'Hello, Brainy',
  type: NounType.Concept,
  metadata: { created: Date.now() }
})
```

## Next Steps

- [Quick Start](/docs/getting-started/quick-start) — build your first knowledge graph in 60 seconds
- [Zero Configuration](/docs/concepts/zero-config) — understand what Brainy auto-detects
- [Storage Adapters](/docs/guides/storage-adapters) — choose the right storage for your deployment
