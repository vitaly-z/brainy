/**
 * Smart metadata filtering for vector search
 * Filters DURING search to ensure relevant results
 * Simple API that just works without configuration
 */
/**
 * Check if a value matches a query with operators
 */
function matchesQuery(value, query) {
    // Direct equality check
    if (typeof query !== 'object' || query === null || Array.isArray(query)) {
        return value === query;
    }
    // Check for Brainy Field Operators (BFO)
    for (const [op, operand] of Object.entries(query)) {
        switch (op) {
            // Equality operators
            case 'equals':
            case 'is':
            case 'eq':
                if (value !== operand)
                    return false;
                break;
            case 'notEquals':
            case 'isNot':
            case 'ne':
                // Special handling: if value is undefined and operand is not undefined,
                // they are not equal (so the condition passes)
                // This ensures items without a 'deleted' field match 'deleted !== true'
                if (value === operand)
                    return false;
                // If value is undefined and operand is not, they're not equal (pass)
                // If both are undefined, they're equal (fail, handled above)
                break;
            // Comparison operators
            case 'greaterThan':
            case 'gt':
                if (typeof value !== 'number' || typeof operand !== 'number' || !(value > operand))
                    return false;
                break;
            case 'greaterEqual':
            case 'gte':
                if (typeof value !== 'number' || typeof operand !== 'number' || !(value >= operand))
                    return false;
                break;
            case 'lessThan':
            case 'lt':
                if (typeof value !== 'number' || typeof operand !== 'number' || !(value < operand))
                    return false;
                break;
            case 'lessEqual':
            case 'lte':
                if (typeof value !== 'number' || typeof operand !== 'number' || !(value <= operand))
                    return false;
                break;
            case 'between':
                if (!Array.isArray(operand) || operand.length !== 2)
                    return false;
                if (typeof value !== 'number' || !(value >= operand[0] && value <= operand[1]))
                    return false;
                break;
            // Array/Set operators
            case 'oneOf':
                if (!Array.isArray(operand) || !operand.includes(value))
                    return false;
                break;
            case 'noneOf':
                if (!Array.isArray(operand) || operand.includes(value))
                    return false;
                break;
            case 'contains':
                if (!Array.isArray(value) || !value.includes(operand))
                    return false;
                break;
            case 'excludes':
                if (!Array.isArray(value) || value.includes(operand))
                    return false;
                break;
            case 'hasAll':
                if (!Array.isArray(value) || !Array.isArray(operand))
                    return false;
                for (const item of operand) {
                    if (!value.includes(item))
                        return false;
                }
                break;
            case 'length':
                if (!Array.isArray(value) || value.length !== operand)
                    return false;
                break;
            // Existence operators
            case 'exists':
                if ((value !== undefined) !== operand)
                    return false;
                break;
            case 'missing':
                if ((value === undefined) !== operand)
                    return false;
                break;
            // Pattern operators
            case 'matches':
                const regex = typeof operand === 'string' ? new RegExp(operand) : operand;
                if (!(regex instanceof RegExp) || !regex.test(String(value)))
                    return false;
                break;
            case 'startsWith':
                if (typeof value !== 'string' || !value.startsWith(String(operand)))
                    return false;
                break;
            case 'endsWith':
                if (typeof value !== 'string' || !value.endsWith(String(operand)))
                    return false;
                break;
            default:
                // Unknown operator, treat as field name
                if (!matchesFieldQuery(value, op, operand))
                    return false;
        }
    }
    return true;
}
/**
 * Check if a field matches a query
 */
function matchesFieldQuery(obj, field, query) {
    const value = getNestedValue(obj, field);
    return matchesQuery(value, query);
}
/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined;
        }
        current = current[part];
    }
    return current;
}
/**
 * Check if metadata matches the filter
 */
export function matchesMetadataFilter(metadata, filter) {
    if (!filter || Object.keys(filter).length === 0) {
        return true;
    }
    for (const [key, query] of Object.entries(filter)) {
        // Handle logical operators
        if (key === 'allOf') {
            if (!Array.isArray(query))
                return false;
            for (const subFilter of query) {
                if (!matchesMetadataFilter(metadata, subFilter))
                    return false;
            }
            continue;
        }
        if (key === 'anyOf') {
            if (!Array.isArray(query))
                return false;
            let matched = false;
            for (const subFilter of query) {
                if (matchesMetadataFilter(metadata, subFilter)) {
                    matched = true;
                    break;
                }
            }
            if (!matched)
                return false;
            continue;
        }
        if (key === 'not') {
            if (matchesMetadataFilter(metadata, query))
                return false;
            continue;
        }
        // Handle field queries
        const value = getNestedValue(metadata, key);
        if (!matchesQuery(value, query)) {
            return false;
        }
    }
    return true;
}
/**
 * Calculate metadata boost score
 */
export function calculateMetadataScore(metadata, filter, scoring) {
    if (!scoring || !scoring.metadataBoosts) {
        return 0;
    }
    let score = 0;
    for (const [field, boost] of Object.entries(scoring.metadataBoosts)) {
        const value = getNestedValue(metadata, field);
        if (typeof boost === 'function') {
            score += boost(value, filter);
        }
        else if (value !== undefined) {
            // Check if the field matches the filter
            const fieldFilter = filter[field];
            if (fieldFilter && matchesQuery(value, fieldFilter)) {
                score += boost;
            }
        }
    }
    return score;
}
/**
 * Apply compound scoring to search results
 */
export function applyCompoundScoring(results, filter, scoring) {
    if (!scoring || (!scoring.vectorWeight && !scoring.metadataWeight)) {
        return results;
    }
    const vectorWeight = scoring.vectorWeight ?? 1.0;
    const metadataWeight = scoring.metadataWeight ?? 0.0;
    return results.map(result => {
        const metadataScore = calculateMetadataScore(result.metadata, filter, scoring);
        const combinedScore = (result.score * vectorWeight) + (metadataScore * metadataWeight);
        return {
            ...result,
            score: combinedScore
        };
    }).sort((a, b) => b.score - a.score); // Re-sort by combined score
}
/**
 * Filter search results by metadata
 */
export function filterSearchResultsByMetadata(results, filter) {
    if (!filter || Object.keys(filter).length === 0) {
        return results;
    }
    return results.filter(result => matchesMetadataFilter(result.metadata, filter));
}
/**
 * Filter nouns by metadata before search
 */
export function filterNounsByMetadata(nouns, filter) {
    if (!filter || Object.keys(filter).length === 0) {
        return nouns;
    }
    return nouns.filter(noun => matchesMetadataFilter(noun.metadata, filter));
}
export function aggregateSearchResults(results, facets) {
    const facetResults = {};
    for (const [facetName, config] of Object.entries(facets)) {
        const counts = {};
        for (const result of results) {
            const value = getNestedValue(result.metadata, config.field);
            if (value !== undefined) {
                const key = String(value);
                counts[key] = (counts[key] || 0) + 1;
            }
        }
        // Sort by count and apply limit
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, config.limit || 10);
        facetResults[facetName] = Object.fromEntries(sorted);
    }
    return {
        results,
        facets: facetResults
    };
}
//# sourceMappingURL=metadataFilter.js.map