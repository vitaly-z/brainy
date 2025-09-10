/**
 * Neural API Type Definitions
 * Comprehensive interfaces for clustering, similarity, and analysis
 */
// ===== ERROR TYPES =====
export class NeuralAPIError extends Error {
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'NeuralAPIError';
    }
}
export class ClusteringError extends NeuralAPIError {
    constructor(message, context) {
        super(message, 'CLUSTERING_ERROR', context);
    }
}
export class SimilarityError extends NeuralAPIError {
    constructor(message, context) {
        super(message, 'SIMILARITY_ERROR', context);
    }
}
//# sourceMappingURL=types.js.map