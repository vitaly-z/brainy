/**
 * Transaction System Errors
 *
 * Provides detailed error information for transaction failures.
 */

/**
 * Base class for all transaction errors
 */
export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message)
    this.name = 'TransactionError'
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Error during transaction execution
 */
export class TransactionExecutionError extends TransactionError {
  constructor(
    message: string,
    public readonly operationIndex: number,
    public readonly operationName: string | undefined,
    public readonly cause: Error
  ) {
    super(message, {
      operationIndex,
      operationName,
      cause: cause.message
    })
    this.name = 'TransactionExecutionError'
  }
}

/**
 * Error during transaction rollback
 */
export class TransactionRollbackError extends TransactionError {
  constructor(
    message: string,
    public readonly originalError: Error,
    public readonly rollbackErrors: Error[]
  ) {
    super(message, {
      originalError: originalError.message,
      rollbackErrorCount: rollbackErrors.length,
      rollbackErrors: rollbackErrors.map(e => e.message)
    })
    this.name = 'TransactionRollbackError'
  }
}

/**
 * Error for invalid transaction state
 */
export class InvalidTransactionStateError extends TransactionError {
  constructor(
    currentState: string,
    attemptedAction: string
  ) {
    super(
      `Cannot ${attemptedAction}: transaction is in state '${currentState}'`,
      { currentState, attemptedAction }
    )
    this.name = 'InvalidTransactionStateError'
  }
}

/**
 * Error for transaction timeout
 */
export class TransactionTimeoutError extends TransactionError {
  constructor(
    timeoutMs: number,
    operationIndex: number
  ) {
    super(
      `Transaction timed out after ${timeoutMs}ms at operation ${operationIndex}`,
      { timeoutMs, operationIndex }
    )
    this.name = 'TransactionTimeoutError'
  }
}
