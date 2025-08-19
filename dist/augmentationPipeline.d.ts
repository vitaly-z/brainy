/**
 * Cortex - The Brain's Orchestration System
 *
 * 🧠⚛️ The cerebral cortex that coordinates all augmentations
 *
 * This module provides the central coordination system for managing and executing
 * augmentations across all categories. Like the brain's cortex, it orchestrates
 * different capabilities (augmentations) in sequence or parallel.
 *
 * @deprecated AugmentationPipeline - Use Cortex instead
 */
import { BrainyAugmentations, IAugmentation, IWebSocketSupport, AugmentationResponse, AugmentationType } from './types/augmentations.js';
/**
 * Type definitions for the augmentation registry
 */
type AugmentationRegistry = {
    sense: BrainyAugmentations.ISenseAugmentation[];
    conduit: BrainyAugmentations.IConduitAugmentation[];
    cognition: BrainyAugmentations.ICognitionAugmentation[];
    memory: BrainyAugmentations.IMemoryAugmentation[];
    perception: BrainyAugmentations.IPerceptionAugmentation[];
    dialog: BrainyAugmentations.IDialogAugmentation[];
    activation: BrainyAugmentations.IActivationAugmentation[];
    webSocket: IWebSocketSupport[];
};
/**
 * Execution mode for the pipeline
 */
export declare enum ExecutionMode {
    SEQUENTIAL = "sequential",
    PARALLEL = "parallel",
    FIRST_SUCCESS = "firstSuccess",
    FIRST_RESULT = "firstResult",
    THREADED = "threaded"
}
/**
 * Options for pipeline execution
 */
export interface PipelineOptions {
    mode?: ExecutionMode;
    timeout?: number;
    stopOnError?: boolean;
    forceThreading?: boolean;
    disableThreading?: boolean;
}
/**
 * Cortex class - The Brain's Orchestration Center
 *
 * Manages all augmentations like the cerebral cortex coordinates different brain regions.
 * This is the central pipeline that orchestrates all augmentation execution.
 */
