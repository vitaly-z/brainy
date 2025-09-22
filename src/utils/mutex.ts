/**
 * Universal Mutex Implementation for Thread-Safe Operations
 * Provides consistent locking across all storage adapters
 * Critical for preventing race conditions in count operations
 */

export interface MutexInterface {
  acquire(key: string, timeout?: number): Promise<() => void>
  runExclusive<T>(key: string, fn: () => Promise<T>, timeout?: number): Promise<T>
  isLocked(key: string): boolean
}

/**
 * In-memory mutex for single-process scenarios
 * Used by MemoryStorage and as fallback for other adapters
 */
export class InMemoryMutex implements MutexInterface {
  private locks: Map<string, {
    queue: Array<() => void>
    locked: boolean
  }> = new Map()

  async acquire(key: string, timeout: number = 30000): Promise<() => void> {
    if (!this.locks.has(key)) {
      this.locks.set(key, { queue: [], locked: false })
    }

    const lock = this.locks.get(key)!

    if (!lock.locked) {
      lock.locked = true
      return () => this.release(key)
    }

    // Wait in queue
    return new Promise<() => void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = lock.queue.indexOf(resolver)
        if (index !== -1) {
          lock.queue.splice(index, 1)
        }
        reject(new Error(`Mutex timeout for key: ${key}`))
      }, timeout)

      const resolver = () => {
        clearTimeout(timer)
        lock.locked = true
        resolve(() => this.release(key))
      }

      lock.queue.push(resolver)
    })
  }

  private release(key: string): void {
    const lock = this.locks.get(key)
    if (!lock) return

    if (lock.queue.length > 0) {
      const next = lock.queue.shift()!
      next()
    } else {
      lock.locked = false
      // Clean up if no waiters
      if (lock.queue.length === 0) {
        this.locks.delete(key)
      }
    }
  }

  async runExclusive<T>(
    key: string,
    fn: () => Promise<T>,
    timeout?: number
  ): Promise<T> {
    const release = await this.acquire(key, timeout)
    try {
      return await fn()
    } finally {
      release()
    }
  }

  isLocked(key: string): boolean {
    return this.locks.get(key)?.locked || false
  }
}

/**
 * File-based mutex for multi-process scenarios (Node.js)
 * Uses atomic file operations to prevent TOCTOU races
 */
export class FileMutex implements MutexInterface {
  private fs: any
  private path: any
  private lockDir: string
  private processLocks: Map<string, () => void> = new Map()
  private lockTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(lockDir: string) {
    this.lockDir = lockDir
    // Lazy load Node.js modules
    if (typeof window === 'undefined') {
      this.fs = require('fs')
      this.path = require('path')
    }
  }

  async acquire(key: string, timeout: number = 30000): Promise<() => void> {
    if (!this.fs || !this.path) {
      throw new Error('FileMutex is only available in Node.js environments')
    }

    const lockFile = this.path.join(this.lockDir, `${key}.lock`)
    const lockId = `${Date.now()}_${Math.random()}_${process.pid}`
    const startTime = Date.now()

    // Ensure lock directory exists
    await this.fs.promises.mkdir(this.lockDir, { recursive: true })

    while (Date.now() - startTime < timeout) {
      try {
        // Atomic lock creation using 'wx' flag
        await this.fs.promises.writeFile(
          lockFile,
          JSON.stringify({
            lockId,
            pid: process.pid,
            timestamp: Date.now(),
            expiresAt: Date.now() + timeout
          }),
          { flag: 'wx' } // Write exclusive - fails if exists
        )

        // Successfully acquired lock
        const release = () => this.release(key, lockFile, lockId)
        this.processLocks.set(key, release)

        // Auto-release on timeout
        const timer = setTimeout(() => {
          release()
        }, timeout)
        this.lockTimers.set(key, timer)

        return release
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          // Lock exists - check if expired
          try {
            const data = await this.fs.promises.readFile(lockFile, 'utf-8')
            const lock = JSON.parse(data)

            if (lock.expiresAt < Date.now()) {
              // Expired - try to remove
              try {
                await this.fs.promises.unlink(lockFile)
                continue // Retry acquisition
              } catch (unlinkError: any) {
                if (unlinkError.code !== 'ENOENT') {
                  // Someone else removed it, continue
                  continue
                }
              }
            }
          } catch {
            // Can't read lock file, assume it's valid
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 50))
        } else {
          throw error
        }
      }
    }

    throw new Error(`Failed to acquire mutex for key: ${key} after ${timeout}ms`)
  }

  private async release(key: string, lockFile: string, lockId: string): Promise<void> {
    // Clear timer
    const timer = this.lockTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.lockTimers.delete(key)
    }

    // Remove from process locks
    this.processLocks.delete(key)

    try {
      // Verify we own the lock before releasing
      const data = await this.fs.promises.readFile(lockFile, 'utf-8')
      const lock = JSON.parse(data)

      if (lock.lockId === lockId) {
        await this.fs.promises.unlink(lockFile)
      }
    } catch {
      // Lock already released or doesn't exist
    }
  }

  async runExclusive<T>(
    key: string,
    fn: () => Promise<T>,
    timeout?: number
  ): Promise<T> {
    const release = await this.acquire(key, timeout)
    try {
      return await fn()
    } finally {
      release()
    }
  }

  isLocked(key: string): boolean {
    return this.processLocks.has(key)
  }

  /**
   * Clean up all locks held by this process
   */
  async cleanup(): Promise<void> {
    // Clear all timers
    for (const timer of this.lockTimers.values()) {
      clearTimeout(timer)
    }
    this.lockTimers.clear()

    // Release all locks
    const releases = Array.from(this.processLocks.values())
    await Promise.all(releases.map(release => release()))
    this.processLocks.clear()
  }
}

/**
 * Factory to create appropriate mutex for the environment
 */
export function createMutex(options?: {
  type?: 'memory' | 'file'
  lockDir?: string
}): MutexInterface {
  const type = options?.type || (typeof window === 'undefined' ? 'file' : 'memory')

  if (type === 'file' && typeof window === 'undefined') {
    const lockDir = options?.lockDir || '.brainy/locks'
    return new FileMutex(lockDir)
  }

  return new InMemoryMutex()
}

// Global mutex instance for count operations
let globalMutex: MutexInterface | null = null

export function getGlobalMutex(): MutexInterface {
  if (!globalMutex) {
    globalMutex = createMutex()
  }
  return globalMutex
}

/**
 * Cleanup function for graceful shutdown
 */
export async function cleanupMutexes(): Promise<void> {
  if (globalMutex && 'cleanup' in globalMutex) {
    await (globalMutex as any).cleanup()
  }
}