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

// REMOVED: Old augmentation type system for 2.0 clean architecture
// All augmentations now use the unified BrainyAugmentation interface from brainyAugmentation.ts

/**
 * @deprecated Use BrainyAugmentation from '../augmentations/brainyAugmentation.js' instead
 *
 * @example
 * // ❌ Old way (v2.x):
 * import { IAugmentation } from '@soulcraft/brainy/types/augmentations'
 *
 * // ✅ New way (v3.x):
 * import { BrainyAugmentation } from '@soulcraft/brainy'
 */
export type IAugmentation = BrainyAugmentation

/**
 * @deprecated Augmentation types are now unified under BrainyAugmentation interface
 *
 * @example
 * // ❌ Old way (v2.x):
 * import { AugmentationType } from '@soulcraft/brainy/types/augmentations'
 * if (augmentation.type === AugmentationType.SENSE) { ... }
 *
 * // ✅ New way (v3.x):
 * import { BrainyAugmentation } from '@soulcraft/brainy'
 * // Use the unified BrainyAugmentation interface directly
 */
export enum AugmentationType { SENSE = 'sense', CONDUIT = 'conduit', COGNITION = 'cognition', MEMORY = 'memory', PERCEPTION = 'perception', DIALOG = 'dialog', ACTIVATION = 'activation', WEBSOCKET = 'webSocket', SYNAPSE = 'synapse' }

/**
 * @deprecated Use BrainyAugmentation interface directly instead of namespace types
 *
 * @example
 * // ❌ Old way (v2.x):
 * import { BrainyAugmentations } from '@soulcraft/brainy/types/augmentations'
 * class MyAugmentation implements BrainyAugmentations.ISenseAugmentation { ... }
 *
 * // ✅ New way (v3.x):
 * import { BrainyAugmentation } from '@soulcraft/brainy'
 * class MyAugmentation implements BrainyAugmentation { ... }
 */
export namespace BrainyAugmentations {
  /** @deprecated Use BrainyAugmentation instead */
  export type ISenseAugmentation = BrainyAugmentation
  /** @deprecated Use BrainyAugmentation instead */
  export type IConduitAugmentation = BrainyAugmentation
  /** @deprecated Use BrainyAugmentation instead */
  export type ICognitionAugmentation = BrainyAugmentation
  /** @deprecated Use BrainyAugmentation instead */
  export type IMemoryAugmentation = BrainyAugmentation
  /** @deprecated Use BrainyAugmentation instead */
  export type IPerceptionAugmentation = BrainyAugmentation
  /** @deprecated Use BrainyAugmentation instead */
  export type IDialogAugmentation = BrainyAugmentation
  /** @deprecated Use BrainyAugmentation instead */
  export type IActivationAugmentation = BrainyAugmentation
  /** @deprecated Use BrainyAugmentation instead */
  export type ISynapseAugmentation = BrainyAugmentation
}

/**
 * @deprecated Use BrainyAugmentation from '../augmentations/brainyAugmentation.js' instead
 *
 * @example
 * // ❌ Old way (v2.x):
 * import { ISenseAugmentation } from '@soulcraft/brainy/types/augmentations'
 * class MySense implements ISenseAugmentation { ... }
 *
 * // ✅ New way (v3.x):
 * import { BrainyAugmentation } from '@soulcraft/brainy'
 * class MySense implements BrainyAugmentation { ... }
 */
export type ISenseAugmentation = BrainyAugmentation

/**
 * @deprecated Use BrainyAugmentation from '../augmentations/brainyAugmentation.js' instead
 *
 * @example
 * // ❌ Old way (v2.x):
 * import { IConduitAugmentation } from '@soulcraft/brainy/types/augmentations'
 *
 * // ✅ New way (v3.x):
 * import { BrainyAugmentation } from '@soulcraft/brainy'
 */
export type IConduitAugmentation = BrainyAugmentation

/**
 * @deprecated Use BrainyAugmentation from '../augmentations/brainyAugmentation.js' instead
 *
 * @example
 * // ❌ Old way (v2.x):
 * import { ICognitionAugmentation } from '@soulcraft/brainy/types/augmentations'
 *
 * // ✅ New way (v3.x):
 * import { BrainyAugmentation } from '@soulcraft/brainy'
 */
export type ICognitionAugmentation = BrainyAugmentation

/**
 * @deprecated Use BrainyAugmentation from '../augmentations/brainyAugmentation.js' instead
 *
 * @example
 * // ❌ Old way (v2.x):
 * import { IMemoryAugmentation } from '@soulcraft/brainy/types/augmentations'
 *
 * // ✅ New way (v3.x):
 * import { BrainyAugmentation } from '@soulcraft/brainy'
 */
export type IMemoryAugmentation = BrainyAugmentation

/**
 * @deprecated Use BrainyAugmentation from '../augmentations/brainyAugmentation.js' instead
 *
 * @example
 * // ❌ Old way (v2.x):
 * import { IPerceptionAugmentation } from '@soulcraft/brainy/types/augmentations'
 *
 * // ✅ New way (v3.x):
 * import { BrainyAugmentation } from '@soulcraft/brainy'
 */
export type IPerceptionAugmentation = BrainyAugmentation

/**
 * @deprecated Use BrainyAugmentation from '../augmentations/brainyAugmentation.js' instead
 *
 * @example
 * // ❌ Old way (v2.x):
 * import { IDialogAugmentation } from '@soulcraft/brainy/types/augmentations'
 *
 * // ✅ New way (v3.x):
 * import { BrainyAugmentation } from '@soulcraft/brainy'
 */
export type IDialogAugmentation = BrainyAugmentation

/**
 * @deprecated Use BrainyAugmentation from '../augmentations/brainyAugmentation.js' instead
 *
 * @example
 * // ❌ Old way (v2.x):
 * import { IActivationAugmentation } from '@soulcraft/brainy/types/augmentations'
 *
 * // ✅ New way (v3.x):
 * import { BrainyAugmentation } from '@soulcraft/brainy'
 */
export type IActivationAugmentation = BrainyAugmentation

/**
 * @deprecated Use BrainyAugmentation from '../augmentations/brainyAugmentation.js' instead
 *
 * @example
 * // ❌ Old way (v2.x):
 * import { ISynapseAugmentation } from '@soulcraft/brainy/types/augmentations'
 *
 * // ✅ New way (v3.x):
 * import { BrainyAugmentation } from '@soulcraft/brainy'
 */
export type ISynapseAugmentation = BrainyAugmentation

/**
 * @deprecated WebSocket support is now built into BrainyAugmentation interface
 *
 * @example
 * // ❌ Old way (v2.x):
 * import { IWebSocketSupport } from '@soulcraft/brainy/types/augmentations'
 * class MyAugmentation implements IWebSocketSupport { ... }
 *
 * // ✅ New way (v3.x):
 * import { BrainyAugmentation } from '@soulcraft/brainy'
 * class MyAugmentation implements BrainyAugmentation {
 *   // WebSocket functionality is now part of the unified interface
 * }
 */
export interface IWebSocketSupport {}