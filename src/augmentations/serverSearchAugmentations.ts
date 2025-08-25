/**
 * Server Search Augmentations
 *
 * This file implements conduit and activation augmentations for browser-server search functionality.
 * It allows Brainy to search a server-hosted instance and store results locally.
 */

import {
  AugmentationResponse,
  WebSocketConnection
} from '../types/augmentations.js'
import { BaseAugmentation, AugmentationContext } from '../augmentations/brainyAugmentation.js'
import { WebSocketConduitAugmentation } from './conduitAugmentations.js'
import { v4 as uuidv4 } from '../universal/uuid.js'
import { BrainyDataInterface } from '../types/brainyDataInterface.js'

/**
 * ServerSearchConduitAugmentation
 *
 * A specialized conduit augmentation that provides functionality for searching
 * a server-hosted Brainy instance and storing results locally.
 */
export class ServerSearchConduitAugmentation extends BaseAugmentation {
  readonly name = 'server-search-conduit'
  readonly timing = 'after' as const
  operations = ['addNoun', 'delete', 'addVerb'] as ('addNoun' | 'delete' | 'addVerb')[]
  readonly priority = 20
  private localDb: BrainyDataInterface | null = null

  constructor(name?: string) {
    super()
    if (name) {
      // Override name if provided (though it's readonly, this won't work)
      // Keep constructor parameter for API compatibility but ignore it
    }
  }

  /**
   * Initialize the augmentation
   */
  protected async onInitialize(): Promise<void> {
    // Local DB must be set before initialization  
    if (!this.localDb) {
      this.log('Local database not set. Call setLocalDb before using server search.', 'warn')
      return
    }

    this.log('Server search conduit initialized')
  }

  /**
   * Set the local Brainy instance
   * @param db The Brainy instance to use for local storage
   */
  setLocalDb(db: BrainyDataInterface): void {
    this.localDb = db
  }

  /**
   * Stub method for performing search operations via WebSocket
   * TODO: Implement proper WebSocket communication
   */
  private async performSearch(params: any): Promise<AugmentationResponse<any>> {
    this.log('Search operation not yet implemented - returning empty results', 'warn')
    return {
      success: true,
      data: []
    }
  }

  /**
   * Stub method for performing write operations via WebSocket
   * TODO: Implement proper WebSocket communication
   */
  private async performWrite(params: any): Promise<AugmentationResponse<any>> {
    this.log('Write operation not yet implemented', 'warn')
    return {
      success: false,
      data: null,
      error: 'Write operation not implemented'
    }
  }

  /**
   * Get the local Brainy instance
   * @returns The local Brainy instance
   */
  getLocalDb(): BrainyDataInterface | null {
    return this.localDb
  }

