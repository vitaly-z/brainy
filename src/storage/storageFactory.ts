/**
 * Storage Factory
 * Creates the appropriate storage adapter based on the environment and configuration
 */

import { StorageAdapter } from '../coreTypes.js'
import { MemoryStorage } from './adapters/memoryStorage.js'
import { OPFSStorage } from './adapters/opfsStorage.js'
import { S3CompatibleStorage } from './adapters/s3CompatibleStorage.js'
import { R2Storage } from './adapters/r2Storage.js'
import { GcsStorage } from './adapters/gcsStorage.js'
import { AzureBlobStorage } from './adapters/azureBlobStorage.js'
// TypeAwareStorageAdapter removed - type-aware now built into BaseStorage
// FileSystemStorage is dynamically imported to avoid issues in browser environments
import { isBrowser } from '../utils/environment.js'
import { OperationConfig } from '../utils/operationUtils.js'

/**
 * Options for creating a storage adapter
 */
export interface StorageOptions {
  /**
   * The type of storage to use
   * - 'auto': Automatically select the best storage adapter based on the environment
   * - 'memory': Use in-memory storage
   * - 'opfs': Use Origin Private File System storage (browser only)
   * - 'filesystem': Use file system storage (Node.js only)
   * - 's3': Use Amazon S3 storage
   * - 'r2': Use Cloudflare R2 storage
   * - 'gcs': Use Google Cloud Storage (native SDK with ADC)
   * - 'gcs-native': DEPRECATED - Use 'gcs' instead
   * - 'azure': Use Azure Blob Storage (native SDK with Managed Identity)
   * - 'type-aware': Use type-first storage adapter (wraps another adapter)
   */
  type?: 'auto' | 'memory' | 'opfs' | 'filesystem' | 's3' | 'r2' | 'gcs' | 'gcs-native' | 'azure' | 'type-aware'

  /**
   * Force the use of memory storage even if other storage types are available
   */
  forceMemoryStorage?: boolean

  /**
   * Force the use of file system storage even if other storage types are available
   */
  forceFileSystemStorage?: boolean

  /**
   * Request persistent storage permission from the user (browser only)
   */
  requestPersistentStorage?: boolean

  /**
   * Root directory for file system storage (Node.js only)
   */
  rootDirectory?: string

  /**
   * Nested options object for backward compatibility with BrainyConfig.storage.options
   * Supports flexible API patterns
   */
  options?: {
    rootDirectory?: string
    path?: string
    [key: string]: any
  }

  /**
   * Configuration for Amazon S3 storage
   */
  s3Storage?: {
    /**
     * S3 bucket name
     */
    bucketName: string

    /**
     * AWS region (e.g., 'us-east-1')
     */
    region?: string

    /**
     * AWS access key ID
     */
    accessKeyId: string

    /**
     * AWS secret access key
     */
    secretAccessKey: string

    /**
     * AWS session token (optional)
     */
    sessionToken?: string

    /**
     * Initialization mode for fast cold starts
     *
     * - `'auto'` (default): Progressive in cloud environments (Lambda),
     *   strict locally. Zero-config optimization.
     * - `'progressive'`: Always use fast init (<200ms). Bucket validation and
     *   count loading happen in background. First write validates bucket.
     * - `'strict'`: Traditional blocking init. Validates bucket and loads counts
     *   before init() returns.
     *
     */
    initMode?: 'progressive' | 'strict' | 'auto'
  }

  /**
   * Configuration for Cloudflare R2 storage
   */
  r2Storage?: {
    /**
     * R2 bucket name
     */
    bucketName: string

    /**
     * Cloudflare account ID
     */
    accountId: string

    /**
     * R2 access key ID
     */
    accessKeyId: string

    /**
     * R2 secret access key
     */
    secretAccessKey: string
  }

  /**
   * Configuration for Google Cloud Storage (Legacy S3-compatible with HMAC keys)
   * @deprecated Use gcsNativeStorage instead for better performance with ADC
   * This is only needed if you must use HMAC keys for backward compatibility
   */
  gcsStorage?: {
    /**
     * GCS bucket name
     */
    bucketName: string

    /**
     * GCS region (e.g., 'us-central1')
     */
    region?: string

    /**
     * GCS access key ID
     */
    accessKeyId: string

    /**
     * GCS secret access key
     */
    secretAccessKey: string

    /**
     * GCS endpoint (e.g., 'https://storage.googleapis.com')
     */
    endpoint?: string
  }

