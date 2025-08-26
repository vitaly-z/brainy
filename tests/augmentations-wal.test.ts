import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrainyData } from '../src/index.js'
import { WALAugmentation } from '../src/augmentations/walAugmentation.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('WAL (Write-Ahead Logging) Augmentation', () => {
  let db: BrainyData | null = null
  let walDir: string | null = null
  
  // Helper to create test vectors
  const createTestVector = (seed: number = 0) => {
    return new Array(384).fill(0).map((_, i) => Math.sin(i + seed) * 0.5)
  }
  
  beforeEach(async () => {
    // Create a temp directory for WAL
    walDir = path.join(os.tmpdir(), `brainy-wal-test-${Date.now()}`)
    await fs.mkdir(walDir, { recursive: true })
  })
  
  afterEach(async () => {
    // Cleanup
    if (db) {
      await db.cleanup?.()
      db = null
    }
    
    // Clean up WAL directory
    if (walDir) {
      try {
        await fs.rm(walDir, { recursive: true, force: true })
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  })
  
  describe('Configuration', () => {
    it('should be disabled in test environment by default', async () => {
      // WAL is automatically disabled in test environments
      const testDb = new BrainyData()
      await testDb.init()
      
      // WAL should not create any files in test mode
      const files = await fs.readdir(process.cwd()).catch(() => [])
      const walFiles = files.filter(f => f.includes('.wal'))
      expect(walFiles.length).toBe(0)
      
      await testDb.cleanup?.()
    })
    
    it('should initialize with custom configuration', async () => {
      db = new BrainyData({
        walConfig: {
          enabled: true,
          walDir: walDir!,
          maxWalSize: 1024 * 1024, // 1MB
          flushInterval: 100 // 100ms
        }
      })
      
      await db.init()
      
      // Should create WAL directory
      const dirStats = await fs.stat(walDir!)
      expect(dirStats.isDirectory()).toBe(true)
    })
  })
  
  describe('Write Operations', () => {
    beforeEach(async () => {
      db = new BrainyData({
        walConfig: {
          enabled: true,
          walDir: walDir!,
          flushInterval: 50
        }
      })
      await db.init()
    })
    
    it('should log write operations to WAL', async () => {
      // Add some data
      await db.add(createTestVector(1), { id: 'test1', data: 'Test data 1' })
      await db.add(createTestVector(2), { id: 'test2', data: 'Test data 2' })
      
      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check WAL files exist
      const files = await fs.readdir(walDir!)
      const walFiles = files.filter(f => f.endsWith('.wal'))
      expect(walFiles.length).toBeGreaterThan(0)
    })
    
    it('should batch multiple operations', async () => {
      // Add multiple items quickly
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          db!.add(createTestVector(i), { id: `test${i}`, data: `Test ${i}` })
        )
      }
      
      await Promise.all(promises)
      
      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should have batched operations
      const files = await fs.readdir(walDir!)
      const walFiles = files.filter(f => f.endsWith('.wal'))
      
      // Should have created WAL files
      expect(walFiles.length).toBeGreaterThan(0)
    })
  })
  
  describe('Recovery', () => {
    it('should recover from WAL on restart', async () => {
      // Create first instance and add data
      const db1 = new BrainyData({
        walConfig: {
          enabled: true,
          walDir: walDir!,
          flushInterval: 50
        },
        storage: 'filesystem',
        storagePath: walDir
      })
      await db1.init()
      
      // Add test data
      await db1.add(createTestVector(1), { id: 'persist1', data: 'Should persist' })
      await db1.add(createTestVector(2), { id: 'persist2', data: 'Also persists' })
      
      // Wait for WAL flush
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Simulate crash (don't clean up properly)
      // Just null the reference without cleanup
      db1.cleanup = undefined
      
      // Create new instance with same WAL directory
      const db2 = new BrainyData({
        walConfig: {
          enabled: true,
          walDir: walDir!
        },
        storage: 'filesystem',
        storagePath: walDir
      })
      await db2.init()
      
      // Should recover data from WAL
      const result1 = await db2.get('persist1')
      const result2 = await db2.get('persist2')
      
      expect(result1).toBeDefined()
      expect(result1?.metadata?.data).toBe('Should persist')
      expect(result2).toBeDefined()
      expect(result2?.metadata?.data).toBe('Also persists')
      
      await db2.cleanup?.()
    })
  })
  
  describe('Performance', () => {
    it('should not significantly impact write performance', async () => {
      // Test with WAL disabled
      const dbNoWal = new BrainyData({
        walConfig: { enabled: false }
      })
      await dbNoWal.init()
      
      const startNoWal = performance.now()
      for (let i = 0; i < 100; i++) {
        await dbNoWal.add(createTestVector(i), { id: `test${i}` })
      }
      const timeNoWal = performance.now() - startNoWal
      
      await dbNoWal.cleanup?.()
      
      // Test with WAL enabled
      const dbWithWal = new BrainyData({
        walConfig: {
          enabled: true,
          walDir: walDir!,
          flushInterval: 1000 // Long interval to test batching
        }
      })
      await dbWithWal.init()
      
      const startWithWal = performance.now()
      for (let i = 0; i < 100; i++) {
        await dbWithWal.add(createTestVector(i), { id: `test${i}` })
      }
      const timeWithWal = performance.now() - startWithWal
      
      await dbWithWal.cleanup?.()
      
      // WAL should not add more than 50% overhead
      const overhead = (timeWithWal - timeNoWal) / timeNoWal
      expect(overhead).toBeLessThan(0.5)
    })
  })
  
  describe('Error Handling', () => {
    it('should handle WAL directory permission errors gracefully', async () => {
      // Try to use a directory we can't write to
      const readOnlyDir = '/root/no-permission-wal'
      
      const dbWithBadWal = new BrainyData({
        walConfig: {
          enabled: true,
          walDir: readOnlyDir
        }
      })
      
      // Should not throw, just disable WAL
      await expect(dbWithBadWal.init()).resolves.not.toThrow()
      
      // Should still work without WAL
      await dbWithBadWal.add(createTestVector(1), { id: 'test1' })
      const result = await dbWithBadWal.get('test1')
      expect(result).toBeDefined()
      
      await dbWithBadWal.cleanup?.()
    })
    
    it('should handle corrupted WAL files', async () => {
      // Create a corrupted WAL file
      const walFile = path.join(walDir!, 'corrupt.wal')
      await fs.writeFile(walFile, 'This is not valid WAL data!')
      
      const dbWithCorruptWal = new BrainyData({
        walConfig: {
          enabled: true,
          walDir: walDir!
        }
      })
      
      // Should not crash on corrupted WAL
      await expect(dbWithCorruptWal.init()).resolves.not.toThrow()
      
      // Should still function
      await dbWithCorruptWal.add(createTestVector(1), { id: 'test1' })
      const result = await dbWithCorruptWal.get('test1')
      expect(result).toBeDefined()
      
      await dbWithCorruptWal.cleanup?.()
    })
  })
  
  describe('Standalone WAL Augmentation', () => {
    it('should work as standalone augmentation', () => {
      const wal = new WALAugmentation({
        enabled: true,
        walDir: walDir!
      })
      
      expect(wal.name).toBe('WAL')
      expect(wal.timing).toBe('before')
      expect(wal.operations).toContain('saveNoun')
      expect(wal.operations).toContain('saveVerb')
      expect(wal.priority).toBe(100) // Critical priority
    })
    
    it('should track WAL metrics', async () => {
      const wal = new WALAugmentation({
        enabled: true,
        walDir: walDir!,
        flushInterval: 50
      })
      
      // Initialize with mock context
      const mockContext = {
        brain: {},
        storage: {},
        config: {},
        log: () => {}
      }
      
      await wal.initialize(mockContext as any)
      
      // Get stats
      const stats = wal.getStats()
      expect(stats).toBeDefined()
      expect(stats.operationsLogged).toBe(0)
      expect(stats.bytesWritten).toBe(0)
      
      await wal.shutdown()
    })
  })
})