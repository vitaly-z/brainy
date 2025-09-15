# Framework Integration Guide

Brainy 3.0 is **framework-first** - designed from the ground up to work seamlessly with modern JavaScript frameworks. This guide shows you how to integrate Brainy into any framework.

## 🎯 Why Framework-First?

Traditional AI databases require complex browser polyfills and bundler configurations. Brainy 3.0 trusts your framework to handle this:

- **Zero configuration**: Just `import { Brainy } from '@soulcraft/brainy'`
- **Framework responsibility**: Let Next.js, Vite, Webpack handle Node.js polyfills
- **Cleaner code**: No browser-specific entry points or conditional imports
- **Better DX**: Same API everywhere - browser, server, edge

## 🚀 Quick Start

### Install Brainy

```bash
npm install @soulcraft/brainy
```

### Basic Integration

```javascript
import { Brainy } from '@soulcraft/brainy'

// Works in any framework!
const brain = new Brainy()
await brain.init()

// Add data
await brain.add({
  data: "Framework integration is awesome!",
  type: "concept",
  metadata: { framework: "any" }
})

// Search
const results = await brain.find("framework integration")
```

## ⚛️ React Integration

### Basic Hook Pattern

```jsx
import { useState, useEffect, useCallback } from 'react'
import { Brainy } from '@soulcraft/brainy'

function useBrainy() {
  const [brain, setBrain] = useState(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const initBrain = async () => {
      const newBrain = new Brainy({
        storage: { type: 'opfs' } // Browser storage
      })
      await newBrain.init()
      setBrain(newBrain)
      setIsReady(true)
    }

    initBrain()
  }, [])

  return { brain, isReady }
}

// Usage in component
function SearchComponent() {
  const { brain, isReady } = useBrainy()
  const [results, setResults] = useState([])

  const handleSearch = useCallback(async (query) => {
    if (!isReady) return
    const searchResults = await brain.find(query)
    setResults(searchResults)
  }, [brain, isReady])

  if (!isReady) return <div>Loading AI...</div>

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        onChange={(e) => handleSearch(e.target.value)}
      />
      <div>
        {results.map(result => (
          <div key={result.id}>
            <h3>{result.data}</h3>
            <p>Score: {(result.score * 100).toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### React Context Pattern

```jsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Brainy } from '@soulcraft/brainy'

const BrainyContext = createContext()

export function BrainyProvider({ children }) {
  const [brain, setBrain] = useState(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const initBrain = async () => {
      const newBrain = new Brainy()
      await newBrain.init()
      setBrain(newBrain)
      setIsReady(true)
    }

    initBrain()
  }, [])

  return (
    <BrainyContext.Provider value={{ brain, isReady }}>
      {children}
    </BrainyContext.Provider>
  )
}

export function useBrainContext() {
  const context = useContext(BrainyContext)
  if (!context) {
    throw new Error('useBrainContext must be used within BrainyProvider')
  }
  return context
}
```

## 🟢 Vue.js Integration

### Composition API

```vue
<template>
  <div>
    <input v-model="query" @input="search" placeholder="Search..." />
    <div v-for="result in results" :key="result.id">
      <h3>{{ result.data }}</h3>
      <p>Score: {{ (result.score * 100).toFixed(1) }}%</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Brainy } from '@soulcraft/brainy'

const brain = ref(null)
const isReady = ref(false)
const query = ref('')
const results = ref([])

onMounted(async () => {
  brain.value = new Brainy({
    storage: { type: 'opfs' }
  })
  await brain.value.init()
  isReady.value = true
})

const search = async () => {
  if (!isReady.value || !query.value) return
  results.value = await brain.value.find(query.value)
}
</script>
```

### Vue 3 Plugin

```javascript
// plugins/brainy.js
import { Brainy } from '@soulcraft/brainy'

export default {
  install(app, options) {
    const brain = new Brainy(options)

    app.config.globalProperties.$brain = brain
    app.provide('brain', brain)

    // Initialize on app mount
    brain.init()
  }
}

// main.js
import { createApp } from 'vue'
import BrainyPlugin from './plugins/brainy'

