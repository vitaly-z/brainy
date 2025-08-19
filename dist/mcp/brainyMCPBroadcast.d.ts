/**
 * BrainyMCPBroadcast
 *
 * Enhanced MCP service with real-time WebSocket broadcasting capabilities
 * for multi-agent coordination (Jarvis ↔ Picasso communication)
 *
 * Features:
 * - WebSocket server for real-time push notifications
 * - Subscription management for multiple Claude instances
 * - Message broadcasting to all connected agents
 * - Works both locally and with cloud deployment
 */
import { BrainyMCPService } from './brainyMCPService.js';
import { BrainyDataInterface } from '../types/brainyDataInterface.js';
import { MCPServiceOptions } from '../types/mcpTypes.js';
interface BroadcastMessage {
    id: string;
    from: string;
    to?: string | string[];
    type: 'message' | 'notification' | 'sync' | 'heartbeat' | 'identify';
    event?: string;
    data: any;
    timestamp: number;
}
export declare class BrainyMCPBroadcast extends BrainyMCPService {
    private wsServer?;
    private httpServer?;
    private agents;
    private messageHistory;
    private maxHistorySize;
    constructor(brainyData: BrainyDataInterface, options?: MCPServiceOptions & {
        broadcastPort?: number;
        cloudUrl?: string;
    });
    /**
     * Start the WebSocket broadcast server
     * @param port Port to listen on (default: 8765)
     * @param isCloud Whether this is a cloud deployment
     */
    startBroadcastServer(port?: number, isCloud?: boolean): Promise<void>;
    /**
     * Handle new WebSocket connection
     */
    private handleNewConnection;
    /**
     * Handle message from an agent
     */
    private handleAgentMessage;
    /**
     * Broadcast message to all connected agents
     */
    broadcast(message: BroadcastMessage, excludeId?: string): void;
    /**
     * Send message to specific agent
     */
    private sendToAgent;
    /**
     * Remove agent from connected list
     */
    private removeAgent;
    /**
     * Add message to history
     */
    private addToHistory;
    /**
     * Stop the broadcast server
     */
    stopBroadcastServer(): Promise<void>;
    /**
     * Get connected agents
     */
    getConnectedAgents(): Array<{
        id: string;
        name: string;
        role: string;
    }>;
    /**
     * Get message history
     */
    getMessageHistory(): BroadcastMessage[];
}
export default BrainyMCPBroadcast;
