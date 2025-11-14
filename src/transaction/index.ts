/**
 * Transaction System
 *
 * Provides atomicity for Brainy operations.
 * All operations succeed or all rollback - no partial failures.
 *
 * @module transaction
 */

export * from './types.js'
export * from './errors.js'
export { Transaction } from './Transaction.js'
export { TransactionManager, type TransactionStats } from './TransactionManager.js'

// Re-export for convenience
export type {
  Operation,
  RollbackAction,
  TransactionState,
  TransactionContext,
  TransactionFunction,
  TransactionResult,
  TransactionOptions
} from './types.js'

export {
  TransactionError,
  TransactionExecutionError,
  TransactionRollbackError,
  InvalidTransactionStateError,
  TransactionTimeoutError
} from './errors.js'
