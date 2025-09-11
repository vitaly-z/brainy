/**
 * Augmentation Catalog for CLI
 * 
 * Displays available augmentations catalog
 * Local catalog with caching support
 */

import chalk from 'chalk'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const CATALOG_API = process.env.BRAINY_CATALOG_URL || null
const CACHE_PATH = join(homedir(), '.brainy', 'catalog-cache.json')
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

interface Augmentation {
  id: string
  name: string
  description: string
  category: string
  status: 'available' | 'coming_soon' | 'deprecated'
  popular?: boolean
  eta?: string
}

interface Category {
  id: string
  name: string
  icon: string
  description: string
}

interface Catalog {
  version: string
  categories: Category[]
  augmentations: Augmentation[]
}

/**
 * Fetch catalog from API with caching
 */
export async function fetchCatalog(): Promise<Catalog | null> {
  try {
    // Check cache first
    const cached = loadCache()
    if (cached) return cached
    
    // If external catalog API is configured, try to fetch
    if (CATALOG_API) {
      const response = await fetch(`${CATALOG_API}/api/catalog/cli`)
      if (!response.ok) throw new Error('API unavailable')
      
      const catalog = await response.json()
      
      // Save to cache
      saveCache(catalog)
      
      return catalog
    }
    
    // Fall back to local catalog
    return getDefaultCatalog()
  } catch (error) {
    // Try loading from cache even if expired
    const cached = loadCache(true)
    if (cached) {
      console.log(chalk.yellow('📡 Using cached catalog'))
      return cached
    }
    
    // Fall back to hardcoded catalog
    return getDefaultCatalog()
  }
}

/**
 * Display catalog in CLI
 */
export async function showCatalog(options: { 
  category?: string
  search?: string
  detailed?: boolean
}) {
  const catalog = await fetchCatalog()
  if (!catalog) {
    console.log(chalk.red('❌ Could not load augmentation catalog'))
    return
  }
  
  console.log(chalk.cyan.bold('🧠 Brainy Augmentation Catalog'))
  console.log(chalk.gray(`Version ${catalog.version}`))
  console.log('')
  
  // Filter augmentations
  let augmentations = catalog.augmentations
  
  if (options.category) {
    augmentations = augmentations.filter(a => a.category === options.category)
  }
  
  if (options.search) {
    const query = options.search.toLowerCase()
    augmentations = augmentations.filter(a => 
      a.name.toLowerCase().includes(query) ||
      a.description.toLowerCase().includes(query)
    )
  }
  
  // Group by category
  const grouped = groupByCategory(augmentations, catalog.categories)
  
  // Display
  for (const [category, augs] of Object.entries(grouped)) {
    if (augs.length === 0) continue
    
    const cat = catalog.categories.find(c => c.id === category)
    console.log(chalk.bold(`${cat?.icon || '📦'} ${cat?.name || category}`))
    
    for (const aug of augs) {
      const status = getStatusIcon(aug.status)
      const popular = aug.popular ? chalk.yellow(' ⭐') : ''
      const eta = aug.eta ? chalk.gray(` (${aug.eta})`) : ''
      
      console.log(`  ${status} ${aug.name}${popular}${eta}`)
      if (options.detailed) {
        console.log(chalk.gray(`     ${aug.description}`))
      }
    }
    console.log('')
  }
  
  // Show summary
  const available = augmentations.filter(a => a.status === 'available').length
  const coming = augmentations.filter(a => a.status === 'coming_soon').length
  
  console.log(chalk.gray('─'.repeat(50)))
  console.log(chalk.green(`✅ ${available} available`) + chalk.gray(` • `) + 
              chalk.yellow(`🔜 ${coming} coming soon`))
  console.log('')
  console.log(chalk.dim('Configure augmentations with "brainy augment"'))
  console.log(chalk.dim('Run "brainy augment info <name>" for details'))
}

/**
 * Show detailed info about an augmentation
 */
