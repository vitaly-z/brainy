/**
 * Universal Events implementation
 * Browser: Uses EventTarget API
 * Node.js: Uses built-in events module
 */
/**
 * Universal EventEmitter interface
 */
export interface UniversalEventEmitter {
    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    once(event: string, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string): this;
    listenerCount(event: string): number;
}
/**
 * Universal EventEmitter class
 */
export declare class EventEmitter implements UniversalEventEmitter {
    private emitter;
    constructor();
    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    once(event: string, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string): this;
    listenerCount(event: string): number;
}
export { EventEmitter as default };
export declare const NodeEventEmitterClass: any;
