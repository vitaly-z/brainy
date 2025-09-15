/**
 * Enhanced Structured Logging System for Brainy
 * Provides production-ready logging with structured output, context preservation,
 * performance tracking, and multiple transport support
 */

import { performance } from 'perf_hooks'
import { hostname } from 'os'
import { randomUUID } from 'crypto'

export enum LogLevel {
  SILENT = -1,
  FATAL = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5
}

export interface LogContext {
  requestId?: string
  userId?: string
  operation?: string
  entityId?: string
  entityType?: string
  [key: string]: any
}

export interface LogEntry {
  timestamp: string
  level: string
  levelNumeric: number
  module: string
  message: string
  context?: LogContext
  data?: any
  error?: {
    name: string
    message: string
    stack?: string
    code?: string
  }
  performance?: {
    duration?: number
    memory?: {
      used: number
      total: number
    }
  }
  host?: string
  pid: number
  version?: string
}

export interface LogTransport {
  name: string
  log(entry: LogEntry): void | Promise<void>
  flush?(): Promise<void>
}

export interface StructuredLoggerConfig {
  level: LogLevel
  modules?: Record<string, LogLevel>
  format: 'json' | 'pretty' | 'simple'
  transports: LogTransport[]
  context?: LogContext
  includeHost?: boolean
  includeMemory?: boolean
  bufferSize?: number
  flushInterval?: number
  version?: string
}

class ConsoleTransport implements LogTransport {
  name = 'console'
  private format: 'json' | 'pretty' | 'simple'

  constructor(format: 'json' | 'pretty' | 'simple' = 'json') {
    this.format = format
  }

  log(entry: LogEntry): void {
    const method = this.getConsoleMethod(entry.levelNumeric)
    
    if (this.format === 'json') {
      method(JSON.stringify(entry))
    } else if (this.format === 'pretty') {
      const color = this.getColor(entry.levelNumeric)
      const prefix = `${entry.timestamp} ${color}[${entry.level}]\\x1b[0m [${entry.module}]`
      const message = entry.message
      
      if (entry.error) {
        method(`${prefix} ${message}`, entry.error)
      } else if (entry.data) {
        method(`${prefix} ${message}`, entry.data)
      } else {
        method(`${prefix} ${message}`)
      }
    } else {
      // Simple format
      method(`[${entry.level}] ${entry.message}`)
    }
  }

  private getConsoleMethod(level: number): (...args: any[]) => void {
    switch (level) {
      case LogLevel.FATAL:
      case LogLevel.ERROR:
        return console.error
      case LogLevel.WARN:
        return console.warn
      case LogLevel.INFO:
        return console.info
      default:
        return console.log
    }
  }

  private getColor(level: number): string {
    switch (level) {
      case LogLevel.FATAL:
        return '\\x1b[35m' // Magenta
      case LogLevel.ERROR:
        return '\\x1b[31m' // Red
      case LogLevel.WARN:
        return '\\x1b[33m' // Yellow
      case LogLevel.INFO:
        return '\\x1b[36m' // Cyan
      case LogLevel.DEBUG:
        return '\\x1b[32m' // Green
      case LogLevel.TRACE:
        return '\\x1b[90m' // Gray
      default:
        return '\\x1b[0m' // Reset
    }
  }
}

class BufferedTransport implements LogTransport {
  name = 'buffered'
  private buffer: LogEntry[] = []
  private innerTransport: LogTransport
  private bufferSize: number
  private flushTimer?: NodeJS.Timeout

  constructor(innerTransport: LogTransport, bufferSize: number = 100, flushInterval: number = 5000) {
    this.innerTransport = innerTransport
    this.bufferSize = bufferSize
    
    if (flushInterval > 0) {
      this.flushTimer = setInterval(() => this.flush(), flushInterval)
    }
  }

  log(entry: LogEntry): void {
    this.buffer.push(entry)
    
    if (this.buffer.length >= this.bufferSize) {
      this.flush()
    }
  }

  async flush(): Promise<void> {
    const entries = this.buffer.splice(0)
    for (const entry of entries) {
      await this.innerTransport.log(entry)
    }
    
    if (this.innerTransport.flush) {
      await this.innerTransport.flush()
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    this.flush()
  }
}

export class StructuredLogger {
  private static instance: StructuredLogger
  private config: StructuredLoggerConfig
  private defaultContext: LogContext = {}
  private performanceMarks = new Map<string, number>()

