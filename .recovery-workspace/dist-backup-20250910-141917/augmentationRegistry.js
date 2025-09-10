/**
 * Augmentation Registry (Compatibility Layer)
 *
 * @deprecated This module provides backward compatibility for old augmentation
 * loading code. All new code should use the AugmentationRegistry class directly
 * on Brainy instances.
 */
/**
 * Registry of all available augmentations (for compatibility)
 * @deprecated Use brain.augmentations instead
 */
export const availableAugmentations = [];
/**
 * Compatibility wrapper for registerAugmentation
 * @deprecated Use brain.augmentations.register instead
 */
export function registerAugmentation(augmentation) {
    console.warn('registerAugmentation is deprecated. Use brain.augmentations.register instead.');
    // For compatibility, just add to the list (but it won't actually do anything)
    availableAugmentations.push(augmentation);
    return augmentation;
}
/**
 * Sets the default pipeline instance (compatibility)
 * @deprecated Use brain.augmentations instead
 */
export function setDefaultPipeline(pipeline) {
    console.warn('setDefaultPipeline is deprecated. Use brain.augmentations instead.');
}
/**
 * Initializes the augmentation pipeline (compatibility)
 * @deprecated Use brain.augmentations instead
 */
export function initializeAugmentationPipeline(pipelineInstance) {
    console.warn('initializeAugmentationPipeline is deprecated. Use brain.augmentations instead.');
    return pipelineInstance || {};
}
/**
 * Enables or disables an augmentation by name (compatibility)
 * @deprecated Use brain.augmentations instead
 */
export function setAugmentationEnabled(name, enabled) {
    console.warn('setAugmentationEnabled is deprecated. Use brain.augmentations instead.');
    return false;
}
/**
 * Gets all augmentations of a specific type (compatibility)
 * @deprecated Use brain.augmentations instead
 */
export function getAugmentationsByType(type) {
    console.warn('getAugmentationsByType is deprecated. Use brain.augmentations instead.');
    return [];
}
//# sourceMappingURL=augmentationRegistry.js.map