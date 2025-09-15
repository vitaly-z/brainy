# Vue.js Integration Guide

Complete guide to integrating Brainy with Vue.js applications, covering Vue 3, Nuxt.js, Composition API, Options API, and advanced patterns.

## 🚀 Quick Start

### Installation

```bash
npm create vue@latest my-brainy-app
cd my-brainy-app
npm install
npm install @soulcraft/brainy
```

### Basic Setup

```javascript
// src/composables/useBrainy.js
import { ref, onMounted } from 'vue'
import { Brainy } from '@soulcraft/brainy'

const brain = ref(null)
const isReady = ref(false)
const error = ref(null)

export function useBrainy() {
  onMounted(async () => {
    try {
      brain.value = new Brainy({
        storage: { type: 'opfs' } // Browser storage
      })
      await brain.value.init()
      isReady.value = true
    } catch (err) {
      error.value = err.message
      console.error('Brainy initialization failed:', err)
    }
  })

  return {
    brain: readonly(brain),
    isReady: readonly(isReady),
    error: readonly(error)
  }
}
```

## 🧩 Composition API

### Search Component

```vue
<!-- src/components/Search.vue -->
<template>
  <div class="search-container">
    <div v-if="!isReady" class="loading">
      <div class="spinner"></div>
      <span>Initializing AI...</span>
    </div>

    <div v-else>
      <div class="search-input">
        <input
          v-model="query"
          @input="handleSearch"
          placeholder="Search with AI..."
          class="input"
        />
      </div>

      <div v-if="loading" class="loading">
        Searching...
      </div>

      <div v-else class="results">
        <div
          v-for="result in results"
          :key="result.id"
          class="result-item"
        >
          <h3>{{ result.data }}</h3>
          <div class="result-meta">
            <span>Score: {{ (result.score * 100).toFixed(1) }}%</span>
            <span v-if="result.metadata?.type">
              Type: {{ result.metadata.type }}
            </span>
          </div>
        </div>

        <div v-if="query && !loading && results.length === 0" class="no-results">
          No results found for "{{ query }}"
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useBrainy } from '../composables/useBrainy'
import { debounce } from '../utils/debounce'

const { brain, isReady } = useBrainy()

const query = ref('')
const results = ref([])
const loading = ref(false)

const search = async (searchQuery) => {
  if (!isReady.value || !searchQuery.trim()) {
    results.value = []
    return
  }

  loading.value = true
  try {
    const searchResults = await brain.value.find(searchQuery)
    results.value = searchResults
  } catch (error) {
    console.error('Search error:', error)
    results.value = []
  } finally {
    loading.value = false
  }
}

const debouncedSearch = debounce(search, 300)
const handleSearch = () => debouncedSearch(query.value)

// Watch for query changes
watch(query, (newQuery) => {
  if (!newQuery.trim()) {
    results.value = []
    loading.value = false
  }
})
</script>

<style scoped>
.search-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.search-input {
  margin-bottom: 1.5rem;
}

.input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
}

.input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  color: #6b7280;
}

.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.results {
  space-y: 1rem;
}

.result-item {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.result-item h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.result-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: #6b7280;
}

.no-results {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}
</style>
```

### Data Management

