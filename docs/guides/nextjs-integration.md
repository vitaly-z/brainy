# Next.js Integration Guide

Complete guide to integrating Brainy with Next.js applications, covering App Router, Pages Router, API routes, and deployment strategies.

## 🚀 Quick Start

### Installation

```bash
npx create-next-app@latest my-brainy-app
cd my-brainy-app
npm install @soulcraft/brainy
```

### Basic Setup

```jsx
// app/components/BrainyProvider.jsx
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { Brainy } from '@soulcraft/brainy'

const BrainyContext = createContext()

export function BrainyProvider({ children }) {
  const [brain, setBrain] = useState(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const initBrain = async () => {
      const newBrain = new Brainy({
        storage: { type: 'opfs' } // Browser storage for client-side
      })
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

export const useBrainy = () => {
  const context = useContext(BrainyContext)
  if (!context) {
    throw new Error('useBrainy must be used within BrainyProvider')
  }
  return context
}
```

## 📱 App Router (Next.js 13+)

### Root Layout Setup

```jsx
// app/layout.jsx
import { BrainyProvider } from './components/BrainyProvider'
import './globals.css'

export const metadata = {
  title: 'My Brainy App',
  description: 'AI-powered search with Brainy'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <BrainyProvider>
          {children}
        </BrainyProvider>
      </body>
    </html>
  )
}
```

### Search Component

```jsx
// app/components/Search.jsx
'use client'
import { useState, useCallback } from 'react'
import { useBrainy } from './BrainyProvider'

export function Search() {
  const { brain, isReady } = useBrainy()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const handleSearch = useCallback(async (searchQuery) => {
    if (!isReady || !searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const searchResults = await brain.find(searchQuery)
      setResults(searchResults)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [brain, isReady])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Initializing AI...</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            handleSearch(e.target.value)
          }}
          placeholder="Search with AI..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {loading && (
        <div className="text-center py-4">
          <span className="text-gray-600">Searching...</span>
        </div>
      )}

      <div className="space-y-4">
        {results.map((result, index) => (
          <div key={result.id || index} className="bg-white p-4 rounded-lg shadow border">
            <h3 className="font-semibold text-lg mb-2">{result.data}</h3>
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>Score: {(result.score * 100).toFixed(1)}%</span>
              {result.metadata && (
                <span>Type: {result.metadata.type || 'Unknown'}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {query && !loading && results.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No results found for "{query}"
        </div>
      )}
    </div>
  )
}
```

### Main Page

```jsx
// app/page.jsx
import { Search } from './components/Search'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">
          AI-Powered Search with Brainy
        </h1>
        <Search />
      </div>
    </main>
  )
}
```

## 🗂️ Pages Router

### _app.jsx Setup

```jsx
// pages/_app.jsx
import { BrainyProvider } from '../components/BrainyProvider'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return (
    <BrainyProvider>
      <Component {...pageProps} />
    </BrainyProvider>
  )
}
```

### Search Page

```jsx
// pages/search.jsx
import { useState } from 'react'
import { useBrainy } from '../components/BrainyProvider'

export default function SearchPage() {
  const { brain, isReady } = useBrainy()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!isReady || !query.trim()) return

    const searchResults = await brain.find(query)
    setResults(searchResults)
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Search</h1>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 px-4 py-2 border rounded"
            disabled={!isReady}
          />
          <button
            type="submit"
            disabled={!isReady || !query.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Search
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {results.map((result, index) => (
          <div key={index} className="p-4 border rounded">
            <h3 className="font-semibold">{result.data}</h3>
            <p className="text-sm text-gray-600">
              Score: {(result.score * 100).toFixed(1)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## 🔌 API Routes

### Search API Endpoint

```javascript
// app/api/search/route.js (App Router)
import { Brainy } from '@soulcraft/brainy'

let brain = null

async function initBrain() {
  if (!brain) {
    brain = new Brainy({
      storage: {
        type: 'filesystem',
        path: process.env.BRAINY_DATA_PATH || './brainy-data'
      }
    })
    await brain.init()
  }
  return brain
}

