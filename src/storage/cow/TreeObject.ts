/**
 * TreeObject: Directory structure for COW (Copy-on-Write)
 *
 * Similar to Git trees, represents the structure of a Brainy instance at a point in time.
 * Trees contain entries mapping names to blob hashes.
 *
 * Structure:
 * - entities/ → tree hash (entity blobs)
 * - indexes/nouns → blob hash (HNSW noun index)
 * - indexes/metadata → blob hash (metadata index)
 * - indexes/graph → blob hash (graph adjacency index)
 * - indexes/deleted → blob hash (deleted items index)
 *
 * @module storage/cow/TreeObject
 */

import { BlobStorage } from './BlobStorage.js'

/**
 * Tree entry: name → blob hash mapping
 */
export interface TreeEntry {
  name: string
  hash: string
  type: 'blob' | 'tree'  // blob = leaf, tree = subtree
  size: number           // Original size (uncompressed)
}

/**
 * Tree object structure
 */
export interface TreeObject {
  entries: TreeEntry[]
  createdAt: number
}

/**
 * TreeBuilder: Fluent API for building tree objects
 *
 * Example:
 * ```typescript
 * const tree = await TreeBuilder.create(blobStorage)
 *   .addBlob('entities/abc123', entityHash, size)
 *   .addBlob('indexes/nouns', nounsHash, size)
 *   .build()
 * ```
 */
export class TreeBuilder {
  private entries: TreeEntry[] = []
  private blobStorage: BlobStorage

  constructor(blobStorage: BlobStorage) {
    this.blobStorage = blobStorage
  }

  static create(blobStorage: BlobStorage): TreeBuilder {
    return new TreeBuilder(blobStorage)
  }

  /**
   * Add a blob entry to the tree
   *
   * @param name - Entry name (e.g., 'entities/abc123')
   * @param hash - Blob hash
   * @param size - Original blob size
   */
  addBlob(name: string, hash: string, size: number): this {
    this.entries.push({
      name,
      hash,
      type: 'blob',
      size
    })
    return this
  }

  /**
   * Add a subtree entry to the tree
   *
   * @param name - Subtree name (e.g., 'entities/')
   * @param treeHash - Tree hash
   * @param size - Total size of subtree
   */
  addTree(name: string, treeHash: string, size: number): this {
    this.entries.push({
      name,
      hash: treeHash,
      type: 'tree',
      size
    })
    return this
  }

  /**
   * Build and persist the tree object
   *
   * @returns Tree hash
   */
  async build(): Promise<string> {
    const tree: TreeObject = {
      entries: this.entries.sort((a, b) => a.name.localeCompare(b.name)),
      createdAt: Date.now()
    }

    return TreeObject.write(this.blobStorage, tree)
  }
}

/**
 * TreeObject: Represents directory structure in COW storage
 */
export class TreeObject {
  /**
   * Serialize tree object to Buffer
   *
   * Format: JSON (simple, debuggable)
   * Future: Could use protobuf for efficiency
   *
   * @param tree - Tree object
   * @returns Serialized tree
   */
  static serialize(tree: TreeObject): Buffer {
    return Buffer.from(JSON.stringify(tree, null, 0))  // Compact JSON
  }

  /**
   * Deserialize tree object from Buffer
   *
   * @param data - Serialized tree
   * @returns Tree object
   */
  static deserialize(data: Buffer): TreeObject {
    const tree = JSON.parse(data.toString())

    // Validate structure
    if (!tree.entries || !Array.isArray(tree.entries)) {
      throw new Error('Invalid tree object: missing entries array')
    }

    if (typeof tree.createdAt !== 'number') {
      throw new Error('Invalid tree object: missing or invalid createdAt')
    }

    // Validate entries
    for (const entry of tree.entries) {
      if (typeof entry.name !== 'string') {
        throw new Error(`Invalid tree entry: name must be string`)
      }
      if (typeof entry.hash !== 'string' || entry.hash.length !== 64) {
        throw new Error(`Invalid tree entry: hash must be 64-char SHA-256`)
      }
      if (entry.type !== 'blob' && entry.type !== 'tree') {
        throw new Error(`Invalid tree entry: type must be 'blob' or 'tree'`)
      }
      if (typeof entry.size !== 'number' || entry.size < 0) {
        throw new Error(`Invalid tree entry: size must be non-negative number`)
      }
    }

    return tree
  }

  /**
   * Compute hash of tree object
   *
   * @param tree - Tree object
   * @returns SHA-256 hash
   */
  static hash(tree: TreeObject): string {
    const data = TreeObject.serialize(tree)
    return BlobStorage.hash(data)
  }

