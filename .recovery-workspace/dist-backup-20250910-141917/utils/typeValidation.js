import { NounType, VerbType } from '../types/graphTypes.js';
// Type sets for O(1) validation
const VALID_NOUN_TYPES = new Set(Object.values(NounType));
const VALID_VERB_TYPES = new Set(Object.values(VerbType));
// Type guards
export function isValidNounType(type) {
    return typeof type === 'string' && VALID_NOUN_TYPES.has(type);
}
export function isValidVerbType(type) {
    return typeof type === 'string' && VALID_VERB_TYPES.has(type);
}
// Validators with helpful errors
export function validateNounType(type) {
    if (!isValidNounType(type)) {
        const suggestion = findClosestMatch(String(type), VALID_NOUN_TYPES);
        throw new Error(`Invalid noun type: '${type}'. ${suggestion ? `Did you mean '${suggestion}'?` : ''} ` +
            `Valid types are: ${[...VALID_NOUN_TYPES].sort().join(', ')}`);
    }
    return type;
}
export function validateVerbType(type) {
    if (!isValidVerbType(type)) {
        const suggestion = findClosestMatch(String(type), VALID_VERB_TYPES);
        throw new Error(`Invalid verb type: '${type}'. ${suggestion ? `Did you mean '${suggestion}'?` : ''} ` +
            `Valid types are: ${[...VALID_VERB_TYPES].sort().join(', ')}`);
    }
    return type;
}
export function validateGraphNoun(noun) {
    if (!noun || typeof noun !== 'object') {
        throw new Error('Invalid noun: must be an object');
    }
    const n = noun;
    if (!n.noun) {
        throw new Error('Invalid noun: missing required "noun" type field');
    }
    n.noun = validateNounType(n.noun);
    return n;
}
export function validateGraphVerb(verb) {
    if (!verb || typeof verb !== 'object') {
        throw new Error('Invalid verb: must be an object');
    }
    const v = verb;
    if (!v.verb) {
        throw new Error('Invalid verb: missing required "verb" type field');
    }
    v.verb = validateVerbType(v.verb);
    return v;
}
// Helper for suggestions using Levenshtein distance
function findClosestMatch(input, validSet) {
    if (!input)
        return null;
    const lower = input.toLowerCase();
    let bestMatch = null;
    let bestScore = Infinity;
    for (const valid of validSet) {
        const validLower = valid.toLowerCase();
        // Exact match (case-insensitive)
        if (validLower === lower) {
            return valid;
        }
        // Substring match
        if (validLower.includes(lower) || lower.includes(validLower)) {
            return valid;
        }
        // Calculate Levenshtein distance
        const distance = levenshteinDistance(lower, validLower);
        if (distance < bestScore && distance <= 3) { // Threshold of 3 for suggestions
            bestScore = distance;
            bestMatch = valid;
        }
    }
    return bestMatch;
}
// Levenshtein distance implementation
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            }
            else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], // deletion
                dp[i][j - 1], // insertion
                dp[i - 1][j - 1] // substitution
                );
            }
        }
    }
    return dp[m][n];
}
// Batch validation helpers
export function validateNounTypes(types) {
    return types.map(validateNounType);
}
export function validateVerbTypes(types) {
    return types.map(validateVerbType);
}
let stats = {
    validated: 0,
    failed: 0,
    inferred: 0,
    suggestions: 0
};
export function getValidationStats() {
    return { ...stats };
}
export function resetValidationStats() {
    stats = {
        validated: 0,
        failed: 0,
        inferred: 0,
        suggestions: 0
    };
}
// ================================================================
// INPUT VALIDATION UTILITIES
// ================================================================
// Comprehensive validation for all public API parameters
// Extends the existing type validation system
export class ValidationError extends Error {
    constructor(parameter, value, constraint) {
        super(`Invalid ${parameter}: ${constraint}`);
        this.parameter = parameter;
        this.value = value;
        this.constraint = constraint;
        this.name = 'ValidationError';
    }
}
/**
 * Validate required ID parameter
 * Standard validation for all ID-based operations
 */