export async function POST(request) {
  try {
    const { query, options = {} } = await request.json()

    if (!query) {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    const brainInstance = await initBrain()
    const results = await brainInstance.find(query, options)

    return Response.json({ results, count: results.length })
  } catch (error) {
    console.error('Search API error:', error)
    return Response.json(
      { error: 'Search failed', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const brainInstance = await initBrain()
    const stats = await brainInstance.stats()

    return Response.json({
      status: 'ready',
      stats: {
        totalItems: stats.totalItems,
        storageType: stats.storageType
      }
    })
  } catch (error) {
    return Response.json(
      { status: 'error', error: error.message },
      { status: 500 }
    )
  }
}
```

```javascript
// pages/api/search.js (Pages Router)
import { Brainy } from '@soulcraft/brainy'

let brain = null

async function initBrain() {
  if (!brain) {
    brain = new Brainy({
      storage: { type: 'filesystem', path: './brainy-data' }
    })
    await brain.init()
  }
  return brain
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { query, options = {} } = req.body

      if (!query) {
        return res.status(400).json({ error: 'Query is required' })
      }

      const brainInstance = await initBrain()
      const results = await brainInstance.find(query, options)

      res.status(200).json({ results, count: results.length })
    } catch (error) {
      console.error('Search API error:', error)
      res.status(500).json({ error: 'Search failed', details: error.message })
    }
  } else {
    res.setHeader('Allow', ['POST'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}
```

### Add Data API

```javascript
// app/api/data/route.js
import { Brainy } from '@soulcraft/brainy'

let brain = null

async function initBrain() {
  if (!brain) {
    brain = new Brainy({
      storage: { type: 'filesystem', path: './brainy-data' }
    })
    await brain.init()
  }
  return brain
}

export async function POST(request) {
  try {
    const { data, type, metadata } = await request.json()

    if (!data || !type) {
      return Response.json(
        { error: 'Data and type are required' },
        { status: 400 }
      )
    }

    const brainInstance = await initBrain()
    const id = await brainInstance.add({ data, type, metadata })

    return Response.json({ id, success: true })
  } catch (error) {
    console.error('Add data API error:', error)
    return Response.json(
      { error: 'Failed to add data', details: error.message },
      { status: 500 }
    )
  }
}
```

## 🔗 Server Actions (App Router)

```jsx
// app/actions/brainy.js
'use server'
import { Brainy } from '@soulcraft/brainy'

let brain = null

async function initBrain() {
  if (!brain) {
    brain = new Brainy({
      storage: { type: 'filesystem', path: './brainy-data' }
    })
    await brain.init()
  }
  return brain
}

export async function searchAction(query, options = {}) {
  try {
    const brainInstance = await initBrain()
    const results = await brainInstance.find(query, options)
    return { results, error: null }
  } catch (error) {
    console.error('Search action error:', error)
    return { results: [], error: error.message }
  }
}

export async function addDataAction(data, type, metadata) {
  try {
    const brainInstance = await initBrain()
    const id = await brainInstance.add({ data, type, metadata })
    return { id, error: null }
  } catch (error) {
    console.error('Add data action error:', error)
    return { id: null, error: error.message }
  }
}
```

## 📊 Data Management Features

### Admin Dashboard

```jsx
// app/admin/page.jsx
'use client'
import { useState, useEffect } from 'react'
import { useBrainy } from '../components/BrainyProvider'

export default function AdminPage() {
  const { brain, isReady } = useBrainy()
  const [stats, setStats] = useState(null)
  const [newData, setNewData] = useState('')
  const [newType, setNewType] = useState('concept')

  useEffect(() => {
    if (isReady) {
      loadStats()
    }
  }, [isReady])

  const loadStats = async () => {
    try {
      const brainStats = await brain.stats()
      setStats(brainStats)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const handleAddData = async (e) => {
    e.preventDefault()
    if (!newData.trim()) return

    try {
      await brain.add({
        data: newData,
        type: newType,
        metadata: { addedAt: new Date().toISOString() }
      })
      setNewData('')
      loadStats() // Refresh stats
    } catch (error) {
      console.error('Failed to add data:', error)
    }
  }

  if (!isReady) {
    return <div>Loading admin panel...</div>
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-100 p-4 rounded">
            <h3 className="font-semibold">Total Items</h3>
            <p className="text-2xl">{stats.totalItems}</p>
          </div>
          <div className="bg-green-100 p-4 rounded">
            <h3 className="font-semibold">Storage Type</h3>
            <p className="text-lg">{stats.storageType}</p>
          </div>
          <div className="bg-purple-100 p-4 rounded">
            <h3 className="font-semibold">Memory Usage</h3>
            <p className="text-lg">{stats.memoryUsage || 'N/A'}</p>
          </div>
        </div>
      )}

      {/* Add Data Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Add New Data</h2>
        <form onSubmit={handleAddData} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Data</label>
            <textarea
              value={newData}
              onChange={(e) => setNewData(e.target.value)}
              placeholder="Enter data to add..."
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              rows={3}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="concept">Concept</option>
              <option value="document">Document</option>
              <option value="person">Person</option>
              <option value="project">Project</option>
              <option value="task">Task</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Data
          </button>
        </form>
      </div>
    </div>
  )
}
```

## 🚀 Deployment

### Environment Variables

```bash
# .env.local
BRAINY_DATA_PATH=/app/brainy-data
NODE_ENV=production
```

### Vercel Deployment

```json
// vercel.json
{
  "functions": {
    "app/api/**/*.js": {
      "maxDuration": 30
    }
  },
  "env": {
    "BRAINY_DATA_PATH": "/tmp/brainy-data"
  }
}
```

### Docker Setup

```dockerfile
# Dockerfile
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy app files
COPY . .

# Build the app
RUN npm run build

# Create data directory
RUN mkdir -p /app/brainy-data

EXPOSE 3000

CMD ["npm", "start"]
```

### next.config.js

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@soulcraft/brainy']
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false
      }
    }
    return config
  }
}

module.exports = nextConfig
```

## ⚡ Performance Optimization

### Client-Side Optimization

```jsx
// app/hooks/useBrainCache.js
import { useState, useCallback, useMemo } from 'react'

export function useBrainCache() {
  const [cache, setCache] = useState(new Map())

  const getCachedResult = useCallback((query) => {
    return cache.get(query)
  }, [cache])

  const setCachedResult = useCallback((query, result) => {
    setCache(prev => {
      const newCache = new Map(prev)
      newCache.set(query, result)
      // Keep only last 100 results
      if (newCache.size > 100) {
        const firstKey = newCache.keys().next().value
        newCache.delete(firstKey)
      }
      return newCache
    })
  }, [])

  return { getCachedResult, setCachedResult }
}
```

### Debounced Search

```jsx
// app/hooks/useDebounceSearch.js
import { useState, useEffect, useCallback } from 'react'
import { useBrainy } from '../components/BrainyProvider'

export function useDebounceSearch(delay = 300) {
  const { brain, isReady } = useBrainy()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (searchQuery) => {
    if (!isReady || !searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const searchResults = await brain.find(searchQuery)
      setResults(searchResults)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [brain, isReady])

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, delay)

    return () => clearTimeout(timer)
  }, [query, delay, search])

  return { query, setQuery, results, loading }
}
```

## 🔒 Security Best Practices

### Input Validation

```javascript
// app/utils/validation.js
export function validateSearchQuery(query) {
  if (typeof query !== 'string') {
    throw new Error('Query must be a string')
  }

  if (query.length > 1000) {
    throw new Error('Query too long')
  }

  // Sanitize query
  return query.trim()
}

export function validateDataInput(data, type, metadata) {
  if (!data || !type) {
    throw new Error('Data and type are required')
  }

  if (typeof data !== 'string') {
    throw new Error('Data must be a string')
  }

  if (data.length > 10000) {
    throw new Error('Data too long')
  }

  return { data: data.trim(), type, metadata }
}
```

### Rate Limiting

```javascript
// app/middleware/rateLimit.js
const requests = new Map()

export function rateLimit(req, limit = 100, window = 60000) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  const now = Date.now()

  if (!requests.has(ip)) {
    requests.set(ip, [])
  }

  const userRequests = requests.get(ip)

  // Remove old requests
  const validRequests = userRequests.filter(time => now - time < window)

  if (validRequests.length >= limit) {
    throw new Error('Rate limit exceeded')
  }

  validRequests.push(now)
  requests.set(ip, validRequests)

  return true
}
```

## 📚 Advanced Patterns

### Context + Reducer Pattern

```jsx
// app/contexts/BrainyContext.jsx
'use client'
import { createContext, useContext, useReducer, useEffect } from 'react'
import { Brainy } from '@soulcraft/brainy'

const BrainyContext = createContext()

const initialState = {
  brain: null,
  isReady: false,
  error: null,
  stats: null
}

function brainyReducer(state, action) {
  switch (action.type) {
    case 'INIT_START':
      return { ...state, error: null }
    case 'INIT_SUCCESS':
      return { ...state, brain: action.brain, isReady: true, error: null }
    case 'INIT_ERROR':
      return { ...state, error: action.error, isReady: false }
    case 'UPDATE_STATS':
      return { ...state, stats: action.stats }
    default:
      return state
  }
}

export function BrainyProvider({ children }) {
  const [state, dispatch] = useReducer(brainyReducer, initialState)

  useEffect(() => {
    const initBrain = async () => {
      dispatch({ type: 'INIT_START' })
      try {
        const brain = new Brainy()
        await brain.init()
        dispatch({ type: 'INIT_SUCCESS', brain })

        // Load initial stats
        const stats = await brain.stats()
        dispatch({ type: 'UPDATE_STATS', stats })
      } catch (error) {
        console.error('Brain initialization failed:', error)
        dispatch({ type: 'INIT_ERROR', error: error.message })
      }
    }

    initBrain()
  }, [])

  return (
    <BrainyContext.Provider value={{ state, dispatch }}>
      {children}
    </BrainyContext.Provider>
  )
}

export const useBrainyContext = () => {
  const context = useContext(BrainyContext)
  if (!context) {
    throw new Error('useBrainyContext must be used within BrainyProvider')
  }
  return context
}
```

## 🔍 Testing

### Unit Tests

```javascript
// __tests__/brainy.test.js
import { render, screen, waitFor } from '@testing-library/react'
import { BrainyProvider } from '../app/components/BrainyProvider'
import { Search } from '../app/components/Search'

// Mock Brainy
jest.mock('@soulcraft/brainy', () => ({
  Brainy: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([
      { id: '1', data: 'Test result', score: 0.9 }
    ])
  }))
}))

describe('Search Component', () => {
  it('renders search input', async () => {
    render(
      <BrainyProvider>
        <Search />
      </BrainyProvider>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search with AI...')).toBeInTheDocument()
    })
  })
})
```

## 📖 Complete Example Project

Here's a complete mini-project structure:

```
my-brainy-app/
├── app/
│   ├── components/
│   │   ├── BrainyProvider.jsx
│   │   ├── Search.jsx
│   │   └── AdminPanel.jsx
│   ├── api/
│   │   ├── search/route.js
│   │   └── data/route.js
│   ├── admin/
│   │   └── page.jsx
│   ├── layout.jsx
│   └── page.jsx
├── next.config.js
├── package.json
└── README.md
```

This structure provides a complete, production-ready Next.js application with Brainy integration.

## 🎯 Next Steps

- [Vue.js Integration Guide](vue-integration.md) - Vue.js patterns
- [Production Deployment](../deployment/CLOUD_DEPLOYMENT_GUIDE.md) - Deploy to production
- [API Reference](../api/README.md) - Complete API documentation
- [Examples Repository](https://github.com/soulcraftlabs/brainy-examples) - More examples