  /**
   * Write tree object to blob storage
   *
   * @param blobStorage - Blob storage instance
   * @param tree - Tree object
   * @returns Tree hash
   */
  static async write(blobStorage: BlobStorage, tree: TreeObject): Promise<string> {
    const data = TreeObject.serialize(tree)
    return blobStorage.write(data, { type: 'tree', compression: 'auto' })
  }

  /**
   * Read tree object from blob storage
   *
   * @param blobStorage - Blob storage instance
   * @param hash - Tree hash
   * @returns Tree object
   */
  static async read(blobStorage: BlobStorage, hash: string): Promise<TreeObject> {
    const data = await blobStorage.read(hash)
    return TreeObject.deserialize(data)
  }

  /**
   * Get specific entry from tree
   *
   * @param tree - Tree object
   * @param name - Entry name
   * @returns Tree entry or undefined
   */
  static getEntry(tree: TreeObject, name: string): TreeEntry | undefined {
    return tree.entries.find(e => e.name === name)
  }

  /**
   * Get all blob entries from tree (non-recursive)
   *
   * @param tree - Tree object
   * @returns Array of blob entries
   */
  static getBlobs(tree: TreeObject): TreeEntry[] {
    return tree.entries.filter(e => e.type === 'blob')
  }

  /**
   * Get all subtree entries from tree (non-recursive)
   *
   * @param tree - Tree object
   * @returns Array of tree entries
   */
  static getSubtrees(tree: TreeObject): TreeEntry[] {
    return tree.entries.filter(e => e.type === 'tree')
  }

  /**
   * Walk tree recursively, yielding all blob entries
   *
   * @param blobStorage - Blob storage instance
   * @param tree - Tree object
   */
  static async *walk(
    blobStorage: BlobStorage,
    tree: TreeObject
  ): AsyncIterableIterator<TreeEntry> {
    for (const entry of tree.entries) {
      if (entry.type === 'blob') {
        yield entry
      } else {
        // Recurse into subtree
        const subtree = await TreeObject.read(blobStorage, entry.hash)
        yield* TreeObject.walk(blobStorage, subtree)
      }
    }
  }

  /**
   * Compute total size of tree (recursive)
   *
   * @param blobStorage - Blob storage instance
   * @param tree - Tree object
   * @returns Total size in bytes
   */
  static async getTotalSize(blobStorage: BlobStorage, tree: TreeObject): Promise<number> {
    let totalSize = 0

    for await (const entry of TreeObject.walk(blobStorage, tree)) {
      totalSize += entry.size
    }

    return totalSize
  }

  /**
   * Create a new tree by updating a single entry
   * (Copy-on-write: creates new tree, doesn't modify original)
   *
   * @param blobStorage - Blob storage instance
   * @param tree - Original tree
   * @param name - Entry name to update
   * @param hash - New blob/tree hash
   * @param size - New size
   * @returns New tree hash
   */
  static async updateEntry(
    blobStorage: BlobStorage,
    tree: TreeObject,
    name: string,
    hash: string,
    size: number
  ): Promise<string> {
    const builder = TreeBuilder.create(blobStorage)

    // Copy all entries except the one being updated
    for (const entry of tree.entries) {
      if (entry.name === name) {
        // Replace with new entry
        if (entry.type === 'blob') {
          builder.addBlob(name, hash, size)
        } else {
          builder.addTree(name, hash, size)
        }
      } else {
        // Keep existing entry
        if (entry.type === 'blob') {
          builder.addBlob(entry.name, entry.hash, entry.size)
        } else {
          builder.addTree(entry.name, entry.hash, entry.size)
        }
      }
    }

    // If entry didn't exist, add it
    if (!TreeObject.getEntry(tree, name)) {
      builder.addBlob(name, hash, size)
    }

    return builder.build()
  }

  /**
   * Diff two trees, return changed/added/deleted entries
   *
   * @param tree1 - First tree (base)
   * @param tree2 - Second tree (comparison)
   * @returns Diff result
   */
  static diff(tree1: TreeObject, tree2: TreeObject): {
    added: TreeEntry[]
    modified: TreeEntry[]
    deleted: TreeEntry[]
  } {
    const entries1 = new Map(tree1.entries.map(e => [e.name, e]))
    const entries2 = new Map(tree2.entries.map(e => [e.name, e]))

    const added: TreeEntry[] = []
    const modified: TreeEntry[] = []
    const deleted: TreeEntry[] = []

    // Find added and modified
    for (const [name, entry2] of entries2) {
      const entry1 = entries1.get(name)

      if (!entry1) {
        added.push(entry2)
      } else if (entry1.hash !== entry2.hash) {
        modified.push(entry2)
      }
    }

    // Find deleted
    for (const [name, entry1] of entries1) {
      if (!entries2.has(name)) {
        deleted.push(entry1)
      }
    }

    return { added, modified, deleted }
  }
}
