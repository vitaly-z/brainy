/**
 * BrainyMCPClient
 *
 * Client for connecting Claude instances to the Brain Jar Broadcast Server
 * Utilizes Brainy for persistent memory and vector search capabilities
 */
interface ClientOptions {
    name: string;
    role: string;
    serverUrl?: string;
    autoReconnect?: boolean;
    useBrainyMemory?: boolean;
}
interface Message {
    id: string;
    from: string;
    to?: string | string[];
    type: 'message' | 'notification' | 'sync' | 'heartbeat' | 'identify';
    event?: string;
    data: any;
    timestamp: number;
}
export declare class BrainyMCPClient {
    private socket?;
    private options;
    private brainy?;
    private messageHandlers;
    private reconnectTimeout?;
    private isConnected;
    constructor(options: ClientOptions);
    /**
     * Initialize Brainy for persistent memory
     */
    private initBrainy;
    /**
     * Connect to the broadcast server
     */
    connect(): Promise<void>;
    /**
     * Handle incoming message
     */
    private handleMessage;
    /**
     * Send a message
     */
    send(message: Partial<Message>): void;
    /**
     * Send a message to specific agent(s)
     */
    sendTo(recipient: string | string[], data: any): void;
    /**
     * Broadcast to all agents
     */
    broadcast(data: any): void;
    /**
     * Register a message handler
     */
    on(type: string, handler: (message: Message) => void): void;
    /**
     * Remove a message handler
     */
    off(type: string): void;
    /**
     * Search historical messages using Brainy's vector search
     */
    searchMemory(query: string, limit?: number): Promise<any[]>;
    /**
     * Get recent messages from Brainy memory
     */
    getRecentMessages(limit?: number): Promise<any[]>;
    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect;
    /**
     * Disconnect from server
     */
    disconnect(): void;
    /**
     * Check if connected
     */
    getIsConnected(): boolean;
    /**
     * Get agent info
     */
    getAgentInfo(): {
        name: string;
        role: string;
        connected: boolean;
    };
}
export default BrainyMCPClient;