  /**
   * Configuration for Google Cloud Storage (native SDK with ADC)
   * This is the recommended way to use GCS with Brainy
   * Supports Application Default Credentials for zero-config cloud deployments
   */
  gcsNativeStorage?: {
    /**
     * GCS bucket name
     */
    bucketName: string

    /**
     * Service account key file path (optional, uses ADC if not provided)
     */
    keyFilename?: string

    /**
     * Service account credentials object (optional, uses ADC if not provided)
     */
    credentials?: object

    /**
     * HMAC access key ID (backward compatibility, not recommended)
     * @deprecated Use ADC, keyFilename, or credentials instead
     */
    accessKeyId?: string

    /**
     * HMAC secret access key (backward compatibility, not recommended)
     * @deprecated Use ADC, keyFilename, or credentials instead
     */
    secretAccessKey?: string

    /**
     * Skip initial bucket scan for counting entities
     * Useful for large buckets where the scan would timeout
     * If true, counts start at 0 and are updated incrementally
     * @default false
     */
    skipInitialScan?: boolean

    /**
     * Skip loading and saving the counts file entirely
     * Useful for very large datasets where counts aren't critical
     * @default false
     * @deprecated Use `initMode: 'progressive'` instead
     */
    skipCountsFile?: boolean

    /**
     * Initialization mode for fast cold starts
     *
     * - `'auto'` (default): Progressive in cloud environments (Cloud Run),
     *   strict locally. Zero-config optimization.
     * - `'progressive'`: Always use fast init (<200ms). Bucket validation and
     *   count loading happen in background. First write validates bucket.
     * - `'strict'`: Traditional blocking init. Validates bucket and loads counts
     *   before init() returns.
     *
     */
    initMode?: 'progressive' | 'strict' | 'auto'
  }

  /**
   * Configuration for Azure Blob Storage (native SDK with Managed Identity)
   */
  azureStorage?: {
    /**
     * Azure container name
     */
    containerName: string

    /**
     * Azure Storage account name (for Managed Identity or SAS)
     */
    accountName?: string

    /**
     * Azure Storage account key (optional, uses Managed Identity if not provided)
     */
    accountKey?: string

    /**
     * Azure connection string (highest priority if provided)
     */
    connectionString?: string

    /**
     * SAS token (optional, alternative to account key)
     */
    sasToken?: string

    /**
     * Initialization mode for fast cold starts
     *
     * - `'auto'` (default): Progressive in cloud environments (Azure Functions),
     *   strict locally. Zero-config optimization.
     * - `'progressive'`: Always use fast init (<200ms). Container validation and
     *   count loading happen in background. First write validates container.
     * - `'strict'`: Traditional blocking init. Validates container and loads counts
     *   before init() returns.
     *
     */
    initMode?: 'progressive' | 'strict' | 'auto'
  }

  /**
   * Configuration for Type-Aware Storage (type-first architecture)
   * Wraps another storage adapter and adds type-first routing
   */
  typeAwareStorage?: {
    /**
     * Underlying storage adapter to use
     * Can be any of: 'memory', 'filesystem', 's3', 'r2', 'gcs', 'gcs-native'
     */
    underlyingType?: 'memory' | 'filesystem' | 's3' | 'r2' | 'gcs' | 'gcs-native'

    /**
     * Options for the underlying storage adapter
     */
    underlyingOptions?: StorageOptions

    /**
     * Enable verbose logging for debugging
     */
    verbose?: boolean
  }

  /**
   * Configuration for custom S3-compatible storage
   */
  customS3Storage?: {
    /**
     * S3-compatible bucket name
     */
    bucketName: string

    /**
     * S3-compatible region
     */
    region?: string

    /**
     * S3-compatible endpoint URL
     */
    endpoint: string

    /**
     * S3-compatible access key ID
     */
    accessKeyId: string

    /**
     * S3-compatible secret access key
     */
    secretAccessKey: string

    /**
     * S3-compatible service type (for logging and error messages)
     */
    serviceType?: string
  }

  /**
   * Operation configuration for timeout and retry behavior
   */
  operationConfig?: OperationConfig

