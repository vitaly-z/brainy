/**
 * CRITICAL: This file is imported for its side effects to patch the environment
 * for Node.js compatibility before any other library code runs.
 *
 * It ensures that by the time Transformers.js/ONNX Runtime is imported by any other
 * module, the necessary compatibility fixes for the current Node.js
 * environment are already in place.
 *
 * This file MUST be imported as the first import in unified.ts to prevent
 * race conditions with library initialization. Failure to do so may
 * result in errors like "TextEncoder is not a constructor" when the package
 * is used in Node.js environments.
 *
 * The package.json file marks this file as having side effects to prevent
 * tree-shaking by bundlers, ensuring the patch is always applied.
 */
export {};
