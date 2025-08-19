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
import { AugmentationType } from './types/augmentations.js';
import { isThreadingAvailable } from './utils/environment.js';
import { executeInThread } from './utils/workerUtils.js';
/**
 * Execution mode for the pipeline
 */
export var ExecutionMode;
(function (ExecutionMode) {
    ExecutionMode["SEQUENTIAL"] = "sequential";
    ExecutionMode["PARALLEL"] = "parallel";
    ExecutionMode["FIRST_SUCCESS"] = "firstSuccess";
    ExecutionMode["FIRST_RESULT"] = "firstResult";
    ExecutionMode["THREADED"] = "threaded"; // Execute in separate threads when available
})(ExecutionMode || (ExecutionMode = {}));
/**
 * Default pipeline options
 */
const DEFAULT_PIPELINE_OPTIONS = {
    mode: ExecutionMode.SEQUENTIAL,
    timeout: 30000,
    stopOnError: false,
    forceThreading: false,
    disableThreading: false
};
/**
 * Cortex class - The Brain's Orchestration Center
 *
 * Manages all augmentations like the cerebral cortex coordinates different brain regions.
 * This is the central pipeline that orchestrates all augmentation execution.
 */
export class Cortex {
    constructor() {
        this.registry = {
            sense: [],
            conduit: [],
            cognition: [],
            memory: [],
            perception: [],
            dialog: [],
            activation: [],
            webSocket: []
        };
    }
    /**
     * Register an augmentation with the cortex
     *
     * @param augmentation The augmentation to register
     * @returns The cortex instance for chaining
     */
    register(augmentation) {
        let registered = false;
        // Check for specific augmentation types
        if (this.isAugmentationType(augmentation, 'processRawData', 'listenToFeed')) {
            this.registry.sense.push(augmentation);
            registered = true;
        }
        else if (this.isAugmentationType(augmentation, 'establishConnection', 'readData', 'writeData', 'monitorStream')) {
            this.registry.conduit.push(augmentation);
            registered = true;
        }
        else if (this.isAugmentationType(augmentation, 'reason', 'infer', 'executeLogic')) {
            this.registry.cognition.push(augmentation);
            registered = true;
        }
        else if (this.isAugmentationType(augmentation, 'storeData', 'retrieveData', 'updateData', 'deleteData', 'listDataKeys')) {
            this.registry.memory.push(augmentation);
            registered = true;
        }
        else if (this.isAugmentationType(augmentation, 'interpret', 'organize', 'generateVisualization')) {
            this.registry.perception.push(augmentation);
            registered = true;
        }
        else if (this.isAugmentationType(augmentation, 'processUserInput', 'generateResponse', 'manageContext')) {
            this.registry.dialog.push(augmentation);
            registered = true;
        }
        else if (this.isAugmentationType(augmentation, 'triggerAction', 'generateOutput', 'interactExternal')) {
            this.registry.activation.push(augmentation);
            registered = true;
        }
        // Check if the augmentation supports WebSocket
        if (this.isAugmentationType(augmentation, 'connectWebSocket', 'sendWebSocketMessage', 'onWebSocketMessage', 'closeWebSocket')) {
            this.registry.webSocket.push(augmentation);
            registered = true;
        }
        // If the augmentation wasn't registered as any known type, throw an error
        if (!registered) {
            throw new Error(`Unknown augmentation type: ${augmentation.name}`);
        }
        return this;
    }
    /**
     * Unregister an augmentation from the pipeline
     *
     * @param augmentationName The name of the augmentation to unregister
     * @returns The pipeline instance for chaining
     */
    unregister(augmentationName) {
        let found = false;
        // Remove from all registries
        for (const type in this.registry) {
            const typedRegistry = this.registry[type];
            const index = typedRegistry.findIndex((aug) => aug.name === augmentationName);
            if (index !== -1) {
                typedRegistry.splice(index, 1);
                found = true;
            }
        }
        return this;
    }
    /**
     * Initialize all registered augmentations
     *
     * @returns A promise that resolves when all augmentations are initialized
     */
    async initialize() {
        const allAugmentations = this.getAllAugmentations();
        await Promise.all(allAugmentations.map((augmentation) => augmentation.initialize().catch((error) => {
            console.error(`Failed to initialize augmentation ${augmentation.name}:`, error);
        })));
    }
    /**
     * Shut down all registered augmentations
     *
     * @returns A promise that resolves when all augmentations are shut down
     */
    async shutDown() {
        const allAugmentations = this.getAllAugmentations();
        await Promise.all(allAugmentations.map((augmentation) => augmentation.shutDown().catch((error) => {
            console.error(`Failed to shut down augmentation ${augmentation.name}:`, error);
        })));
    }
    /**
     * Execute a sense pipeline
     *
     * @param method The method to execute on each sense augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    async executeSensePipeline(method, args, options = {}) {
        const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };
        return this.executeTypedPipeline(this.registry.sense, method, args, opts);
    }
    /**
     * Execute a conduit pipeline
     *
     * @param method The method to execute on each conduit augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    async executeConduitPipeline(method, args, options = {}) {
        const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };
        return this.executeTypedPipeline(this.registry.conduit, method, args, opts);
    }
    /**
     * Execute a cognition pipeline
     *
     * @param method The method to execute on each cognition augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    async executeCognitionPipeline(method, args, options = {}) {
        const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };
        return this.executeTypedPipeline(this.registry.cognition, method, args, opts);
    }
    /**
     * Execute a memory pipeline
     *
     * @param method The method to execute on each memory augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    async executeMemoryPipeline(method, args, options = {}) {
        const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };
        return this.executeTypedPipeline(this.registry.memory, method, args, opts);
    }
    /**
     * Execute a perception pipeline
     *
     * @param method The method to execute on each perception augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    async executePerceptionPipeline(method, args, options = {}) {
        const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };
        return this.executeTypedPipeline(this.registry.perception, method, args, opts);
    }
    /**
     * Execute a dialog pipeline
     *
     * @param method The method to execute on each dialog augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    async executeDialogPipeline(method, args, options = {}) {
        const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };
        return this.executeTypedPipeline(this.registry.dialog, method, args, opts);
    }
    /**
     * Execute an activation pipeline
     *
     * @param method The method to execute on each activation augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    async executeActivationPipeline(method, args, options = {}) {
        const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };
        return this.executeTypedPipeline(this.registry.activation, method, args, opts);
    }
    /**
     * Get all registered augmentations
     *
     * @returns An array of all registered augmentations
     */
    getAllAugmentations() {
        // Create a Set to avoid duplicates (an augmentation might be in multiple registries)
        const allAugmentations = new Set([
            ...this.registry.sense,
            ...this.registry.conduit,
            ...this.registry.cognition,
            ...this.registry.memory,
            ...this.registry.perception,
            ...this.registry.dialog,
            ...this.registry.activation,
            ...this.registry.webSocket
        ]);
        // Convert back to array
        return Array.from(allAugmentations);
    }
    /**
     * Get all augmentations of a specific type
     *
     * @param type The type of augmentation to get
     * @returns An array of all augmentations of the specified type
     */
    getAugmentationsByType(type) {
        switch (type) {
            case AugmentationType.SENSE:
                return [...this.registry.sense];
            case AugmentationType.CONDUIT:
                return [...this.registry.conduit];
            case AugmentationType.COGNITION:
                return [...this.registry.cognition];
            case AugmentationType.MEMORY:
                return [...this.registry.memory];
            case AugmentationType.PERCEPTION:
                return [...this.registry.perception];
            case AugmentationType.DIALOG:
                return [...this.registry.dialog];
            case AugmentationType.ACTIVATION:
                return [...this.registry.activation];
            case AugmentationType.WEBSOCKET:
                return [...this.registry.webSocket];
            default:
                return [];
        }
    }
    /**
     * Get all available augmentation types
     *
     * @returns An array of all augmentation types that have at least one registered augmentation
     */
    getAvailableAugmentationTypes() {
        const availableTypes = [];
        if (this.registry.sense.length > 0)
            availableTypes.push(AugmentationType.SENSE);
        if (this.registry.conduit.length > 0)
            availableTypes.push(AugmentationType.CONDUIT);
        if (this.registry.cognition.length > 0)
            availableTypes.push(AugmentationType.COGNITION);
        if (this.registry.memory.length > 0)
            availableTypes.push(AugmentationType.MEMORY);
        if (this.registry.perception.length > 0)
            availableTypes.push(AugmentationType.PERCEPTION);
        if (this.registry.dialog.length > 0)
            availableTypes.push(AugmentationType.DIALOG);
        if (this.registry.activation.length > 0)
            availableTypes.push(AugmentationType.ACTIVATION);
        if (this.registry.webSocket.length > 0)
            availableTypes.push(AugmentationType.WEBSOCKET);
        return availableTypes;
    }
    /**
     * Get all WebSocket-supporting augmentations
     *
     * @returns An array of all augmentations that support WebSocket connections
     */
    getWebSocketAugmentations() {
        return [...this.registry.webSocket];
    }
    /**
     * Check if an augmentation is of a specific type
     *
     * @param augmentation The augmentation to check
     * @param methods The methods that should be present on the augmentation
     * @returns True if the augmentation is of the specified type
     */
    isAugmentationType(augmentation, ...methods) {
        // First check that the augmentation has all the required base methods
        const baseMethodsExist = ['initialize', 'shutDown', 'getStatus'].every((method) => typeof augmentation[method] === 'function');
        if (!baseMethodsExist) {
            return false;
        }
        // Then check that it has all the specific methods for this type
        return methods.every((method) => typeof augmentation[method] === 'function');
    }
    /**
     * Determines if threading should be used based on options and environment
     *
     * @param options The pipeline options
     * @returns True if threading should be used, false otherwise
     */
    shouldUseThreading(options) {
        // If threading is explicitly disabled, don't use it
        if (options.disableThreading) {
            return false;
        }
        // If threading is explicitly forced, use it if available
        if (options.forceThreading) {
            return isThreadingAvailable();
        }
        // If in THREADED mode, use threading if available
        if (options.mode === ExecutionMode.THREADED) {
            return isThreadingAvailable();
        }
        // Otherwise, don't use threading
        return false;
    }
    /**
     * Execute a pipeline for a specific augmentation type
     *
     * @param augmentations The augmentations to execute
     * @param method The method to execute on each augmentation
     * @param args The arguments to pass to the method
     * @param options The pipeline execution options
     * @returns A promise that resolves with the results from all augmentations
     */
    async executeTypedPipeline(augmentations, method, args, options) {
        // Filter out disabled augmentations
        const enabledAugmentations = augmentations.filter((aug) => aug.enabled !== false);
        if (enabledAugmentations.length === 0) {
            return [];
        }
        // Create a function to execute the method on an augmentation
        const executeMethod = async (augmentation) => {
            try {
                // Create a timeout promise if a timeout is specified
                const timeoutPromise = options.timeout
                    ? new Promise((_, reject) => {
                        setTimeout(() => {
                            reject(new Error(`Timeout executing ${String(method)} on ${augmentation.name}`));
                        }, options.timeout);
                    })
                    : null;
                // Check if threading should be used
                const useThreading = this.shouldUseThreading(options);
                // Execute the method on the augmentation, using threading if appropriate
                let methodPromise;
                if (useThreading) {
                    // Execute in a separate thread
                    try {
                        // Create a function that can be serialized and executed in a worker
                        const workerFn = (...workerArgs) => {
                            // This function will be stringified and executed in the worker
                            // It needs to be self-contained
                            const augFn = augmentation[method];
                            return augFn.apply(augmentation, workerArgs);
                        };
                        methodPromise = executeInThread(workerFn.toString(), args);
                    }
                    catch (threadError) {
                        console.warn(`Failed to execute in thread, falling back to main thread: ${threadError}`);
                        // Fall back to executing in the main thread
                        methodPromise = Promise.resolve(augmentation[method](...args));
                    }
                }
                else {
                    // Execute in the main thread
                    methodPromise = Promise.resolve(augmentation[method](...args));
                }
                // Race the method promise against the timeout promise if a timeout is specified
                const result = timeoutPromise
                    ? await Promise.race([methodPromise, timeoutPromise])
                    : await methodPromise;
                return result;
            }
            catch (error) {
                console.error(`Error executing ${String(method)} on ${augmentation.name}:`, error);
                return {
                    success: false,
                    data: null,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        };
        // Execute the pipeline based on the specified mode
        switch (options.mode) {
            case ExecutionMode.PARALLEL:
                // Execute all augmentations in parallel
                return enabledAugmentations.map(executeMethod);
            case ExecutionMode.THREADED:
                // Execute all augmentations in parallel with threading enabled
                // Force threading for this mode
                const threadedOptions = { ...options, forceThreading: true };
                // Create a new executeMethod function that uses the threaded options
                const executeMethodThreaded = async (augmentation) => {
                    // Save the original options
                    const originalOptions = options;
                    // Set the options to the threaded options
                    options = threadedOptions;
                    // Execute the method
                    const result = await executeMethod(augmentation);
                    // Restore the original options
                    options = originalOptions;
                    return result;
                };
                return enabledAugmentations.map(executeMethodThreaded);
            case ExecutionMode.FIRST_SUCCESS:
                // Execute augmentations sequentially until one succeeds
                for (const augmentation of enabledAugmentations) {
                    const resultPromise = executeMethod(augmentation);
                    const result = await resultPromise;
                    if (result.success) {
                        return [resultPromise];
                    }
                }
                return [];
            case ExecutionMode.FIRST_RESULT:
                // Execute augmentations sequentially until one returns a result
                for (const augmentation of enabledAugmentations) {
                    const resultPromise = executeMethod(augmentation);
                    const result = await resultPromise;
                    if (result.success && result.data) {
                        return [resultPromise];
                    }
                }
                return [];
            case ExecutionMode.SEQUENTIAL:
            default:
                // Execute augmentations sequentially
                const results = [];
                for (const augmentation of enabledAugmentations) {
                    const resultPromise = executeMethod(augmentation);
                    results.push(resultPromise);
                    // Check if we need to stop on error
                    if (options.stopOnError) {
                        const result = await resultPromise;
                        if (!result.success) {
                            break;
                        }
                    }
                }
                return results;
        }
    }
    /**
     * Enable an augmentation by name
     *
     * @param name The name of the augmentation to enable
     * @returns True if augmentation was found and enabled
     */
    enableAugmentation(name) {
        for (const type of Object.keys(this.registry)) {
            const augmentation = this.registry[type].find(aug => aug.name === name);
            if (augmentation) {
                augmentation.enabled = true;
                return true;
            }
        }
        return false;
    }
    /**
     * Disable an augmentation by name
     *
     * @param name The name of the augmentation to disable
     * @returns True if augmentation was found and disabled
     */
    disableAugmentation(name) {
        for (const type of Object.keys(this.registry)) {
            const augmentation = this.registry[type].find(aug => aug.name === name);
            if (augmentation) {
                augmentation.enabled = false;
                return true;
            }
        }
        return false;
    }
    /**
     * Check if an augmentation is enabled
     *
     * @param name The name of the augmentation to check
     * @returns True if augmentation is found and enabled, false otherwise
     */
    isAugmentationEnabled(name) {
        for (const type of Object.keys(this.registry)) {
            const augmentation = this.registry[type].find(aug => aug.name === name);
            if (augmentation) {
                return augmentation.enabled;
            }
        }
        return false;
    }
    /**
     * Get all augmentations with their enabled status
     *
     * @returns Array of augmentations with name, type, and enabled status
     */
    listAugmentationsWithStatus() {
        const result = [];
        for (const [type, augmentations] of Object.entries(this.registry)) {
            for (const aug of augmentations) {
                result.push({
                    name: aug.name,
                    type: type,
                    enabled: aug.enabled,
                    description: aug.description
                });
            }
        }
        return result;
    }
    /**
     * Enable all augmentations of a specific type
     *
     * @param type The type of augmentations to enable
     * @returns Number of augmentations enabled
     */
    enableAugmentationType(type) {
        let count = 0;
        for (const aug of this.registry[type]) {
            aug.enabled = true;
            count++;
        }
        return count;
    }
    /**
     * Disable all augmentations of a specific type
     *
     * @param type The type of augmentations to disable
     * @returns Number of augmentations disabled
     */
    disableAugmentationType(type) {
        let count = 0;
        for (const aug of this.registry[type]) {
            aug.enabled = false;
            count++;
        }
        return count;
    }
}
// Create and export a default instance of the cortex
export const cortex = new Cortex();
// Backward compatibility exports
export const AugmentationPipeline = Cortex;
export const augmentationPipeline = cortex;
//# sourceMappingURL=augmentationPipeline.js.map