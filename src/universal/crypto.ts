/**
 * Universal Crypto implementation
 * Framework-friendly: Trusts that frameworks provide crypto polyfills
 * Works in all environments: Browser (via framework), Node.js, Serverless
 */

import { isNode } from '../utils/environment.js'

let nodeCrypto: any = null

// Dynamic import for Node.js crypto (only in Node.js environment)
if (isNode()) {
  try {
    // Use node: protocol to prevent bundler polyfilling (requires Node 22+)
    nodeCrypto = await import('node:crypto')
  } catch {
    // Ignore import errors in non-Node environments
  }
}

/**
 * Generate random bytes
 * Framework-friendly: Assumes crypto API is available via framework polyfills
 */
export function randomBytes(size: number): Uint8Array {
  if (typeof crypto !== 'undefined') {
    // Use Web Crypto API (available in browsers via framework polyfills and modern Node.js)
    const array = new Uint8Array(size)
    crypto.getRandomValues(array)
    return array
  } else if (nodeCrypto) {
    // Use Node.js crypto
    return new Uint8Array(nodeCrypto.randomBytes(size))
  } else {
    throw new Error('Crypto API not available. Framework bundlers should provide crypto polyfills.')
  }
}

/**
 * Generate random UUID
 * Framework-friendly: Assumes crypto.randomUUID is available via framework polyfills
 */
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  } else if (nodeCrypto && nodeCrypto.randomUUID) {
    return nodeCrypto.randomUUID()
  } else {
    throw new Error('crypto.randomUUID not available. Framework bundlers should provide crypto polyfills.')
  }
}

/**
 * Create hash (simplified interface)
 * Framework-friendly: Relies on Node.js crypto or framework-provided implementations
 */
export function createHash(algorithm: string): {
  update: (data: string | Uint8Array) => any
  digest: (encoding: string) => string
} {
  if (nodeCrypto && nodeCrypto.createHash) {
    return nodeCrypto.createHash(algorithm)
  } else {
    throw new Error(`createHash not available. For browser environments, frameworks should provide crypto polyfills or use Web Crypto API directly.`)
  }
}

/**
 * Create HMAC
 * Framework-friendly: Relies on Node.js crypto or framework-provided implementations
 */
export function createHmac(algorithm: string, key: string | Uint8Array): {
  update: (data: string | Uint8Array) => any
  digest: (encoding: string) => string
} {
  if (nodeCrypto && nodeCrypto.createHmac) {
    return nodeCrypto.createHmac(algorithm, key)
  } else {
    throw new Error(`createHmac not available. For browser environments, frameworks should provide crypto polyfills or use Web Crypto API directly.`)
  }
}

/**
 * PBKDF2 synchronous
 * Framework-friendly: Relies on Node.js crypto or framework-provided implementations
 */
export function pbkdf2Sync(password: string | Uint8Array, salt: string | Uint8Array, iterations: number, keylen: number, digest: string): Uint8Array {
  if (nodeCrypto && nodeCrypto.pbkdf2Sync) {
    return new Uint8Array(nodeCrypto.pbkdf2Sync(password, salt, iterations, keylen, digest))
  } else {
    throw new Error(`pbkdf2Sync not available. For browser environments, frameworks should provide crypto polyfills or use Web Crypto API directly.`)
  }
}

/**
 * Scrypt synchronous
 * Framework-friendly: Relies on Node.js crypto or framework-provided implementations
 */
export function scryptSync(password: string | Uint8Array, salt: string | Uint8Array, keylen: number, options?: any): Uint8Array {
  if (nodeCrypto && nodeCrypto.scryptSync) {
    return new Uint8Array(nodeCrypto.scryptSync(password, salt, keylen, options))
  } else {
    throw new Error(`scryptSync not available. For browser environments, frameworks should provide crypto polyfills or use Web Crypto API directly.`)
  }
}

/**
 * Create cipher
 * Framework-friendly: Relies on Node.js crypto or framework-provided implementations
 */
export function createCipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array): {
  update: (data: string, inputEncoding?: string, outputEncoding?: string) => string
  final: (outputEncoding?: string) => string
} {
  if (nodeCrypto && nodeCrypto.createCipheriv) {
    return nodeCrypto.createCipheriv(algorithm, key, iv)
  } else {
    throw new Error(`createCipheriv not available. For browser environments, frameworks should provide crypto polyfills or use Web Crypto API directly.`)
  }
}

/**
 * Create decipher
 * Framework-friendly: Relies on Node.js crypto or framework-provided implementations
 */
export function createDecipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array): {
  update: (data: string, inputEncoding?: string, outputEncoding?: string) => string
  final: (outputEncoding?: string) => string
} {
  if (nodeCrypto && nodeCrypto.createDecipheriv) {
    return nodeCrypto.createDecipheriv(algorithm, key, iv)
  } else {
    throw new Error(`createDecipheriv not available. For browser environments, frameworks should provide crypto polyfills or use Web Crypto API directly.`)
  }
}

/**
 * Timing safe equal
 * Framework-friendly: Relies on Node.js crypto or framework-provided implementations
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (nodeCrypto && nodeCrypto.timingSafeEqual) {
    return nodeCrypto.timingSafeEqual(a, b)
  } else {
    throw new Error(`timingSafeEqual not available. For browser environments, frameworks should provide crypto polyfills or use Web Crypto API directly.`)
  }
}

export default {
  randomBytes,
  randomUUID, 
  createHash,
  createHmac,
  pbkdf2Sync,
  scryptSync,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual
}