const app = createApp(App)
app.use(BrainyPlugin, {
  storage: { type: 'opfs' }
})
```

## 🅰️ Angular Integration

### Service Pattern

```typescript
// brainy.service.ts
import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'
import { Brainy } from '@soulcraft/brainy'

@Injectable({
  providedIn: 'root'
})
export class BrainyService {
  private brain: Brainy
  private readySubject = new BehaviorSubject<boolean>(false)

  ready$: Observable<boolean> = this.readySubject.asObservable()

  constructor() {
    this.initBrain()
  }

  private async initBrain() {
    this.brain = new Brainy({
      storage: { type: 'opfs' }
    })
    await this.brain.init()
    this.readySubject.next(true)
  }

  async search(query: string): Promise<any[]> {
    if (!this.readySubject.value) {
      throw new Error('Brain not ready')
    }
    return await this.brain.find(query)
  }

  async add(data: any, type: string, metadata?: any): Promise<string> {
    if (!this.readySubject.value) {
      throw new Error('Brain not ready')
    }
    return await this.brain.add({ data, type, metadata })
  }
}
```

```typescript
// search.component.ts
import { Component } from '@angular/core'
import { BrainyService } from './brainy.service'

@Component({
  selector: 'app-search',
  template: `
    <div>
      <input
        [(ngModel)]="query"
        (input)="search()"
        placeholder="Search..."
      />
      <div *ngFor="let result of results">
        <h3>{{ result.data }}</h3>
        <p>Score: {{ (result.score * 100).toFixed(1) }}%</p>
      </div>
    </div>
  `
})
export class SearchComponent {
  query = ''
  results: any[] = []

  constructor(private brainyService: BrainyService) {}

  async search() {
    if (!this.query) return
    this.results = await this.brainyService.search(this.query)
  }
}
```

## 🚀 Next.js Integration

### App Router (Next.js 13+)

```jsx
// app/providers.jsx
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { Brainy } from '@soulcraft/brainy'

const BrainyContext = createContext()

export function BrainyProvider({ children }) {
  const [brain, setBrain] = useState(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const initBrain = async () => {
      const newBrain = new Brainy()
      await newBrain.init()
      setBrain(newBrain)
      setIsReady(true)
    }

    initBrain()
  }, [])

  return (
    <BrainyContext.Provider value={{ brain, isReady }}>
      {children}
    </BrainyContext.Provider>
  )
}

export const useBrainy = () => useContext(BrainyContext)
```

```jsx
// app/layout.jsx
import { BrainyProvider } from './providers'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <BrainyProvider>
          {children}
        </BrainyProvider>
      </body>
    </html>
  )
}
```

### API Routes

```javascript
// app/api/search/route.js
import { Brainy } from '@soulcraft/brainy'

const brain = new Brainy({
  storage: { type: 'filesystem', path: './data' }
})
await brain.init()

export async function POST(request) {
  const { query } = await request.json()
  const results = await brain.find(query)

  return Response.json({ results })
}
```

## 🔷 Svelte Integration

```svelte
<!-- SearchComponent.svelte -->
<script>
  import { onMount } from 'svelte'
  import { Brainy } from '@soulcraft/brainy'

  let brain = null
  let isReady = false
  let query = ''
  let results = []

  onMount(async () => {
    brain = new Brainy({
      storage: { type: 'opfs' }
    })
    await brain.init()
    isReady = true
  })

  async function search() {
    if (!isReady || !query) return
    results = await brain.find(query)
  }
</script>

<div>
  <input bind:value={query} on:input={search} placeholder="Search..." />

  {#each results as result}
    <div>
      <h3>{result.data}</h3>
      <p>Score: {(result.score * 100).toFixed(1)}%</p>
    </div>
  {/each}
</div>
```

## 🌟 Solid.js Integration

```jsx
import { createSignal, onMount } from 'solid-js'
import { Brainy } from '@soulcraft/brainy'

function SearchComponent() {
  const [brain, setBrain] = createSignal(null)
  const [isReady, setIsReady] = createSignal(false)
  const [query, setQuery] = createSignal('')
  const [results, setResults] = createSignal([])

  onMount(async () => {
    const newBrain = new Brainy()
    await newBrain.init()
    setBrain(newBrain)
    setIsReady(true)
  })

  const search = async () => {
    if (!isReady() || !query()) return
    const searchResults = await brain().find(query())
    setResults(searchResults)
  }

  return (
    <div>
      <input
        value={query()}
        onInput={(e) => {
          setQuery(e.target.value)
          search()
        }}
        placeholder="Search..."
      />

      <For each={results()}>
        {(result) => (
          <div>
            <h3>{result.data}</h3>
            <p>Score: {(result.score * 100).toFixed(1)}%</p>
          </div>
        )}
      </For>
    </div>
  )
}
```

## 📦 Bundler Configuration

### Vite (Recommended)

```javascript
// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    include: ['@soulcraft/brainy']
  }
})
```

### Webpack

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    fallback: {
      "fs": false,
      "path": require.resolve("path-browserify"),
      "crypto": require.resolve("crypto-browserify")
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      global: 'global'
    })
  ]
}
```