```vue
<!-- src/components/DataManager.vue -->
<template>
  <div class="data-manager">
    <h2>Data Management</h2>

    <div v-if="!isReady" class="loading">
      Initializing...
    </div>

    <div v-else>
      <!-- Add Data Form -->
      <form @submit.prevent="addData" class="add-form">
        <h3>Add New Data</h3>
        <div class="form-group">
          <label for="data">Data:</label>
          <textarea
            id="data"
            v-model="newItem.data"
            placeholder="Enter data..."
            required
          ></textarea>
        </div>
        <div class="form-group">
          <label for="type">Type:</label>
          <select id="type" v-model="newItem.type">
            <option value="concept">Concept</option>
            <option value="document">Document</option>
            <option value="person">Person</option>
            <option value="project">Project</option>
          </select>
        </div>
        <div class="form-group">
          <label for="tags">Tags (comma-separated):</label>
          <input
            id="tags"
            v-model="newItem.tags"
            placeholder="tag1, tag2, tag3"
          />
        </div>
        <button type="submit" :disabled="!newItem.data.trim()">
          Add Data
        </button>
      </form>

      <!-- Stats -->
      <div v-if="stats" class="stats">
        <h3>Statistics</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Total Items:</span>
            <span class="stat-value">{{ stats.totalItems }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Storage Type:</span>
            <span class="stat-value">{{ stats.storageType }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useBrainy } from '../composables/useBrainy'

const { brain, isReady } = useBrainy()

const newItem = reactive({
  data: '',
  type: 'concept',
  tags: ''
})

const stats = ref(null)

onMounted(async () => {
  if (isReady.value) {
    await loadStats()
  }
})

// Watch for brain readiness
watch(isReady, async (ready) => {
  if (ready) {
    await loadStats()
  }
})

const addData = async () => {
  try {
    const metadata = {
      addedAt: new Date().toISOString(),
      tags: newItem.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    }

    await brain.value.add({
      data: newItem.data,
      type: newItem.type,
      metadata
    })

    // Reset form
    newItem.data = ''
    newItem.type = 'concept'
    newItem.tags = ''

    // Refresh stats
    await loadStats()
  } catch (error) {
    console.error('Failed to add data:', error)
  }
}

const loadStats = async () => {
  try {
    stats.value = await brain.value.stats()
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}
</script>

<style scoped>
.data-manager {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.add-form {
  background: #f9fafb;
  padding: 1.5rem;
  border-radius: 0.5rem;
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
}

.form-group textarea {
  height: 100px;
  resize: vertical;
}

button {
  background: #3b82f6;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
}

button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.stats {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
}

.stat-label {
  font-weight: 500;
}

.stat-value {
  color: #3b82f6;
  font-weight: 600;
}
</style>
```

## 🏗️ Options API

### Search Component (Options API)

```vue
<!-- src/components/SearchOptions.vue -->
<template>
  <div class="search-container">
    <div v-if="!isReady" class="loading">
      Initializing AI...
    </div>

    <div v-else>
      <input
        v-model="query"
        @input="handleSearch"
        placeholder="Search..."
        class="search-input"
      />

      <div v-if="loading" class="loading">Searching...</div>

      <div class="results">
        <div
          v-for="result in results"
          :key="result.id"
          class="result-item"
        >
          <h3>{{ result.data }}</h3>
          <p>Score: {{ (result.score * 100).toFixed(1) }}%</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Brainy } from '@soulcraft/brainy'
import { debounce } from '../utils/debounce'

export default {
  name: 'SearchOptions',
  data() {
    return {
      brain: null,
      isReady: false,
      query: '',
      results: [],
      loading: false
    }
  },
  async mounted() {
    await this.initBrain()
  },
  methods: {
    async initBrain() {
      try {
        this.brain = new Brainy({
          storage: { type: 'opfs' }
        })
        await this.brain.init()
        this.isReady = true
      } catch (error) {
        console.error('Brain initialization failed:', error)
      }
    },
    async search(query) {
      if (!this.isReady || !query.trim()) {
        this.results = []
        return
      }

      this.loading = true
      try {
        this.results = await this.brain.find(query)
      } catch (error) {
        console.error('Search error:', error)
        this.results = []
      } finally {
        this.loading = false
      }
    },
    handleSearch: debounce(function() {
      this.search(this.query)
    }, 300)
  },
  watch: {
    query(newQuery) {
      if (!newQuery.trim()) {
        this.results = []
        this.loading = false
      }
    }
  },
  beforeUnmount() {
    // Cleanup if needed
    this.brain = null
  }
}
</script>
```

## 🔌 Vue Plugin

### Global Brainy Plugin

```javascript
// src/plugins/brainy.js
import { Brainy } from '@soulcraft/brainy'

export default {
  install(app, options = {}) {
    const defaultOptions = {
      storage: { type: 'opfs' },
      ...options
    }

    const brain = new Brainy(defaultOptions)

    // Make brain available globally
    app.config.globalProperties.$brain = brain
    app.provide('brain', brain)

    // Auto-initialize
    brain.init().catch(error => {
      console.error('Brainy plugin initialization failed:', error)
    })

    // Add global method
    app.config.globalProperties.$searchBrain = async (query, options) => {
      return await brain.find(query, options)
    }
  }
}
```

### Plugin Usage

```javascript
// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import BrainyPlugin from './plugins/brainy'

const app = createApp(App)

app.use(BrainyPlugin, {
  storage: { type: 'opfs' }
})

app.mount('#app')
```

