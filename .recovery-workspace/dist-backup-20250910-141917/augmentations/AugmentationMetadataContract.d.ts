/**
 * Augmentation Metadata Contract System
 *
 * Prevents accidental metadata corruption while allowing intentional enrichment
 * Each augmentation declares its metadata intentions upfront
 */
export interface AugmentationMetadataContract {
    name: string;
    version: string;
    reads?: {
        userFields?: string[];
        internalFields?: string[];
        augmentationFields?: string[];
    };
    writes?: {
        userFields?: Array<{
            field: string;
            type: 'create' | 'update' | 'merge' | 'delete';
            description: string;
            example?: any;
        }>;
        augmentationFields?: Array<{
            field: string;
            description: string;
        }>;
        internalFields?: Array<{
            field: string;
            permission: 'granted' | 'requested';
            reason: string;
        }>;
    };
    conflictResolution?: {
        strategy: 'error' | 'warn' | 'merge' | 'skip' | 'override';
        priority?: number;
    };
    guarantees?: {
        preservesExisting?: boolean;
        reversible?: boolean;
        idempotent?: boolean;
        validatesTypes?: boolean;
    };
}
/**
 * Runtime metadata safety enforcer
 */
export declare class MetadataSafetyEnforcer {
    private contracts;
    private modifications;
    /**
     * Register an augmentation's contract
     */
    registerContract(contract: AugmentationMetadataContract): void;
    /**
     * Check if an augmentation can modify a field
     */
    canModifyField(augName: string, field: string, value: any): {
        allowed: boolean;
        reason?: string;
        warnings?: string[];
    };
    /**
     * Create safe metadata proxy for an augmentation
     */
    createSafeProxy(metadata: any, augName: string): any;
}
/**
 * Example augmentation contracts
 */
export declare const EXAMPLE_CONTRACTS: Record<string, AugmentationMetadataContract>;
/**
 * Augmentation base class with safety
 */
export declare abstract class SafeAugmentation {
    protected enforcer: MetadataSafetyEnforcer;
    protected contract: AugmentationMetadataContract;
    constructor(contract: AugmentationMetadataContract);
    /**
     * Get safe metadata proxy
     */
    protected getSafeMetadata(metadata: any): any;
    /**
     * Abstract method to implement augmentation logic
     */
    abstract execute(metadata: any): Promise<any>;
}
/**
 * Example: Category enricher implementation
 */
export declare class CategoryEnricherAugmentation extends SafeAugmentation {
    constructor();
    execute(metadata: any): Promise<any>;
    private detectCategory;
    private detectSubcategories;
}
