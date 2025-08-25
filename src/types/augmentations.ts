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
 * Legacy compatibility - these are deprecated and should not be used in new code
 * @deprecated Use BrainyAugmentation instead
 */
export type IAugmentation = BrainyAugmentation

/**
 * @deprecated AugmentationType enum is no longer used - augmentations are identified by name
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
 * @deprecated Use specific augmentation classes instead
 */
export namespace BrainyAugmentations {
  export interface ISenseAugmentation extends BrainyAugmentation {}
  export interface IConduitAugmentation extends BrainyAugmentation {}
  export interface ICognitionAugmentation extends BrainyAugmentation {}
  export interface IMemoryAugmentation extends BrainyAugmentation {}
  export interface IPerceptionAugmentation extends BrainyAugmentation {}
  export interface IDialogAugmentation extends BrainyAugmentation {}
  export interface IActivationAugmentation extends BrainyAugmentation {}
  export interface ISynapseAugmentation extends BrainyAugmentation {}
}

/**
 * @deprecated Use BrainyAugmentation instead
 */
export interface IWebSocketSupport extends BrainyAugmentation {
  connectWebSocket?(url: string, protocols?: string | string[]): Promise<WebSocketConnection>
  sendWebSocketMessage?(connectionId: string, data: unknown): Promise<void>
  onWebSocketMessage?(connectionId: string, callback: DataCallback<unknown>): Promise<void>
  offWebSocketMessage?(connectionId: string, callback: DataCallback<unknown>): Promise<void>
  closeWebSocket?(connectionId: string, code?: number, reason?: string): Promise<void>
}