export function validateId(id, paramName = 'id') {
    if (id === null || id === undefined) {
        throw new ValidationError(paramName, id, 'cannot be null or undefined');
    }
    if (typeof id !== 'string') {
        throw new ValidationError(paramName, id, 'must be a string');
    }
    if (id.trim().length === 0) {
        throw new ValidationError(paramName, id, 'cannot be empty string');
    }
    if (id.length > 512) {
        throw new ValidationError(paramName, id, 'cannot exceed 512 characters');
    }
    return id.trim();
}
/**
 * Validate search query input
 * Handles string queries, vectors, and objects for search operations
 */
export function validateSearchQuery(query, paramName = 'query') {
    if (query === null || query === undefined) {
        throw new ValidationError(paramName, query, 'cannot be null or undefined');
    }
    // Allow strings, arrays (vectors), or objects
    if (typeof query === 'string') {
        if (query.trim().length === 0) {
            throw new ValidationError(paramName, query, 'query string cannot be empty');
        }
        if (query.length > 10000) {
            throw new ValidationError(paramName, query, 'query string too long (max 10000 characters)');
        }
        return query.trim();
    }
    if (Array.isArray(query)) {
        if (query.length === 0) {
            throw new ValidationError(paramName, query, 'array cannot be empty');
        }
        // Validate vector arrays contain only numbers
        if (query.every(item => typeof item === 'number')) {
            if (query.some(num => !isFinite(num))) {
                throw new ValidationError(paramName, query, 'vector contains invalid numbers (NaN or Infinity)');
            }
        }
        return query;
    }
    if (typeof query === 'object') {
        return query;
    }
    throw new ValidationError(paramName, query, 'must be string, array, or object');
}
/**
 * Validate data input for addNoun/updateNoun operations
 * Handles vectors, objects, strings, and validates structure
 */
export function validateDataInput(data, paramName = 'data', allowNull = false) {
    // Handle null/undefined
    if (data === null) {
        if (!allowNull) {
            throw new ValidationError(paramName, data, 'Input cannot be null or undefined');
        }
        return data;
    }
    if (data === undefined) {
        throw new ValidationError(paramName, data, 'Input cannot be null or undefined');
    }
    // Handle strings (including empty strings which are valid)
    if (typeof data === 'string') {
        // Empty strings are valid - they get converted to embeddings
        // This matches the behavior in the embed function
        if (data.length > 1000000) {
            throw new ValidationError(paramName, data, 'string too long (max 1MB)');
        }
        return data;
    }
    // Handle arrays (vectors)
    if (Array.isArray(data)) {
        if (data.length === 0) {
            throw new ValidationError(paramName, data, 'array cannot be empty');
        }
        if (data.length > 100000) {
            throw new ValidationError(paramName, data, 'array too large (max 100k elements)');
        }
        // Validate vector arrays contain only numbers
        if (data.every(item => typeof item === 'number')) {
            if (data.some(num => !isFinite(num))) {
                throw new ValidationError(paramName, data, 'vector contains invalid numbers (NaN or Infinity)');
            }
        }
        return data;
    }
    // Handle objects
    if (typeof data === 'object') {
        try {
            // Quick check if object can be serialized (avoids circular references)
            JSON.stringify(data);
        }
        catch (error) {
            throw new ValidationError(paramName, data, 'object contains circular references or unserializable values');
        }
        return data;
    }
    // Handle primitive types
    if (typeof data === 'number') {
        if (!isFinite(data)) {
            throw new ValidationError(paramName, data, 'number must be finite (not NaN or Infinity)');
        }
        return data;
    }
    if (typeof data === 'boolean') {
        return data;
    }
    throw new ValidationError(paramName, data, 'must be string, number, boolean, array, or object');
}
/**
 * Validate search options
 * Comprehensive validation for search API options
 */