### Rollup

```javascript
// rollup.config.js
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default {
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs()
  ]
}
```

## 🌐 SSR/SSG Considerations

### Server-Side Rendering

```javascript
// Check if running in browser
if (typeof window !== 'undefined') {
  // Browser-only code
  const brain = new Brainy({
    storage: { type: 'opfs' }
  })
}

// Or use dynamic imports
const initBrainForBrowser = async () => {
  if (typeof window === 'undefined') return null

  const { Brainy } = await import('@soulcraft/brainy')
  const brain = new Brainy()
  await brain.init()
  return brain
}
```

### Static Site Generation

```javascript
// For build-time usage
import { Brainy } from '@soulcraft/brainy'

export async function generateStaticProps() {
  const brain = new Brainy({
    storage: { type: 'filesystem', path: './content' }
  })
  await brain.init()

  // Build search index
  const allContent = await brain.export()

  return {
    props: { searchIndex: allContent }
  }
}
```

## 🔧 Framework-Specific Tips

### React
- Use `useCallback` for search functions to prevent re-renders
- Consider `useMemo` for expensive brain operations
- Implement cleanup in `useEffect` for proper memory management

### Vue
- Use `shallowRef` for the brain instance (it's not reactive data)
- Consider Pinia for global brain state management
- Use `watchEffect` for reactive search queries

### Angular
- Implement proper dependency injection with services
- Use RxJS observables for reactive search
- Consider lazy loading brain in feature modules

### Next.js
- Use dynamic imports for client-side only features
- Consider API routes for server-side brain operations
- Implement proper error boundaries

## 🚨 Common Issues & Solutions

### Issue: "crypto is not defined"
**Solution**: Your framework should handle this automatically. If not:
```javascript
// Add to your bundle config
define: {
  global: 'globalThis'
}
```

### Issue: "fs module not found"
**Solution**: This is expected in browsers. Use browser-compatible storage:
```javascript
const brain = new Brainy({
  storage: { type: 'opfs' } // Or 'memory' for development
})
```

### Issue: Large bundle size
**Solution**: Use dynamic imports for optional features:
```javascript
const brain = await import('@soulcraft/brainy').then(m => new m.Brainy())
```

### Issue: SSR hydration mismatch
**Solution**: Initialize brain only on client:
```javascript
useEffect(() => {
  // Browser-only initialization
  initBrain()
}, [])
```

## 🎯 Best Practices

1. **Initialize Once**: Create brain instance at app level, not component level
2. **Use Context**: Share brain instance across components with context/providers
3. **Handle Loading**: Always show loading states during brain initialization
4. **Error Boundaries**: Implement proper error handling for brain operations
5. **Memory Management**: Clean up brain instances on unmount
6. **Storage Strategy**: Choose appropriate storage for your deployment target

## 📚 Next Steps

- [Next.js Integration Guide](nextjs-integration.md) - Detailed Next.js examples
- [Vue.js Integration Guide](vue-integration.md) - Complete Vue.js patterns
- [API Reference](../api/README.md) - Complete API documentation
- [Production Deployment](../deployment/CLOUD_DEPLOYMENT_GUIDE.md) - Deploy to production

## 🤝 Community Examples

Check out community examples in the [examples repository](https://github.com/soulcraftlabs/brainy-examples):

- React + TypeScript starter
- Vue 3 + Composition API
- Next.js full-stack app
- Svelte SPA with search
- Angular enterprise app