  private constructor() {
    const isDevelopment = process.env.NODE_ENV !== 'production'
    const format = isDevelopment ? 'pretty' : 'json'
    
    this.config = {
      level: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
      format,
      transports: [new ConsoleTransport(format)],
      includeHost: !isDevelopment,
      includeMemory: false,
      bufferSize: 100,
      flushInterval: 5000,
      version: process.env.npm_package_version
    }

    // Load from environment
    this.loadEnvironmentConfig()
  }

  private loadEnvironmentConfig(): void {
    const envLevel = process.env.BRAINY_LOG_LEVEL
    if (envLevel) {
      const level = LogLevel[envLevel.toUpperCase() as keyof typeof LogLevel]
      if (level !== undefined) {
        this.config.level = level
      }
    }

    const envFormat = process.env.BRAINY_LOG_FORMAT
    if (envFormat && ['json', 'pretty', 'simple'].includes(envFormat)) {
      this.config.format = envFormat as 'json' | 'pretty' | 'simple'
    }

    const moduleConfig = process.env.BRAINY_MODULE_LOG_LEVELS
    if (moduleConfig) {
      try {
        this.config.modules = JSON.parse(moduleConfig)
      } catch {
        // Ignore parse errors
      }
    }
  }

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger()
    }
    return StructuredLogger.instance
  }

  configure(config: Partial<StructuredLoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  setContext(context: LogContext): void {
    this.defaultContext = { ...this.defaultContext, ...context }
  }

  clearContext(): void {
    this.defaultContext = {}
  }

  withContext(context: LogContext): StructuredLogger {
    const contextualLogger = Object.create(this)
    contextualLogger.defaultContext = { ...this.defaultContext, ...context }
    return contextualLogger
  }

  startTimer(label: string): void {
    this.performanceMarks.set(label, performance.now())
  }

  endTimer(label: string): number | undefined {
    const start = this.performanceMarks.get(label)
    if (start === undefined) return undefined
    
    const duration = performance.now() - start
    this.performanceMarks.delete(label)
    return duration
  }

  private shouldLog(level: LogLevel, module: string): boolean {
    if (this.config.modules?.[module] !== undefined) {
      return level <= this.config.modules[module]
    }
    return level <= this.config.level
  }

  private createLogEntry(
    level: LogLevel,
    module: string,
    message: string,
    context?: LogContext,
    data?: any,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      levelNumeric: level,
      module,
      message,
      pid: process.pid,
      version: this.config.version
    }

    // Merge contexts
    const mergedContext = { ...this.defaultContext, ...context }
    if (Object.keys(mergedContext).length > 0) {
      entry.context = mergedContext
    }

    if (data !== undefined) {
      entry.data = data
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      }
    }

    if (this.config.includeHost) {
      entry.host = hostname()
    }

    if (this.config.includeMemory) {
      const mem = process.memoryUsage()
      entry.performance = {
        memory: {
          used: Math.round(mem.heapUsed / 1024 / 1024),
          total: Math.round(mem.heapTotal / 1024 / 1024)
        }
      }
    }

    return entry
  }

  private log(
    level: LogLevel,
    module: string,
    message: string,
    contextOrData?: LogContext | any,
    data?: any
  ): void {
    if (!this.shouldLog(level, module)) {
      return
    }

    // Handle overloaded parameters
    let context: LogContext | undefined
    let logData: any
    
    if (contextOrData && typeof contextOrData === 'object' && !Array.isArray(contextOrData)) {
      // Check if it looks like a context object
      const hasContextKeys = ['requestId', 'userId', 'operation', 'entityId', 'entityType']
        .some(key => key in contextOrData)
      
      if (hasContextKeys) {
        context = contextOrData
        logData = data
      } else {
        logData = contextOrData
      }
    } else {
      logData = contextOrData
    }

    // Extract error if present
    let error: Error | undefined
    if (logData instanceof Error) {
      error = logData
      logData = undefined
    } else if (logData?.error instanceof Error) {
      error = logData.error
      delete logData.error
    }

    const entry = this.createLogEntry(level, module, message, context, logData, error)

    // Send to all transports
    for (const transport of this.config.transports) {
      try {
        transport.log(entry)
      } catch (err) {
        // Fallback to console.error if transport fails
        console.error('Logger transport error:', err)
      }
    }
  }

  fatal(module: string, message: string, contextOrData?: LogContext | any, data?: any): void {
    this.log(LogLevel.FATAL, module, message, contextOrData, data)
  }

  error(module: string, message: string, contextOrData?: LogContext | any, data?: any): void {
    this.log(LogLevel.ERROR, module, message, contextOrData, data)
  }

  warn(module: string, message: string, contextOrData?: LogContext | any, data?: any): void {
    this.log(LogLevel.WARN, module, message, contextOrData, data)
  }

  info(module: string, message: string, contextOrData?: LogContext | any, data?: any): void {
    this.log(LogLevel.INFO, module, message, contextOrData, data)
  }

  debug(module: string, message: string, contextOrData?: LogContext | any, data?: any): void {
    this.log(LogLevel.DEBUG, module, message, contextOrData, data)
  }

  trace(module: string, message: string, contextOrData?: LogContext | any, data?: any): void {
    this.log(LogLevel.TRACE, module, message, contextOrData, data)
  }

  createModuleLogger(module: string) {
    const self = this
    return {
      fatal: (message: string, contextOrData?: LogContext | any, data?: any) => 
        self.fatal(module, message, contextOrData, data),
      error: (message: string, contextOrData?: LogContext | any, data?: any) => 
        self.error(module, message, contextOrData, data),
      warn: (message: string, contextOrData?: LogContext | any, data?: any) => 
        self.warn(module, message, contextOrData, data),
      info: (message: string, contextOrData?: LogContext | any, data?: any) => 
        self.info(module, message, contextOrData, data),
      debug: (message: string, contextOrData?: LogContext | any, data?: any) => 
        self.debug(module, message, contextOrData, data),
      trace: (message: string, contextOrData?: LogContext | any, data?: any) => 
        self.trace(module, message, contextOrData, data),
      withContext: (context: LogContext) => {
        const contextual = self.withContext(context)
        return contextual.createModuleLogger(module)
      },
      startTimer: (label: string) => self.startTimer(`${module}:${label}`),
      endTimer: (label: string) => self.endTimer(`${module}:${label}`)
    }
  }

  async flush(): Promise<void> {
    const flushPromises = this.config.transports
      .filter(t => t.flush)
      .map(t => t.flush!())
    
    await Promise.all(flushPromises)
  }

  addTransport(transport: LogTransport): void {
    this.config.transports.push(transport)
  }

  removeTransport(name: string): void {
    this.config.transports = this.config.transports.filter(t => t.name !== name)
  }

  child(context: LogContext): StructuredLogger {
    return this.withContext(context)
  }
}

