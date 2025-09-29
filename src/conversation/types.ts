/**
 * Conversation Types for Infinite Agent Memory
 *
 * Production-ready type definitions for storing and retrieving
 * conversation history with semantic search and context management.
 */

import { NounType, VerbType } from '../types/graphTypes.js'

/**
 * Role of the message sender
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

/**
 * Problem-solving phase for tracking agent's progress
 */
export type ProblemSolvingPhase =
  | 'understanding'
  | 'analysis'
  | 'planning'
  | 'implementation'
  | 'testing'
  | 'debugging'
  | 'refinement'
  | 'completed'

/**
 * Metadata for a conversation message
 */
export interface ConversationMessageMetadata {
  role: MessageRole
  conversationId: string
  sessionId?: string
  timestamp: number

  // Agent state tracking
  problemSolvingPhase?: ProblemSolvingPhase
  confidence?: number // 0-1 confidence score

  // Token tracking
  tokensUsed?: number
  tokensTotal?: number

  // Context tracking
  artifacts?: string[] // IDs or paths of created artifacts
  toolsUsed?: string[] // Names of tools/functions used
  references?: string[] // IDs of referenced messages/documents

  // Metadata for filtering
  tags?: string[]
  priority?: number
  archived?: boolean

  // Custom metadata
  [key: string]: any
}

/**
 * A conversation message with all metadata
 */
export interface ConversationMessage {
  id: string
  content: string
  role: MessageRole
  metadata: ConversationMessageMetadata
  embedding?: number[]
  createdAt: number
  updatedAt: number
}

/**
 * Conversation thread metadata
 */
export interface ConversationThreadMetadata {
  conversationId: string
  sessionId?: string
  title?: string
  summary?: string
  startTime: number
  endTime?: number
  messageCount: number
  totalTokens: number
  participants: string[] // user IDs or names
  tags?: string[]
  archived?: boolean
  [key: string]: any
}

/**
 * A conversation thread (collection of messages)
 */
export interface ConversationThread {
  id: string
  metadata: ConversationThreadMetadata
  messages: ConversationMessage[]
  artifacts?: string[] // VFS paths or entity IDs
}

/**
 * Options for retrieving relevant context
 */
export interface ContextRetrievalOptions {
  // Query
  query?: string // Natural language query
  conversationId?: string // Limit to specific conversation
  sessionId?: string // Limit to specific session

  // Filtering
  role?: MessageRole | MessageRole[]
  phase?: ProblemSolvingPhase | ProblemSolvingPhase[]
  tags?: string[]
  minConfidence?: number
  timeRange?: {
    start?: number
    end?: number
  }

  // Search parameters
  limit?: number // Max messages to return (default: 10)
  maxTokens?: number // Token budget for context (default: 50000)
  relevanceThreshold?: number // Minimum similarity score (default: 0.7)

  // Ranking weights
  weights?: {
    semantic?: number // Weight for semantic similarity (default: 1.0)
    temporal?: number // Weight for recency (default: 0.5)
    graph?: number // Weight for graph relationships (default: 0.3)
  }

  // Advanced options
  includeArtifacts?: boolean // Include linked code/file artifacts
  includeSimilarConversations?: boolean // Include similar past conversations
  deduplicateClusters?: boolean // Deduplicate via clustering (default: true)
}

/**
 * Ranked context message with relevance score
 */
export interface RankedMessage extends ConversationMessage {
  relevanceScore: number
  semanticScore?: number
  temporalScore?: number
  graphScore?: number
  explanation?: string
}

/**
 * Retrieved context result
 */
export interface ConversationContext {
  messages: RankedMessage[]
  artifacts?: Array<{
    path: string
    id: string
    content?: string
    summary?: string
  }>
  similarConversations?: Array<{
    id: string
    title?: string
    summary?: string
    relevance: number
    messageCount: number
  }>
  totalTokens: number
  metadata: {
    queryTime: number
    messagesConsidered: number
    conversationsSearched: number
  }
}

/**
 * Options for saving messages
 */
export interface SaveMessageOptions {
  conversationId?: string // Auto-generated if not provided
  sessionId?: string
  phase?: ProblemSolvingPhase
  confidence?: number
  artifacts?: string[]
  toolsUsed?: string[]
  tags?: string[]
  linkToPrevious?: string // ID of previous message to link
  metadata?: Record<string, any> // Additional metadata
}

/**
 * Options for conversation search
 */
export interface ConversationSearchOptions {
  query: string
  limit?: number
  role?: MessageRole | MessageRole[]
  conversationId?: string
  sessionId?: string
  timeRange?: {
    start?: number
    end?: number
  }
  includeMetadata?: boolean
  includeContent?: boolean
}

/**
 * Search result for conversations
 */
export interface ConversationSearchResult {
  message: ConversationMessage
  score: number
  conversationId: string
  snippet?: string
}

/**
 * Theme discovered via clustering
 */
export interface ConversationTheme {
  id: string
  label: string
  messages: string[] // Message IDs
  centroid: number[] // Vector centroid
  coherence: number // How coherent the cluster is (0-1)
  keywords?: string[]
}

/**
 * Options for artifact storage
 */
export interface ArtifactOptions {
  conversationId: string
  messageId?: string
  type?: 'code' | 'config' | 'data' | 'document' | 'other'
  language?: string
  description?: string
  metadata?: Record<string, any>
}

/**
 * Statistics about conversations
 */
export interface ConversationStats {
  totalConversations: number
  totalMessages: number
  totalTokens: number
  averageMessagesPerConversation: number
  averageTokensPerMessage: number
  oldestMessage: number
  newestMessage: number
  phases: Record<ProblemSolvingPhase, number>
  roles: Record<MessageRole, number>
}

/**
 * Compaction strategy options
 */
export interface CompactionOptions {
  conversationId: string
  strategy?: 'cluster-based' | 'importance-based' | 'hybrid'
  keepRatio?: number // Ratio of messages to keep (default: 0.3)
  minImportance?: number // Minimum importance score to keep (default: 0.5)
  preservePhases?: ProblemSolvingPhase[] // Always keep these phases
  preserveRecent?: number // Always keep this many recent messages
}

/**
 * Result of compaction operation
 */
export interface CompactionResult {
  originalCount: number
  compactedCount: number
  removedCount: number
  tokensFreed: number
  preservedMessageIds: string[]
  summaryMessageId?: string
}