export async function showAugmentationInfo(id: string) {
  const catalog = await fetchCatalog()
  if (!catalog) {
    console.log(chalk.red('❌ Could not load augmentation catalog'))
    return
  }
  
  const aug = catalog.augmentations.find(a => a.id === id)
  if (!aug) {
    console.log(chalk.red(`❌ Augmentation not found: ${id}`))
    console.log('')
    console.log('Available augmentations:')
    catalog.augmentations.forEach(a => {
      console.log(`  • ${a.id}`)
    })
    return
  }
  
  // Fetch full details from API if available
  try {
    if (!CATALOG_API) throw new Error('No external catalog configured')
    
    const response = await fetch(`${CATALOG_API}/api/catalog/augmentation/${id}`)
    const details = await response.json()
    
    console.log(chalk.cyan.bold(`📦 ${details.name}`))
    if (details.popular) console.log(chalk.yellow('⭐ Popular'))
    console.log('')
    
    console.log(chalk.bold('Category:'), getCategoryName(details.category, catalog.categories))
    console.log(chalk.bold('Status:'), getStatusText(details.status))
    if (details.eta) console.log(chalk.bold('Expected:'), details.eta)
    console.log('')
    
    console.log(chalk.bold('Description:'))
    console.log(details.longDescription || details.description)
    console.log('')
    
    if (details.features) {
      console.log(chalk.bold('Features:'))
      details.features.forEach((f: string) => console.log(`  ✓ ${f}`))
      console.log('')
    }
    
    if (details.example) {
      console.log(chalk.bold('Example:'))
      console.log(chalk.gray('─'.repeat(50)))
      console.log(details.example.code)
      console.log(chalk.gray('─'.repeat(50)))
      console.log('')
    }
    
    if (details.requirements?.config) {
      console.log(chalk.bold('Required Configuration:'))
      details.requirements.config.forEach((c: string) => console.log(`  • ${c}`))
      console.log('')
    }
    
    if (details.pricing) {
      console.log(chalk.bold('Available in:'))
      details.pricing.tiers.forEach((t: string) => console.log(`  • ${t}`))
      console.log('')
    }
    
    console.log(chalk.dim('To activate: brainy augment activate'))
  } catch (error) {
    // Show basic info if API fails
    console.log(chalk.cyan.bold(`📦 ${aug.name}`))
    console.log(aug.description)
    console.log('')
    console.log(chalk.dim('Full details unavailable (no external catalog configured)'))
  }
}

/**
 * Show user's available augmentations
 */
export async function showAvailable(licenseKey?: string) {
  // Show local catalog as default
  const catalog = await fetchCatalog()
  if (!catalog) {
    console.log(chalk.red('❌ Could not load augmentation catalog'))
    return
  }
  
  console.log(chalk.cyan.bold('🧠 Available Augmentations'))
  console.log('')
  
  const available = catalog.augmentations.filter(a => a.status === 'available')
  const grouped = groupByCategory(available, catalog.categories)
  
  for (const [category, augs] of Object.entries(grouped)) {
    if (augs.length === 0) continue
    
    const cat = catalog.categories.find(c => c.id === category)
    console.log(chalk.bold(`${cat?.icon || '📦'} ${cat?.name || category}`))
    augs.forEach(aug => {
      console.log(`  ✅ ${aug.name}`)
      console.log(chalk.gray(`     ${aug.description}`))
    })
    console.log('')
  }
  
  console.log(chalk.green(`✅ ${available.length} augmentations available`))
  
  // If external API is configured and license key provided, try to fetch personalized data
  if (CATALOG_API && licenseKey) {
    try {
      const response = await fetch(`${CATALOG_API}/api/catalog/available`, {
        headers: { 'x-license-key': licenseKey }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(chalk.gray(`Plan: ${data.plan || 'Standard'}`))
        
        if (data.operations) {
          const used = data.operations.used || 0
          const limit = data.operations.limit
          const percent = limit === 'unlimited' ? 0 : Math.round((used / limit) * 100)
          
          console.log(chalk.bold('Usage:'))
          if (limit === 'unlimited') {
            console.log(`  Unlimited operations`)
          } else {
            console.log(`  ${used.toLocaleString()} / ${limit.toLocaleString()} operations (${percent}%)`)
          }
        }
      }
    } catch (error) {
      // Ignore external API errors - local catalog is sufficient
    }
  }
}

// Helper functions

function loadCache(ignoreExpiry = false): Catalog | null {
  try {
    if (!existsSync(CACHE_PATH)) return null
    
    const data = JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
    
    if (!ignoreExpiry && Date.now() - data.timestamp > CACHE_TTL) {
      return null
    }
    
    return data.catalog
  } catch {
    return null
  }
}

function saveCache(catalog: Catalog): void {
  try {
    const dir = join(homedir(), '.brainy')
    if (!existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true })
    }
    
    writeFileSync(CACHE_PATH, JSON.stringify({
      catalog,
      timestamp: Date.now()
    }))
  } catch {
    // Ignore cache save errors
  }
}