// Singleton instance
export const structuredLogger = StructuredLogger.getInstance()

// Convenience functions
export function createModuleLogger(module: string) {
  return structuredLogger.createModuleLogger(module)
}

export function setLogContext(context: LogContext) {
  structuredLogger.setContext(context)
}

export function withLogContext(context: LogContext) {
  return structuredLogger.withContext(context)
}

// Correlation ID middleware helper
export function createCorrelationId(): string {
  return randomUUID()
}

// Performance logging helper
export function logPerformance(
  logger: ReturnType<typeof createModuleLogger>,
  operation: string,
  fn: () => any
): any {
  logger.startTimer(operation)
  try {
    const result = fn()
    if (result && typeof result.then === 'function') {
      return result.finally(() => {
        const duration = logger.endTimer(operation)
        logger.debug(`${operation} completed`, { duration })
      })
    }
    const duration = logger.endTimer(operation)
    logger.debug(`${operation} completed`, { duration })
    return result
  } catch (error) {
    const duration = logger.endTimer(operation)
    logger.error(`${operation} failed`, { duration, error })
    throw error
  }
}

// Backward compatibility wrapper for existing logger
export class LoggerCompatibilityWrapper {
  private moduleLogger: ReturnType<typeof createModuleLogger>

  constructor(module: string = 'legacy') {
    this.moduleLogger = createModuleLogger(module)
  }

  error(module: string, message: string, ...args: any[]): void {
    this.moduleLogger.error(message, { module, data: args })
  }

  warn(module: string, message: string, ...args: any[]): void {
    this.moduleLogger.warn(message, { module, data: args })
  }

  info(module: string, message: string, ...args: any[]): void {
    this.moduleLogger.info(message, { module, data: args })
  }

  debug(module: string, message: string, ...args: any[]): void {
    this.moduleLogger.debug(message, { module, data: args })
  }

  trace(module: string, message: string, ...args: any[]): void {
    this.moduleLogger.trace(message, { module, data: args })
  }

  createModuleLogger(module: string) {
    const logger = createModuleLogger(module)
    return {
      error: (message: string, ...args: any[]) => logger.error(message, { data: args }),
      warn: (message: string, ...args: any[]) => logger.warn(message, { data: args }),
      info: (message: string, ...args: any[]) => logger.info(message, { data: args }),
      debug: (message: string, ...args: any[]) => logger.debug(message, { data: args }),
      trace: (message: string, ...args: any[]) => logger.trace(message, { data: args })
    }
  }
}

// Export types for external use
export type ModuleLogger = ReturnType<typeof createModuleLogger>
// Types are already exported above, no need to re-export