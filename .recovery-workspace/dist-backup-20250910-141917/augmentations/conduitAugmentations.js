/**
 * Conduit Augmentations - Data Synchronization Bridges
 *
 * These augmentations connect and synchronize data between multiple Brainy instances.
 * Now using the unified BrainyAugmentation interface.
 */
import { BaseAugmentation } from './brainyAugmentation.js';
import { v4 as uuidv4 } from '../universal/uuid.js';
/**
 * Base class for conduit augmentations that sync between Brainy instances
 * Converted to use the unified BrainyAugmentation interface
 */
class BaseConduitAugmentation extends BaseAugmentation {
    constructor() {
        super(...arguments);
        this.timing = 'after'; // Conduits run after operations to sync
        this.metadata = 'readonly'; // Conduits read metadata to pass to external systems
        this.operations = ['addNoun', 'delete', 'addVerb'];
        this.priority = 20; // Medium-low priority
        this.connections = new Map();
    }
    async onShutdown() {
        // Close all connections
        for (const [connectionId, connection] of this.connections.entries()) {
            try {
                if (connection.close) {
                    await connection.close();
                }
            }
            catch (error) {
                this.log(`Failed to close connection ${connectionId}: ${error}`, 'error');
            }
        }
        this.connections.clear();
    }
}
/**
 * WebSocket Conduit Augmentation
 * Syncs data between Brainy instances using WebSockets
 */
export class WebSocketConduitAugmentation extends BaseConduitAugmentation {
    constructor() {
        super(...arguments);
        this.name = 'websocket-conduit';
        this.webSocketConnections = new Map();
        this.messageCallbacks = new Map();
    }
    async execute(operation, params, next) {
        // Execute the operation first
        const result = await next();
        // Then sync to connected instances
        if (this.shouldSync(operation)) {
            await this.syncOperation(operation, params, result);
        }
        return result;
    }
    shouldSync(operation) {
        return ['addNoun', 'deleteNoun', 'addVerb'].includes(operation);
    }
    async syncOperation(operation, params, result) {
        // Broadcast to all connected WebSocket instances
        for (const [id, connection] of this.webSocketConnections) {
            if (connection.socket && connection.readyState === 1) { // OPEN state
                try {
                    const message = JSON.stringify({
                        type: 'sync',
                        operation,
                        params,
                        timestamp: Date.now()
                    });
                    if (typeof connection.socket.send === 'function') {
                        connection.socket.send(message);
                    }
                }
                catch (error) {
                    this.log(`Failed to sync to ${id}: ${error}`, 'error');
                }
            }
        }
    }
    async establishConnection(url, config) {
        try {
            const connectionId = uuidv4();
            const protocols = config?.protocols;
            // Create WebSocket based on environment
            let socket;
            if (typeof WebSocket !== 'undefined') {
                // Browser environment
                socket = new WebSocket(url, protocols);
            }
            else {
                // Node.js environment - dynamic import
                try {
                    const ws = await import('ws');
                    socket = new ws.WebSocket(url, protocols);
                }
                catch {
                    this.log('WebSocket not available in this environment', 'error');
                    return null;
                }
            }
            // Setup event handlers
            socket.onopen = () => {
                this.log(`Connected to ${url}`);
            };
            socket.onmessage = (event) => {
                this.handleMessage(connectionId, event.data);
            };
            socket.onerror = (error) => {
                this.log(`WebSocket error: ${error}`, 'error');
            };
            socket.onclose = () => {
                this.log(`Disconnected from ${url}`);
                this.webSocketConnections.delete(connectionId);
            };
            // Wait for connection to open
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 5000);
                socket.onopen = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                socket.onerror = (error) => {
                    clearTimeout(timeout);
                    reject(error);
                };
            });
            const connection = {
                connectionId,
                url,
                readyState: socket.readyState,
                socket
            };
            this.webSocketConnections.set(connectionId, connection);
            this.connections.set(connectionId, connection);
            return connection;
        }
        catch (error) {
            this.log(`Failed to establish connection to ${url}: ${error}`, 'error');
            return null;
        }
    }
    handleMessage(connectionId, data) {
        try {
            const message = typeof data === 'string' ? JSON.parse(data) : data;
            // Handle sync messages from remote instances
            if (message.type === 'sync') {
                // Apply the operation to our local instance
                this.applySyncOperation(message).catch(error => {
                    this.log(`Failed to apply sync operation: ${error}`, 'error');
                });
            }
            // Notify any registered callbacks
            const callbacks = this.messageCallbacks.get(connectionId);
            if (callbacks) {
                callbacks.forEach(callback => callback(message));
            }
        }
        catch (error) {
            this.log(`Failed to handle message: ${error}`, 'error');
        }
    }
    async applySyncOperation(message) {
        // Apply the synced operation to our local Brainy instance
        const { operation, params } = message;
        try {
            switch (operation) {
                case 'addNoun':
                    await this.context?.brain.addNoun(params.content, params.metadata);
                    break;
                case 'deleteNoun':
                    await this.context?.brain.deleteNoun(params.id);
                    break;
                case 'addVerb':
                    await this.context?.brain.addVerb(params.source, params.target, params.verb, params.metadata);
                    break;
            }
        }
        catch (error) {
            this.log(`Failed to apply ${operation}: ${error}`, 'error');
        }
    }
    /**
     * Subscribe to messages from a specific connection
     */
    onMessage(connectionId, callback) {
        if (!this.messageCallbacks.has(connectionId)) {
            this.messageCallbacks.set(connectionId, new Set());
        }
        this.messageCallbacks.get(connectionId).add(callback);
    }
    /**
     * Send a message to a specific connection
     */
    sendMessage(connectionId, data) {
        const connection = this.webSocketConnections.get(connectionId);
        if (connection?.socket && connection.readyState === 1) {
            try {
                const message = typeof data === 'string' ? data : JSON.stringify(data);
                connection.socket.send(message);
                return true;
            }
            catch (error) {
                this.log(`Failed to send message: ${error}`, 'error');
            }
        }
        return false;
    }
}
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
//# sourceMappingURL=conduitAugmentations.js.map