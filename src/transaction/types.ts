/**
 * Transaction System Types
 *
 * Provides atomicity for Brainy operations - all succeed or all rollback.
 * Prevents partial failures that leave system in inconsistent state.
 */

/**
 * Transaction state
 */
export type TransactionState =
  | 'pending'      // Created but not executed
  | 'executing'    // Currently executing operations
  | 'committed'    // Successfully committed
  | 'rolling_back' // Rolling back due to failure
  | 'rolled_back'  // Successfully rolled back

/**
 * Rollback action - undoes an operation
 * Must be idempotent (safe to call multiple times)
 */
export type RollbackAction = () => Promise<void>

/**
 * Operation that can be executed and rolled back
 */
export interface Operation {
  /**
   * Execute the operation
   * @returns Rollback action to undo this operation (or undefined if no rollback needed)
   */
  execute(): Promise<RollbackAction | undefined>

  /**
   * Optional: Name of operation for debugging
   */
  readonly name?: string
}

/**
 * Transaction context passed to user functions
 */
export interface TransactionContext {
  /**
   * Add an operation to the transaction
   */
  addOperation(operation: Operation): void

  /**
   * Get current transaction state
   */
  getState(): TransactionState

  /**
   * Get number of operations in transaction
   */
  getOperationCount(): number
}

/**
 * Function that builds a transaction
 */
export type TransactionFunction<T> = (ctx: TransactionContext) => Promise<T>

/**
 * Transaction execution result
 */
export interface TransactionResult<T> {
  /**
   * Result value from user function
   */
  value: T

  /**
   * Number of operations executed
   */
  operationCount: number

  /**
   * Execution time in milliseconds
   */
  executionTimeMs: number
}

/**
 * Transaction execution options
 */
export interface TransactionOptions {
  /**
   * Timeout in milliseconds (default: 30000 = 30 seconds)
   */
  timeout?: number

  /**
   * Whether to log transaction execution (default: false)
   */
  logging?: boolean

  /**
   * Maximum number of rollback retry attempts (default: 3)
   */
  maxRollbackRetries?: number
}
