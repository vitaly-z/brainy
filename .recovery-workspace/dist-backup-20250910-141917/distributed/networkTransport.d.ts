/**
 * Network Transport Layer for Distributed Brainy
 * Uses WebSocket + HTTP for maximum compatibility
 */
import { EventEmitter } from 'events';
export interface NetworkMessage {
    type: string;
    from: string;
    to?: string;
    data: any;
    timestamp: number;
    id: string;
}
export interface NodeEndpoint {
    nodeId: string;
    host: string;
    httpPort: number;
    wsPort: number;
    lastSeen: number;
}
export interface NetworkConfig {
    nodeId?: string;
    host?: string;
    httpPort?: number;
    wsPort?: number;
    seeds?: string[];
    discoveryMethod?: 'seeds' | 'dns' | 'kubernetes' | 'auto';
    enableUDP?: boolean;
}
/**
 * Production-ready network transport
 */
export declare class NetworkTransport extends EventEmitter {
    private nodeId;
    private config;
    private httpServer?;
    private wsServer;
    private peers;
    private connections;
    private messageHandlers;
    private responseHandlers;
    private isRunning;
    constructor(config: NetworkConfig);
    /**
     * Start network transport
     */
    start(): Promise<void>;
    /**
     * Stop network transport
     */
    stop(): Promise<void>;
    /**
     * Start HTTP server for REST API and health checks
     */
    private startHTTPServer;
    /**
     * Start WebSocket server for real-time communication
     */
    private startWebSocketServer;
    /**
     * Discover peers based on configuration
     */
    private discoverPeers;
    /**
     * Connect to seed nodes
     */
    private connectToSeeds;
    /**
     * Discover peers via DNS
     */
    private discoverViaDNS;
    /**
     * Discover peers via Kubernetes
     */
    private discoverViaKubernetes;
    /**
     * Connect to a specific node
     */
    private connectToNode;
    /**
     * Get node information via HTTP
     */
    private getNodeInfo;
    /**
     * Connect to peer via WebSocket
     */
    private connectWebSocket;
    /**
     * Start heartbeat to maintain connections
     */
    private startHeartbeat;
    /**
     * Send message to specific node
     */
    sendToNode(nodeId: string, type: string, data: any): Promise<any>;
    /**
     * Send via HTTP
     */
    private sendViaHTTP;
    /**
     * Broadcast to all peers
     */
    broadcast(type: string, data: any): Promise<void>;
    /**
     * Register message handler
     */
    onMessage(type: string, handler: (msg: NetworkMessage) => Promise<any>): void;
    /**
     * Get connected peers
     */
    getPeers(): NodeEndpoint[];
    /**
     * Check if connected
     */
    isConnected(nodeId: string): boolean;
    /**
     * Generate node ID
     */
    private generateNodeId;
    /**
     * Generate message ID
     */
    private generateMessageId;
    /**
     * Get node ID
     */
    getNodeId(): string;
}
/**
 * Create network transport
 */
export declare function createNetworkTransport(config: NetworkConfig): NetworkTransport;
