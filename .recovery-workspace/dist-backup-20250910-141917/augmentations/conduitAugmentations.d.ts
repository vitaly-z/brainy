/**
 * Conduit Augmentations - Data Synchronization Bridges
 *
 * These augmentations connect and synchronize data between multiple Brainy instances.
 * Now using the unified BrainyAugmentation interface.
 */
import { BaseAugmentation } from './brainyAugmentation.js';
export interface WebSocketConnection {
    connectionId: string;
    url: string;
    readyState: number;
    socket?: any;
}
/**
 * Base class for conduit augmentations that sync between Brainy instances
 * Converted to use the unified BrainyAugmentation interface
 */
declare abstract class BaseConduitAugmentation extends BaseAugmentation {
    readonly timing: "after";
    readonly metadata: "readonly";
    readonly operations: ("addNoun" | "delete" | "addVerb")[];
    readonly priority = 20;
    protected connections: Map<string, any>;
    protected onShutdown(): Promise<void>;
    abstract establishConnection(targetSystemId: string, config?: Record<string, unknown>): Promise<WebSocketConnection | null>;
}
/**
 * WebSocket Conduit Augmentation
 * Syncs data between Brainy instances using WebSockets
 */
export declare class WebSocketConduitAugmentation extends BaseConduitAugmentation {
    readonly name = "websocket-conduit";
    private webSocketConnections;
    private messageCallbacks;
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    private shouldSync;
    private syncOperation;
    establishConnection(url: string, config?: Record<string, unknown>): Promise<WebSocketConnection | null>;
    private handleMessage;
    private applySyncOperation;
    /**
     * Subscribe to messages from a specific connection
     */
    onMessage(connectionId: string, callback: (data: any) => void): void;
    /**
     * Send a message to a specific connection
     */
    sendMessage(connectionId: string, data: any): boolean;
}
export {};
/**
 * Example usage:
 *
 * // Server instance
 * const serverBrain = new Brainy()
 * serverBrain.augmentations.register(new APIServerAugmentation())
 * await serverBrain.init()
 *
 * // Client instance
 * const clientBrain = new Brainy()
 * const conduit = new WebSocketConduitAugmentation()
 * clientBrain.augmentations.register(conduit)
 * await clientBrain.init()
 *
 * // Connect client to server
 * await conduit.establishConnection('ws://localhost:3000/ws')
 *
 * // Now operations sync automatically!
 * await clientBrain.addNoun('synced data', { source: 'client' })
 * // This will automatically sync to the server
 */ 
