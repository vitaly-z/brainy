/**
 * Brain-Cloud Catalog Discovery
 * 
 * Discovers augmentations available in the brain-cloud catalog
 * Handles free, premium, and community augmentations
 */

import { AugmentationManifest } from '../manifest.js'

export interface CatalogAugmentation {
  id: string
  name: string
  description: string
  longDescription?: string
  category: string
  status: 'available' | 'coming_soon' | 'deprecated'
  tier: 'free' | 'premium' | 'enterprise'
  price?: {
    monthly?: number
    yearly?: number
    oneTime?: number
  }
  manifest?: AugmentationManifest
  source: 'catalog'
  cdnUrl?: string
  npmPackage?: string
  githubRepo?: string
  author?: {
    name: string
    url?: string
  }
  metrics?: {
    installations: number
    rating: number
    reviews: number
  }
  requirements?: {
    minBrainyVersion?: string
    maxBrainyVersion?: string
    dependencies?: string[]
  }
}

export interface CatalogOptions {
  apiUrl?: string
  apiKey?: string
  cache?: boolean
  cacheTimeout?: number
}

export interface CatalogFilters {
  category?: string
  tier?: 'free' | 'premium' | 'enterprise'
  status?: 'available' | 'coming_soon' | 'deprecated'
  search?: string
  installed?: boolean
  minRating?: number
}

/**
 * Brain-Cloud Catalog Discovery
 */
export class CatalogDiscovery {
  private apiUrl: string
  private apiKey?: string
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private cacheTimeout: number
  
  constructor(options: CatalogOptions = {}) {
    this.apiUrl = options.apiUrl || 'https://api.soulcraft.com/brain-cloud'
    this.apiKey = options.apiKey
    this.cacheTimeout = options.cacheTimeout || 5 * 60 * 1000 // 5 minutes
  }
  
  /**
   * Discover augmentations from catalog
   */
  async discover(filters: CatalogFilters = {}): Promise<CatalogAugmentation[]> {
    const cacheKey = JSON.stringify(filters)
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data
      }
    }
    
    // Build query parameters
    const params = new URLSearchParams()
    if (filters.category) params.append('category', filters.category)
    if (filters.tier) params.append('tier', filters.tier)
    if (filters.status) params.append('status', filters.status)
    if (filters.search) params.append('q', filters.search)
    if (filters.minRating) params.append('minRating', filters.minRating.toString())
    
    // Fetch from API
    const response = await fetch(`${this.apiUrl}/augmentations/discover?${params}`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch catalog: ${response.statusText}`)
    }
    
    const data = await response.json()
    const augmentations = this.transformCatalogData(data)
    
    // Cache result
    this.cache.set(cacheKey, {
      data: augmentations,
      timestamp: Date.now()
    })
    
    return augmentations
  }
  
  /**
   * Get specific augmentation details
   */
  async getAugmentation(id: string): Promise<CatalogAugmentation | null> {
    const response = await fetch(`${this.apiUrl}/augmentations/${id}`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Failed to fetch augmentation: ${response.statusText}`)
    }
    
    const data = await response.json()
    return this.transformAugmentation(data)
  }
  
  /**
   * Get augmentation manifest
   */
  async getManifest(id: string): Promise<AugmentationManifest | null> {
    const response = await fetch(`${this.apiUrl}/augmentations/${id}/manifest`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Failed to fetch manifest: ${response.statusText}`)
    }
    
    return response.json()
  }
  
  /**
   * Get CDN URL for dynamic loading
   */
  async getCDNUrl(id: string): Promise<string | null> {
    const aug = await this.getAugmentation(id)
    return aug?.cdnUrl || null
  }
  
  /**
   * Check if user has access to augmentation
   */
  async checkAccess(id: string): Promise<{
    hasAccess: boolean
    requiresPurchase?: boolean
    requiredTier?: string
  }> {
    if (!this.apiKey) {
      // No API key, only free augmentations
      const aug = await this.getAugmentation(id)
      return {
        hasAccess: aug?.tier === 'free',
        requiresPurchase: aug?.tier !== 'free',
        requiredTier: aug?.tier
      }
    }
    
    const response = await fetch(`${this.apiUrl}/augmentations/${id}/access`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      throw new Error(`Failed to check access: ${response.statusText}`)
    }
    
    return response.json()
  }
  
  /**
   * Purchase/activate augmentation
   */
  async purchase(id: string, licenseKey?: string): Promise<{
    success: boolean
    cdnUrl?: string
    npmPackage?: string
    licenseKey?: string
  }> {
    const body = licenseKey ? { licenseKey } : {}
    
    const response = await fetch(`${this.apiUrl}/augmentations/${id}/purchase`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      throw new Error(`Failed to purchase: ${response.statusText}`)
    }
    
    return response.json()
  }
  
  /**
   * Get user's purchased augmentations
   */
  async getPurchased(): Promise<CatalogAugmentation[]> {
    if (!this.apiKey) {
      return []
    }
    
    const response = await fetch(`${this.apiUrl}/user/augmentations`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch purchased: ${response.statusText}`)
    }
    
    const data = await response.json()
    return this.transformCatalogData(data)
  }
  
  /**
   * Get categories
   */
  async getCategories(): Promise<Array<{
    id: string
    name: string
    description: string
    icon?: string
  }>> {
    const response = await fetch(`${this.apiUrl}/augmentations/categories`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`)
    }
    
    return response.json()
  }
  
  /**
   * Search augmentations
   */
  async search(query: string): Promise<CatalogAugmentation[]> {
    return this.discover({ search: query })
  }
  
  /**
   * Get trending augmentations
   */
  async getTrending(limit: number = 10): Promise<CatalogAugmentation[]> {
    const response = await fetch(`${this.apiUrl}/augmentations/trending?limit=${limit}`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch trending: ${response.statusText}`)
    }
    
    const data = await response.json()
    return this.transformCatalogData(data)
  }
  
  /**
   * Get recommended augmentations
   */
  async getRecommended(): Promise<CatalogAugmentation[]> {
    if (!this.apiKey) {
      // Return popular free augmentations
      return this.discover({ tier: 'free', minRating: 4 })
    }
    
    const response = await fetch(`${this.apiUrl}/augmentations/recommended`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch recommended: ${response.statusText}`)
    }
    
    const data = await response.json()
    return this.transformCatalogData(data)
  }
  
  /**
   * Transform catalog data
   */
  private transformCatalogData(data: any[]): CatalogAugmentation[] {
    return data.map(item => this.transformAugmentation(item))
  }
  
  /**
   * Transform single augmentation
   */
  private transformAugmentation(item: any): CatalogAugmentation {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      longDescription: item.longDescription,
      category: item.category,
      status: item.status || 'available',
      tier: item.tier || 'free',
      price: item.price,
      manifest: item.manifest,
      source: 'catalog',
      cdnUrl: item.cdnUrl || `https://cdn.soulcraft.com/augmentations/${item.id}@latest`,
      npmPackage: item.npmPackage,
      githubRepo: item.githubRepo,
      author: item.author,
      metrics: item.metrics,
      requirements: item.requirements
    }
  }
  
  /**
   * Get request headers
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {}
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }
    
    return headers
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }
  
  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
    this.clearCache() // Clear cache when API key changes
  }
}