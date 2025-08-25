/**
 * Brainy 2.0 Augmentation Types
 * 
 * This file contains only the minimal types needed for augmentations.
 * The main augmentation interfaces are now in augmentations/brainyAugmentation.ts
 */

/**
 * WebSocket connection type for conduit augmentations
 */
export type WebSocketConnection = {
  connectionId: string
  url: string
  status: 'connected' | 'disconnected' | 'error'
  send?: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => Promise<void>
  close?: () => Promise<void>
  _streamMessageHandler?: (event: { data: unknown }) => void
  _messageHandlerWrapper?: (data: unknown) => void
}

/**
 * Generic augmentation response type
 */
export type AugmentationResponse<T> = {
  success: boolean
  data: T
  error?: string
}

/**
 * Data callback type for subscriptions
 */
export type DataCallback<T> = (data: T) => void

/**
 * Import types for re-export (avoiding circular dependencies)
 */
import type { 
  BrainyAugmentation as BA,
  BaseAugmentation as BaseA,
  AugmentationContext as AC
} from '../augmentations/brainyAugmentation.js'

export type BrainyAugmentation = BA
export type BaseAugmentation = BaseA  
export type AugmentationContext = AC

/**
 * @deprecated - Being removed in 2.0 final. Use BrainyAugmentation directly
 */
export type IAugmentation = BrainyAugmentation

/**
 * @deprecated - Being removed in 2.0 final
 */
export enum AugmentationType {
  SENSE = 'sense',
  CONDUIT = 'conduit',
  COGNITION = 'cognition',
  MEMORY = 'memory',
  PERCEPTION = 'perception',
  DIALOG = 'dialog',
  ACTIVATION = 'activation',
  WEBSOCKET = 'webSocket',
  SYNAPSE = 'synapse'
}

/**
 * @deprecated - Being removed in 2.0 final. These are just aliases now
 */
export namespace BrainyAugmentations {
  export type ISenseAugmentation = BrainyAugmentation
  export type IConduitAugmentation = BrainyAugmentation
  export type ICognitionAugmentation = BrainyAugmentation
  export type IMemoryAugmentation = BrainyAugmentation
  export type IPerceptionAugmentation = BrainyAugmentation
  export type IDialogAugmentation = BrainyAugmentation
  export type IActivationAugmentation = BrainyAugmentation
  export type ISynapseAugmentation = BrainyAugmentation
}

// Export as individual types for compatibility
export type ISenseAugmentation = BrainyAugmentations.ISenseAugmentation
export type IConduitAugmentation = BrainyAugmentations.IConduitAugmentation
export type ICognitionAugmentation = BrainyAugmentations.ICognitionAugmentation
export type IMemoryAugmentation = BrainyAugmentations.IMemoryAugmentation
export type IPerceptionAugmentation = BrainyAugmentations.IPerceptionAugmentation
export type IDialogAugmentation = BrainyAugmentations.IDialogAugmentation
export type IActivationAugmentation = BrainyAugmentations.IActivationAugmentation

/**
 * @deprecated - Being removed in 2.0 final
 */
export interface IWebSocketSupport {
  connectWebSocket?(url: string, protocols?: string | string[]): Promise<WebSocketConnection>
  sendWebSocketMessage?(connectionId: string, data: unknown): Promise<void>
  onWebSocketMessage?(connectionId: string, callback: DataCallback<unknown>): Promise<void>
  offWebSocketMessage?(connectionId: string, callback: DataCallback<unknown>): Promise<void>
  closeWebSocket?(connectionId: string, code?: number, reason?: string): Promise<void>
}