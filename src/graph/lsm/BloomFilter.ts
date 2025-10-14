/**
 * BloomFilter - Probabilistic data structure for membership testing
 *
 * Production-grade implementation with MurmurHash3 for:
 * - 90-95% reduction in disk reads for LSM-tree
 * - Configurable false positive rate
 * - Efficient serialization for storage
 *
 * Used by LSM-tree to quickly determine if a key might be in an SSTable
 * before performing expensive disk I/O and binary search.
 */

/**
 * MurmurHash3 implementation (32-bit)
 * Industry-standard non-cryptographic hash function
 * Fast, good distribution, low collision rate
 */
export class MurmurHash3 {
  /**
   * Hash a string to a 32-bit unsigned integer
   * @param key The string to hash
   * @param seed The seed value (for multiple hash functions)
   * @returns 32-bit hash value
   */
  static hash(key: string, seed: number = 0): number {
    const data = Buffer.from(key, 'utf-8')
    const len = data.length
    const c1 = 0xcc9e2d51
    const c2 = 0x1b873593
    const r1 = 15
    const r2 = 13
    const m = 5
    const n = 0xe6546b64

    let h = seed
    const blocks = Math.floor(len / 4)

    // Process 4-byte blocks
    for (let i = 0; i < blocks; i++) {
      let k =
        (data[i * 4] & 0xff) |
        ((data[i * 4 + 1] & 0xff) << 8) |
        ((data[i * 4 + 2] & 0xff) << 16) |
        ((data[i * 4 + 3] & 0xff) << 24)

      k = this.imul(k, c1)
      k = (k << r1) | (k >>> (32 - r1))
      k = this.imul(k, c2)

      h ^= k
      h = (h << r2) | (h >>> (32 - r2))
      h = this.imul(h, m) + n
    }

    // Process remaining bytes
    const remaining = len % 4
    let k1 = 0

    if (remaining === 3) {
      k1 ^= (data[blocks * 4 + 2] & 0xff) << 16
    }
    if (remaining >= 2) {
      k1 ^= (data[blocks * 4 + 1] & 0xff) << 8
    }
    if (remaining >= 1) {
      k1 ^= data[blocks * 4] & 0xff
      k1 = this.imul(k1, c1)
      k1 = (k1 << r1) | (k1 >>> (32 - r1))
      k1 = this.imul(k1, c2)
      h ^= k1
    }

    // Finalization
    h ^= len
    h ^= h >>> 16
    h = this.imul(h, 0x85ebca6b)
    h ^= h >>> 13
    h = this.imul(h, 0xc2b2ae35)
    h ^= h >>> 16

    // Convert to unsigned 32-bit integer
    return h >>> 0
  }

  /**
   * 32-bit signed integer multiplication
   * JavaScript's Math.imul or manual implementation for older environments
   */
  private static imul(a: number, b: number): number {
    if (typeof Math.imul === 'function') {
      return Math.imul(a, b)
    }

    // Fallback implementation
    const ah = (a >>> 16) & 0xffff
    const al = a & 0xffff
    const bh = (b >>> 16) & 0xffff
    const bl = b & 0xffff

    return (al * bl + (((ah * bl + al * bh) << 16) >>> 0)) | 0
  }

  /**
   * Generate k independent hash values for a key
   * Uses double hashing: hash_i(x) = hash1(x) + i * hash2(x)
   *
   * @param key The string to hash
   * @param k Number of hash functions
   * @param m Size of the bit array
   * @returns Array of k hash positions
   */
  static hashMultiple(key: string, k: number, m: number): number[] {
    const hash1 = this.hash(key, 0)
    const hash2 = this.hash(key, hash1)

    const positions: number[] = []
    for (let i = 0; i < k; i++) {
      // Double hashing to generate k different positions
      const hash = (hash1 + i * hash2) >>> 0
      positions.push(hash % m)
    }

    return positions
  }
}

/**
 * BloomFilter configuration
 */
export interface BloomFilterConfig {
  /**
   * Expected number of elements
   * Used to calculate optimal bit array size
   */
  expectedElements: number

  /**
   * Target false positive rate (0-1)
   * Default: 0.01 (1%)
   * Lower = more memory, fewer false positives
   */
  falsePositiveRate?: number

  /**
   * Manual bit array size (overrides calculation)
   */
  size?: number

  /**
   * Manual number of hash functions (overrides calculation)
   */
  numHashFunctions?: number
}

/**
 * Serialized bloom filter format
 */
export interface SerializedBloomFilter {
  /**
   * Bit array as Uint8Array
   */
  bits: Uint8Array

  /**
   * Size of bit array in bits
   */
  size: number

  /**
   * Number of hash functions
   */
  numHashFunctions: number

  /**
   * Number of elements added
   */
  count: number

  /**
   * Expected false positive rate
   */
  falsePositiveRate: number
}

/**
 * BloomFilter - Space-efficient probabilistic set membership testing
 *
 * Key Properties:
 * - False positives possible (controllable rate)
 * - False negatives impossible (100% accurate for "not in set")
 * - Space efficient: ~10 bits per element for 1% FP rate
 * - Fast: O(k) where k is number of hash functions (~7 for 1% FP)
 *
 * Use Case: LSM-tree SSTable filtering
 * - Before reading SSTable from disk, check bloom filter
 * - If filter says "not present" → skip SSTable (100% accurate)
 * - If filter says "maybe present" → read SSTable (1% false positive)
 * - Result: 90-95% reduction in disk I/O
 */
