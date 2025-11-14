/**
 * Transaction - Atomic Unit of Work
 *
 * Executes operations atomically: all succeed or all rollback.
 * Prevents partial failures that leave system in inconsistent state.
 *
 * Usage:
 * ```typescript
 * const tx = new Transaction()
 * tx.addOperation(operation1)
 * tx.addOperation(operation2)
 * await tx.execute() // Both succeed or both rollback
 * ```
 */

import {
  Operation,
  RollbackAction,
  TransactionState,
  TransactionContext,
  TransactionOptions
} from './types.js'
import {
  InvalidTransactionStateError,
  TransactionExecutionError,
  TransactionRollbackError,
  TransactionTimeoutError
} from './errors.js'
import { prodLog } from '../utils/logger.js'

/**
 * Default transaction options
 */
const DEFAULT_OPTIONS: Required<TransactionOptions> = {
  timeout: 30000, // 30 seconds
  logging: false,
  maxRollbackRetries: 3
}

/**
 * Transaction class
 */
export class Transaction implements TransactionContext {
  private operations: Operation[] = []
  private rollbackActions: RollbackAction[] = []
  private state: TransactionState = 'pending'
  private readonly options: Required<TransactionOptions>
  private startTime?: number
  private endTime?: number

  constructor(options: TransactionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Add an operation to the transaction
   */
  addOperation(operation: Operation): void {
    if (this.state !== 'pending') {
      throw new InvalidTransactionStateError(
        this.state,
        'add operation'
      )
    }
    this.operations.push(operation)
  }

  /**
   * Get current transaction state
   */
  getState(): TransactionState {
    return this.state
  }

  /**
   * Get number of operations in transaction
   */
  getOperationCount(): number {
    return this.operations.length
  }

  /**
   * Execute all operations atomically
   */
  async execute(): Promise<void> {
    if (this.state !== 'pending') {
      throw new InvalidTransactionStateError(
        this.state,
        'execute'
      )
    }

    this.state = 'executing'
    this.startTime = Date.now()

    if (this.options.logging) {
      prodLog.info(`[Transaction] Executing ${this.operations.length} operations`)
    }

    try {
      // Execute each operation in order
      for (let i = 0; i < this.operations.length; i++) {
        // Check timeout
        if (Date.now() - this.startTime > this.options.timeout) {
          throw new TransactionTimeoutError(this.options.timeout, i)
        }

        const operation = this.operations[i]

        try {
          if (this.options.logging) {
            prodLog.info(`[Transaction] Executing operation ${i}: ${operation.name || 'unnamed'}`)
          }

          // Execute operation
          const rollbackAction = await operation.execute()

          // Record rollback action (if provided)
          if (rollbackAction) {
            this.rollbackActions.push(rollbackAction)
          }

        } catch (error) {
          // Operation failed - rollback and re-throw
          const executionError = new TransactionExecutionError(
            `Operation ${i} failed: ${(error as Error).message}`,
            i,
            operation.name,
            error as Error
          )

          await this.rollback(executionError)
          throw executionError
        }
      }

      // All operations succeeded - commit
      this.commit()

    } catch (error) {
      // Error already handled in rollback
      throw error
    }
  }

  /**
   * Commit the transaction
   */
  private commit(): void {
    this.state = 'committed'
    this.endTime = Date.now()

    if (this.options.logging) {
      const duration = this.endTime - (this.startTime || this.endTime)
      prodLog.info(`[Transaction] Committed successfully in ${duration}ms`)
    }

    // Clear rollback actions - no longer needed
    this.rollbackActions = []
  }

  /**
   * Rollback all executed operations in reverse order
   */
  private async rollback(originalError: Error): Promise<void> {
    this.state = 'rolling_back'

    if (this.options.logging) {
      prodLog.info(`[Transaction] Rolling back ${this.rollbackActions.length} operations`)
    }

    const rollbackErrors: Error[] = []

    // Execute rollback actions in REVERSE order
    for (let i = this.rollbackActions.length - 1; i >= 0; i--) {
      const action = this.rollbackActions[i]

      // Retry rollback with exponential backoff
      let attempts = 0
      let success = false

      while (attempts < this.options.maxRollbackRetries && !success) {
        try {
          await action()
          success = true

          if (this.options.logging) {
            prodLog.info(`[Transaction] Rolled back operation ${i}`)
          }

        } catch (error) {
          attempts++

          if (attempts >= this.options.maxRollbackRetries) {
            // Max retries exceeded - log error and continue
            const rollbackError = error as Error
            rollbackErrors.push(rollbackError)

            prodLog.error(
              `[Transaction] Rollback failed for operation ${i} after ${attempts} attempts: ${rollbackError.message}`
            )
          } else {
            // Retry with exponential backoff
            const delayMs = Math.pow(2, attempts) * 100
            await new Promise(resolve => setTimeout(resolve, delayMs))
          }
        }
      }
    }

    this.state = 'rolled_back'
    this.endTime = Date.now()

    if (this.options.logging) {
      const duration = this.endTime - (this.startTime || this.endTime)
      prodLog.info(`[Transaction] Rolled back in ${duration}ms`)
    }

    // If rollback encountered errors, wrap them with original error
    if (rollbackErrors.length > 0) {
      throw new TransactionRollbackError(
        `Transaction rollback encountered ${rollbackErrors.length} errors during cleanup`,
        originalError,
        rollbackErrors
      )
    }
  }

  /**
   * Get transaction execution time in milliseconds
   */
  getExecutionTimeMs(): number | undefined {
    if (this.startTime && this.endTime) {
      return this.endTime - this.startTime
    }
    return undefined
  }
}
