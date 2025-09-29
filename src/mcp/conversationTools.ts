/**
 * MCP Conversation Tools
 *
 * Exposes ConversationManager functionality through MCP for Claude Code integration.
 * Provides 6 tools for infinite agent memory.
 *
 * REAL IMPLEMENTATION - Uses ConversationManager which uses real Brainy APIs
 */

import { v4 as uuidv4 } from '../universal/uuid.js'
import {
  MCPResponse,
  MCPToolExecutionRequest,
  MCPTool,
  MCP_VERSION
} from '../types/mcpTypes.js'
import { ConversationManager } from '../conversation/conversationManager.js'
import { Brainy } from '../brainy.js'

/**
 * MCP Conversation Toolset
 *
 * Provides conversation and context management tools for AI agents
 */
export class MCPConversationToolset {
  private conversationManager: ConversationManager
  private initialized = false

  /**
   * Create MCP Conversation Toolset
   * @param brain Brainy instance
   */
  constructor(private brain: Brainy) {
    this.conversationManager = new ConversationManager(brain)
  }

  /**
   * Initialize the toolset
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.conversationManager.init()
    this.initialized = true
  }

  /**
   * Handle MCP tool execution request
   * @param request MCP tool execution request
   * @returns MCP response
   */
  async handleRequest(request: MCPToolExecutionRequest): Promise<MCPResponse> {
    if (!this.initialized) {
      await this.init()
    }

    try {
      const { toolName, parameters } = request

      // Route to appropriate tool handler
      switch (toolName) {
        case 'conversation_save_message':
          return await this.handleSaveMessage(request.requestId, parameters)

        case 'conversation_get_context':
          return await this.handleGetContext(request.requestId, parameters)

        case 'conversation_search':
          return await this.handleSearch(request.requestId, parameters)

        case 'conversation_get_thread':
          return await this.handleGetThread(request.requestId, parameters)

        case 'conversation_save_artifact':
          return await this.handleSaveArtifact(request.requestId, parameters)

        case 'conversation_find_similar':
          return await this.handleFindSimilar(request.requestId, parameters)

        default:
          return this.createErrorResponse(
            request.requestId,
            'UNKNOWN_TOOL',
            `Unknown conversation tool: ${toolName}`
          )
      }
    } catch (error) {
      return this.createErrorResponse(
        request.requestId,
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  /**
   * Get available conversation tools
   * @returns Array of MCP tool definitions
   */
  async getAvailableTools(): Promise<MCPTool[]> {
    return [
      {
        name: 'conversation_save_message',
        description: 'Save a message to conversation history with automatic embedding and indexing',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Message content'
            },
            role: {
              type: 'string',
              enum: ['user', 'assistant', 'system', 'tool'],
              description: 'Message role'
            },
            conversationId: {
              type: 'string',
              description: 'Conversation ID (auto-generated if not provided)'
            },
            sessionId: {
              type: 'string',
              description: 'Session ID (optional)'
            },
            phase: {
              type: 'string',
              enum: [
                'understanding',
                'analysis',
                'planning',
                'implementation',
                'testing',
                'debugging',
                'refinement',
                'completed'
              ],
              description: 'Problem-solving phase'
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Confidence score (0-1)'
            },
            artifacts: {
              type: 'array',
              items: { type: 'string' },
              description: 'Artifact IDs or paths'
            },
            toolsUsed: {
              type: 'array',
              items: { type: 'string' },
              description: 'Names of tools used'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for categorization'
            },
            linkToPrevious: {
              type: 'string',
              description: 'ID of previous message to link'
            }
          },
          required: ['content', 'role']
        }
      },
      {
        name: 'conversation_get_context',
        description: 'Retrieve relevant context from conversation history using semantic search',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query string for context retrieval'
            },
            conversationId: {
              type: 'string',
              description: 'Limit to specific conversation'
            },
            limit: {
              type: 'number',
              description: 'Maximum messages to return (default: 10)',
              default: 10
            },
            maxTokens: {
              type: 'number',
              description: 'Token budget for context (default: 50000)',
              default: 50000
            },
            relevanceThreshold: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Minimum similarity score (default: 0.7)',
              default: 0.7
            },
            role: {
              oneOf: [
                { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
                { type: 'array', items: { type: 'string' } }
              ],
              description: 'Filter by message role'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tags'
            },
            includeArtifacts: {
              type: 'boolean',
              description: 'Include linked artifacts',
              default: false
            },
            includeSimilarConversations: {
              type: 'boolean',
              description: 'Include similar past conversations',
              default: false
            }
          },
          required: ['query']
        }
      },
      {
        name: 'conversation_search',
        description: 'Search messages semantically across all conversations',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 10)',
              default: 10
            },
            conversationId: {
              type: 'string',
              description: 'Limit to specific conversation'
            },
            role: {
              oneOf: [
                { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
                { type: 'array', items: { type: 'string' } }
              ],
              description: 'Filter by role'
            },
            timeRange: {
              type: 'object',
              properties: {
                start: { type: 'number', description: 'Start timestamp' },
                end: { type: 'number', description: 'End timestamp' }
              },
              description: 'Time range filter'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'conversation_get_thread',
        description: 'Get full conversation thread with all messages',
        parameters: {
          type: 'object',
          properties: {
            conversationId: {
              type: 'string',
              description: 'Conversation ID'
            },
            includeArtifacts: {
              type: 'boolean',
              description: 'Include linked artifacts',
              default: false
            }
          },
          required: ['conversationId']
        }
      },
      {
        name: 'conversation_save_artifact',
        description: 'Save code/file artifact and link to conversation',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'VFS path for artifact'
            },
            content: {
              type: 'string',
              description: 'Artifact content'
            },
            conversationId: {
              type: 'string',
              description: 'Conversation ID'
            },
            messageId: {
              type: 'string',
              description: 'Message ID to link artifact to'
            },
            type: {
              type: 'string',
              enum: ['code', 'config', 'data', 'document', 'other'],
              description: 'Artifact type'
            },
            language: {
              type: 'string',
              description: 'Programming language (for code artifacts)'
            },
            description: {
              type: 'string',
              description: 'Artifact description'
            }
          },
          required: ['path', 'content', 'conversationId']
        }
      },
      {
        name: 'conversation_find_similar',
        description: 'Find similar past conversations using semantic similarity',
        parameters: {
          type: 'object',
          properties: {
            conversationId: {
              type: 'string',
              description: 'Conversation ID to find similar to'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 5)',
              default: 5
            },
            threshold: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Minimum similarity threshold (default: 0.7)',
              default: 0.7
            }
          },
          required: ['conversationId']
        }
      }
    ]
  }

  /**
   * Handle save_message tool
   * REAL: Uses ConversationManager.saveMessage()
   */
  private async handleSaveMessage(
    requestId: string,
    parameters: any
  ): Promise<MCPResponse> {
    const {
      content,
      role,
      conversationId,
      sessionId,
      phase,
      confidence,
      artifacts,
      toolsUsed,
      tags,
      linkToPrevious
    } = parameters

    // Validate required parameters
    if (!content || !role) {
      return this.createErrorResponse(
        requestId,
        'INVALID_PARAMETERS',
        'Missing required parameters: content and role are required'
      )
    }

    // Save message (REAL)
    const messageId = await this.conversationManager.saveMessage(content, role, {
      conversationId,
      sessionId,
      phase,
      confidence,
      artifacts,
      toolsUsed,
      tags,
      linkToPrevious
    })

    return this.createSuccessResponse(requestId, {
      messageId,
      conversationId: conversationId || messageId.split('_')[0]
    })
  }

  /**
   * Handle get_context tool
   * REAL: Uses ConversationManager.getRelevantContext()
   */
  private async handleGetContext(
    requestId: string,
    parameters: any
  ): Promise<MCPResponse> {
    const { query, ...options } = parameters

    if (!query) {
      return this.createErrorResponse(
        requestId,
        'INVALID_PARAMETERS',
        'Missing required parameter: query'
      )
    }

    // Get context (REAL)
    const context = await this.conversationManager.getRelevantContext(query, options)

    return this.createSuccessResponse(requestId, context)
  }

  /**
   * Handle search tool
   * REAL: Uses ConversationManager.searchMessages()
   */
  private async handleSearch(
    requestId: string,
    parameters: any
  ): Promise<MCPResponse> {
    const { query } = parameters

    if (!query) {
      return this.createErrorResponse(
        requestId,
        'INVALID_PARAMETERS',
        'Missing required parameter: query'
      )
    }

    // Search messages (REAL)
    const results = await this.conversationManager.searchMessages(parameters)

    return this.createSuccessResponse(requestId, {
      results,
      count: results.length
    })
  }

  /**
   * Handle get_thread tool
   * REAL: Uses ConversationManager.getConversationThread()
   */
  private async handleGetThread(
    requestId: string,
    parameters: any
  ): Promise<MCPResponse> {
    const { conversationId, includeArtifacts = false } = parameters

    if (!conversationId) {
      return this.createErrorResponse(
        requestId,
        'INVALID_PARAMETERS',
        'Missing required parameter: conversationId'
      )
    }

    // Get thread (REAL)
    const thread = await this.conversationManager.getConversationThread(
      conversationId,
      { includeArtifacts }
    )

    return this.createSuccessResponse(requestId, thread)
  }

  /**
   * Handle save_artifact tool
   * REAL: Uses ConversationManager.saveArtifact()
   */
  private async handleSaveArtifact(
    requestId: string,
    parameters: any
  ): Promise<MCPResponse> {
    const {
      path,
      content,
      conversationId,
      messageId,
      type,
      language,
      description
    } = parameters

    if (!path || !content || !conversationId) {
      return this.createErrorResponse(
        requestId,
        'INVALID_PARAMETERS',
        'Missing required parameters: path, content, and conversationId are required'
      )
    }

    // Save artifact (REAL)
    const artifactId = await this.conversationManager.saveArtifact(path, content, {
      conversationId,
      messageId,
      type,
      language,
      description
    })

    return this.createSuccessResponse(requestId, {
      artifactId,
      path
    })
  }

  /**
   * Handle find_similar tool
   * REAL: Uses ConversationManager.findSimilarConversations()
   */
  private async handleFindSimilar(
    requestId: string,
    parameters: any
  ): Promise<MCPResponse> {
    const { conversationId, limit = 5, threshold = 0.7 } = parameters

    if (!conversationId) {
      return this.createErrorResponse(
        requestId,
        'INVALID_PARAMETERS',
        'Missing required parameter: conversationId'
      )
    }

    // Find similar (REAL)
    const similar = await this.conversationManager.findSimilarConversations(
      conversationId,
      limit,
      threshold
    )

    return this.createSuccessResponse(requestId, {
      similar,
      count: similar.length
    })
  }

  /**
   * Create success response
   */
  private createSuccessResponse(requestId: string, data: any): MCPResponse {
    return {
      success: true,
      requestId,
      version: MCP_VERSION,
      data
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    requestId: string,
    code: string,
    message: string,
    details?: any
  ): MCPResponse {
    return {
      success: false,
      requestId,
      version: MCP_VERSION,
      error: {
        code,
        message,
        details
      }
    }
  }

  /**
   * Generate request ID
   */
  generateRequestId(): string {
    return uuidv4()
  }
}

/**
 * Create MCP conversation toolset
 * @param brain Brainy instance
 * @returns MCPConversationToolset instance
 */
export function createConversationToolset(brain: Brainy): MCPConversationToolset {
  return new MCPConversationToolset(brain)
}