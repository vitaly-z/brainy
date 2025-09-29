/**
 * Conversation Module - Infinite Agent Memory
 *
 * Provides conversation and context management for AI agents
 * Built on Brainy's existing infrastructure
 */

export { ConversationManager, createConversationManager } from './conversationManager.js'

export type {
  MessageRole,
  ProblemSolvingPhase,
  ConversationMessage,
  ConversationMessageMetadata,
  ConversationThread,
  ConversationThreadMetadata,
  ConversationContext,
  RankedMessage,
  SaveMessageOptions,
  ContextRetrievalOptions,
  ConversationSearchOptions,
  ConversationSearchResult,
  ConversationTheme,
  ArtifactOptions,
  ConversationStats,
  CompactionOptions,
  CompactionResult
} from './types.js'