  /**
   * Cache configuration for optimizing data access
   * Particularly important for S3 and other remote storage
   */
  cacheConfig?: {
    /**
     * Maximum size of the hot cache (most frequently accessed items)
     * For large datasets, consider values between 5000-50000 depending on available memory
     */
    hotCacheMaxSize?: number

    /**
     * Threshold at which to start evicting items from the hot cache
     * Expressed as a fraction of hotCacheMaxSize (0.0 to 1.0)
     * Default: 0.8 (start evicting when cache is 80% full)
     */
    hotCacheEvictionThreshold?: number

    /**
     * Time-to-live for items in the warm cache in milliseconds
     * Default: 3600000 (1 hour)
     */
    warmCacheTTL?: number

    /**
     * Batch size for operations like prefetching
     * Larger values improve throughput but use more memory
     */
    batchSize?: number

    /**
     * Whether to enable auto-tuning of cache parameters
     * When true, the system will automatically adjust cache sizes based on usage patterns
     * Default: true
     */
    autoTune?: boolean

    /**
     * The interval (in milliseconds) at which to auto-tune cache parameters
     * Only applies when autoTune is true
     * Default: 60000 (1 minute)
     */
    autoTuneInterval?: number

    /**
     * Whether the storage is in read-only mode
     * This affects cache sizing and prefetching strategies
     */
    readOnly?: boolean
  }

  /**
   * COW (Copy-on-Write) configuration for instant fork() capability
   * COW is now always enabled (automatic, zero-config)
   */
  branch?: string              // Current branch name (default: 'main')
  enableCompression?: boolean // Enable zstd compression for COW blobs (default: true)
}

/**
 * Extract filesystem root directory from options
 * Single source of truth for path resolution - supports all API variants
 * Zero-config philosophy: flexible input, predictable output
 */
function getFileSystemPath(options: StorageOptions): string {
  return (
    options.rootDirectory ||         // Official storageFactory API
    (options as any).path ||         // User-friendly API
    options.options?.rootDirectory || // Nested options API
    options.options?.path ||          // Nested path API
    './brainy-data'                   // Zero-config fallback
  )
}

/**
 * Configure COW (Copy-on-Write) options on a storage adapter
 * TypeAware is now built-in to all adapters, no wrapper needed!
 *
 * @param storage - The storage adapter
 * @param options - Storage options (for COW configuration)
 */
function configureCOW(storage: any, options?: StorageOptions): void {
  // COW will be initialized AFTER storage.init() in Brainy
  // Store COW options for later initialization
  if (typeof storage.initializeCOW === 'function') {
    storage._cowOptions = {
      branch: options?.branch || 'main',
      enableCompression: options?.enableCompression !== false
    }
  }
}

/**
 * Create a storage adapter based on the environment and configuration
 * @param options Options for creating the storage adapter
 * @returns Promise that resolves to a storage adapter
 */
