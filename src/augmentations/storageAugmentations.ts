/**
 * Storage Augmentations - Concrete Implementations
 * 
 * These augmentations provide different storage backends for Brainy.
 * Each wraps an existing storage adapter for backward compatibility.
 */

import { StorageAugmentation } from './storageAugmentation.js'
import { StorageAdapter } from '../coreTypes.js'
import { AugmentationManifest } from './manifest.js'
import { MemoryStorage } from '../storage/adapters/memoryStorage.js'
import { OPFSStorage } from '../storage/adapters/opfsStorage.js'
import { S3CompatibleStorage } from '../storage/adapters/s3CompatibleStorage.js'
import { R2Storage } from '../storage/adapters/r2Storage.js'
import { AzureBlobStorage } from '../storage/adapters/azureBlobStorage.js'

/**
 * Memory Storage Augmentation - Fast in-memory storage
 */
export class MemoryStorageAugmentation extends StorageAugmentation {
  readonly name = 'memory-storage'
  readonly category = 'core' as const
  readonly description = 'High-performance in-memory storage for development and testing'
  
  constructor(config?: any) {
    super(config)
  }
  
  getManifest(): AugmentationManifest {
    return {
      id: 'memory-storage',
      name: 'Memory Storage',
      version: '2.0.0',
      description: 'Fast in-memory storage with no persistence',
      longDescription: 'Perfect for development, testing, and temporary data. All data is lost when the process ends. Provides the fastest possible performance with zero I/O overhead.',
      category: 'storage',
      configSchema: {
        type: 'object',
        properties: {
          maxSize: {
            type: 'number',
            default: 104857600, // 100MB
            minimum: 1048576,   // 1MB
            maximum: 1073741824, // 1GB
            description: 'Maximum memory usage in bytes'
          },
          gcInterval: {
            type: 'number',
            default: 60000, // 1 minute
            minimum: 1000,  // 1 second
            maximum: 3600000, // 1 hour
            description: 'Garbage collection interval in milliseconds'
          },
          enableStats: {
            type: 'boolean',
            default: false,
            description: 'Enable memory usage statistics'
          }
        },
        additionalProperties: false
      },
      configDefaults: {
        maxSize: 104857600,
        gcInterval: 60000,
        enableStats: false
      },
      minBrainyVersion: '2.0.0',
      keywords: ['storage', 'memory', 'ram', 'volatile', 'fast'],
      documentation: 'https://docs.brainy.dev/augmentations/memory-storage',
      status: 'stable',
      performance: {
        memoryUsage: 'high',
        cpuUsage: 'low',
        networkUsage: 'none'
      },
      features: ['fast-access', 'zero-latency', 'no-persistence'],
      ui: {
        icon: '💾',
        color: '#4CAF50'
      }
    }
  }
  
  async provideStorage(): Promise<StorageAdapter> {
    const storage = new MemoryStorage()
    this.storageAdapter = storage
    return storage
  }
  
  protected async onInitialize(): Promise<void> {
    await this.storageAdapter!.init()
    this.log(`Memory storage initialized (max size: ${this.config.maxSize} bytes)`)
  }
}

/**
 * FileSystem Storage Augmentation - Node.js persistent storage
 */
export class FileSystemStorageAugmentation extends StorageAugmentation {
  readonly name = 'filesystem-storage'
  readonly category = 'core' as const
  readonly description = 'Persistent file-based storage for Node.js environments'
  
  constructor(config?: any) {
    super(config)
  }
  
  getManifest(): AugmentationManifest {
    return {
      id: 'filesystem-storage',
      name: 'FileSystem Storage',
      version: '2.0.0',
      description: 'Persistent storage using the local filesystem',
      longDescription: 'Stores data as files on the local filesystem. Perfect for Node.js applications, desktop apps, and servers. Provides persistent storage with good performance and unlimited capacity.',
      category: 'storage',
      configSchema: {
        type: 'object',
        properties: {
          rootDirectory: {
            type: 'string',
            default: './brainy-data',
            description: 'Root directory for storing data files'
          },
          compression: {
            type: 'boolean',
            default: false,
            description: 'Enable gzip compression for stored files'
          },
          maxFileSize: {
            type: 'number',
            default: 10485760, // 10MB
            minimum: 1048576,  // 1MB
            maximum: 104857600, // 100MB
            description: 'Maximum size per file in bytes'
          },
          autoBackup: {
            type: 'boolean',
            default: false,
            description: 'Enable automatic backups'
          },
          backupInterval: {
            type: 'number',
            default: 3600000, // 1 hour
            minimum: 60000,   // 1 minute
            maximum: 86400000, // 24 hours
            description: 'Backup interval in milliseconds'
          }
        },
        additionalProperties: false
      },
      configDefaults: {
        rootDirectory: './brainy-data',
        compression: false,
        maxFileSize: 10485760,
        autoBackup: false,
        backupInterval: 3600000
      },
      minBrainyVersion: '2.0.0',
      keywords: ['storage', 'filesystem', 'persistent', 'node', 'disk'],
      documentation: 'https://docs.brainy.dev/augmentations/filesystem-storage',
      status: 'stable',
      performance: {
        memoryUsage: 'low',
        cpuUsage: 'low',
        networkUsage: 'none'
      },
      features: ['persistence', 'unlimited-capacity', 'file-based', 'compression-support'],
      ui: {
        icon: '📁',
        color: '#FF9800'
      }
    }
  }
  
