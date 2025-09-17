/**
 * Universal Events implementation
 * Framework-friendly: Trusts that frameworks provide events polyfills
 * Works in all environments: Browser (via framework), Node.js, Serverless
 */

import { isNode } from '../utils/environment.js'

let nodeEvents: any = null

// Dynamic import for Node.js events (only in Node.js environment)
if (isNode()) {
  try {
    nodeEvents = await import('node:events')
  } catch {
    // Ignore import errors in non-Node environments
  }
}

/**
 * Universal EventEmitter interface
 */
export interface UniversalEventEmitter {
  on(event: string, listener: (...args: any[]) => void): this
  off(event: string, listener: (...args: any[]) => void): this
  emit(event: string, ...args: any[]): boolean
  once(event: string, listener: (...args: any[]) => void): this
  removeAllListeners(event?: string): this
  listenerCount(event: string): number
}

/**
 * Node.js implementation using events.EventEmitter
 */
class NodeEventEmitter implements UniversalEventEmitter {
  private emitter: any

  constructor() {
    this.emitter = new nodeEvents.EventEmitter()
  }

  on(event: string, listener: (...args: any[]) => void): this {
    this.emitter.on(event, listener)
    return this
  }

  off(event: string, listener: (...args: any[]) => void): this {
    this.emitter.off(event, listener)
    return this
  }

  emit(event: string, ...args: any[]): boolean {
    return this.emitter.emit(event, ...args)
  }

  once(event: string, listener: (...args: any[]) => void): this {
    this.emitter.once(event, listener)
    return this
  }

  removeAllListeners(event?: string): this {
    this.emitter.removeAllListeners(event)
    return this
  }

  listenerCount(event: string): number {
    return this.emitter.listenerCount(event)
  }
}

/**
 * Universal EventEmitter class
 * Framework-friendly: Assumes events API is available via framework polyfills
 */
export class EventEmitter implements UniversalEventEmitter {
  private emitter: UniversalEventEmitter

  constructor() {
    if (isNode() && nodeEvents) {
      this.emitter = new NodeEventEmitter()
    } else {
      throw new Error('Events operations not available. Framework bundlers should provide events polyfills.')
    }
  }

  on(event: string, listener: (...args: any[]) => void): this {
    this.emitter.on(event, listener)
    return this
  }

  off(event: string, listener: (...args: any[]) => void): this {
    this.emitter.off(event, listener)
    return this
  }

  emit(event: string, ...args: any[]): boolean {
    return this.emitter.emit(event, ...args)
  }

  once(event: string, listener: (...args: any[]) => void): this {
    this.emitter.once(event, listener)
    return this
  }

  removeAllListeners(event?: string): this {
    this.emitter.removeAllListeners(event)
    return this
  }

  listenerCount(event: string): number {
    return this.emitter.listenerCount(event)
  }
}

// Named export for compatibility
export { EventEmitter as default }

// Re-export Node.js EventEmitter class if available
export const NodeEventEmitterClass = nodeEvents?.EventEmitter || null