function groupByCategory(augmentations: Augmentation[], categories: Category[]) {
  const grouped: Record<string, Augmentation[]> = {}
  
  for (const aug of augmentations) {
    if (!grouped[aug.category]) {
      grouped[aug.category] = []
    }
    grouped[aug.category].push(aug)
  }
  
  // Sort by category order
  const ordered: Record<string, Augmentation[]> = {}
  const categoryOrder = ['memory', 'coordination', 'enterprise', 'perception', 'dialog', 'activation', 'cognition', 'websocket']
  
  for (const cat of categoryOrder) {
    if (grouped[cat]) {
      ordered[cat] = grouped[cat]
    }
  }
  
  return ordered
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'available': return chalk.green('✅')
    case 'coming_soon': return chalk.yellow('🔜')
    case 'deprecated': return chalk.red('⚠️')
    default: return '❓'
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'available': return chalk.green('Available')
    case 'coming_soon': return chalk.yellow('Coming Soon')
    case 'deprecated': return chalk.red('Deprecated')
    default: return 'Unknown'
  }
}

function getCategoryName(categoryId: string, categories: Category[]): string {
  const cat = categories.find(c => c.id === categoryId)
  return cat ? `${cat.icon} ${cat.name}` : categoryId
}

function readLicenseFile(): string | null {
  try {
    const licensePath = join(homedir(), '.brainy', 'license')
    if (existsSync(licensePath)) {
      return readFileSync(licensePath, 'utf8').trim()
    }
  } catch (error) {
    // License file read failed, return null
    console.debug('Failed to read license file:', error)
  }
  return null
}

function getDefaultCatalog(): Catalog {
  // Local catalog with current features
  return {
    version: '1.5.0',
    categories: [
      { id: 'core', name: 'Core Features', icon: '🧠', description: 'Essential brainy functionality' },
      { id: 'neural', name: 'Neural API', icon: '🔗', description: 'Semantic similarity and clustering' },
      { id: 'enterprise', name: 'Enterprise', icon: '🏢', description: 'Business integrations' },
      { id: 'storage', name: 'Storage', icon: '💾', description: 'Data persistence and caching' }
    ],
    augmentations: [
      {
        id: 'vector-search',
        name: 'Vector Search',
        category: 'core',
        description: 'High-performance semantic search with HNSW indexing',
        status: 'available',
        popular: true
      },
      {
        id: 'neural-similarity',
        name: 'Neural Similarity API',
        category: 'neural',
        description: 'Advanced semantic similarity, clustering, and hierarchy detection',
        status: 'available',
        popular: true
      },
      {
        id: 'intelligent-verb-scoring',
        name: 'Intelligent Verb Scoring',
        category: 'neural',
        description: 'Smart relationship scoring with taxonomy understanding',
        status: 'available'
      },
      {
        id: 'connection-pooling',
        name: 'Connection Pooling',
        category: 'enterprise',
        description: 'Efficient database connection management',
        status: 'available'
      },
      {
        id: 'batch-processing',
        name: 'Batch Processing',
        category: 'enterprise',
        description: 'High-throughput batch operations with deduplication',
        status: 'available'
      },
      {
        id: 's3-storage',
        name: 'S3 Compatible Storage',
        category: 'storage',
        description: 'Cloud storage with optimized batch operations',
        status: 'available'
      },
      {
        id: 'opfs-storage',
        name: 'OPFS Storage',
        category: 'storage',
        description: 'Browser-based persistent storage',
        status: 'available'
      }
    ]
  }
}