  /**
   * Execute method - required by BaseAugmentation
   */
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // Just pass through for now - server search operations are handled by the activation augmentation
    return next()
  }

  /**
   * Search the server-hosted Brainy instance and store results locally
   * @param connectionId The ID of the established connection
   * @param query The search query
   * @param limit Maximum number of results to return
   * @returns Search results
   */
  async searchServer(
    connectionId: string,
    query: string,
    limit: number = 10
  ): Promise<AugmentationResponse<unknown>> {
    if (!this.isInitialized) {
      throw new Error('ServerSearchConduitAugmentation not initialized')
    }

    try {
      // Create a search request (TODO: Implement proper WebSocket communication)
      const readResult = await this.performSearch({
        connectionId,
        query: {
          type: 'search',
          query,
          limit
        }
      })

      if (readResult.success && readResult.data) {
        const searchResults = readResult.data as any[]

        // Store the results in the local Brainy instance
        if (this.localDb) {
          for (const result of searchResults) {
            // Check if the noun already exists in the local database
            const existingNoun = await this.localDb.getNoun(result.id)

            if (!existingNoun) {
              // Add the noun to the local database
              await this.localDb.addNoun(result.vector, result.metadata)
            }
          }
        }

        return {
          success: true,
          data: searchResults
        }
      } else {
        return {
          success: false,
          data: null,
          error: readResult.error || 'Unknown error searching server'
        }
      }
    } catch (error) {
      console.error('Error searching server:', error)
      return {
        success: false,
        data: null,
        error: `Error searching server: ${error}`
      }
    }
  }

  /**
   * Search the local Brainy instance
   * @param query The search query
   * @param limit Maximum number of results to return
   * @returns Search results
   */
  async searchLocal(
    query: string,
    limit: number = 10
  ): Promise<AugmentationResponse<unknown>> {
    if (!this.isInitialized) {
      throw new Error('ServerSearchConduitAugmentation not initialized')
    }

    try {
      if (!this.localDb) {
        return {
          success: false,
          data: null,
          error: 'Local database not initialized'
        }
      }

      const results = await this.localDb.searchText(query, limit)

      return {
        success: true,
        data: results
      }
    } catch (error) {
      console.error('Error searching local database:', error)
      return {
        success: false,
        data: null,
        error: `Error searching local database: ${error}`
      }
    }
  }

  /**
   * Search both server and local instances, combine results, and store server results locally
   * @param connectionId The ID of the established connection
   * @param query The search query
   * @param limit Maximum number of results to return
   * @returns Combined search results
   */
  async searchCombined(
    connectionId: string,
    query: string,
    limit: number = 10
  ): Promise<AugmentationResponse<unknown>> {
    if (!this.isInitialized) {
      throw new Error('ServerSearchConduitAugmentation not initialized')
    }

    try {
      // Search local first
      const localSearchResult = await this.searchLocal(query, limit)

      if (!localSearchResult.success) {
        return localSearchResult
      }

      const localResults = localSearchResult.data as any[]

      // If we have enough local results, return them
      if (localResults.length >= limit) {
        return localSearchResult
      }

      // Otherwise, search server for additional results
      const serverSearchResult = await this.searchServer(
        connectionId,
        query,
        limit - localResults.length
      )

      if (!serverSearchResult.success) {
        // If server search fails, return local results
        return localSearchResult
      }

      const serverResults = serverSearchResult.data as any[]

      // Combine results, removing duplicates
      const combinedResults = [...localResults]
      const localIds = new Set(localResults.map((r) => r.id))

      for (const result of serverResults) {
        if (!localIds.has(result.id)) {
          combinedResults.push(result)
        }
      }

      return {
        success: true,
        data: combinedResults
      }
    } catch (error) {
      console.error('Error performing combined search:', error)
      return {
        success: false,
        data: null,
        error: `Error performing combined search: ${error}`
      }
    }
  }

  /**
   * Add data to both local and server instances
   * @param connectionId The ID of the established connection
   * @param data Text or vector to add
   * @param metadata Metadata for the data
   * @returns ID of the added data
   */
  async addToBoth(
    connectionId: string,
    data: string | any[],
    metadata: any = {}
  ): Promise<AugmentationResponse<string>> {
    if (!this.isInitialized) {
      throw new Error('ServerSearchConduitAugmentation not initialized')
    }

    try {
      if (!this.localDb) {
        return {
          success: false,
          data: '',
          error: 'Local database not initialized'
        }
      }

      // Add to local first - addNoun handles both strings and vectors automatically
      const id = await this.localDb.addNoun(data, metadata)

      // Get the vector and metadata
      const noun = (await this.localDb.getNoun(
        id
      )) as import('../coreTypes.js').VectorDocument<unknown>

      if (!noun) {
        return {
          success: false,
          data: '',
          error: 'Failed to retrieve newly created noun'
        }
      }

      // Add to server (TODO: Implement proper WebSocket communication)
      const writeResult = await this.performWrite({
        connectionId,
        data: {
          type: 'addNoun',
          vector: noun.vector,
          metadata: noun.metadata
        }
      })

      if (!writeResult.success) {
        return {
          success: true,
          data: id,
          error: `Added locally but failed to add to server: ${writeResult.error}`
        }
      }

      return {
        success: true,
        data: id
      }
    } catch (error) {
      console.error('Error adding data to both:', error)
      return {
        success: false,
        data: '',
        error: `Error adding data to both: ${error}`
      }
    }
  }

  /**
   * Establish connection to remote server
   * @param serverUrl Server URL to connect to
   * @param options Connection options
   * @returns Connection promise
   */
  establishConnection(serverUrl: string, options?: any): Promise<any> {
    // Stub implementation - remote connection functionality not yet fully implemented in 2.0
    console.warn('establishConnection: Remote server connections not yet fully implemented in Brainy 2.0')
    return Promise.resolve({ connected: false, reason: 'Not implemented' })
  }

  /**
   * Close WebSocket connection
   * @param connectionId Connection ID to close
   * @returns Promise that resolves when connection is closed
   */
  async closeWebSocket(connectionId: string): Promise<void> {
    // Stub implementation - WebSocket functionality not yet fully implemented in 2.0
    console.warn(`closeWebSocket: WebSocket functionality not yet fully implemented in Brainy 2.0 (connectionId: ${connectionId})`)
  }
}

