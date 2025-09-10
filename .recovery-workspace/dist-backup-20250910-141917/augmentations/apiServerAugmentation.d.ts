/**
 * API Server Augmentation - Universal API Exposure
 *
 * 🌐 Exposes Brainy through REST, WebSocket, and MCP
 * 🔌 Works in Node.js, Deno, and Service Workers
 * 🚀 Single augmentation for all API needs
 *
 * This unifies and replaces:
 * - BrainyMCPBroadcast (Node-specific server)
 * - WebSocketConduitAugmentation (client connections)
 * - Future REST API implementations
 */
import { BaseAugmentation } from './brainyAugmentation.js';
export interface APIServerConfig {
    enabled?: boolean;
    port?: number;
    mcpPort?: number;
    wsPort?: number;
    host?: string;
    cors?: {
        origin?: string | string[];
        credentials?: boolean;
    };
    auth?: {
        required?: boolean;
        apiKeys?: string[];
        bearerTokens?: string[];
    };
    rateLimit?: {
        windowMs?: number;
        max?: number;
    };
    ssl?: {
        cert?: string;
        key?: string;
    };
}
/**
 * Unified API Server Augmentation
 * Exposes Brainy through multiple protocols
 */
export declare class APIServerAugmentation extends BaseAugmentation {
    readonly name = "api-server";
    readonly timing: "after";
    readonly metadata: "readonly";
    readonly operations: ("all")[];
    readonly priority = 5;
    protected config: APIServerConfig;
    private mcpService?;
    private httpServer?;
    private wsServer?;
    private clients;
    private operationHistory;
    private maxHistorySize;
    constructor(config?: APIServerConfig);
    protected onInitialize(): Promise<void>;
    /**
     * Start Node.js server with Express
     */
    private startNodeServer;
    /**
     * Setup REST API routes
     */
    private setupRESTRoutes;
    /**
     * Setup WebSocket server
     */
    private setupWebSocketServer;
    /**
     * Handle WebSocket message
     */
    private handleWebSocketMessage;
    /**
     * Execute augmentation - broadcast operations to clients
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Auth middleware for Express
     */
    private authMiddleware;
    /**
     * Rate limiting middleware
     */
    private rateLimitMiddleware;
    /**
     * Sanitize parameters before broadcasting
     */
    private sanitizeParams;
    /**
     * Send heartbeats to all connected clients
     */
    private sendHeartbeats;
    /**
     * Start Deno server
     */
    private startDenoServer;
    /**
     * Start Service Worker (for browser)
     */
    private startServiceWorker;
    /**
     * Shutdown the server
     */
    protected onShutdown(): Promise<void>;
}
/**
 * Helper function to create and configure API server
 */
export declare function createAPIServer(config?: APIServerConfig): APIServerAugmentation;
