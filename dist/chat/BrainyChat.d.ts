/**
 * BrainyChat - Magical Chat Command Center
 *
 * A smart chat system that leverages Brainy's standard noun/verb types
 * to create intelligent, persistent conversations with automatic context loading.
 *
 * Key Features:
 * - Uses standard NounType.Message for all chat messages
 * - Employs VerbType.Communicates and VerbType.Precedes for conversation flow
 * - Auto-discovery of previous sessions using Brainy's search capabilities
 * - Hybrid architecture: basic chat (open source) + premium memory sync
 */
import { BrainyData } from '../brainyData.js';
export interface ChatMessage {
    id: string;
    content: string;
    speaker: 'user' | 'assistant' | string;
    sessionId: string;
    timestamp: Date;
    metadata?: {
        model?: string;
        usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
        };
        context?: Record<string, any>;
    };
}
export interface ChatSession {
    id: string;
    title?: string;
    createdAt: Date;
    lastMessageAt: Date;
    messageCount: number;
    participants: string[];
    metadata?: {
        tags?: string[];
        summary?: string;
        archived?: boolean;
        premium?: boolean;
    };
}
/**
 * Enhanced BrainyChat with automatic context loading and intelligent memory
 *
 * This extends basic chat functionality with premium features when available
 */
export declare class BrainyChat {
    private brainy;
    private currentSessionId;
    private sessionCache;
    constructor(brainy: BrainyData);
    /**
     * Initialize chat system and auto-discover last session
     * Uses Brainy's advanced search to find the most recent conversation
     */
    initialize(): Promise<ChatSession | null>;
    /**
     * Start a new chat session
     * Automatically generates a session ID and stores session metadata
     */
    startNewSession(title?: string, participants?: string[]): Promise<ChatSession>;
    /**
     * Add a message to the current session
     * Stores using standard NounType.Message and creates conversation flow relationships
     */
    addMessage(content: string, speaker?: string, metadata?: ChatMessage['metadata']): Promise<ChatMessage>;
    /**
     * Get conversation history for current session
     * Uses Brainy's graph traversal to get messages in chronological order
     */
    getHistory(limit?: number): Promise<ChatMessage[]>;
    /**
     * Search across all chat sessions and messages
     * Leverages Brainy's powerful vector and semantic search
     */
    searchMessages(query: string, options?: {
        sessionId?: string;
        speaker?: string;
        limit?: number;
        semanticSearch?: boolean;
    }): Promise<ChatMessage[]>;
    /**
     * Get all chat sessions
     * Uses Brainy's search to find all conversation sessions
     */
    getSessions(limit?: number): Promise<ChatSession[]>;
    /**
     * Switch to a different session
     * Automatically loads context and history
     */
    switchToSession(sessionId: string): Promise<ChatSession | null>;
    /**
     * Archive a session (premium feature)
     * Maintains full searchability while organizing conversations
     */
    archiveSession(sessionId: string): Promise<boolean>;
    /**
     * Generate session summary using AI (premium feature)
     * Intelligently summarizes long conversations
     */
    generateSessionSummary(sessionId: string): Promise<string | null>;
    private createMessageRelationships;
    private loadSession;
    private getHistoryForSession;
    private updateSessionMetadata;
    private nounToChatMessage;
    private nounToChatSession;
    private toTimestamp;
    private isPremiumEnabled;
    getCurrentSessionId(): string | null;
    getCurrentSession(): ChatSession | null;
}
