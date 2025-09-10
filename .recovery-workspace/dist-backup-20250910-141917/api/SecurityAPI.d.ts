/**
 * Security API for Brainy 3.0
 * Provides encryption, decryption, hashing, and secure storage
 */
export declare class SecurityAPI {
    private config?;
    private encryptionKey?;
    constructor(config?: {
        encryptionKey?: string;
    } | undefined);
    /**
     * Encrypt data using AES-256-CBC
     */
    encrypt(data: string): Promise<string>;
    /**
     * Decrypt data encrypted with encrypt()
     */
    decrypt(encryptedData: string): Promise<string>;
    /**
     * Create a one-way hash of data (for passwords, etc)
     */
    hash(data: string, algorithm?: 'sha256' | 'sha512'): Promise<string>;
    /**
     * Compare data with a hash (for password verification)
     */
    compare(data: string, hash: string, algorithm?: 'sha256' | 'sha512'): Promise<boolean>;
    /**
     * Generate a secure random token
     */
    generateToken(bytes?: number): Promise<string>;
    /**
     * Derive a key from a password using PBKDF2
     * Note: Simplified version using hash instead of PBKDF2 which may not be available
     */
    deriveKey(password: string, salt?: string, iterations?: number): Promise<{
        key: string;
        salt: string;
    }>;
    /**
     * Sign data with HMAC
     */
    sign(data: string, secret?: string): Promise<string>;
    /**
     * Verify HMAC signature
     */
    verify(data: string, signature: string, secret: string): Promise<boolean>;
    private hexToBytes;
    private bytesToHex;
    private constantTimeCompare;
}