export function validateSearchOptions(options, paramName = 'options') {
    if (options === null || options === undefined) {
        return {}; // Default to empty options
    }
    if (typeof options !== 'object' || Array.isArray(options)) {
        throw new ValidationError(paramName, options, 'must be an object');
    }
    const opts = options;
    // Validate limit
    if ('limit' in opts) {
        const limit = opts.limit;
        if (typeof limit !== 'number' || limit < 1 || limit > 10000 || !Number.isInteger(limit)) {
            throw new ValidationError(`${paramName}.limit`, limit, 'must be integer between 1 and 10000');
        }
    }
    // Validate offset  
    if ('offset' in opts) {
        const offset = opts.offset;
        if (typeof offset !== 'number' || offset < 0 || !Number.isInteger(offset)) {
            throw new ValidationError(`${paramName}.offset`, offset, 'must be non-negative integer');
        }
    }
    // Validate threshold
    if ('threshold' in opts) {
        const threshold = opts.threshold;
        if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
            throw new ValidationError(`${paramName}.threshold`, threshold, 'must be number between 0 and 1');
        }
    }
    // Validate timeout
    if ('timeout' in opts) {
        const timeout = opts.timeout;
        if (typeof timeout !== 'number' || timeout < 1 || timeout > 300000 || !Number.isInteger(timeout)) {
            throw new ValidationError(`${paramName}.timeout`, timeout, 'must be integer between 1 and 300000 milliseconds');
        }
    }
    // Validate nounTypes array
    if ('nounTypes' in opts) {
        if (!Array.isArray(opts.nounTypes)) {
            throw new ValidationError(`${paramName}.nounTypes`, opts.nounTypes, 'must be an array');
        }
        if (opts.nounTypes.length > 100) {
            throw new ValidationError(`${paramName}.nounTypes`, opts.nounTypes, 'too many noun types (max 100)');
        }
        // Validate each noun type
        opts.nounTypes = opts.nounTypes.map((type, index) => {
            try {
                return validateNounType(type);
            }
            catch (error) {
                if (error instanceof Error) {
                    throw new ValidationError(`${paramName}.nounTypes[${index}]`, type, error.message);
                }
                throw error;
            }
        });
    }
    // Validate itemIds array
    if ('itemIds' in opts) {
        if (!Array.isArray(opts.itemIds)) {
            throw new ValidationError(`${paramName}.itemIds`, opts.itemIds, 'must be an array');
        }
        if (opts.itemIds.length > 10000) {
            throw new ValidationError(`${paramName}.itemIds`, opts.itemIds, 'too many item IDs (max 10000)');
        }
        opts.itemIds = opts.itemIds.map((id, index) => {
            try {
                return validateId(id, `${paramName}.itemIds[${index}]`);
            }
            catch (error) {
                throw error; // Re-throw with proper context
            }
        });
    }
    return opts;
}
/**
 * Validate ID arrays (for bulk operations)
 */
export function validateIdArray(ids, paramName = 'ids') {
    if (ids === null || ids === undefined) {
        throw new ValidationError(paramName, ids, 'cannot be null or undefined');
    }
    if (!Array.isArray(ids)) {
        throw new ValidationError(paramName, ids, 'must be an array');
    }
    if (ids.length === 0) {
        throw new ValidationError(paramName, ids, 'cannot be empty');
    }
    if (ids.length > 10000) {
        throw new ValidationError(paramName, ids, 'too large (max 10000 items)');
    }
    return ids.map((id, index) => {
        try {
            return validateId(id, `${paramName}[${index}]`);
        }
        catch (error) {
            throw error; // Re-throw with proper array context
        }
    });
}
/**
 * Track validation stats for monitoring
 */
export function recordValidation(success) {
    if (success) {
        stats.validated++;
    }
    else {
        stats.failed++;
    }
}
//# sourceMappingURL=typeValidation.js.map