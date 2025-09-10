/**
 * Runtime enforcement of metadata contracts
 * Ensures augmentations only access declared fields
 */
export class MetadataEnforcer {
    /**
     * Enforce metadata access based on augmentation contract
     * Returns a wrapped metadata object that enforces the contract
     */
    static enforce(augmentation, metadata, operation = 'write') {
        // Handle simple contracts
        if (augmentation.metadata === 'none') {
            // No access at all
            if (operation === 'read')
                return null;
            throw new Error(`Augmentation '${augmentation.name}' has metadata='none' - cannot access metadata`);
        }
        if (augmentation.metadata === 'readonly') {
            if (operation === 'read') {
                // Return frozen deep clone for read-only access
                return deepFreeze(deepClone(metadata));
            }
            throw new Error(`Augmentation '${augmentation.name}' has metadata='readonly' - cannot write`);
        }
        // Handle specific field access
        const access = augmentation.metadata;
        if (operation === 'read') {
            // For reads, filter to allowed fields
            if (access.reads === '*') {
                return deepClone(metadata); // Can read everything
            }
            if (!access.reads) {
                return {}; // No read access
            }
            // Filter to specific fields
            const filtered = {};
            for (const field of access.reads) {
                if (field.includes('.')) {
                    // Handle nested fields like '_brainy.deleted'
                    const parts = field.split('.');
                    let source = metadata;
                    let target = filtered;
                    for (let i = 0; i < parts.length - 1; i++) {
                        const part = parts[i];
                        if (!source[part])
                            break;
                        if (!target[part])
                            target[part] = {};
                        source = source[part];
                        target = target[part];
                    }
                    const lastPart = parts[parts.length - 1];
                    if (source && lastPart in source) {
                        target[lastPart] = source[lastPart];
                    }
                }
                else {
                    // Simple field
                    if (field in metadata) {
                        filtered[field] = metadata[field];
                    }
                }
            }
            return filtered;
        }
        // For writes, create a proxy that validates
        return new Proxy(metadata, {
            set(target, prop, value) {
                const field = String(prop);
                // Check if write is allowed
                if (access.writes === '*') {
                    // Can write anything
                    target[prop] = value;
                    return true;
                }
                if (!access.writes || !access.writes.includes(field)) {
                    throw new Error(`Augmentation '${augmentation.name}' cannot write to field '${field}'. ` +
                        `Allowed writes: ${access.writes?.join(', ') || 'none'}`);
                }
                // Check namespace if specified
                if (access.namespace && !field.startsWith(access.namespace)) {
                    console.warn(`Augmentation '${augmentation.name}' writing outside its namespace. ` +
                        `Expected: ${access.namespace}.*, got: ${field}`);
                }
                target[prop] = value;
                return true;
            },
            deleteProperty(target, prop) {
                const field = String(prop);
                // Deletion counts as a write
                if (access.writes === '*' || access.writes?.includes(field)) {
                    delete target[prop];
                    return true;
                }
                throw new Error(`Augmentation '${augmentation.name}' cannot delete field '${field}'`);
            }
        });
    }
    /**
     * Validate that an augmentation's actual behavior matches its contract
     * Used in testing to verify contracts are accurate
     */
    static async validateContract(augmentation, testMetadata = { test: 'data', _brainy: { deleted: false } }) {
        const violations = [];
        // Test read access
        try {
            const readable = this.enforce(augmentation, testMetadata, 'read');
            if (augmentation.metadata === 'none' && readable !== null) {
                violations.push(`Contract says 'none' but got readable metadata`);
            }
        }
        catch (error) {
            violations.push(`Read enforcement error: ${error}`);
        }
        // Test write access
        try {
            const writable = this.enforce(augmentation, testMetadata, 'write');
            if (augmentation.metadata === 'none') {
                violations.push(`Contract says 'none' but got writable metadata`);
            }
            if (augmentation.metadata === 'readonly') {
                // Try to write - should fail
                try {
                    writable.testWrite = 'value';
                    violations.push(`Contract says 'readonly' but write succeeded`);
                }
                catch {
                    // Expected to fail
                }
            }
        }
        catch (error) {
            // Expected for 'none' and 'readonly' on write
            if (augmentation.metadata !== 'none' && augmentation.metadata !== 'readonly') {
                violations.push(`Write enforcement error: ${error}`);
            }
        }
        return {
            valid: violations.length === 0,
            violations
        };
    }
}
// Helper functions
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object')
        return obj;
    if (obj instanceof Date)
        return new Date(obj);
    if (obj instanceof Array)
        return obj.map(item => deepClone(item));
    const cloned = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}
function deepFreeze(obj) {
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (obj[prop] !== null &&
            (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
            !Object.isFrozen(obj[prop])) {
            deepFreeze(obj[prop]);
        }
    });
    return obj;
}
//# sourceMappingURL=metadataEnforcer.js.map