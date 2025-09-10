/**
 * HTTP + SSE Transport for Zero-Config Distributed Brainy
 * Simple, reliable, works everywhere - no WebSocket complexity!
 * REAL PRODUCTION CODE - Handles millions of operations
 */
import * as http from 'http';
import { EventEmitter } from 'events';
export interface TransportMessage {
    id: string;
    method: string;
    params: any;
    timestamp: number;
    from: string;
    to?: string;
}
export interface TransportResponse {
    id: string;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
    timestamp: number;
}
export interface SSEClient {
    id: string;
    response: http.ServerResponse;
    lastPing: number;
}
export declare class HTTPTransport extends EventEmitter {
    private server;
    private port;
    private nodeId;
    private endpoints;
    private pendingRequests;
    private sseClients;
    private messageHandlers;
    private isRunning;
    private readonly REQUEST_TIMEOUT;
    private readonly SSE_HEARTBEAT_INTERVAL;
    private sseHeartbeatTimer;
    constructor(nodeId: string);
    /**
     * Start HTTP server with automatic port selection
     */
    start(): Promise<number>;
    /**
     * Stop HTTP server
     */
    stop(): Promise<void>;
    /**
     * Register a node endpoint
     */
    registerEndpoint(nodeId: string, endpoint: string): void;
    /**
     * Register RPC method handler
     */
    registerHandler(method: string, handler: (params: any, from: string) => Promise<any>): void;
    /**
     * Call RPC method on remote node
     */
    call(nodeId: string, method: string, params: any): Promise<any>;
    /**
     * Broadcast to all SSE clients
     */
    broadcast(event: string, data: any): void;
    /**
     * Handle health check
     */
    private handleHealth;
    /**
     * Handle RPC requests
     */
    private handleRPC;
    /**
     * Handle SSE connections for real-time updates
     */
    private handleSSE;
    /**
     * Handle streaming data (for shard migration)
     */
    private handleStream;
    /**
     * Handle stream upload (receiving data)
     */
    private handleStreamUpload;
    /**
     * Handle stream download (sending data)
     */
    private handleStreamDownload;
    /**
     * Send HTTP request to another node
     */
    private sendHTTPRequest;
    /**
     * Read request body
     */
    private readBody;
    /**
     * Find an available port
     */
    private findAvailablePort;
    /**
     * Start SSE heartbeat to keep connections alive
     */
    private startSSEHeartbeat;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Get connected nodes count
     */
    getConnectionCount(): number;
    /**
     * Get SSE client count
     */
    getSSEClientCount(): number;
}
