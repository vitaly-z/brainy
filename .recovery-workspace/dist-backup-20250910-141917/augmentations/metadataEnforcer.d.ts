/**
 * Runtime enforcement of metadata contracts
 * Ensures augmentations only access declared fields
 */
import { BrainyAugmentation } from './brainyAugmentation.js';
export declare class MetadataEnforcer {
    /**
     * Enforce metadata access based on augmentation contract
     * Returns a wrapped metadata object that enforces the contract
     */
    static enforce(augmentation: BrainyAugmentation, metadata: any, operation?: 'read' | 'write'): any;
    /**
     * Validate that an augmentation's actual behavior matches its contract
     * Used in testing to verify contracts are accurate
     */
    static validateContract(augmentation: BrainyAugmentation, testMetadata?: any): Promise<{
        valid: boolean;
        violations: string[];
    }>;
}