export declare class Cortex {
    private registry;
    /**
     * Register an augmentation with the cortex
     *
     * @param augmentation The augmentation to register
     * @returns The cortex instance for chaining
     */
    register<T extends IAugmentation>(augmentation: T): Cortex;
    /**
     * Unregister an augmentation from the pipeline
     *
     * @param augmentationName The name of the augmentation to unregister
     * @returns The pipeline instance for chaining
     */
    unregister(augmentationName: string): Cortex;
    /**
     * Initialize all registered augmentations
     *
     * @returns A promise that resolves when all augmentations are initialized
     */
    initialize(): Promise<void>;
    /**
     * Shut down all registered augmentations
     *
     * @returns A promise that resolves when all augmentations are shut down
     */
    shutDown(): Promise<void>;
    /**
     * Execute a sense pipeline
     *
     * @param method The method to execute on each sense augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    executeSensePipeline<M extends keyof BrainyAugmentations.ISenseAugmentation & string, R extends BrainyAugmentations.ISenseAugmentation[M] extends (...args: any[]) => AugmentationResponse<infer U> ? U : never>(method: M & (BrainyAugmentations.ISenseAugmentation[M] extends (...args: any[]) => any ? M : never), args: Parameters<Extract<BrainyAugmentations.ISenseAugmentation[M], (...args: any[]) => any>>, options?: PipelineOptions): Promise<Promise<{
        success: boolean;
        data: R;
        error?: string;
    }>[]>;
    /**
     * Execute a conduit pipeline
     *
     * @param method The method to execute on each conduit augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    executeConduitPipeline<M extends keyof BrainyAugmentations.IConduitAugmentation & string, R extends BrainyAugmentations.IConduitAugmentation[M] extends (...args: any[]) => AugmentationResponse<infer U> ? U : never>(method: M & (BrainyAugmentations.IConduitAugmentation[M] extends (...args: any[]) => any ? M : never), args: Parameters<Extract<BrainyAugmentations.IConduitAugmentation[M], (...args: any[]) => any>>, options?: PipelineOptions): Promise<Promise<{
        success: boolean;
        data: R;
        error?: string;
    }>[]>;
    /**
     * Execute a cognition pipeline
     *
     * @param method The method to execute on each cognition augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    executeCognitionPipeline<M extends keyof BrainyAugmentations.ICognitionAugmentation & string, R extends BrainyAugmentations.ICognitionAugmentation[M] extends (...args: any[]) => AugmentationResponse<infer U> ? U : never>(method: M & (BrainyAugmentations.ICognitionAugmentation[M] extends (...args: any[]) => any ? M : never), args: Parameters<Extract<BrainyAugmentations.ICognitionAugmentation[M], (...args: any[]) => any>>, options?: PipelineOptions): Promise<Promise<{
        success: boolean;
        data: R;
        error?: string;
    }>[]>;
    /**
     * Execute a memory pipeline
     *
     * @param method The method to execute on each memory augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    executeMemoryPipeline<M extends keyof BrainyAugmentations.IMemoryAugmentation & string, R extends BrainyAugmentations.IMemoryAugmentation[M] extends (...args: any[]) => AugmentationResponse<infer U> ? U : never>(method: M & (BrainyAugmentations.IMemoryAugmentation[M] extends (...args: any[]) => any ? M : never), args: Parameters<Extract<BrainyAugmentations.IMemoryAugmentation[M], (...args: any[]) => any>>, options?: PipelineOptions): Promise<Promise<{
        success: boolean;
        data: R;
        error?: string;
    }>[]>;
    /**
     * Execute a perception pipeline
     *
     * @param method The method to execute on each perception augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    executePerceptionPipeline<M extends keyof BrainyAugmentations.IPerceptionAugmentation & string, R extends BrainyAugmentations.IPerceptionAugmentation[M] extends (...args: any[]) => AugmentationResponse<infer U> ? U : never>(method: M & (BrainyAugmentations.IPerceptionAugmentation[M] extends (...args: any[]) => any ? M : never), args: Parameters<Extract<BrainyAugmentations.IPerceptionAugmentation[M], (...args: any[]) => any>>, options?: PipelineOptions): Promise<Promise<{
        success: boolean;
        data: R;
        error?: string;
    }>[]>;
    /**
     * Execute a dialog pipeline
     *
     * @param method The method to execute on each dialog augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    executeDialogPipeline<M extends keyof BrainyAugmentations.IDialogAugmentation & string, R extends BrainyAugmentations.IDialogAugmentation[M] extends (...args: any[]) => AugmentationResponse<infer U> ? U : never>(method: M & (BrainyAugmentations.IDialogAugmentation[M] extends (...args: any[]) => any ? M : never), args: Parameters<Extract<BrainyAugmentations.IDialogAugmentation[M], (...args: any[]) => any>>, options?: PipelineOptions): Promise<Promise<{
        success: boolean;
        data: R;
        error?: string;
    }>[]>;
    /**
     * Execute an activation pipeline
     *
     * @param method The method to execute on each activation augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    executeActivationPipeline<M extends keyof BrainyAugmentations.IActivationAugmentation & string, R extends BrainyAugmentations.IActivationAugmentation[M] extends (...args: any[]) => AugmentationResponse<infer U> ? U : never>(method: M & (BrainyAugmentations.IActivationAugmentation[M] extends (...args: any[]) => any ? M : never), args: Parameters<Extract<BrainyAugmentations.IActivationAugmentation[M], (...args: any[]) => any>>, options?: PipelineOptions): Promise<Promise<{
        success: boolean;
        data: R;
        error?: string;
    }>[]>;
    /**
     * Get all registered augmentations
     *
     * @returns An array of all registered augmentations
     */
    getAllAugmentations(): IAugmentation[];
    /**
     * Get all augmentations of a specific type
     *
     * @param type The type of augmentation to get
     * @returns An array of all augmentations of the specified type
     */
    getAugmentationsByType(type: AugmentationType): IAugmentation[];
    /**
     * Get all available augmentation types
     *
     * @returns An array of all augmentation types that have at least one registered augmentation
     */
    getAvailableAugmentationTypes(): AugmentationType[];
    /**
     * Get all WebSocket-supporting augmentations
     *
     * @returns An array of all augmentations that support WebSocket connections
     */
    getWebSocketAugmentations(): IWebSocketSupport[];
    /**
     * Check if an augmentation is of a specific type
     *
     * @param augmentation The augmentation to check
     * @param methods The methods that should be present on the augmentation
     * @returns True if the augmentation is of the specified type
     */
    private isAugmentationType;
    /**
     * Determines if threading should be used based on options and environment
     *
     * @param options The pipeline options
     * @returns True if threading should be used, false otherwise
     */
    private shouldUseThreading;
    /**
     * Execute a pipeline for a specific augmentation type
     *
     * @param augmentations The augmentations to execute
     * @param method The method to execute on each augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    private executeTypedPipeline;
    /**
     * Enable an augmentation by name
     *
     * @param name The name of the augmentation to enable
     * @returns True if augmentation was found and enabled
     */
    enableAugmentation(name: string): boolean;
    /**
     * Disable an augmentation by name
     *
     * @param name The name of the augmentation to disable
     * @returns True if augmentation was found and disabled
     */
    disableAugmentation(name: string): boolean;
    /**
     * Check if an augmentation is enabled
     *
     * @param name The name of the augmentation to check
     * @returns True if augmentation is found and enabled, false otherwise
     */
    isAugmentationEnabled(name: string): boolean;
    /**
     * Get all augmentations with their enabled status
     *
     * @returns Array of augmentations with name, type, and enabled status
     */
    listAugmentationsWithStatus(): Array<{
        name: string;
        type: keyof AugmentationRegistry;
        enabled: boolean;
        description: string;
    }>;
    /**
     * Enable all augmentations of a specific type
     *
     * @param type The type of augmentations to enable
     * @returns Number of augmentations enabled
     */
    enableAugmentationType(type: keyof AugmentationRegistry): number;
    /**
     * Disable all augmentations of a specific type
     *
     * @param type The type of augmentations to disable
     * @returns Number of augmentations disabled
     */
    disableAugmentationType(type: keyof AugmentationRegistry): number;
}
export declare const cortex: Cortex;
export declare const AugmentationPipeline: typeof Cortex;
export declare const augmentationPipeline: Cortex;
export {};
