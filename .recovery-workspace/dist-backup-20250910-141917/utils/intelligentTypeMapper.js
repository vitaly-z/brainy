/**
 * Intelligent Type Mapper
 * Maps generic/invalid type names to specific semantic types based on data analysis
 * Prevents semantic degradation from overuse of generic types
 */
import { NounType, VerbType } from '../types/graphTypes.js';
/**
 * Common aliases that users might use
 */
const GENERIC_ALIASES = new Set([
    'entity',
    'item',
    'object',
    'node',
    'record',
    'entry',
    'data',
    'resource'
]);
/**
 * Field signatures for type inference
 */
const TYPE_SIGNATURES = {
    // Person indicators
    person: {
        required: [],
        indicators: ['email', 'firstName', 'lastName', 'name', 'phone', 'username', 'userId'],
        patterns: [/@/, /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i],
        weight: 10
    },
    // User account indicators  
    user: {
        required: [],
        indicators: ['username', 'password', 'accountId', 'loginTime', 'permissions', 'role'],
        patterns: [],
        weight: 9
    },
    // Organization indicators
    organization: {
        required: [],
        indicators: ['companyName', 'orgName', 'ein', 'vatNumber', 'employees', 'headquarters'],
        patterns: [],
        weight: 8
    },
    // Product indicators
    product: {
        required: [],
        indicators: ['price', 'sku', 'barcode', 'inventory', 'cost', 'productId', 'inStock'],
        patterns: [/^\$?\d+\.?\d*$/, /^[A-Z0-9-]+$/],
        weight: 8
    },
    // Document indicators
    document: {
        required: [],
        indicators: ['content', 'text', 'body', 'title', 'author', 'markdown', 'html'],
        patterns: [],
        weight: 7
    },
    // Message indicators
    message: {
        required: [],
        indicators: ['from', 'to', 'subject', 'body', 'sentAt', 'messageId', 'threadId'],
        patterns: [],
        weight: 7
    },
    // Task indicators
    task: {
        required: [],
        indicators: ['dueDate', 'assignee', 'status', 'priority', 'completed', 'taskId'],
        patterns: [],
        weight: 7
    },
    // Event indicators
    event: {
        required: [],
        indicators: ['startTime', 'endTime', 'date', 'location', 'attendees', 'eventType'],
        patterns: [],
        weight: 6
    },
    // Location indicators
    location: {
        required: [],
        indicators: ['latitude', 'longitude', 'address', 'city', 'country', 'zipCode', 'coordinates'],
        patterns: [/^-?\d+\.\d+$/, /^\d{5}(-\d{4})?$/],
        weight: 6
    },
    // File indicators
    file: {
        required: [],
        indicators: ['filename', 'filepath', 'extension', 'mimeType', 'fileSize', 'checksum'],
        patterns: [/\.[a-z0-9]+$/i],
        weight: 5
    },
    // Dataset indicators
    dataset: {
        required: [],
        indicators: ['schema', 'rows', 'columns', 'records', 'dataType', 'format'],
        patterns: [],
        weight: 5
    },
    // Media indicators
    media: {
        required: [],
        indicators: ['url', 'thumbnail', 'duration', 'resolution', 'codec', 'bitrate'],
        patterns: [/\.(jpg|jpeg|png|gif|mp4|mp3|wav|avi)$/i],
        weight: 5
    },
    // Project indicators
    project: {
        required: [],
        indicators: ['deadline', 'budget', 'team', 'milestones', 'deliverables', 'projectId'],
        patterns: [],
        weight: 5
    },
    // Service indicators
    service: {
        required: [],
        indicators: ['endpoint', 'apiKey', 'serviceUrl', 'port', 'protocol', 'healthCheck'],
        patterns: [/^https?:\/\//, /:\d+$/],
        weight: 4
    }
};
/**
 * Intelligent Type Mapper
 */
export class IntelligentTypeMapper {
    constructor() {
        this.typeCache = new Map();
        this.inferenceStats = {
            total: 0,
            inferred: 0,
            defaulted: 0,
            cached: 0
        };
    }
    /**
     * Map a noun type, with intelligent inference for generic types
     */
    mapNounType(inputType, data) {
        // Check if it's already a valid type
        if (this.isValidNounType(inputType)) {
            return inputType;
        }
        // Check cache for this exact input
        const cacheKey = `${inputType}-${JSON.stringify(data || {}).substring(0, 100)}`;
        if (this.typeCache.has(cacheKey)) {
            this.inferenceStats.cached++;
            return this.typeCache.get(cacheKey);
        }
        this.inferenceStats.total++;
        // If it's a generic alias and we have data, try to infer
        if (GENERIC_ALIASES.has(inputType.toLowerCase()) && data) {
            const inferred = this.inferTypeFromData(data);
            if (inferred) {
                this.inferenceStats.inferred++;
                this.typeCache.set(cacheKey, inferred);
                return inferred;
            }
        }
        // Handle specific common mappings
        const directMapping = this.getDirectMapping(inputType);
        if (directMapping) {
            this.typeCache.set(cacheKey, directMapping);
            return directMapping;
        }
        // Default to 'thing' for truly unknown types
        this.inferenceStats.defaulted++;
        const defaultType = NounType.Thing;
        this.typeCache.set(cacheKey, defaultType);
        return defaultType;
    }
    /**
     * Map a verb type
     */
    mapVerbType(inputType) {
        // Check if it's already valid
        if (this.isValidVerbType(inputType)) {
            return inputType;
        }
        // Common verb mappings
        const verbMappings = {
            'related': VerbType.RelatedTo,
            'relates': VerbType.RelatedTo,
            'has': VerbType.Contains,
            'includes': VerbType.Contains,
            'belongsTo': VerbType.PartOf,
            'in': VerbType.LocatedAt,
            'at': VerbType.LocatedAt,
            'references': VerbType.References,
            'cites': VerbType.References,
            'before': VerbType.Precedes,
            'after': VerbType.Succeeds,
            'causes': VerbType.Causes,
            'needs': VerbType.Requires,
            'requires': VerbType.Requires,
            'makes': VerbType.Creates,
            'produces': VerbType.Creates,
            'changes': VerbType.Modifies,
            'updates': VerbType.Modifies,
            'owns': VerbType.Owns,
            'ownedBy': VerbType.BelongsTo, // Use BelongsTo for reverse ownership
            'uses': VerbType.Uses,
            'usedBy': VerbType.Uses // Same relationship, just interpret direction
        };
        const normalized = inputType.toLowerCase();
        return verbMappings[normalized] || VerbType.RelatedTo;
    }
    /**
     * Infer type from data structure
     */
    inferTypeFromData(data) {
        if (!data || typeof data !== 'object')
            return null;
        const scores = new Map();
        const fields = Object.keys(data);
        const values = Object.values(data);
        // Calculate scores for each type based on field matches
        for (const [type, signature] of Object.entries(TYPE_SIGNATURES)) {
            let score = 0;
            // Check required fields
            if (signature.required.length > 0) {
                const hasRequired = signature.required.every(field => fields.includes(field));
                if (!hasRequired)
                    continue;
                score += signature.weight * 2;
            }
            // Check indicator fields
            for (const field of fields) {
                if (signature.indicators.some(indicator => field.toLowerCase().includes(indicator.toLowerCase()))) {
                    score += signature.weight;
                }
            }
            // Check value patterns
            for (const value of values) {
                if (typeof value === 'string' && signature.patterns.length > 0) {
                    for (const pattern of signature.patterns) {
                        if (pattern.test(value)) {
                            score += signature.weight / 2;
                            break;
                        }
                    }
                }
            }
            if (score > 0) {
                scores.set(type, score);
            }
        }
        // Return the type with highest score
        if (scores.size > 0) {
            const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
            return sorted[0][0];
        }
        // Fallback inference based on data structure
        if (fields.includes('url') || fields.includes('href')) {
            return NounType.Document;
        }
        if (Array.isArray(data) || fields.includes('items') || fields.includes('elements')) {
            return NounType.Collection;
        }
        // Check if it looks like a process/workflow
        if (fields.includes('steps') || fields.includes('stages')) {
            return NounType.Process;
        }
        return null;
    }
    /**
     * Get direct mapping for common aliases
     */
    getDirectMapping(inputType) {
        const mappings = {
            // Specific mappings that aren't generic
            'company': NounType.Organization,
            'corp': NounType.Organization,
            'business': NounType.Organization,
            'employee': NounType.Person,
            'staff': NounType.Person,
            'customer': NounType.Person,
            'client': NounType.Person,
            'article': NounType.Document,
            'post': NounType.Document,
            'page': NounType.Document,
            'image': NounType.Media,
            'video': NounType.Media,
            'audio': NounType.Media,
            'photo': NounType.Media,
            'place': NounType.Location,
            'address': NounType.Location,
            'country': NounType.Location,
            'city': NounType.Location,
            'todo': NounType.Task,
            'job': NounType.Task,
            'work': NounType.Task,
            'meeting': NounType.Event,
            'appointment': NounType.Event,
            'conference': NounType.Event,
            'folder': NounType.Collection,
            'group': NounType.Collection,
            'list': NounType.Collection,
            'category': NounType.Collection
        };
        const normalized = inputType.toLowerCase();
        return mappings[normalized] || null;
    }
    /**
     * Check if a type is valid
     */
    isValidNounType(type) {
        return Object.values(NounType).includes(type);
    }
    /**
     * Check if a verb type is valid
     */
    isValidVerbType(type) {
        return Object.values(VerbType).includes(type);
    }
    /**
     * Get inference statistics
     */
    getStats() {
        return {
            ...this.inferenceStats,
            cacheSize: this.typeCache.size,
            inferenceRate: this.inferenceStats.total > 0
                ? (this.inferenceStats.inferred / this.inferenceStats.total)
                : 0
        };
    }
    /**
     * Clear the type cache
     */
    clearCache() {
        this.typeCache.clear();
    }
}
// Singleton instance
export const typeMapper = new IntelligentTypeMapper();
/**
 * Helper function for easy type mapping
 */
export function mapNounType(inputType, data) {
    return typeMapper.mapNounType(inputType, data);
}
/**
 * Helper function for verb mapping
 */
export function mapVerbType(inputType) {
    return typeMapper.mapVerbType(inputType);
}
//# sourceMappingURL=intelligentTypeMapper.js.map