/**
 * ServerSearchActivationAugmentation
 *
 * An activation augmentation that provides actions for server search functionality.
 */
export class ServerSearchActivationAugmentation extends BaseAugmentation {
  readonly name = 'server-search-activation'
  readonly timing = 'after' as const
  operations = ['search', 'addNoun'] as ('search' | 'addNoun')[]
  readonly priority = 20
  
  private conduitAugmentation: ServerSearchConduitAugmentation | null = null
  private connections: Map<string, WebSocketConnection> = new Map()

  constructor(name?: string) {
    super()
    if (name) {
      // Keep constructor parameter for API compatibility but ignore it
    }
  }

  protected async onInitialize(): Promise<void> {
    // Initialization logic if needed
  }

  protected async onShutdown(): Promise<void> {
    // Cleanup connections
    this.connections.clear()
  }
  
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // Execute the operation first
    const result = await next()
    
    // Handle server search operations
    if (operation === 'search' && this.conduitAugmentation) {
      // Trigger server search when local search happens
      const connectionId = this.connections.keys().next().value
      if (connectionId && params.query) {
        await this.conduitAugmentation.searchServer(
          connectionId,
          params.query,
          params.limit || 10
        )
      }
    }
    
    return result
  }

  /**
   * Set the conduit augmentation to use for server search
   * @param conduit The ServerSearchConduitAugmentation to use
   */
  setConduitAugmentation(conduit: ServerSearchConduitAugmentation): void {
    this.conduitAugmentation = conduit
  }

  /**
   * Store a connection for later use
   * @param connectionId The ID to use for the connection
   * @param connection The WebSocket connection
   */
  storeConnection(connectionId: string, connection: WebSocketConnection): void {
    this.connections.set(connectionId, connection)
  }

  /**
   * Get a stored connection
   * @param connectionId The ID of the connection to retrieve
   * @returns The WebSocket connection
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId)
  }

  /**
   * Trigger an action based on a processed command or internal state
   * @param actionName The name of the action to trigger
   * @param parameters Optional parameters for the action
   */
  triggerAction(
    actionName: string,
    parameters?: Record<string, unknown>
  ): AugmentationResponse<unknown> {
    if (!this.conduitAugmentation) {
      return {
        success: false,
        data: null,
        error: 'Conduit augmentation not set'
      }
    }

    // Handle different actions
    switch (actionName) {
      case 'connectToServer':
        return this.handleConnectToServer(parameters || {})
      case 'searchServer':
        return this.handleSearchServer(parameters || {})
      case 'searchLocal':
        return this.handleSearchLocal(parameters || {})
      case 'searchCombined':
        return this.handleSearchCombined(parameters || {})
      case 'addToBoth':
        return this.handleAddToBoth(parameters || {})
      default:
        return {
          success: false,
          data: null,
          error: `Unknown action: ${actionName}`
        }
    }
  }

  /**
   * Handle the connectToServer action
   * @param parameters Action parameters
   */
  private handleConnectToServer(
    parameters: Record<string, unknown>
  ): AugmentationResponse<unknown> {
    const serverUrl = parameters.serverUrl as string
    const protocols = parameters.protocols as string | string[] | undefined

    if (!serverUrl) {
      return {
        success: false,
        data: null,
        error: 'serverUrl parameter is required'
      }
    }

    // Return a promise that will be resolved when the connection is established
    return {
      success: true,
      data: this.conduitAugmentation!.establishConnection(serverUrl, {
        protocols
      })
    }
  }

  /**
   * Handle the searchServer action
   * @param parameters Action parameters
   */
  private handleSearchServer(
    parameters: Record<string, unknown>
  ): AugmentationResponse<unknown> {
    const connectionId = parameters.connectionId as string
    const query = parameters.query as string
    const limit = (parameters.limit as number) || 10

    if (!connectionId) {
      return {
        success: false,
        data: null,
        error: 'connectionId parameter is required'
      }
    }

    if (!query) {
      return {
        success: false,
        data: null,
        error: 'query parameter is required'
      }
    }

    // Return a promise that will be resolved when the search is complete
    return {
      success: true,
      data: this.conduitAugmentation!.searchServer(connectionId, query, limit)
    }
  }

  /**
   * Handle the searchLocal action
   * @param parameters Action parameters
   */
  private handleSearchLocal(
    parameters: Record<string, unknown>
  ): AugmentationResponse<unknown> {
    const query = parameters.query as string
    const limit = (parameters.limit as number) || 10

    if (!query) {
      return {
        success: false,
        data: null,
        error: 'query parameter is required'
      }
    }

    // Return a promise that will be resolved when the search is complete
    return {
      success: true,
      data: this.conduitAugmentation!.searchLocal(query, limit)
    }
  }

  /**
   * Handle the searchCombined action
   * @param parameters Action parameters
   */
  private handleSearchCombined(
    parameters: Record<string, unknown>
  ): AugmentationResponse<unknown> {
    const connectionId = parameters.connectionId as string
    const query = parameters.query as string
    const limit = (parameters.limit as number) || 10

    if (!connectionId) {
      return {
        success: false,
        data: null,
        error: 'connectionId parameter is required'
      }
    }

    if (!query) {
      return {
        success: false,
        data: null,
        error: 'query parameter is required'
      }
    }

    // Return a promise that will be resolved when the search is complete
    return {
      success: true,
      data: this.conduitAugmentation!.searchCombined(connectionId, query, limit)
    }
  }

  /**
   * Handle the addToBoth action
   * @param parameters Action parameters
   */
  private handleAddToBoth(
    parameters: Record<string, unknown>
  ): AugmentationResponse<unknown> {
    const connectionId = parameters.connectionId as string
    const data = parameters.data
    const metadata = parameters.metadata || {}

    if (!connectionId) {
      return {
        success: false,
        data: null,
        error: 'connectionId parameter is required'
      }
    }

    if (!data) {
      return {
        success: false,
        data: null,
        error: 'data parameter is required'
      }
    }

    // Return a promise that will be resolved when the add is complete
    return {
      success: true,
      data: this.conduitAugmentation!.addToBoth(
        connectionId,
        data as any,
        metadata as any
      )
    }
  }

  /**
   * Generates an expressive output or response from Brainy
   * @param knowledgeId The identifier of the knowledge to express
   * @param format The desired output format (e.g., 'text', 'json')
   */
  generateOutput(
    knowledgeId: string,
    format: string
  ): AugmentationResponse<string | Record<string, unknown>> {
    // This method is not used for server search functionality
    return {
      success: false,
      data: '',
      error:
        'generateOutput is not implemented for ServerSearchActivationAugmentation'
    }
  }

  /**
   * Interacts with an external system or API
   * @param systemId The identifier of the external system
   * @param payload The data to send to the external system
   */
  interactExternal(
    systemId: string,
    payload: Record<string, unknown>
  ): AugmentationResponse<unknown> {
    // This method is not used for server search functionality
    return {
      success: false,
      data: null,
      error:
        'interactExternal is not implemented for ServerSearchActivationAugmentation'
    }
  }
}

