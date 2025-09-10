/**
 * Universal Crypto implementation
 * Works in all environments: Browser, Node.js, Serverless
 */
/**
 * Generate random bytes
 */
export declare function randomBytes(size: number): Uint8Array;
/**
 * Generate random UUID
 */
export declare function randomUUID(): string;
/**
 * Create hash (simplified interface)
 */
export declare function createHash(algorithm: string): {
    update: (data: string | Uint8Array) => any;
    digest: (encoding: string) => string;
};
/**
 * Create HMAC
 */
export declare function createHmac(algorithm: string, key: string | Uint8Array): {
    update: (data: string | Uint8Array) => any;
    digest: (encoding: string) => string;
};
/**
 * PBKDF2 synchronous
 */
export declare function pbkdf2Sync(password: string | Uint8Array, salt: string | Uint8Array, iterations: number, keylen: number, digest: string): Uint8Array;
/**
 * Scrypt synchronous
 */
export declare function scryptSync(password: string | Uint8Array, salt: string | Uint8Array, keylen: number, options?: any): Uint8Array;
/**
 * Create cipher
 */
export declare function createCipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array): {
    update: (data: string, inputEncoding?: string, outputEncoding?: string) => string;
    final: (outputEncoding?: string) => string;
};
/**
 * Create decipher
 */
export declare function createDecipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array): {
    update: (data: string, inputEncoding?: string, outputEncoding?: string) => string;
    final: (outputEncoding?: string) => string;
};
/**
 * Timing safe equal
 */
export declare function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
declare const _default: {
    randomBytes: typeof randomBytes;
    randomUUID: typeof randomUUID;
    createHash: typeof createHash;
    createHmac: typeof createHmac;
    pbkdf2Sync: typeof pbkdf2Sync;
    scryptSync: typeof scryptSync;
    createCipheriv: typeof createCipheriv;
    createDecipheriv: typeof createDecipheriv;
    timingSafeEqual: typeof timingSafeEqual;
};
export default _default;
