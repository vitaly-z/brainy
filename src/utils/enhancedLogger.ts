/**
 * Enhanced logging system that bridges old logger with new structured logger
 * Provides backward compatibility while enabling gradual migration
 */

import { 
  structuredLogger, 
  createModuleLogger as createStructuredModuleLogger,
  LogLevel as StructuredLogLevel,
  type LogContext,
  type ModuleLogger
} from './structuredLogger.js'
import { isProductionEnvironment, getLogLevel } from './environment.js'

// Re-export LogLevel for compatibility
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

// Map old LogLevel to new StructuredLogLevel
function mapLogLevel(level: LogLevel): StructuredLogLevel {
  switch (level) {
    case LogLevel.ERROR: return StructuredLogLevel.ERROR
    case LogLevel.WARN: return StructuredLogLevel.WARN
    case LogLevel.INFO: return StructuredLogLevel.INFO
    case LogLevel.DEBUG: return StructuredLogLevel.DEBUG
    case LogLevel.TRACE: return StructuredLogLevel.TRACE
    default: return StructuredLogLevel.INFO
  }
}

export interface LoggerConfig {
  level: LogLevel
  modules?: {
    [moduleName: string]: LogLevel
  }
  timestamps?: boolean
  includeModule?: boolean
  handler?: (level: LogLevel, module: string, message: string, ...args: any[]) => void
}

/**
 * Enhanced Logger that uses structured logger internally
 * Maintains backward compatibility with existing code
 */
class EnhancedLogger {
  private static instance: EnhancedLogger
  private config: LoggerConfig = {
    level: LogLevel.ERROR,
    timestamps: false,
    includeModule: true
  }
  
