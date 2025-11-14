/**
 * Transaction Manager
 *
 * Manages transaction execution across the system.
 * Provides high-level API for executing atomic operations.
 *
 * Usage:
 * ```typescript
 * const txManager = new TransactionManager()
 *
 * const result = await txManager.executeTransaction(async (tx) => {
 *   tx.addOperation(operation1)
 *   tx.addOperation(operation2)
 *   return someValue
 * })
 * ```
 */

import { Transaction } from './Transaction.js'
import {
  TransactionFunction,
  TransactionResult,
  TransactionOptions
} from './types.js'
import { TransactionError } from './errors.js'
import { prodLog } from '../utils/logger.js'

/**
 * Transaction Manager Statistics
 */
export interface TransactionStats {
  totalTransactions: number
  successfulTransactions: number
  failedTransactions: number
  rolledBackTransactions: number
  averageExecutionTimeMs: number
  averageOperationsPerTransaction: number
}

/**
 * Transaction Manager
 */
export class TransactionManager {
  private stats: TransactionStats = {
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    rolledBackTransactions: 0,
    averageExecutionTimeMs: 0,
    averageOperationsPerTransaction: 0
  }

  private totalExecutionTime = 0
  private totalOperations = 0

  /**
   * Execute a function within a transaction
   * All operations succeed atomically or all rollback
   *
   * @param fn Function that builds and executes transaction
   * @param options Transaction execution options
   * @returns Result from user function
   * @throws TransactionError if transaction fails
   */
  async executeTransaction<T>(
    fn: TransactionFunction<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const transaction = new Transaction(options)

    this.stats.totalTransactions++

    try {
      // Execute user function (builds operations list)
      const result = await fn(transaction)

      // Execute all operations atomically
      await transaction.execute()

      // Update statistics
      this.stats.successfulTransactions++
      this.updateStats(transaction)

      return result

    } catch (error) {
      // Transaction failed and rolled back
      this.stats.failedTransactions++

      if (transaction.getState() === 'rolled_back') {
        this.stats.rolledBackTransactions++
      }

      this.updateStats(transaction)

      // Re-throw with context
      if (error instanceof TransactionError) {
        throw error
      } else {
        throw new TransactionError(
          `Transaction failed: ${(error as Error).message}`,
          { cause: error }
        )
      }
    }
  }

  /**
   * Execute a transaction and return detailed result
   */
  async executeTransactionWithResult<T>(
    fn: TransactionFunction<T>,
    options?: TransactionOptions
  ): Promise<TransactionResult<T>> {
    const startTime = Date.now()
    const transaction = new Transaction(options)

    try {
      const value = await fn(transaction)
      await transaction.execute()

      const executionTimeMs = Date.now() - startTime

      return {
        value,
        operationCount: transaction.getOperationCount(),
        executionTimeMs
      }

    } catch (error) {
      // Transaction failed
      throw error
    }
  }

  /**
   * Get transaction statistics
   */
  getStats(): Readonly<TransactionStats> {
    return { ...this.stats }
  }

  /**
   * Reset transaction statistics
   */
  resetStats(): void {
    this.stats = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      rolledBackTransactions: 0,
      averageExecutionTimeMs: 0,
      averageOperationsPerTransaction: 0
    }
    this.totalExecutionTime = 0
    this.totalOperations = 0
  }

  /**
   * Update running statistics
   */
  private updateStats(transaction: Transaction): void {
    const executionTime = transaction.getExecutionTimeMs()
    const operationCount = transaction.getOperationCount()

    if (executionTime !== undefined) {
      this.totalExecutionTime += executionTime
      this.stats.averageExecutionTimeMs =
        this.totalExecutionTime / this.stats.totalTransactions
    }

    this.totalOperations += operationCount
    this.stats.averageOperationsPerTransaction =
      this.totalOperations / this.stats.totalTransactions
  }

  /**
   * Log current statistics
   */
  logStats(): void {
    prodLog.info('[TransactionManager] Statistics:')
    prodLog.info(`  Total: ${this.stats.totalTransactions}`)
    prodLog.info(`  Successful: ${this.stats.successfulTransactions}`)
    prodLog.info(`  Failed: ${this.stats.failedTransactions}`)
    prodLog.info(`  Rolled back: ${this.stats.rolledBackTransactions}`)
    prodLog.info(`  Avg execution time: ${this.stats.averageExecutionTimeMs.toFixed(2)}ms`)
    prodLog.info(`  Avg operations/tx: ${this.stats.averageOperationsPerTransaction.toFixed(2)}`)
  }
}
