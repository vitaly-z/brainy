/**
 * Universal adapters for cross-environment compatibility
 * Provides consistent APIs across Browser, Node.js, and Serverless environments
 */
export * from './uuid.js';
export { default as uuid } from './uuid.js';
export * from './crypto.js';
export { default as crypto } from './crypto.js';
export * from './fs.js';
export { default as fs } from './fs.js';
export * from './path.js';
export { default as path } from './path.js';
export * from './events.js';
export { default as events } from './events.js';
export { v4 as uuidv4 } from './uuid.js';
export { EventEmitter } from './events.js';
