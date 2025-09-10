/**
 * Server Search Augmentations
 *
 * This file implements conduit and activation augmentations for browser-server search functionality.
 * It allows Brainy to search a server-hosted instance and store results locally.
 */
import { AugmentationResponse, WebSocketConnection } from '../types/augmentations.js';
import { BaseAugmentation } from '../augmentations/brainyAugmentation.js';
import { BrainyDataInterface } from '../types/brainyDataInterface.js';
/**
 * ServerSearchConduitAugmentation
 *
 * A specialized conduit augmentation that provides functionality for searching
 * a server-hosted Brainy instance and storing results locally.
 */
export declare class ServerSearchConduitAugmentation extends BaseAugmentation {
    readonly name = "server-search-conduit";
    readonly timing: "after";
    readonly metadata: "readonly";
    operations: ("addNoun" | "delete" | "addVerb")[];
    readonly priority = 20;
    private localDb;
    constructor(name?: string);
    /**
     * Initialize the augmentation
     */
    protected onInitialize(): Promise<void>;
    /**
     * Set the local Brainy instance
     * @param db The Brainy instance to use for local storage
     */
    setLocalDb(db: BrainyDataInterface): void;
    /**
     * Stub method for performing search operations via WebSocket
     * TODO: Implement proper WebSocket communication
     */
    private performSearch;
    /**
     * Stub method for performing write operations via WebSocket
     * TODO: Implement proper WebSocket communication
     */
    private performWrite;
    /**
     * Get the local Brainy instance
     * @returns The local Brainy instance
     */
    getLocalDb(): BrainyDataInterface | null;
    /**
     * Execute method - required by BaseAugmentation
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Search the server-hosted Brainy instance and store results locally
     * @param connectionId The ID of the established connection
     * @param query The search query
     * @param limit Maximum number of results to return
     * @returns Search results
     */
    searchServer(connectionId: string, query: string, limit?: number): Promise<AugmentationResponse<unknown>>;
    /**
     * Search the local Brainy instance
     * @param query The search query
     * @param limit Maximum number of results to return
     * @returns Search results
     */
    searchLocal(query: string, limit?: number): Promise<AugmentationResponse<unknown>>;
    /**
     * Search both server and local instances, combine results, and store server results locally
     * @param connectionId The ID of the established connection
     * @param query The search query
     * @param limit Maximum number of results to return
     * @returns Combined search results
     */
    searchCombined(connectionId: string, query: string, limit?: number): Promise<AugmentationResponse<unknown>>;
    /**
     * Add data to both local and server instances
     * @param connectionId The ID of the established connection
     * @param data Text or vector to add
     * @param metadata Metadata for the data
     * @returns ID of the added data
     */
    addToBoth(connectionId: string, data: string | any[], metadata?: any): Promise<AugmentationResponse<string>>;
    /**
     * Establish connection to remote server
     * @param serverUrl Server URL to connect to
     * @param options Connection options
     * @returns Connection promise
     */
    establishConnection(serverUrl: string, options?: any): Promise<any>;
    /**
     * Close WebSocket connection
     * @param connectionId Connection ID to close
     * @returns Promise that resolves when connection is closed
     */
    closeWebSocket(connectionId: string): Promise<void>;
}
/**
 * ServerSearchActivationAugmentation
 *
 * An activation augmentation that provides actions for server search functionality.
 */
export declare class ServerSearchActivationAugmentation extends BaseAugmentation {
    readonly name = "server-search-activation";
    readonly timing: "after";
    readonly metadata: "readonly";
    operations: ("search" | "addNoun")[];
    readonly priority = 20;
    private conduitAugmentation;
    private connections;
    constructor(name?: string);
    protected onInitialize(): Promise<void>;
    protected onShutdown(): Promise<void>;
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Set the conduit augmentation to use for server search
     * @param conduit The ServerSearchConduitAugmentation to use
     */
    setConduitAugmentation(conduit: ServerSearchConduitAugmentation): void;
    /**
     * Store a connection for later use
     * @param connectionId The ID to use for the connection
     * @param connection The WebSocket connection
     */
    storeConnection(connectionId: string, connection: WebSocketConnection): void;
    /**
     * Get a stored connection
     * @param connectionId The ID of the connection to retrieve
     * @returns The WebSocket connection
     */
    getConnection(connectionId: string): WebSocketConnection | undefined;
    /**
     * Trigger an action based on a processed command or internal state
     * @param actionName The name of the action to trigger
     * @param parameters Optional parameters for the action
     */
    triggerAction(actionName: string, parameters?: Record<string, unknown>): AugmentationResponse<unknown>;
    /**
     * Handle the connectToServer action
     * @param parameters Action parameters
     */
    private handleConnectToServer;
    /**
     * Handle the searchServer action
     * @param parameters Action parameters
     */
    private handleSearchServer;
    /**
     * Handle the searchLocal action
     * @param parameters Action parameters
     */
    private handleSearchLocal;
    /**
     * Handle the searchCombined action
     * @param parameters Action parameters
     */
    private handleSearchCombined;
    /**
     * Handle the addToBoth action
     * @param parameters Action parameters
     */
    private handleAddToBoth;
    /**
     * Generates an expressive output or response from Brainy
     * @param knowledgeId The identifier of the knowledge to express
     * @param format The desired output format (e.g., 'text', 'json')
     */
    generateOutput(knowledgeId: string, format: string): AugmentationResponse<string | Record<string, unknown>>;
    /**
     * Interacts with an external system or API
     * @param systemId The identifier of the external system
     * @param payload The data to send to the external system
     */
    interactExternal(systemId: string, payload: Record<string, unknown>): AugmentationResponse<unknown>;
}
/**
 * Factory function to create server search augmentations
 * @param serverUrl The URL of the server to connect to
 * @param options Additional options
 * @returns An object containing the created augmentations
 */
export declare function createServerSearchAugmentations(serverUrl: string, options?: {
    conduitName?: string;
    activationName?: string;
    protocols?: string | string[];
    localDb?: BrainyDataInterface;
}): Promise<{
    conduit: ServerSearchConduitAugmentation;
    activation: ServerSearchActivationAugmentation;
    connection: WebSocketConnection;
}>;