  async provideStorage(): Promise<StorageAdapter> {
    try {
      // Dynamically import for Node.js environments
      const { FileSystemStorage } = await import('../storage/adapters/fileSystemStorage.js')
      const storage = new FileSystemStorage(this.config.rootDirectory)
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
    this.log(`FileSystem storage initialized at ${this.config.rootDirectory}`)
    if (this.config.compression) {
      this.log('Compression enabled for stored files')
    }
  }
}

/**
 * OPFS Storage Augmentation - Browser persistent storage
 */
export class OPFSStorageAugmentation extends StorageAugmentation {
  readonly name = 'opfs-storage'
  readonly category = 'core' as const
  readonly description = 'Persistent browser storage using Origin Private File System'
  
  constructor(config?: any) {
    super(config)
  }
  
  getManifest(): AugmentationManifest {
    return {
      id: 'opfs-storage',
      name: 'OPFS Storage',
      version: '2.0.0',
      description: 'Modern browser storage with file system capabilities',
      longDescription: 'Uses the Origin Private File System API for persistent browser storage. Provides file-like storage in modern browsers with better performance than IndexedDB and unlimited storage quota.',
      category: 'storage',
      configSchema: {
        type: 'object',
        properties: {
          requestPersistent: {
            type: 'boolean',
            default: false,
            description: 'Request persistent storage permission from browser'
          },
          directoryName: {
            type: 'string',
            default: 'brainy-data',
            description: 'Directory name within OPFS'
          },
          chunkSize: {
            type: 'number',
            default: 1048576, // 1MB
            minimum: 65536,   // 64KB
            maximum: 10485760, // 10MB
            description: 'Chunk size for file operations in bytes'
          },
          enableCache: {
            type: 'boolean',
            default: true,
            description: 'Enable in-memory caching for frequently accessed data'
          }
        },
        additionalProperties: false
      },
      configDefaults: {
        requestPersistent: false,
        directoryName: 'brainy-data',
        chunkSize: 1048576,
        enableCache: true
      },
      minBrainyVersion: '2.0.0',
      keywords: ['storage', 'browser', 'opfs', 'persistent', 'web'],
      documentation: 'https://docs.brainy.dev/augmentations/opfs-storage',
      status: 'stable',
      performance: {
        memoryUsage: 'medium',
        cpuUsage: 'low',
        networkUsage: 'none'
      },
      features: ['browser-persistent', 'file-system-api', 'unlimited-quota', 'async-operations'],
      ui: {
        icon: '🌐',
        color: '#2196F3'
      }
    }
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
    
    if (this.config.requestPersistent && this.storageAdapter instanceof OPFSStorage) {
      const granted = await this.storageAdapter.requestPersistentStorage()
      this.log(`Persistent storage ${granted ? 'granted' : 'denied'}`)
    }
    
    this.log(`OPFS storage initialized in directory: ${this.config.directoryName}`)
  }
}

/**
 * S3 Storage Augmentation - Amazon S3 cloud storage
 */
export class S3StorageAugmentation extends StorageAugmentation {
  readonly name = 's3-storage'
  protected config: {
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
  protected config: {
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
      ...this.config
      // serviceType not needed - R2Storage is dedicated
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
  protected config: {
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
 * Azure Blob Storage Augmentation - Microsoft Azure
 */
export class AzureStorageAugmentation extends StorageAugmentation {
  readonly name = 'azure-storage'
  protected config: {
    containerName: string
    accountName?: string
    accountKey?: string
    connectionString?: string
    sasToken?: string
    cacheConfig?: any
  }

  constructor(config: {
    containerName: string
    accountName?: string
    accountKey?: string
    connectionString?: string
    sasToken?: string
    cacheConfig?: any
  }) {
    super()
    this.config = config
  }

  async provideStorage(): Promise<StorageAdapter> {
    const storage = new AzureBlobStorage({
      ...this.config
    })
    this.storageAdapter = storage
    return storage
  }

  protected async onInitialize(): Promise<void> {
    await this.storageAdapter!.init()
    this.log(`Azure Blob Storage initialized with container ${this.config.containerName}`)
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
    return new FileSystemStorageAugmentation({
      rootDirectory: options.rootDirectory || './brainy-data'
    })
  } else {
    // Browser environment - try OPFS, fall back to memory
    const opfsAug = new OPFSStorageAugmentation({
      requestPersistent: options.requestPersistentStorage || false
    })
    
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