export class BloomFilter {
  /**
   * Bit array stored as Uint8Array for memory efficiency
   */
  private bits: Uint8Array

  /**
   * Size of bit array in bits
   */
  private size: number

  /**
   * Number of hash functions to use
   */
  private numHashFunctions: number

  /**
   * Number of elements added to filter
   */
  private count: number

  /**
   * Target false positive rate
   */
  private falsePositiveRate: number

  constructor(config: BloomFilterConfig) {
    const fpr = config.falsePositiveRate ?? 0.01

    // Calculate optimal bit array size
    // m = -(n * ln(p)) / (ln(2)^2)
    // where n = expected elements, p = false positive rate
    const optimalSize =
      config.size ??
      Math.ceil(
        (-config.expectedElements * Math.log(fpr)) / (Math.LN2 * Math.LN2)
      )

    // Calculate optimal number of hash functions
    // k = (m / n) * ln(2)
    const optimalHashFunctions =
      config.numHashFunctions ??
      Math.ceil((optimalSize / config.expectedElements) * Math.LN2)

    this.size = optimalSize
    this.numHashFunctions = Math.max(1, optimalHashFunctions)
    this.falsePositiveRate = fpr
    this.count = 0

    // Allocate bit array (8 bits per byte)
    const numBytes = Math.ceil(this.size / 8)
    this.bits = new Uint8Array(numBytes)
  }

  /**
   * Add an element to the bloom filter
   * @param key The element to add
   */
  add(key: string): void {
    const positions = MurmurHash3.hashMultiple(
      key,
      this.numHashFunctions,
      this.size
    )

    for (const pos of positions) {
      this.setBit(pos)
    }

    this.count++
  }

  /**
   * Check if an element might be in the set
   * @param key The element to check
   * @returns true if element might be present (with FP rate), false if definitely not present
   */
  contains(key: string): boolean {
    const positions = MurmurHash3.hashMultiple(
      key,
      this.numHashFunctions,
      this.size
    )

    for (const pos of positions) {
      if (!this.getBit(pos)) {
        // If any bit is not set, element is definitely not in the set
        return false
      }
    }

    // All bits are set, element might be in the set
    return true
  }

  /**
   * Set a bit at the given position
   * @param pos Bit position
   */
  private setBit(pos: number): void {
    const byteIndex = Math.floor(pos / 8)
    const bitIndex = pos % 8
    this.bits[byteIndex] |= 1 << bitIndex
  }

  /**
   * Get a bit at the given position
   * @param pos Bit position
   * @returns true if bit is set, false otherwise
   */
  private getBit(pos: number): boolean {
    const byteIndex = Math.floor(pos / 8)
    const bitIndex = pos % 8
    return (this.bits[byteIndex] & (1 << bitIndex)) !== 0
  }

  /**
   * Get the current actual false positive rate based on number of elements added
   * @returns Estimated false positive rate
   */
  getActualFalsePositiveRate(): number {
    if (this.count === 0) {
      return 0
    }

    // p = (1 - e^(-k*n/m))^k
    // where k = num hash functions, n = elements added, m = bit array size
    const exponent =
      (-this.numHashFunctions * this.count) / this.size
    const base = 1 - Math.exp(exponent)
    return Math.pow(base, this.numHashFunctions)
  }

  /**
   * Get statistics about the bloom filter
   */
  getStats(): {
    size: number
    numHashFunctions: number
    count: number
    targetFalsePositiveRate: number
    actualFalsePositiveRate: number
    memoryBytes: number
    fillRatio: number
  } {
    // Calculate fill ratio (how many bits are set)
    let bitsSet = 0
    for (let i = 0; i < this.bits.length; i++) {
      // Count set bits in each byte
      let byte = this.bits[i]
      while (byte > 0) {
        bitsSet += byte & 1
        byte >>= 1
      }
    }

    return {
      size: this.size,
      numHashFunctions: this.numHashFunctions,
      count: this.count,
      targetFalsePositiveRate: this.falsePositiveRate,
      actualFalsePositiveRate: this.getActualFalsePositiveRate(),
      memoryBytes: this.bits.length,
      fillRatio: bitsSet / this.size
    }
  }

  /**
   * Clear all bits in the filter
   */
  clear(): void {
    this.bits.fill(0)
    this.count = 0
  }

  /**
   * Serialize bloom filter for storage
   * @returns Serialized representation
   */
  serialize(): SerializedBloomFilter {
    return {
      bits: this.bits,
      size: this.size,
      numHashFunctions: this.numHashFunctions,
      count: this.count,
      falsePositiveRate: this.falsePositiveRate
    }
  }

  /**
   * Deserialize bloom filter from storage
   * @param data Serialized bloom filter
   * @returns BloomFilter instance
   */
  static deserialize(data: SerializedBloomFilter): BloomFilter {
    const filter = new BloomFilter({
      expectedElements: data.count || 1,
      falsePositiveRate: data.falsePositiveRate,
      size: data.size,
      numHashFunctions: data.numHashFunctions
    })

    filter.bits = new Uint8Array(data.bits)
    filter.count = data.count

    return filter
  }

  /**
   * Create an optimal bloom filter for a given number of elements
   * @param expectedElements Number of elements expected
   * @param falsePositiveRate Target false positive rate (default 1%)
   * @returns Configured BloomFilter
   */
  static createOptimal(
    expectedElements: number,
    falsePositiveRate: number = 0.01
  ): BloomFilter {
    return new BloomFilter({
      expectedElements,
      falsePositiveRate
    })
  }
}