  private constructor() {
    this.applyEnvironmentDefaults()
    
    // Sync with structured logger
    this.syncWithStructuredLogger()
    
    // Set log level from environment variable if available
    const envLogLevel = process.env.BRAINY_LOG_LEVEL
    if (envLogLevel) {
      const level = LogLevel[envLogLevel.toUpperCase() as keyof typeof LogLevel]
      if (level !== undefined) {
        this.config.level = level
        this.syncWithStructuredLogger()
      }
    }
    
    // Parse module-specific log levels
    const moduleLogLevels = process.env.BRAINY_MODULE_LOG_LEVELS
    if (moduleLogLevels) {
      try {
        this.config.modules = JSON.parse(moduleLogLevels)
        this.syncWithStructuredLogger()
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }
  
  private applyEnvironmentDefaults(): void {
    const envLogLevel = getLogLevel()
    
    switch (envLogLevel) {
      case 'silent':
        this.config.level = -1 as LogLevel
        break
      case 'error':
        this.config.level = LogLevel.ERROR
        this.config.timestamps = false
        break
      case 'warn':
        this.config.level = LogLevel.WARN
        this.config.timestamps = false
        break
      case 'info':
        this.config.level = LogLevel.INFO
        this.config.timestamps = true
        break
      case 'verbose':
        this.config.level = LogLevel.DEBUG
        this.config.timestamps = true
        break
    }
    
    if (isProductionEnvironment()) {
      this.config.level = Math.min(this.config.level, LogLevel.ERROR)
      this.config.timestamps = false
      this.config.includeModule = false
    }
  }
  
  private syncWithStructuredLogger(): void {
    // Convert modules config
    const modules: Record<string, StructuredLogLevel> = {}
    if (this.config.modules) {
      for (const [module, level] of Object.entries(this.config.modules)) {
        modules[module] = mapLogLevel(level)
      }
    }
    
    // Configure structured logger
    structuredLogger.configure({
      level: mapLogLevel(this.config.level),
      modules,
      format: this.config.timestamps ? 'pretty' : 'simple'
    })
  }
  
  static getInstance(): EnhancedLogger {
    if (!EnhancedLogger.instance) {
      EnhancedLogger.instance = new EnhancedLogger()
    }
    return EnhancedLogger.instance
  }
  
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
    this.syncWithStructuredLogger()
  }
  
  private shouldLog(level: LogLevel, module: string): boolean {
    if (this.config.modules && this.config.modules[module] !== undefined) {
      return level <= this.config.modules[module]
    }
    return level <= this.config.level
  }
  
  error(module: string, message: string, ...args: any[]): void {
    const logger = createStructuredModuleLogger(module)
    logger.error(message, { data: args })
  }
  
  warn(module: string, message: string, ...args: any[]): void {
    const logger = createStructuredModuleLogger(module)
    logger.warn(message, { data: args })
  }
  
  info(module: string, message: string, ...args: any[]): void {
    const logger = createStructuredModuleLogger(module)
    logger.info(message, { data: args })
  }
  
  debug(module: string, message: string, ...args: any[]): void {
    const logger = createStructuredModuleLogger(module)
    logger.debug(message, { data: args })
  }
  
  trace(module: string, message: string, ...args: any[]): void {
    const logger = createStructuredModuleLogger(module)
    logger.trace(message, { data: args })
  }
  
  createModuleLogger(module: string) {
    const structuredLogger = createStructuredModuleLogger(module)
    
    // Return a backward-compatible interface
    return {
      error: (message: string, ...args: any[]) => 
        structuredLogger.error(message, { data: args }),
      warn: (message: string, ...args: any[]) => 
        structuredLogger.warn(message, { data: args }),
      info: (message: string, ...args: any[]) => 
        structuredLogger.info(message, { data: args }),
      debug: (message: string, ...args: any[]) => 
        structuredLogger.debug(message, { data: args }),
      trace: (message: string, ...args: any[]) => 
        structuredLogger.trace(message, { data: args }),
      // New structured logging methods
      withContext: (context: LogContext) => 
        structuredLogger.withContext(context),
      startTimer: (label: string) => 
        structuredLogger.startTimer(label),
      endTimer: (label: string) => 
        structuredLogger.endTimer(label)
    }
  }
}

// Export singleton instance
export const logger = EnhancedLogger.getInstance()

// Export convenience function for creating module loggers
export function createModuleLogger(module: string) {
  return logger.createModuleLogger(module)
}

// Export function to configure logger
export function configureLogger(config: Partial<LoggerConfig>) {
  logger.configure(config)
}

/**
 * Smart console replacement that uses structured logger
 */
export const smartConsole = {
  log: (message?: any, ...args: any[]) => {
    const logger = createStructuredModuleLogger('console')
    logger.info(typeof message === 'string' ? message : JSON.stringify(message), { data: args })
  },
  
  info: (message?: any, ...args: any[]) => {
    const logger = createStructuredModuleLogger('console')
    logger.info(typeof message === 'string' ? message : JSON.stringify(message), { data: args })
  },
  
  warn: (message?: any, ...args: any[]) => {
    const logger = createStructuredModuleLogger('console')
    logger.warn(typeof message === 'string' ? message : JSON.stringify(message), { data: args })
  },
  
  error: (message?: any, ...args: any[]) => {
    const logger = createStructuredModuleLogger('console')
    logger.error(typeof message === 'string' ? message : JSON.stringify(message), { data: args })
  },
  
  debug: (message?: any, ...args: any[]) => {
    const logger = createStructuredModuleLogger('console')
    logger.debug(typeof message === 'string' ? message : JSON.stringify(message), { data: args })
  },
  
  trace: (message?: any, ...args: any[]) => {
    const logger = createStructuredModuleLogger('console')
    logger.trace(typeof message === 'string' ? message : JSON.stringify(message), { data: args })
  }
}

/**
 * Production-optimized logging functions
 */
export const prodLog = {
  error: (message?: any, ...args: any[]) => {
    const logger = createStructuredModuleLogger('prod')
    logger.error(typeof message === 'string' ? message : JSON.stringify(message), { data: args })
  },
  
  warn: (message?: any, ...args: any[]) => {
    if (!isProductionEnvironment() || process.env.BRAINY_LOG_LEVEL) {
      const logger = createStructuredModuleLogger('prod')
      logger.warn(typeof message === 'string' ? message : JSON.stringify(message), { data: args })
    }
  },
  
  info: (message?: any, ...args: any[]) => {
    if (!isProductionEnvironment() || process.env.BRAINY_LOG_LEVEL) {
      const logger = createStructuredModuleLogger('prod')
      logger.info(typeof message === 'string' ? message : JSON.stringify(message), { data: args })
    }
  },
  
  debug: (message?: any, ...args: any[]) => {
    if (!isProductionEnvironment() || process.env.BRAINY_LOG_LEVEL) {
      const logger = createStructuredModuleLogger('prod')
      logger.debug(typeof message === 'string' ? message : JSON.stringify(message), { data: args })
    }
  },
  
  log: (message?: any, ...args: any[]) => {
    if (!isProductionEnvironment() || process.env.BRAINY_LOG_LEVEL) {
      const logger = createStructuredModuleLogger('prod')
      logger.info(typeof message === 'string' ? message : JSON.stringify(message), { data: args })
    }
  }
}

// Re-export structured logger utilities for new code
export {
  createModuleLogger as createStructuredModuleLogger,
  type LogContext,
  type ModuleLogger
} from './structuredLogger.js'