```vue
<!-- Component using the plugin -->
<template>
  <div>
    <input v-model="query" @input="search" />
    <div v-for="result in results" :key="result.id">
      {{ result.data }}
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      query: '',
      results: []
    }
  },
  methods: {
    async search() {
      // Use the global method
      this.results = await this.$searchBrain(this.query)
    }
  }
}
</script>
```

## 🏰 Nuxt.js Integration

### Nuxt Plugin

```javascript
// plugins/brainy.client.js
import { Brainy } from '@soulcraft/brainy'

export default defineNuxtPlugin(async () => {
  const brain = new Brainy({
    storage: { type: 'opfs' }
  })

  await brain.init()

  return {
    provide: {
      brain
    }
  }
})
```

### Nuxt Composable

```javascript
// composables/useBrainy.js
export const useBrainy = () => {
  const { $brain } = useNuxtApp()

  const search = async (query, options = {}) => {
    return await $brain.find(query, options)
  }

  const add = async (data, type, metadata) => {
    return await $brain.add({ data, type, metadata })
  }

  const stats = async () => {
    return await $brain.stats()
  }

  return {
    brain: $brain,
    search,
    add,
    stats
  }
}
```

### Nuxt Page Example

```vue
<!-- pages/search.vue -->
<template>
  <div>
    <h1>AI Search</h1>

    <div v-if="pending" class="loading">
      Initializing AI...
    </div>

    <div v-else>
      <input
        v-model="query"
        @input="handleSearch"
        placeholder="Search..."
      />

      <div v-if="searching" class="loading">Searching...</div>

      <div class="results">
        <div v-for="result in results" :key="result.id" class="result">
          <h3>{{ result.data }}</h3>
          <p>Score: {{ (result.score * 100).toFixed(1) }}%</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const { search } = useBrainy()

const query = ref('')
const results = ref([])
const searching = ref(false)
const pending = ref(true)

// Initialize
onMounted(() => {
  pending.value = false
})

const handleSearch = debounce(async () => {
  if (!query.value.trim()) {
    results.value = []
    return
  }

  searching.value = true
  try {
    results.value = await search(query.value)
  } catch (error) {
    console.error('Search failed:', error)
  } finally {
    searching.value = false
  }
}, 300)
</script>
```

### Nuxt Configuration

```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false, // Disable SSR for browser-only features

  // Or use client-side hydration
  nitro: {
    experimental: {
      wasm: true
    }
  },

  vite: {
    define: {
      global: 'globalThis'
    }
  }
})
```

## 🛠️ Advanced Patterns

### Global State Management with Pinia

```javascript
// stores/brainy.js
import { defineStore } from 'pinia'
import { Brainy } from '@soulcraft/brainy'

export const useBrainyStore = defineStore('brainy', () => {
  const brain = ref(null)
  const isReady = ref(false)
  const error = ref(null)
  const stats = ref(null)

  const init = async (options = {}) => {
    try {
      brain.value = new Brainy(options)
      await brain.value.init()
      isReady.value = true
      await loadStats()
    } catch (err) {
      error.value = err.message
      console.error('Brainy initialization failed:', err)
    }
  }

  const search = async (query, options = {}) => {
    if (!isReady.value) throw new Error('Brain not ready')
    return await brain.value.find(query, options)
  }

  const add = async (data, type, metadata) => {
    if (!isReady.value) throw new Error('Brain not ready')
    const id = await brain.value.add({ data, type, metadata })
    await loadStats() // Refresh stats
    return id
  }

  const loadStats = async () => {
    if (!isReady.value) return
    try {
      stats.value = await brain.value.stats()
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  return {
    brain: readonly(brain),
    isReady: readonly(isReady),
    error: readonly(error),
    stats: readonly(stats),
    init,
    search,
    add,
    loadStats
  }
})
```

### Real-time Search Component