/**
 * Factory function to create server search augmentations
 * @param serverUrl The URL of the server to connect to
 * @param options Additional options
 * @returns An object containing the created augmentations
 */
export async function createServerSearchAugmentations(
  serverUrl: string,
  options: {
    conduitName?: string
    activationName?: string
    protocols?: string | string[]
    localDb?: BrainyDataInterface
  } = {}
): Promise<{
  conduit: ServerSearchConduitAugmentation
  activation: ServerSearchActivationAugmentation
  connection: WebSocketConnection
}> {
  // Create the conduit augmentation
  const conduit = new ServerSearchConduitAugmentation(options.conduitName)
  
  // Set the local database if provided
  if (options.localDb) {
    conduit.setLocalDb(options.localDb)
  }

  // Create the activation augmentation  
  const activation = new ServerSearchActivationAugmentation(
    options.activationName
  )
  
  // Note: Augmentations will be initialized when added to BrainyData

  // Link the augmentations
  activation.setConduitAugmentation(conduit)

  // TODO: Connect to the server (stub implementation for now)
  const connection: WebSocketConnection = {
    connectionId: `stub-connection-${Date.now()}`,
    url: serverUrl,
    status: 'connected',
    close: async () => {},
    send: async (data: any) => {}
  }

  // Store the connection in the activation augmentation
  activation.storeConnection(connection.connectionId, connection)

  return {
    conduit,
    activation,
    connection
  }
}
