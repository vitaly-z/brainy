/**
 * TransactionManager Tests
 *
 * Tests the TransactionManager for:
 * - High-level transaction API
 * - Statistics tracking
 * - Error handling
 * - Result wrapping
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TransactionManager } from '../../src/transaction/TransactionManager.js'
import { TransactionError } from '../../src/transaction/errors.js'

describe('TransactionManager', () => {
  let manager: TransactionManager

  beforeEach(() => {
    manager = new TransactionManager()
  })

  describe('executeTransaction', () => {
    it('should execute transaction and return user value', async () => {
      const result = await manager.executeTransaction(async (tx) => {
        tx.addOperation({ execute: async () => undefined })
        return 'success'
      })

      expect(result).toBe('success')
    })

    it('should execute multiple operations', async () => {
      const executionOrder: number[] = []

      await manager.executeTransaction(async (tx) => {
        tx.addOperation({
          execute: async () => {
            executionOrder.push(1)
            return async () => {}
          }
        })

        tx.addOperation({
          execute: async () => {
            executionOrder.push(2)
            return async () => {}
          }
        })
      })

      expect(executionOrder).toEqual([1, 2])
    })

    it('should throw TransactionError on failure', async () => {
      await expect(
        manager.executeTransaction(async (tx) => {
          tx.addOperation({
            execute: async () => {
              throw new Error('Operation failed')
            }
          })
        })
      ).rejects.toThrow(TransactionError)
    })

    it('should pass through custom transaction options', async () => {
      // Should timeout with many operations
      await expect(
        manager.executeTransaction(
          async (tx) => {
            for (let i = 0; i < 10; i++) {
              tx.addOperation({
                execute: async () => {
                  await new Promise(resolve => setTimeout(resolve, 10))
                  return async () => {}
                }
              })
            }
          },
          { timeout: 50 }
        )
      ).rejects.toThrow()
    })
  })

  describe('executeTransactionWithResult', () => {
    it('should return detailed result', async () => {
      const result = await manager.executeTransactionWithResult(async (tx) => {
        tx.addOperation({
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 1))
            return async () => {}
          }
        })
        tx.addOperation({ execute: async () => undefined })
        return 'success'
      })

      expect(result.value).toBe('success')
      expect(result.operationCount).toBe(2)
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('should measure execution time', async () => {
      const result = await manager.executeTransactionWithResult(async (tx) => {
        tx.addOperation({
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
            return async () => {}
          }
        })
        return 'done'
      })

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(10)
    })
  })

  describe('Statistics Tracking', () => {
    it('should track total transactions', async () => {
      await manager.executeTransaction(async (tx) => {
        tx.addOperation({ execute: async () => undefined })
      })

      await manager.executeTransaction(async (tx) => {
        tx.addOperation({ execute: async () => undefined })
      })

      const stats = manager.getStats()
      expect(stats.totalTransactions).toBe(2)
    })

    it('should track successful transactions', async () => {
      await manager.executeTransaction(async (tx) => {
        tx.addOperation({ execute: async () => undefined })
      })

      const stats = manager.getStats()
      expect(stats.successfulTransactions).toBe(1)
      expect(stats.failedTransactions).toBe(0)
    })

    it('should track failed transactions', async () => {
      await manager.executeTransaction(async (tx) => {
        tx.addOperation({ execute: async () => undefined })
      }).catch(() => {})

      await manager.executeTransaction(async (tx) => {
        tx.addOperation({
          execute: async () => {
            throw new Error('Failed')
          }
        })
      }).catch(() => {})

      const stats = manager.getStats()
      expect(stats.successfulTransactions).toBe(1)
      expect(stats.failedTransactions).toBe(1)
    })

    it('should track rolled back transactions', async () => {
      await manager.executeTransaction(async (tx) => {
        tx.addOperation({
          execute: async () => {
            return async () => { /* rollback */ }
          }
        })
        tx.addOperation({
          execute: async () => {
            throw new Error('Failed')
          }
        })
      }).catch(() => {})

      const stats = manager.getStats()
      expect(stats.rolledBackTransactions).toBe(1)
    })

    it('should calculate average execution time', async () => {
      await manager.executeTransaction(async (tx) => {
        tx.addOperation({
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
            return async () => {}
          }
        })
      })

      await manager.executeTransaction(async (tx) => {
        tx.addOperation({
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
            return async () => {}
          }
        })
      })

      const stats = manager.getStats()
      expect(stats.averageExecutionTimeMs).toBeGreaterThan(0)
      expect(stats.totalTransactions).toBe(2)
    })

    it('should calculate average operations per transaction', async () => {
      await manager.executeTransaction(async (tx) => {
        tx.addOperation({ execute: async () => undefined })
        tx.addOperation({ execute: async () => undefined })
      })

      await manager.executeTransaction(async (tx) => {
        tx.addOperation({ execute: async () => undefined })
        tx.addOperation({ execute: async () => undefined })
        tx.addOperation({ execute: async () => undefined })
        tx.addOperation({ execute: async () => undefined })
      })

      const stats = manager.getStats()
      expect(stats.averageOperationsPerTransaction).toBe(3) // (2 + 4) / 2
    })

    it('should allow resetting statistics', async () => {
      await manager.executeTransaction(async (tx) => {
        tx.addOperation({ execute: async () => undefined })
      })

      let stats = manager.getStats()
      expect(stats.totalTransactions).toBe(1)

      manager.resetStats()

      stats = manager.getStats()
      expect(stats.totalTransactions).toBe(0)
      expect(stats.successfulTransactions).toBe(0)
      expect(stats.failedTransactions).toBe(0)
      expect(stats.rolledBackTransactions).toBe(0)
      expect(stats.averageExecutionTimeMs).toBe(0)
      expect(stats.averageOperationsPerTransaction).toBe(0)
    })
  })

  describe('Concurrent Transactions', () => {
    it('should handle concurrent transactions', async () => {
      const results = await Promise.all([
        manager.executeTransaction(async (tx) => {
          tx.addOperation({ execute: async () => undefined })
          return 1
        }),
        manager.executeTransaction(async (tx) => {
          tx.addOperation({ execute: async () => undefined })
          return 2
        }),
        manager.executeTransaction(async (tx) => {
          tx.addOperation({ execute: async () => undefined })
          return 3
        })
      ])

      expect(results).toEqual([1, 2, 3])

      const stats = manager.getStats()
      expect(stats.totalTransactions).toBe(3)
      expect(stats.successfulTransactions).toBe(3)
    })

    it('should track mixed success/failure in concurrent transactions', async () => {
      const results = await Promise.allSettled([
        manager.executeTransaction(async (tx) => {
          tx.addOperation({ execute: async () => undefined })
        }),
        manager.executeTransaction(async (tx) => {
          tx.addOperation({
            execute: async () => {
              throw new Error('Failed')
            }
          })
        }),
        manager.executeTransaction(async (tx) => {
          tx.addOperation({ execute: async () => undefined })
        })
      ])

      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
      expect(results[2].status).toBe('fulfilled')

      const stats = manager.getStats()
      expect(stats.totalTransactions).toBe(3)
      expect(stats.successfulTransactions).toBe(2)
      expect(stats.failedTransactions).toBe(1)
    })
  })

  describe('Error Context', () => {
    it('should wrap non-TransactionError errors', async () => {
      const error = await manager.executeTransaction(async () => {
        throw new Error('Custom error')
      }).catch(e => e)

      expect(error).toBeInstanceOf(TransactionError)
      expect(error.message).toContain('Custom error')
    })

    it('should preserve TransactionError instances', async () => {
      const error = await manager.executeTransaction(async (tx) => {
        tx.addOperation({
          execute: async () => {
            throw new Error('Operation failed')
          }
        })
      }).catch(e => e)

      expect(error).toBeInstanceOf(TransactionError)
    })
  })

  describe('Stats Immutability', () => {
    it('should return immutable stats copy', async () => {
      await manager.executeTransaction(async (tx) => {
        tx.addOperation({ execute: async () => undefined })
      })

      const stats1 = manager.getStats()
      const stats2 = manager.getStats()

      expect(stats1).not.toBe(stats2) // Different objects
      expect(stats1).toEqual(stats2) // Same values
    })
  })
})
