/**
 * Version utilities for Brainy
 */
/**
 * Get the current Brainy package version
 * @returns The current version string
 */
export declare function getBrainyVersion(): string;
/**
 * Get version information for augmentation metadata
 * @param service The service/augmentation name
 * @returns Version metadata object
 */
export declare function getAugmentationVersion(service: string): {
    augmentation: string;
    version: string;
};
