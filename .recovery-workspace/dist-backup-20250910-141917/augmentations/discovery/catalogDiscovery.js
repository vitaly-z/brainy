/**
 * Brain-Cloud Catalog Discovery
 *
 * Discovers augmentations available in the brain-cloud catalog
 * Handles free, premium, and community augmentations
 */
/**
 * Brain-Cloud Catalog Discovery
 */
export class CatalogDiscovery {
    constructor(options = {}) {
        this.cache = new Map();
        this.apiUrl = options.apiUrl || 'https://api.soulcraft.com/brain-cloud';
        this.apiKey = options.apiKey;
        this.cacheTimeout = options.cacheTimeout || 5 * 60 * 1000; // 5 minutes
    }
    /**
     * Discover augmentations from catalog
     */
    async discover(filters = {}) {
        const cacheKey = JSON.stringify(filters);
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }
        // Build query parameters
        const params = new URLSearchParams();
        if (filters.category)
            params.append('category', filters.category);
        if (filters.tier)
            params.append('tier', filters.tier);
        if (filters.status)
            params.append('status', filters.status);
        if (filters.search)
            params.append('q', filters.search);
        if (filters.minRating)
            params.append('minRating', filters.minRating.toString());
        // Fetch from API
        const response = await fetch(`${this.apiUrl}/augmentations/discover?${params}`, {
            headers: this.getHeaders()
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch catalog: ${response.statusText}`);
        }
        const data = await response.json();
        const augmentations = this.transformCatalogData(data);
        // Cache result
        this.cache.set(cacheKey, {
            data: augmentations,
            timestamp: Date.now()
        });
        return augmentations;
    }
    /**
     * Get specific augmentation details
     */
    async getAugmentation(id) {
        const response = await fetch(`${this.apiUrl}/augmentations/${id}`, {
            headers: this.getHeaders()
        });
        if (!response.ok) {
            if (response.status === 404)
                return null;
            throw new Error(`Failed to fetch augmentation: ${response.statusText}`);
        }
        const data = await response.json();
        return this.transformAugmentation(data);
    }
    /**
     * Get augmentation manifest
     */
    async getManifest(id) {
        const response = await fetch(`${this.apiUrl}/augmentations/${id}/manifest`, {
            headers: this.getHeaders()
        });
        if (!response.ok) {
            if (response.status === 404)
                return null;
            throw new Error(`Failed to fetch manifest: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Get CDN URL for dynamic loading
     */
    async getCDNUrl(id) {
        const aug = await this.getAugmentation(id);
        return aug?.cdnUrl || null;
    }
    /**
     * Check if user has access to augmentation
     */
    async checkAccess(id) {
        if (!this.apiKey) {
            // No API key, only free augmentations
            const aug = await this.getAugmentation(id);
            return {
                hasAccess: aug?.tier === 'free',
                requiresPurchase: aug?.tier !== 'free',
                requiredTier: aug?.tier
            };
        }
        const response = await fetch(`${this.apiUrl}/augmentations/${id}/access`, {
            headers: this.getHeaders()
        });
        if (!response.ok) {
            throw new Error(`Failed to check access: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Purchase/activate augmentation
     */
    async purchase(id, licenseKey) {
        const body = licenseKey ? { licenseKey } : {};
        const response = await fetch(`${this.apiUrl}/augmentations/${id}/purchase`, {
            method: 'POST',
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            throw new Error(`Failed to purchase: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Get user's purchased augmentations
     */
    async getPurchased() {
        if (!this.apiKey) {
            return [];
        }
        const response = await fetch(`${this.apiUrl}/user/augmentations`, {
            headers: this.getHeaders()
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch purchased: ${response.statusText}`);
        }
        const data = await response.json();
        return this.transformCatalogData(data);
    }
    /**
     * Get categories
     */
    async getCategories() {
        const response = await fetch(`${this.apiUrl}/augmentations/categories`, {
            headers: this.getHeaders()
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch categories: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Search augmentations
     */
    async search(query) {
        return this.discover({ search: query });
    }
    /**
     * Get trending augmentations
     */
    async getTrending(limit = 10) {
        const response = await fetch(`${this.apiUrl}/augmentations/trending?limit=${limit}`, {
            headers: this.getHeaders()
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch trending: ${response.statusText}`);
        }
        const data = await response.json();
        return this.transformCatalogData(data);
    }
    /**
     * Get recommended augmentations
     */
    async getRecommended() {
        if (!this.apiKey) {
            // Return popular free augmentations
            return this.discover({ tier: 'free', minRating: 4 });
        }
        const response = await fetch(`${this.apiUrl}/augmentations/recommended`, {
            headers: this.getHeaders()
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch recommended: ${response.statusText}`);
        }
        const data = await response.json();
        return this.transformCatalogData(data);
    }
    /**
     * Transform catalog data
     */
    transformCatalogData(data) {
        return data.map(item => this.transformAugmentation(item));
    }
    /**
     * Transform single augmentation
     */
    transformAugmentation(item) {
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
        };
    }
    /**
     * Get request headers
     */
    getHeaders() {
        const headers = {};
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        return headers;
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Set API key
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.clearCache(); // Clear cache when API key changes
    }
}
//# sourceMappingURL=catalogDiscovery.js.map