```vue
<!-- src/components/RealTimeSearch.vue -->
<template>
  <div class="realtime-search">
    <div class="search-bar">
      <input
        ref="searchInput"
        v-model="query"
        @input="handleInput"
        @focus="showResults = true"
        @blur="handleBlur"
        placeholder="Search..."
        class="search-input"
      />
      <div v-if="loading" class="search-spinner">⟳</div>
    </div>

    <Transition name="dropdown">
      <div
        v-if="showResults && (results.length > 0 || query.trim())"
        class="search-dropdown"
      >
        <div
          v-for="(result, index) in results"
          :key="result.id"
          :class="['result-item', { active: selectedIndex === index }]"
          @mousedown="selectResult(result)"
          @mouseenter="selectedIndex = index"
        >
          <div class="result-content">
            <span class="result-text">{{ result.data }}</span>
            <span class="result-score">{{ (result.score * 100).toFixed(0) }}%</span>
          </div>
        </div>

        <div v-if="query.trim() && results.length === 0 && !loading" class="no-results">
          No results found
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useBrainyStore } from '../stores/brainy'
import { debounce } from '../utils/debounce'

const emit = defineEmits(['select'])

const brainyStore = useBrainyStore()

const searchInput = ref(null)
const query = ref('')
const results = ref([])
const loading = ref(false)
const showResults = ref(false)
const selectedIndex = ref(-1)

const search = async (searchQuery) => {
  if (!brainyStore.isReady || !searchQuery.trim()) {
    results.value = []
    return
  }

  loading.value = true
  try {
    const searchResults = await brainyStore.search(searchQuery, { limit: 10 })
    results.value = searchResults
  } catch (error) {
    console.error('Search error:', error)
    results.value = []
  } finally {
    loading.value = false
  }
}

const debouncedSearch = debounce(search, 200)

const handleInput = () => {
  selectedIndex.value = -1
  debouncedSearch(query.value)
}

const handleBlur = () => {
  // Delay hiding to allow clicking on results
  setTimeout(() => {
    showResults.value = false
  }, 150)
}

const selectResult = (result) => {
  query.value = result.data
  showResults.value = false
  emit('select', result)
}

// Keyboard navigation
const handleKeydown = (event) => {
  if (!showResults.value) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, results.value.length - 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
      break
    case 'Enter':
      event.preventDefault()
      if (selectedIndex.value >= 0) {
        selectResult(results.value[selectedIndex.value])
      }
      break
    case 'Escape':
      showResults.value = false
      searchInput.value?.blur()
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.realtime-search {
  position: relative;
  width: 100%;
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-spinner {
  position: absolute;
  right: 0.75rem;
  animation: spin 1s linear infinite;
  color: #6b7280;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
}

.result-item {
  padding: 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover,
.result-item.active {
  background: #f3f4f6;
}

.result-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-text {
  flex: 1;
  margin-right: 0.5rem;
}

.result-score {
  font-size: 0.875rem;
  color: #6b7280;
}

.no-results {
  padding: 1rem;
  text-align: center;
  color: #6b7280;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
```

## 📊 Performance Optimization

### Lazy Loading

```vue
<!-- src/components/LazyBrainComponent.vue -->
<template>
  <div>
    <button v-if="!loaded" @click="loadBrain" class="load-button">
      Load AI Search
    </button>

    <Suspense v-else>
      <template #default>
        <SearchComponent />
      </template>
      <template #fallback>
        <div class="loading">Loading AI...</div>
      </template>
    </Suspense>
  </div>
</template>

<script setup>
import { ref, defineAsyncComponent } from 'vue'

const loaded = ref(false)

const SearchComponent = defineAsyncComponent(() =>
  import('./Search.vue')
)

const loadBrain = () => {
  loaded.value = true
}
</script>
```

### Virtual Scrolling for Large Results

```vue
<!-- src/components/VirtualResults.vue -->
<template>
  <div ref="container" class="virtual-container" @scroll="onScroll">
    <div :style="{ height: totalHeight + 'px' }" class="virtual-spacer">
      <div
        :style="{ transform: `translateY(${offsetY}px)` }"
        class="virtual-content"
      >
        <div
          v-for="item in visibleItems"
          :key="item.id"
          class="result-item"
          :style="{ height: itemHeight + 'px' }"
        >
          <h3>{{ item.data }}</h3>
          <p>Score: {{ (item.score * 100).toFixed(1) }}%</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  items: Array,
  itemHeight: { type: Number, default: 80 }
})

const container = ref(null)
const scrollTop = ref(0)
const containerHeight = ref(400)

const totalHeight = computed(() => props.items.length * props.itemHeight)
const visibleStart = computed(() => Math.floor(scrollTop.value / props.itemHeight))
const visibleEnd = computed(() => Math.min(
  visibleStart.value + Math.ceil(containerHeight.value / props.itemHeight) + 1,
  props.items.length
))
const visibleItems = computed(() =>
  props.items.slice(visibleStart.value, visibleEnd.value)
)
const offsetY = computed(() => visibleStart.value * props.itemHeight)

const onScroll = () => {
  scrollTop.value = container.value.scrollTop
}

onMounted(() => {
  containerHeight.value = container.value.clientHeight
})
</script>

<style scoped>
.virtual-container {
  height: 400px;
  overflow: auto;
}

.virtual-spacer {
  position: relative;
}

.virtual-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.result-item {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
```

