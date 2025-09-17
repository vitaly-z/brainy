/**
 * Universal Path implementation
 * Framework-friendly: Trusts that frameworks provide path polyfills
 * Works in all environments: Browser (via framework), Node.js, Serverless
 */

import { isNode } from '../utils/environment.js'

let nodePath: any = null

// Dynamic import for Node.js path (only in Node.js environment)
if (isNode()) {
  try {
    // Use node: protocol to prevent bundler polyfilling (requires Node 22+)
    nodePath = await import('node:path')
  } catch {
    // Ignore import errors in non-Node environments
  }
}

/**
 * Universal path operations
 * Framework-friendly: Assumes path API is available via framework polyfills
 */
export function join(...paths: string[]): string {
  if (nodePath) {
    return nodePath.join(...paths)
  } else {
    throw new Error('Path operations not available. Framework bundlers should provide path polyfills.')
  }
}

export function dirname(path: string): string {
  if (nodePath) {
    return nodePath.dirname(path)
  } else {
    throw new Error('Path operations not available. Framework bundlers should provide path polyfills.')
  }
}

export function basename(path: string, ext?: string): string {
  if (nodePath) {
    return nodePath.basename(path, ext)
  } else {
    throw new Error('Path operations not available. Framework bundlers should provide path polyfills.')
  }
}

export function extname(path: string): string {
  if (nodePath) {
    return nodePath.extname(path)
  } else {
    throw new Error('Path operations not available. Framework bundlers should provide path polyfills.')
  }
}

export function resolve(...paths: string[]): string {
  if (nodePath) {
    return nodePath.resolve(...paths)
  } else {
    throw new Error('Path operations not available. Framework bundlers should provide path polyfills.')
  }
}

export function relative(from: string, to: string): string {
  if (nodePath) {
    return nodePath.relative(from, to)
  } else {
    throw new Error('Path operations not available. Framework bundlers should provide path polyfills.')
  }
}

export function isAbsolute(path: string): boolean {
  if (nodePath) {
    return nodePath.isAbsolute(path)
  } else {
    throw new Error('Path operations not available. Framework bundlers should provide path polyfills.')
  }
}

// Path separator (always use forward slash for consistency)
export const sep = '/'
export const delimiter = ':'

// POSIX path object for compatibility
export const posix = {
  join,
  dirname,
  basename,
  extname,
  resolve,
  relative,
  isAbsolute,
  sep: '/',
  delimiter: ':'
}

// Default export
export default {
  join,
  dirname,
  basename,
  extname,
  resolve,
  relative,
  isAbsolute,
  sep,
  delimiter,
  posix
}