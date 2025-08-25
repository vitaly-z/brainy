/**
 * Storage Augmentations - Concrete Implementations
 * 
 * These augmentations provide different storage backends for Brainy.
 * Each wraps an existing storage adapter for backward compatibility.
 */

import { StorageAugmentation } from './storageAugmentation.js'
import { StorageAdapter } from '../coreTypes.js'
import { MemoryStorage } from '../storage/adapters/memoryStorage.js'
import { OPFSStorage } from '../storage/adapters/opfsStorage.js'
import { 
  S3CompatibleStorage, 
  R2Storage 
} from '../storage/adapters/s3CompatibleStorage.js'

/**
 * Memory Storage Augmentation - Fast in-memory storage
 */
export class MemoryStorageAugmentation extends StorageAugmentation {
  readonly name = 'memory-storage'
  
  constructor() {
    super()
  }
  
  async provideStorage(): Promise<StorageAdapter> {
    const storage = new MemoryStorage()
    this.storageAdapter = storage
    return storage
  }
  
  protected async onInitialize(): Promise<void> {
    await this.storageAdapter!.init()
    this.log('Memory storage initialized')
  }
}

/**
 * FileSystem Storage Augmentation - Node.js persistent storage
 */
export class FileSystemStorageAugmentation extends StorageAugmentation {
  readonly name = 'filesystem-storage'
  private rootDirectory: string
  
  constructor(rootDirectory: string = './brainy-data') {
    super()
    this.rootDirectory = rootDirectory
  }
  
  async provideStorage(): Promise<StorageAdapter> {
    try {
      // Dynamically import for Node.js environments
      const { FileSystemStorage } = await import('../storage/adapters/fileSystemStorage.js')
      const storage = new FileSystemStorage(this.rootDirectory)
      this.storageAdapter = storage
      return storage
    } catch (error) {
      this.log('FileSystemStorage not available, falling back to memory', 'warn')
      // Fall back to memory storage
      const storage = new MemoryStorage()
      this.storageAdapter = storage
      return storage
    }
  }
  
  protected async onInitialize(): Promise<void> {
    await this.storageAdapter!.init()
    this.log(`FileSystem storage initialized at ${this.rootDirectory}`)
  }
}

/**
 * OPFS Storage Augmentation - Browser persistent storage
 */
export class OPFSStorageAugmentation extends StorageAugmentation {
  readonly name = 'opfs-storage'
  private requestPersistent: boolean
  
  constructor(requestPersistent: boolean = false) {
    super()
    this.requestPersistent = requestPersistent
  }
  
  async provideStorage(): Promise<StorageAdapter> {
    const storage = new OPFSStorage()
    
    if (!storage.isOPFSAvailable()) {
      this.log('OPFS not available, falling back to memory', 'warn')
      const memStorage = new MemoryStorage()
      this.storageAdapter = memStorage
      return memStorage
    }
    
    this.storageAdapter = storage
    return storage
  }
  
  protected async onInitialize(): Promise<void> {
    await this.storageAdapter!.init()
    
    if (this.requestPersistent && this.storageAdapter instanceof OPFSStorage) {
      const granted = await this.storageAdapter.requestPersistentStorage()
      this.log(`Persistent storage ${granted ? 'granted' : 'denied'}`)
    }
    
    this.log('OPFS storage initialized')
  }
}

/**
 * S3 Storage Augmentation - Amazon S3 cloud storage
 */
export class S3StorageAugmentation extends StorageAugmentation {
  readonly name = 's3-storage'
  private config: {
    bucketName: string
    region?: string
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
    cacheConfig?: any
    operationConfig?: any
  }
  
  constructor(config: {
    bucketName: string
    region?: string
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
    cacheConfig?: any
    operationConfig?: any
  }) {
    super()
    this.config = config
  }
  
  async provideStorage(): Promise<StorageAdapter> {
    const storage = new S3CompatibleStorage({
      ...this.config,
      serviceType: 's3'
    })
    this.storageAdapter = storage
    return storage
  }
  
  protected async onInitialize(): Promise<void> {
    await this.storageAdapter!.init()
    this.log(`S3 storage initialized with bucket ${this.config.bucketName}`)
  }
}

/**
 * R2 Storage Augmentation - Cloudflare R2 storage
 */
export class R2StorageAugmentation extends StorageAugmentation {
  readonly name = 'r2-storage'
  private config: {
    bucketName: string
    accountId: string
    accessKeyId: string
    secretAccessKey: string
    cacheConfig?: any
  }
  
  constructor(config: {
    bucketName: string
    accountId: string
    accessKeyId: string
    secretAccessKey: string
    cacheConfig?: any
  }) {
    super()
    this.config = config
  }
  
  async provideStorage(): Promise<StorageAdapter> {
    const storage = new R2Storage({
      ...this.config,
      serviceType: 'r2'
    })
    this.storageAdapter = storage
    return storage
  }
  
  protected async onInitialize(): Promise<void> {
    await this.storageAdapter!.init()
    this.log(`R2 storage initialized with bucket ${this.config.bucketName}`)
  }
}

/**
 * GCS Storage Augmentation - Google Cloud Storage
 */
export class GCSStorageAugmentation extends StorageAugmentation {
  readonly name = 'gcs-storage'
  private config: {
    bucketName: string
    region?: string
    accessKeyId: string
    secretAccessKey: string
    endpoint?: string
    cacheConfig?: any
  }
  
  constructor(config: {
    bucketName: string
    region?: string
    accessKeyId: string
    secretAccessKey: string
    endpoint?: string
    cacheConfig?: any
  }) {
    super()
    this.config = config
  }
  
  async provideStorage(): Promise<StorageAdapter> {
    const storage = new S3CompatibleStorage({
      ...this.config,
      endpoint: this.config.endpoint || 'https://storage.googleapis.com',
      serviceType: 'gcs'
    })
    this.storageAdapter = storage
    return storage
  }
  
  protected async onInitialize(): Promise<void> {
    await this.storageAdapter!.init()
    this.log(`GCS storage initialized with bucket ${this.config.bucketName}`)
  }
}

/**
 * Auto-select the best storage augmentation for the environment
 * Maintains zero-config philosophy
 */
export async function createAutoStorageAugmentation(options: {
  rootDirectory?: string
  requestPersistentStorage?: boolean
} = {}): Promise<StorageAugmentation> {
  // Detect environment
  const isNodeEnv = (globalThis as any).__ENV__?.isNode || (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  )
  
  if (isNodeEnv) {
    // Node.js environment - use FileSystem
    return new FileSystemStorageAugmentation(
      options.rootDirectory || './brainy-data'
    )
  } else {
    // Browser environment - try OPFS, fall back to memory
    const opfsAug = new OPFSStorageAugmentation(
      options.requestPersistentStorage || false
    )
    
    // Test if OPFS is available
    const testStorage = new OPFSStorage()
    if (testStorage.isOPFSAvailable()) {
      return opfsAug
    } else {
      // Fall back to memory
      return new MemoryStorageAugmentation()
    }
  }
}