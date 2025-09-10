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
    connectionId: string;
    url: string;
    status: 'connected' | 'disconnected' | 'error';
    send?: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => Promise<void>;
    close?: () => Promise<void>;
    _streamMessageHandler?: (event: {
        data: unknown;
    }) => void;
    _messageHandlerWrapper?: (data: unknown) => void;
};
/**
 * Generic augmentation response type
 */
export type AugmentationResponse<T> = {
    success: boolean;
    data: T;
    error?: string;
};
/**
 * Data callback type for subscriptions
 */
export type DataCallback<T> = (data: T) => void;
/**
 * Import types for re-export (avoiding circular dependencies)
 */
import type { BrainyAugmentation as BA, BaseAugmentation as BaseA, AugmentationContext as AC } from '../augmentations/brainyAugmentation.js';
export type BrainyAugmentation = BA;
export type BaseAugmentation = BaseA;
export type AugmentationContext = AC;
export type IAugmentation = BrainyAugmentation;
export declare enum AugmentationType {
    SENSE = "sense",
    CONDUIT = "conduit",
    COGNITION = "cognition",
    MEMORY = "memory",
    PERCEPTION = "perception",
    DIALOG = "dialog",
    ACTIVATION = "activation",
    WEBSOCKET = "webSocket",
    SYNAPSE = "synapse"
}
export declare namespace BrainyAugmentations {
    type ISenseAugmentation = BrainyAugmentation;
    type IConduitAugmentation = BrainyAugmentation;
    type ICognitionAugmentation = BrainyAugmentation;
    type IMemoryAugmentation = BrainyAugmentation;
    type IPerceptionAugmentation = BrainyAugmentation;
    type IDialogAugmentation = BrainyAugmentation;
    type IActivationAugmentation = BrainyAugmentation;
    type ISynapseAugmentation = BrainyAugmentation;
}
export type ISenseAugmentation = BrainyAugmentation;
export type IConduitAugmentation = BrainyAugmentation;
export type ICognitionAugmentation = BrainyAugmentation;
export type IMemoryAugmentation = BrainyAugmentation;
export type IPerceptionAugmentation = BrainyAugmentation;
export type IDialogAugmentation = BrainyAugmentation;
export type IActivationAugmentation = BrainyAugmentation;
export type ISynapseAugmentation = BrainyAugmentation;
export interface IWebSocketSupport {
}
