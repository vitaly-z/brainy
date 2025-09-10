/**
 * Worker process for embeddings - Workaround for transformers.js memory leak
 *
 * This worker can be killed and restarted to release memory completely.
 * Based on 2024 research: dispose() doesn't fully free memory in transformers.js
 */
export {};
