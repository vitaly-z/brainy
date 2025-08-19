/**
 * Universal Events implementation
 * Browser: Uses EventTarget API
 * Node.js: Uses built-in events module
 */
import { isBrowser, isNode } from '../utils/environment.js';
let nodeEvents = null;
// Dynamic import for Node.js events (only in Node.js environment)
if (isNode()) {
    try {
        nodeEvents = await import('events');
    }
    catch {
        // Ignore import errors in non-Node environments
    }
}
/**
 * Browser implementation using EventTarget
 */
class BrowserEventEmitter extends EventTarget {
    constructor() {
        super(...arguments);
        this.listeners = new Map();
    }
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(listener);
        const handler = (e) => {
            const customEvent = e;
            listener(...(customEvent.detail || []));
        };
        listener.__handler = handler;
        this.addEventListener(event, handler);
        return this;
    }
    off(event, listener) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.delete(listener);
            const handler = listener.__handler;
            if (handler) {
                this.removeEventListener(event, handler);
                delete listener.__handler;
            }
        }
        return this;
    }
    emit(event, ...args) {
        const customEvent = new CustomEvent(event, { detail: args });
        this.dispatchEvent(customEvent);
        const eventListeners = this.listeners.get(event);
        return eventListeners ? eventListeners.size > 0 : false;
    }
    once(event, listener) {
        const onceListener = (...args) => {
            this.off(event, onceListener);
            listener(...args);
        };
        return this.on(event, onceListener);
    }
    removeAllListeners(event) {
        if (event) {
            const eventListeners = this.listeners.get(event);
            if (eventListeners) {
                for (const listener of eventListeners) {
                    this.off(event, listener);
                }
            }
        }
        else {
            for (const [eventName] of this.listeners) {
                this.removeAllListeners(eventName);
            }
        }
        return this;
    }
    listenerCount(event) {
        const eventListeners = this.listeners.get(event);
        return eventListeners ? eventListeners.size : 0;
    }
}
/**
 * Node.js implementation using events.EventEmitter
 */
class NodeEventEmitter {
    constructor() {
        this.emitter = new nodeEvents.EventEmitter();
    }
    on(event, listener) {
        this.emitter.on(event, listener);
        return this;
    }
    off(event, listener) {
        this.emitter.off(event, listener);
        return this;
    }
    emit(event, ...args) {
        return this.emitter.emit(event, ...args);
    }
    once(event, listener) {
        this.emitter.once(event, listener);
        return this;
    }
    removeAllListeners(event) {
        this.emitter.removeAllListeners(event);
        return this;
    }
    listenerCount(event) {
        return this.emitter.listenerCount(event);
    }
}
/**
 * Universal EventEmitter class
 */
export class EventEmitter {
    constructor() {
        if (isBrowser()) {
            this.emitter = new BrowserEventEmitter();
        }
        else if (isNode() && nodeEvents) {
            this.emitter = new NodeEventEmitter();
        }
        else {
            this.emitter = new BrowserEventEmitter();
        }
    }
    on(event, listener) {
        this.emitter.on(event, listener);
        return this;
    }
    off(event, listener) {
        this.emitter.off(event, listener);
        return this;
    }
    emit(event, ...args) {
        return this.emitter.emit(event, ...args);
    }
    once(event, listener) {
        this.emitter.once(event, listener);
        return this;
    }
    removeAllListeners(event) {
        this.emitter.removeAllListeners(event);
        return this;
    }
    listenerCount(event) {
        return this.emitter.listenerCount(event);
    }
}
// Named export for compatibility
export { EventEmitter as default };
// Re-export Node.js EventEmitter class if available
export const NodeEventEmitterClass = nodeEvents?.EventEmitter || null;
//# sourceMappingURL=events.js.map