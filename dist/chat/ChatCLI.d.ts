/**
 * ChatCLI - Command Line Interface for BrainyChat
 *
 * Provides a magical chat experience through the Brainy CLI with:
 * - Auto-discovery of previous sessions
 * - Intelligent context loading
 * - Multi-agent coordination support
 * - Premium memory sync integration
 */
import { type ChatMessage } from './BrainyChat.js';
import { BrainyData } from '../brainyData.js';
export declare class ChatCLI {
    private brainyChat;
    private brainy;
    constructor(brainy: BrainyData);
    /**
     * Start an interactive chat session
     * Automatically discovers and loads previous context
     */
    startInteractiveChat(options?: {
        sessionId?: string;
        speaker?: string;
        memory?: boolean;
        newSession?: boolean;
    }): Promise<void>;
    /**
     * Send a single message and get response
     */
    sendMessage(message: string, options?: {
        sessionId?: string;
        speaker?: string;
        noResponse?: boolean;
    }): Promise<ChatMessage[]>;
    /**
     * Show conversation history
     */
    showHistory(limit?: number): Promise<void>;
    /**
     * Search across all conversations
     */
    searchConversations(query: string, options?: {
        limit?: number;
        sessionId?: string;
        semantic?: boolean;
    }): Promise<void>;
    /**
     * List all chat sessions
     */
    listSessions(): Promise<void>;
    /**
     * Switch to a different session
     */
    switchSession(sessionId: string): Promise<void>;
    /**
     * Show help for chat commands
     */
    showHelp(): void;
    private interactiveLoop;
    private showRecentContext;
    private generateResponse;
}
