/**
 * Transaction Core Tests
 *
 * Tests the Transaction class for:
 * - Basic execution flow
 * - Rollback on failure
 * - State management
 * - Timeout handling
 * - Retry logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Transaction } from '../../src/transaction/Transaction.js'
import type { Operation, RollbackAction } from '../../src/transaction/types.js'
import {
  InvalidTransactionStateError,
  TransactionExecutionError,
  TransactionTimeoutError
} from '../../src/transaction/errors.js'

describe('Transaction', () => {
  describe('Basic Execution', () => {
    it('should execute operations in order and commit', async () => {
      const executionOrder: number[] = []

      const op1: Operation = {
        name: 'Operation1',
        execute: async () => {
          executionOrder.push(1)
          return async () => { /* rollback */ }
        }
      }

      const op2: Operation = {
        name: 'Operation2',
        execute: async () => {
          executionOrder.push(2)
          return async () => { /* rollback */ }
        }
      }

      const tx = new Transaction()
      tx.addOperation(op1)
      tx.addOperation(op2)

      await tx.execute()

      expect(executionOrder).toEqual([1, 2])
      expect(tx.getState()).toBe('committed')
    })

    it('should track operation count', () => {
      const tx = new Transaction()

      expect(tx.getOperationCount()).toBe(0)

      tx.addOperation({ execute: async () => undefined })
      expect(tx.getOperationCount()).toBe(1)

      tx.addOperation({ execute: async () => undefined })
      expect(tx.getOperationCount()).toBe(2)
    })

    it('should record execution time', async () => {
      const tx = new Transaction()
      tx.addOperation({
        execute: async () => {
          // Small delay to ensure measurable time
          await new Promise(resolve => setTimeout(resolve, 1))
          return async () => {}
        }
      })

      await tx.execute()

      const executionTime = tx.getExecutionTimeMs()
      expect(executionTime).toBeGreaterThanOrEqual(0) // Can be 0 for very fast operations
      expect(executionTime).toBeLessThan(1000) // Should be reasonably quick
    })
  })

  describe('Rollback on Failure', () => {
    it('should rollback all operations when one fails', async () => {
      const rollbackOrder: number[] = []

      const op1: Operation = {
        name: 'Operation1',
        execute: async () => {
          return async () => { rollbackOrder.push(1) }
        }
      }

      const op2: Operation = {
        name: 'Operation2',
        execute: async () => {
          throw new Error('Operation 2 failed')
        }
      }

      const op3: Operation = {
        name: 'Operation3',
        execute: async () => {
          return async () => { rollbackOrder.push(3) }
        }
      }

      const tx = new Transaction()
      tx.addOperation(op1)
      tx.addOperation(op2)
      tx.addOperation(op3)

      await expect(tx.execute()).rejects.toThrow(TransactionExecutionError)

      expect(tx.getState()).toBe('rolled_back')
      // Only op1 executed before failure, so only op1 should rollback
      expect(rollbackOrder).toEqual([1])
    })

    it('should rollback operations in reverse order', async () => {
      const rollbackOrder: number[] = []

      const op1: Operation = {
        execute: async () => {
          return async () => { rollbackOrder.push(1) }
        }
      }

      const op2: Operation = {
        execute: async () => {
          return async () => { rollbackOrder.push(2) }
        }
      }

      const op3: Operation = {
        execute: async () => {
          throw new Error('op3 failed')
        }
      }

      const tx = new Transaction()
      tx.addOperation(op1)
      tx.addOperation(op2)
      tx.addOperation(op3)

      await expect(tx.execute()).rejects.toThrow()

      // Rollback in reverse order: op2, then op1
      expect(rollbackOrder).toEqual([2, 1])
    })

    it('should retry failed rollback operations', async () => {
      let rollbackAttempts = 0

      const op: Operation = {
        execute: async () => {
          return async () => {
            rollbackAttempts++
            if (rollbackAttempts < 2) {
              throw new Error('Rollback failed')
            }
            // Success on 2nd attempt
          }
        }
      }

      const failingOp: Operation = {
        execute: async () => {
          throw new Error('Operation failed')
        }
      }

      const tx = new Transaction()
      tx.addOperation(op)
      tx.addOperation(failingOp)

      await expect(tx.execute()).rejects.toThrow()

      // Should have retried rollback
      expect(rollbackAttempts).toBe(2)
    })

    it('should continue rollback even if one rollback fails', async () => {
      const rollbackOrder: number[] = []

      const op1: Operation = {
        execute: async () => {
          return async () => { rollbackOrder.push(1) }
        }
      }

      const op2: Operation = {
        execute: async () => {
          return async () => {
            rollbackOrder.push(2)
            throw new Error('Rollback 2 failed')
          }
        }
      }

      const op3: Operation = {
        execute: async () => {
          throw new Error('op3 failed')
        }
      }

      const tx = new Transaction({ maxRollbackRetries: 1 })
      tx.addOperation(op1)
      tx.addOperation(op2)
      tx.addOperation(op3)

      await expect(tx.execute()).rejects.toThrow()

      // Should attempt both rollbacks despite op2 failing
      expect(rollbackOrder).toContain(1)
      expect(rollbackOrder).toContain(2)
    })
  })

  describe('State Management', () => {
    it('should prevent adding operations after execution starts', async () => {
      const tx = new Transaction()
      tx.addOperation({ execute: async () => undefined })

      const executePromise = tx.execute()

      expect(() => {
        tx.addOperation({ execute: async () => undefined })
      }).toThrow(InvalidTransactionStateError)

      await executePromise
    })

    it('should prevent double execution', async () => {
      const tx = new Transaction()
      tx.addOperation({ execute: async () => undefined })

      await tx.execute()

      await expect(tx.execute()).rejects.toThrow(InvalidTransactionStateError)
    })

    it('should transition through states correctly', async () => {
      const states: string[] = []

      const tx = new Transaction()
      states.push(tx.getState())

      tx.addOperation({
        execute: async () => {
          states.push(tx.getState())
          return async () => {}
        }
      })

      await tx.execute()
      states.push(tx.getState())

      expect(states).toEqual(['pending', 'executing', 'committed'])
    })
  })

  describe('Timeout Handling', () => {
    it('should timeout long-running transactions with many operations', async () => {
      const tx = new Transaction({ timeout: 50 })

      // Add many operations that cumulatively exceed timeout
      for (let i = 0; i < 10; i++) {
        tx.addOperation({
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
            return async () => {}
          }
        })
      }

      await expect(tx.execute()).rejects.toThrow(TransactionTimeoutError)
    })

    it('should not timeout fast transactions', async () => {
      const tx = new Transaction({ timeout: 1000 })

      tx.addOperation({
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return async () => {}
        }
      })

      await expect(tx.execute()).resolves.toBeUndefined()
    })
  })

  describe('Options', () => {
    it('should respect custom timeout', async () => {
      const tx = new Transaction({ timeout: 50 })

      // Many operations to ensure cumulative time exceeds timeout
      for (let i = 0; i < 10; i++) {
        tx.addOperation({
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
            return async () => {}
          }
        })
      }

      const error = await tx.execute().catch(e => e)
      expect(error).toBeInstanceOf(TransactionTimeoutError)
    })

    it('should respect maxRollbackRetries', async () => {
      let attempts = 0

      const tx = new Transaction({ maxRollbackRetries: 2 })

      tx.addOperation({
        execute: async () => {
          return async () => {
            attempts++
            throw new Error('Rollback failed')
          }
        }
      })

      tx.addOperation({
        execute: async () => {
          throw new Error('Operation failed')
        }
      })

      await expect(tx.execute()).rejects.toThrow()

      // Should try maxRollbackRetries times
      expect(attempts).toBe(2)
    })
  })

  describe('Error Context', () => {
    it('should include operation name in error', async () => {
      const tx = new Transaction()

      tx.addOperation({
        name: 'MySpecialOperation',
        execute: async () => {
          throw new Error('Failed')
        }
      })

      const error = await tx.execute().catch(e => e)
      expect(error).toBeInstanceOf(TransactionExecutionError)
      expect(error.operationName).toBe('MySpecialOperation')
    })

    it('should include operation index in error', async () => {
      const tx = new Transaction()

      tx.addOperation({ execute: async () => undefined })
      tx.addOperation({ execute: async () => undefined })
      tx.addOperation({
        execute: async () => {
          throw new Error('Failed')
        }
      })

      const error = await tx.execute().catch(e => e)
      expect(error).toBeInstanceOf(TransactionExecutionError)
      expect(error.operationIndex).toBe(2)
    })
  })

  describe('Empty Transactions', () => {
    it('should handle empty transaction', async () => {
      const tx = new Transaction()

      await tx.execute()

      expect(tx.getState()).toBe('committed')
      expect(tx.getOperationCount()).toBe(0)
    })
  })

  describe('Operations without Rollback', () => {
    it('should handle operations that return no rollback action', async () => {
      const tx = new Transaction()

      tx.addOperation({
        execute: async () => {
          return undefined // No rollback needed
        }
      })

      await expect(tx.execute()).resolves.toBeUndefined()
      expect(tx.getState()).toBe('committed')
    })
  })
})