## 🧪 Testing

### Component Testing with Vitest

```javascript
// tests/components/Search.test.js
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Search from '../src/components/Search.vue'

// Mock Brainy
vi.mock('@soulcraft/brainy', () => ({
  Brainy: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue([
      { id: '1', data: 'Test result', score: 0.9 }
    ])
  }))
}))

describe('Search Component', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(Search)
  })

  it('renders search input', () => {
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('shows loading state initially', () => {
    expect(wrapper.text()).toContain('Initializing AI')
  })

  it('performs search when input changes', async () => {
    // Wait for brain to initialize
    await wrapper.vm.$nextTick()

    const input = wrapper.find('input')
    await input.setValue('test query')
    await input.trigger('input')

    // Wait for debounced search
    await new Promise(resolve => setTimeout(resolve, 350))

    expect(wrapper.text()).toContain('Test result')
  })
})
```

### E2E Testing with Playwright

```javascript
// tests/e2e/search.spec.js
import { test, expect } from '@playwright/test'

test('search functionality works', async ({ page }) => {
  await page.goto('/')

  // Wait for brain to initialize
  await page.waitForSelector('[data-testid="search-input"]')

  // Perform search
  await page.fill('[data-testid="search-input"]', 'test query')

  // Wait for results
  await page.waitForSelector('[data-testid="search-results"]')

  // Check results
  const results = await page.locator('[data-testid="result-item"]')
  await expect(results).toHaveCountGreaterThan(0)
})
```

## 🚀 Production Tips

### Bundle Optimization

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    include: ['@soulcraft/brainy']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'brainy': ['@soulcraft/brainy']
        }
      }
    }
  }
})
```

### Error Handling

```javascript
// src/composables/useBrainyWithErrorHandling.js
import { ref, onMounted } from 'vue'
import { Brainy } from '@soulcraft/brainy'

export function useBrainyWithErrorHandling() {
  const brain = ref(null)
  const isReady = ref(false)
  const error = ref(null)
  const retryCount = ref(0)

  const init = async () => {
    try {
      brain.value = new Brainy()
      await brain.value.init()
      isReady.value = true
      error.value = null
      retryCount.value = 0
    } catch (err) {
      error.value = err.message
      console.error('Brainy initialization failed:', err)

      // Retry logic
      if (retryCount.value < 3) {
        retryCount.value++
        setTimeout(init, 2000 * retryCount.value)
      }
    }
  }

  onMounted(init)

  return {
    brain: readonly(brain),
    isReady: readonly(isReady),
    error: readonly(error),
    retry: init
  }
}
```

## 🎯 Complete Example

Here's a complete Vue 3 application structure:

```
my-brainy-vue-app/
├── src/
│   ├── components/
│   │   ├── Search.vue
│   │   ├── DataManager.vue
│   │   └── RealTimeSearch.vue
│   ├── composables/
│   │   ├── useBrainy.js
│   │   └── useBrainyWithErrorHandling.js
│   ├── stores/
│   │   └── brainy.js
│   ├── utils/
│   │   └── debounce.js
│   ├── App.vue
│   └── main.js
├── tests/
│   ├── components/
│   └── e2e/
├── vite.config.js
└── package.json
```

This provides a complete, production-ready Vue.js application with comprehensive Brainy integration.

## 📚 Next Steps

- [Framework Integration Guide](framework-integration.md) - Multi-framework patterns
- [Production Deployment](../deployment/CLOUD_DEPLOYMENT_GUIDE.md) - Deploy to production
- [API Reference](../api/README.md) - Complete API documentation
- [Examples Repository](https://github.com/soulcraftlabs/brainy-examples) - More examples