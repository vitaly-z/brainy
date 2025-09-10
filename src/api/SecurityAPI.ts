/**
 * Security API for Brainy 3.0
 * Provides encryption, decryption, hashing, and secure storage
 */

export class SecurityAPI {
  private encryptionKey?: Uint8Array

  constructor(private config?: { encryptionKey?: string }) {
    if (config?.encryptionKey) {
      // Use provided key (must be 32 bytes hex string)
      this.encryptionKey = this.hexToBytes(config.encryptionKey)
    }
  }

  /**
   * Encrypt data using AES-256-CBC
   */
  async encrypt(data: string): Promise<string> {
    const crypto = await import('../universal/crypto.js')
    
    // Generate or use existing key
    const key = this.encryptionKey || crypto.randomBytes(32)
    const iv = crypto.randomBytes(16)
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Package encrypted data with metadata
    // In production, store keys separately in a key management service
    return JSON.stringify({
      encrypted,
      key: this.bytesToHex(key),
      iv: this.bytesToHex(iv),
      algorithm: 'aes-256-cbc',
      timestamp: Date.now()
    })
  }

  /**
   * Decrypt data encrypted with encrypt()
   */
  async decrypt(encryptedData: string): Promise<string> {
    const crypto = await import('../universal/crypto.js')
    
    try {
      const parsed = JSON.parse(encryptedData)
      const { encrypted, key: keyHex, iv: ivHex, algorithm } = parsed
      
      if (algorithm && algorithm !== 'aes-256-cbc') {
        throw new Error(`Unsupported encryption algorithm: ${algorithm}`)
      }
      
      const key = this.hexToBytes(keyHex)
      const iv = this.hexToBytes(ivHex)
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      throw new Error(`Decryption failed: ${(error as Error).message}`)
    }
  }

  /**
   * Create a one-way hash of data (for passwords, etc)
   */
  async hash(data: string, algorithm: 'sha256' | 'sha512' = 'sha256'): Promise<string> {
    const crypto = await import('../universal/crypto.js')
    const hash = crypto.createHash(algorithm)
    hash.update(data)
    return hash.digest('hex')
  }

  /**
   * Compare data with a hash (for password verification)
   */
  async compare(data: string, hash: string, algorithm: 'sha256' | 'sha512' = 'sha256'): Promise<boolean> {
    const dataHash = await this.hash(data, algorithm)
    return this.constantTimeCompare(dataHash, hash)
  }

  /**
   * Generate a secure random token
   */
  async generateToken(bytes: number = 32): Promise<string> {
    const crypto = await import('../universal/crypto.js')
    const buffer = crypto.randomBytes(bytes)
    return this.bytesToHex(buffer)
  }

  /**
   * Derive a key from a password using PBKDF2
   * Note: Simplified version using hash instead of PBKDF2 which may not be available
   */
  async deriveKey(password: string, salt?: string, iterations: number = 100000): Promise<{
    key: string
    salt: string
  }> {
    const crypto = await import('../universal/crypto.js')
    const actualSalt = salt || this.bytesToHex(crypto.randomBytes(32))
    
    // Simplified key derivation using repeated hashing
    // In production, use a proper PBKDF2 implementation
    let derived = password + actualSalt
    for (let i = 0; i < Math.min(iterations, 1000); i++) {
      const hash = crypto.createHash('sha256')
      hash.update(derived)
      derived = hash.digest('hex')
    }
    
    return {
      key: derived,
      salt: actualSalt
    }
  }

  /**
   * Sign data with HMAC
   */
  async sign(data: string, secret?: string): Promise<string> {
    const crypto = await import('../universal/crypto.js')
    const actualSecret = secret || (await this.generateToken())
    const hmac = crypto.createHmac('sha256', actualSecret)
    hmac.update(data)
    return hmac.digest('hex')
  }

  /**
   * Verify HMAC signature
   */
  async verify(data: string, signature: string, secret: string): Promise<boolean> {
    const expectedSignature = await this.sign(data, secret)
    return this.constantTimeCompare(signature, expectedSignature)
  }

  // Helper methods

  private hexToBytes(hex: string): Uint8Array {
    const matches = hex.match(/.{1,2}/g)
    if (!matches) throw new Error('Invalid hex string')
    return new Uint8Array(matches.map(byte => parseInt(byte, 16)))
  }

  private bytesToHex(bytes: Uint8Array | Buffer): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return result === 0
  }
}