export async function createStorage(
  options: StorageOptions = {}
): Promise<StorageAdapter> {
  // If memory storage is forced, use it regardless of other options
  if (options.forceMemoryStorage) {
    console.log('Using memory storage (forced) with built-in type-aware')
    const storage = new MemoryStorage()
    configureCOW(storage, options)
    return storage
  }

  // If file system storage is forced, use it regardless of other options
  if (options.forceFileSystemStorage) {
    if (isBrowser()) {
      console.warn(
        'FileSystemStorage is not available in browser environments, falling back to memory storage'
      )
      const storage = new MemoryStorage()
      configureCOW(storage, options)
      return storage
    }
    const fsPath = getFileSystemPath(options)
    console.log(`Using file system storage (forced): ${fsPath} with built-in type-aware`)
    try {
      const { FileSystemStorage } = await import(
        './adapters/fileSystemStorage.js'
      )
      const storage = new FileSystemStorage(fsPath)
      configureCOW(storage, options)
      return storage
    } catch (error) {
      console.warn(
        'Failed to load FileSystemStorage, falling back to memory storage:',
        error
      )
      const storage = new MemoryStorage()
      configureCOW(storage, options)
      return storage
    }
  }

  // If a specific storage type is specified, use it
  if (options.type && options.type !== 'auto') {
    switch (options.type) {
      case 'memory':
        console.log('Using memory storage with built-in type-aware')
        const memStorage = new MemoryStorage()
        configureCOW(memStorage, options)
        return memStorage

      case 'opfs': {
        console.warn('[brainy] OPFS storage is deprecated and will be removed in v8.0. Migrate to Node.js/Bun with filesystem or mmap-filesystem storage.')
        // Check if OPFS is available
        const opfsStorage = new OPFSStorage()
        if (opfsStorage.isOPFSAvailable()) {
          console.log('Using OPFS storage with built-in type-aware')
          await opfsStorage.init()

          // Request persistent storage if specified
          if (options.requestPersistentStorage) {
            const isPersistent = await opfsStorage.requestPersistentStorage()
            console.log(
              `Persistent storage ${isPersistent ? 'granted' : 'denied'}`
            )
          }

          configureCOW(opfsStorage, options)
          return opfsStorage
        } else {
          console.warn(
            'OPFS storage is not available, falling back to memory storage'
          )
          const storage = new MemoryStorage()
          configureCOW(storage, options)
          return storage
        }
      }

      case 'filesystem': {
        if (isBrowser()) {
          console.warn(
            'FileSystemStorage is not available in browser environments, falling back to memory storage'
          )
          const storage = new MemoryStorage()
          configureCOW(storage, options)
          return storage
        }
        const fsPath = getFileSystemPath(options)
        console.log(`Using file system storage: ${fsPath} with built-in type-aware`)
        try {
          const { FileSystemStorage } = await import(
            './adapters/fileSystemStorage.js'
          )
          const storage = new FileSystemStorage(fsPath)
          configureCOW(storage, options)
          return storage
        } catch (error) {
          console.warn(
            'Failed to load FileSystemStorage, falling back to memory storage:',
            error
          )
          const storage = new MemoryStorage()
          configureCOW(storage, options)
          return storage
        }
      }

      case 's3':
        if (options.s3Storage) {
          console.log('Using Amazon S3 storage with built-in type-aware')
          const storage = new S3CompatibleStorage({
            bucketName: options.s3Storage.bucketName,
            region: options.s3Storage.region,
            accessKeyId: options.s3Storage.accessKeyId,
            secretAccessKey: options.s3Storage.secretAccessKey,
            sessionToken: options.s3Storage.sessionToken,
            initMode: options.s3Storage.initMode,
            serviceType: 's3',
            operationConfig: options.operationConfig,
            cacheConfig: options.cacheConfig
          })
          configureCOW(storage, options)
          return storage
        } else {
          console.warn(
            'S3 storage configuration is missing, falling back to memory storage'
          )
          const storage = new MemoryStorage()
          configureCOW(storage, options)
          return storage
        }

      case 'r2':
        if (options.r2Storage) {
          console.log('Using Cloudflare R2 storage (dedicated adapter) with built-in type-aware')
          const storage = new R2Storage({
            bucketName: options.r2Storage.bucketName,
            accountId: options.r2Storage.accountId,
            accessKeyId: options.r2Storage.accessKeyId,
            secretAccessKey: options.r2Storage.secretAccessKey,
            cacheConfig: options.cacheConfig
          })
          configureCOW(storage, options)
          return storage
        } else {
          console.warn(
            'R2 storage configuration is missing, falling back to memory storage'
          )
          const storage = new MemoryStorage()
          configureCOW(storage, options)
          return storage
        }

      case 'gcs-native':
        // DEPRECATED: gcs-native is deprecated in favor of just 'gcs'
        console.warn(
          '⚠️  DEPRECATED: type "gcs-native" is deprecated. Use type "gcs" instead.'
        )
        console.warn(
          '   This will continue to work but may be removed in a future version.'
        )
        // Fall through to 'gcs' case

      case 'gcs': {
        // Prefer gcsNativeStorage, but also accept gcsStorage for backward compatibility
        const gcsNative = options.gcsNativeStorage
        const gcsLegacy = options.gcsStorage

        if (!gcsNative && !gcsLegacy) {
          console.warn(
            'GCS storage configuration is missing, falling back to memory storage'
          )
          const storage = new MemoryStorage()
          configureCOW(storage, options)
          return storage
        }

        // If using legacy gcsStorage with HMAC keys, use S3-compatible adapter
        if (gcsLegacy && gcsLegacy.accessKeyId && gcsLegacy.secretAccessKey) {
          console.warn(
            '⚠️  GCS with HMAC keys detected. Consider using gcsNativeStorage with ADC instead.'
          )
          console.warn(
            '   Native GCS with Application Default Credentials is recommended for better performance and security.'
          )
          // Use S3-compatible storage for HMAC keys
          const storage = new S3CompatibleStorage({
            bucketName: gcsLegacy.bucketName,
            region: gcsLegacy.region,
            endpoint: gcsLegacy.endpoint || 'https://storage.googleapis.com',
            accessKeyId: gcsLegacy.accessKeyId,
            secretAccessKey: gcsLegacy.secretAccessKey,
            serviceType: 'gcs',
            cacheConfig: options.cacheConfig
          })
          configureCOW(storage, options)
          return storage
        }

        // Use native GCS SDK (the correct default!)
        const config = gcsNative || gcsLegacy!
        console.log('Using Google Cloud Storage (native SDK) + TypeAware wrapper')
        const storage = new GcsStorage({
          bucketName: config.bucketName,
          keyFilename: gcsNative?.keyFilename,
          credentials: gcsNative?.credentials,
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          skipInitialScan: gcsNative?.skipInitialScan,
          skipCountsFile: gcsNative?.skipCountsFile,
          initMode: gcsNative?.initMode,
          cacheConfig: options.cacheConfig
        })
        configureCOW(storage, options)
        return storage
      }

      case 'azure':
        if (options.azureStorage) {
          console.log('Using Azure Blob Storage (native SDK) + TypeAware wrapper')
          const storage = new AzureBlobStorage({
            containerName: options.azureStorage.containerName,
            accountName: options.azureStorage.accountName,
            accountKey: options.azureStorage.accountKey,
            connectionString: options.azureStorage.connectionString,
            sasToken: options.azureStorage.sasToken,
            initMode: options.azureStorage.initMode,
            cacheConfig: options.cacheConfig
          })
          configureCOW(storage, options)
          return storage
        } else {
          console.warn(
            'Azure storage configuration is missing, falling back to memory storage'
          )
          const storage = new MemoryStorage()
          configureCOW(storage, options)
          return storage
        }

      case 'type-aware':
        // TypeAware is now the default for ALL adapters
        // Redirect to the underlying type instead
        console.warn(
          '⚠️  type-aware is deprecated - TypeAware is now always enabled.'
        )
        console.warn(
          '   Just use the underlying storage type (e.g., "filesystem", "s3", etc.)'
        )
        // Recursively create storage with underlying type
        return await createStorage({
          ...options,
          type: options.typeAwareStorage?.underlyingType || 'auto'
        })

      default:
        console.warn(
          `Unknown storage type: ${options.type}, falling back to memory storage`
        )
        const storage = new MemoryStorage()
          configureCOW(storage, options)
          return storage
    }
  }

  // If custom S3-compatible storage is specified, use it
  if (options.customS3Storage) {
    console.log(
      `Using custom S3-compatible storage: ${options.customS3Storage.serviceType || 'custom'} + TypeAware wrapper`
    )
    const storage = new S3CompatibleStorage({
      bucketName: options.customS3Storage.bucketName,
      region: options.customS3Storage.region,
      endpoint: options.customS3Storage.endpoint,
      accessKeyId: options.customS3Storage.accessKeyId,
      secretAccessKey: options.customS3Storage.secretAccessKey,
      serviceType: options.customS3Storage.serviceType || 'custom',
      cacheConfig: options.cacheConfig
    })
    configureCOW(storage, options)
    return storage
  }

  // If R2 storage is specified, use it
  if (options.r2Storage) {
    console.log('Using Cloudflare R2 storage (dedicated adapter) + TypeAware wrapper')
    const storage = new R2Storage({
      bucketName: options.r2Storage.bucketName,
      accountId: options.r2Storage.accountId,
      accessKeyId: options.r2Storage.accessKeyId,
      secretAccessKey: options.r2Storage.secretAccessKey,
      cacheConfig: options.cacheConfig
    })
    configureCOW(storage, options)
    return storage
  }

  // If S3 storage is specified, use it
  if (options.s3Storage) {
    console.log('Using Amazon S3 storage + TypeAware wrapper')
    const storage = new S3CompatibleStorage({
      bucketName: options.s3Storage.bucketName,
      region: options.s3Storage.region,
      accessKeyId: options.s3Storage.accessKeyId,
      secretAccessKey: options.s3Storage.secretAccessKey,
      sessionToken: options.s3Storage.sessionToken,
      initMode: options.s3Storage.initMode,
      serviceType: 's3',
      cacheConfig: options.cacheConfig
    })
    configureCOW(storage, options)
    return storage
  }

  // If GCS storage is specified (native or legacy S3-compatible)
  // Prefer gcsNativeStorage, but also accept gcsStorage for backward compatibility
  const gcsNative = options.gcsNativeStorage
  const gcsLegacy = options.gcsStorage

  if (gcsNative || gcsLegacy) {
    // If using legacy gcsStorage with HMAC keys, use S3-compatible adapter
    if (gcsLegacy && gcsLegacy.accessKeyId && gcsLegacy.secretAccessKey) {
      console.warn(
        '⚠️  GCS with HMAC keys detected. Consider using gcsNativeStorage with ADC instead.'
      )
      console.warn(
        '   Native GCS with Application Default Credentials is recommended for better performance and security.'
      )
      // Use S3-compatible storage for HMAC keys
      console.log('Using Google Cloud Storage (S3-compatible with HMAC - auto-detected) + TypeAware wrapper')
      const storage = new S3CompatibleStorage({
        bucketName: gcsLegacy.bucketName,
        region: gcsLegacy.region,
        endpoint: gcsLegacy.endpoint || 'https://storage.googleapis.com',
        accessKeyId: gcsLegacy.accessKeyId,
        secretAccessKey: gcsLegacy.secretAccessKey,
        serviceType: 'gcs',
        cacheConfig: options.cacheConfig
      })
      configureCOW(storage, options)
      return storage
    }

    // Use native GCS SDK (the correct default!)
    const config = gcsNative || gcsLegacy!
    console.log('Using Google Cloud Storage (native SDK - auto-detected) + TypeAware wrapper')
    const storage = new GcsStorage({
      bucketName: config.bucketName,
      keyFilename: gcsNative?.keyFilename,
      credentials: gcsNative?.credentials,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      skipInitialScan: gcsNative?.skipInitialScan,
      skipCountsFile: gcsNative?.skipCountsFile,
      initMode: gcsNative?.initMode,
      cacheConfig: options.cacheConfig
    })
    configureCOW(storage, options)
    return storage
  }

  // If Azure storage is specified, use it
  if (options.azureStorage) {
    console.log('Using Azure Blob Storage (native SDK) + TypeAware wrapper')
    const storage = new AzureBlobStorage({
      containerName: options.azureStorage.containerName,
      accountName: options.azureStorage.accountName,
      accountKey: options.azureStorage.accountKey,
      connectionString: options.azureStorage.connectionString,
      sasToken: options.azureStorage.sasToken,
      initMode: options.azureStorage.initMode,
      cacheConfig: options.cacheConfig
    })
    configureCOW(storage, options)
    return storage
  }

  // Auto-detect the best storage adapter based on the environment
  // First, check if we're in Node.js (prioritize for test environments)
  if (!isBrowser()) {
    try {
      // Check if we're in a Node.js environment
      if (
        typeof process !== 'undefined' &&
        process.versions &&
        process.versions.node
      ) {
        const fsPath = getFileSystemPath(options)
        console.log(`Using file system storage (auto-detected): ${fsPath} with built-in type-aware`)
        try {
          const { FileSystemStorage } = await import(
            './adapters/fileSystemStorage.js'
          )
          const storage = new FileSystemStorage(fsPath)
          configureCOW(storage, options)
          return storage
        } catch (fsError) {
          console.warn(
            'Failed to load FileSystemStorage, falling back to memory storage:',
            fsError
          )
        }
      }
    } catch (error) {
      // Not in a Node.js environment or file system is not available
      console.warn('Not in a Node.js environment:', error)
    }
  }

  // Next, try OPFS (browser only)
  if (isBrowser()) {
    console.warn('[brainy] Browser environment detected. Browser support is deprecated and will be removed in v8.0. Migrate to Node.js/Bun.')
    const opfsStorage = new OPFSStorage()
    if (opfsStorage.isOPFSAvailable()) {
      console.log('Using OPFS storage (auto-detected) + TypeAware wrapper')
      await opfsStorage.init()

      // Request persistent storage if specified
      if (options.requestPersistentStorage) {
        const isPersistent = await opfsStorage.requestPersistentStorage()
        console.log(`Persistent storage ${isPersistent ? 'granted' : 'denied'}`)
      }

      configureCOW(opfsStorage, options)
      return opfsStorage
    }
  }

  // Finally, fall back to memory storage
  console.log('Using memory storage (auto-detected) with built-in type-aware')
  const storage = new MemoryStorage()
  configureCOW(storage, options)
  return storage
}

/**
 * Export storage adapters (TypeAware is now built-in, no separate export)
 */
export {
  MemoryStorage,
  OPFSStorage,
  S3CompatibleStorage,
  R2Storage,
  GcsStorage,
  AzureBlobStorage
}

// Export FileSystemStorage conditionally
// NOTE: FileSystemStorage is now only imported dynamically to avoid fs imports in browser builds
// export { FileSystemStorage } from './adapters/fileSystemStorage.js'
