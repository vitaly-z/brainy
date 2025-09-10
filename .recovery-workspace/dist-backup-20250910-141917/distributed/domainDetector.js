/**
 * Domain Detector
 * Automatically detects and manages data domains for logical separation
 */
export class DomainDetector {
    constructor() {
        this.domainPatterns = [
            {
                domain: 'medical',
                patterns: {
                    fields: ['symptoms', 'diagnosis', 'treatment', 'medication', 'patient'],
                    keywords: ['medical', 'health', 'disease', 'symptom', 'treatment', 'doctor', 'patient']
                },
                priority: 1
            },
            {
                domain: 'legal',
                patterns: {
                    fields: ['contract', 'clause', 'litigation', 'statute', 'jurisdiction'],
                    keywords: ['legal', 'law', 'contract', 'court', 'attorney', 'litigation', 'statute']
                },
                priority: 1
            },
            {
                domain: 'product',
                patterns: {
                    fields: ['price', 'sku', 'inventory', 'category', 'brand'],
                    keywords: ['product', 'price', 'sale', 'inventory', 'catalog', 'item', 'sku']
                },
                priority: 1
            },
            {
                domain: 'customer',
                patterns: {
                    fields: ['customerId', 'email', 'phone', 'address', 'orders'],
                    keywords: ['customer', 'client', 'user', 'account', 'profile', 'contact']
                },
                priority: 1
            },
            {
                domain: 'financial',
                patterns: {
                    fields: ['amount', 'currency', 'transaction', 'balance', 'account'],
                    keywords: ['financial', 'money', 'payment', 'transaction', 'bank', 'credit', 'debit']
                },
                priority: 1
            },
            {
                domain: 'technical',
                patterns: {
                    fields: ['code', 'function', 'error', 'stack', 'api'],
                    keywords: ['code', 'software', 'api', 'error', 'debug', 'function', 'class', 'method']
                },
                priority: 2
            }
        ];
        this.customPatterns = [];
        this.domainStats = new Map();
    }
    /**
     * Detect domain from data object
     * @param data - The data object to analyze
     * @returns The detected domain and metadata
     */
    detectDomain(data) {
        if (!data || typeof data !== 'object') {
            return { domain: 'general' };
        }
        // Check for explicit domain field
        if (data.domain && typeof data.domain === 'string') {
            this.updateStats(data.domain);
            return {
                domain: data.domain,
                domainMetadata: this.extractDomainMetadata(data, data.domain)
            };
        }
        // Score each domain pattern
        const scores = new Map();
        // Check custom patterns first (higher priority)
        for (const pattern of this.customPatterns) {
            const score = this.scorePattern(data, pattern);
            if (score > 0) {
                scores.set(pattern.domain, score * (pattern.priority || 1));
            }
        }
        // Check default patterns
        for (const pattern of this.domainPatterns) {
            const score = this.scorePattern(data, pattern);
            if (score > 0) {
                const currentScore = scores.get(pattern.domain) || 0;
                scores.set(pattern.domain, currentScore + score * (pattern.priority || 1));
            }
        }
        // Find highest scoring domain
        let bestDomain = 'general';
        let bestScore = 0;
        for (const [domain, score] of scores.entries()) {
            if (score > bestScore) {
                bestDomain = domain;
                bestScore = score;
            }
        }
        this.updateStats(bestDomain);
        return {
            domain: bestDomain,
            domainMetadata: this.extractDomainMetadata(data, bestDomain)
        };
    }
    /**
     * Score a data object against a domain pattern
     */
    scorePattern(data, pattern) {
        let score = 0;
        // Check field matches
        if (pattern.patterns.fields) {
            const dataKeys = Object.keys(data);
            for (const field of pattern.patterns.fields) {
                if (dataKeys.some(key => key.toLowerCase().includes(field.toLowerCase()))) {
                    score += 2; // Field match is strong signal
                }
            }
        }
        // Check keyword matches in values
        if (pattern.patterns.keywords) {
            const dataStr = JSON.stringify(data).toLowerCase();
            for (const keyword of pattern.patterns.keywords) {
                if (dataStr.includes(keyword.toLowerCase())) {
                    score += 1;
                }
            }
        }
        // Check regex patterns
        if (pattern.patterns.regex) {
            const dataStr = JSON.stringify(data);
            if (pattern.patterns.regex.test(dataStr)) {
                score += 3; // Regex match is very specific
            }
        }
        return score;
    }
    /**
     * Extract domain-specific metadata
     */
    extractDomainMetadata(data, domain) {
        const metadata = {};
        switch (domain) {
            case 'medical':
                if (data.patientId)
                    metadata.patientId = data.patientId;
                if (data.condition)
                    metadata.condition = data.condition;
                if (data.severity)
                    metadata.severity = data.severity;
                break;
            case 'legal':
                if (data.caseId)
                    metadata.caseId = data.caseId;
                if (data.jurisdiction)
                    metadata.jurisdiction = data.jurisdiction;
                if (data.documentType)
                    metadata.documentType = data.documentType;
                break;
            case 'product':
                if (data.sku)
                    metadata.sku = data.sku;
                if (data.category)
                    metadata.category = data.category;
                if (data.brand)
                    metadata.brand = data.brand;
                if (data.price)
                    metadata.priceRange = this.getPriceRange(data.price);
                break;
            case 'customer':
                if (data.customerId)
                    metadata.customerId = data.customerId;
                if (data.segment)
                    metadata.segment = data.segment;
                if (data.lifetime_value)
                    metadata.valueCategory = this.getValueCategory(data.lifetime_value);
                break;
            case 'financial':
                if (data.accountId)
                    metadata.accountId = data.accountId;
                if (data.transactionType)
                    metadata.transactionType = data.transactionType;
                if (data.amount)
                    metadata.amountRange = this.getAmountRange(data.amount);
                break;
            case 'technical':
                if (data.service)
                    metadata.service = data.service;
                if (data.environment)
                    metadata.environment = data.environment;
                if (data.severity)
                    metadata.severity = data.severity;
                break;
        }
        // Add detection confidence
        metadata.detectionConfidence = this.calculateConfidence(data, domain);
        return metadata;
    }
    /**
     * Calculate detection confidence
     */
    calculateConfidence(data, domain) {
        // If domain was explicitly specified
        if (data.domain === domain)
            return 'high';
        // Check how many patterns matched
        const pattern = [...this.customPatterns, ...this.domainPatterns]
            .find(p => p.domain === domain);
        if (!pattern)
            return 'low';
        const score = this.scorePattern(data, pattern);
        if (score >= 5)
            return 'high';
        if (score >= 2)
            return 'medium';
        return 'low';
    }
    /**
     * Categorize price ranges
     */
    getPriceRange(price) {
        if (price < 10)
            return 'low';
        if (price < 100)
            return 'medium';
        if (price < 1000)
            return 'high';
        return 'premium';
    }
    /**
     * Categorize customer value
     */
    getValueCategory(value) {
        if (value < 100)
            return 'low';
        if (value < 1000)
            return 'medium';
        if (value < 10000)
            return 'high';
        return 'vip';
    }
    /**
     * Categorize amount ranges
     */
    getAmountRange(amount) {
        if (amount < 100)
            return 'micro';
        if (amount < 1000)
            return 'small';
        if (amount < 10000)
            return 'medium';
        if (amount < 100000)
            return 'large';
        return 'enterprise';
    }
    /**
     * Add custom domain pattern
     * @param pattern - Custom domain pattern to add
     */
    addCustomPattern(pattern) {
        // Remove existing pattern for same domain if exists
        this.customPatterns = this.customPatterns.filter(p => p.domain !== pattern.domain);
        this.customPatterns.push(pattern);
    }
    /**
     * Remove custom domain pattern
     * @param domain - Domain to remove pattern for
     */
    removeCustomPattern(domain) {
        this.customPatterns = this.customPatterns.filter(p => p.domain !== domain);
    }
    /**
     * Update domain statistics
     */
    updateStats(domain) {
        const count = this.domainStats.get(domain) || 0;
        this.domainStats.set(domain, count + 1);
    }
    /**
     * Get domain statistics
     * @returns Map of domain to count
     */
    getDomainStats() {
        return new Map(this.domainStats);
    }
    /**
     * Clear domain statistics
     */
    clearStats() {
        this.domainStats.clear();
    }
    /**
     * Get all configured domains
     * @returns Array of domain names
     */
    getConfiguredDomains() {
        const domains = new Set();
        for (const pattern of [...this.domainPatterns, ...this.customPatterns]) {
            domains.add(pattern.domain);
        }
        return Array.from(domains).sort();
    }
}
//# sourceMappingURL=domainDetector.js.map