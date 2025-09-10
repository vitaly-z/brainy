/**
 * Consistent API Types for Brainy
 *
 * These types provide a uniform interface for all public methods,
 * using object parameters for consistency and extensibility.
 */
// ============= ERRORS =============
/**
 * Structured error for API operations
 */
export class BrainyAPIError extends Error {
    constructor(message, code, statusCode = 400, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'BrainyAPIError';
    }
}
// Error codes
export const ErrorCodes = {
    INVALID_TYPE: 'INVALID_TYPE',
    NOT_FOUND: 'NOT_FOUND',
    DUPLICATE_ID: 'DUPLICATE_ID',
    INVALID_VECTOR: 'INVALID_VECTOR',
    STORAGE_ERROR: 'STORAGE_ERROR',
    EMBEDDING_ERROR: 'EMBEDDING_ERROR',
    AUGMENTATION_ERROR: 'AUGMENTATION_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    UNAUTHORIZED: 'UNAUTHORIZED'
};
//# sourceMappingURL=apiTypes.js.map