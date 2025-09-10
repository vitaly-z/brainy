/**
 * Centralized logging utility for Brainy
 * Provides configurable log levels and consistent logging across the codebase
 * Automatically reduces logging in production environments to minimize costs
 */
export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
}
export interface LoggerConfig {
    level: LogLevel;
    modules?: {
        [moduleName: string]: LogLevel;
    };
    timestamps?: boolean;
    includeModule?: boolean;
    handler?: (level: LogLevel, module: string, message: string, ...args: any[]) => void;
}
declare class Logger {
    private static instance;
    private config;
    private constructor();
    private applyEnvironmentDefaults;
    static getInstance(): Logger;
    configure(config: Partial<LoggerConfig>): void;
    private shouldLog;
    private formatMessage;
    private log;
    error(module: string, message: string, ...args: any[]): void;
    warn(module: string, message: string, ...args: any[]): void;
    info(module: string, message: string, ...args: any[]): void;
    debug(module: string, message: string, ...args: any[]): void;
    trace(module: string, message: string, ...args: any[]): void;
    createModuleLogger(module: string): {
        error: (message: string, ...args: any[]) => void;
        warn: (message: string, ...args: any[]) => void;
        info: (message: string, ...args: any[]) => void;
        debug: (message: string, ...args: any[]) => void;
        trace: (message: string, ...args: any[]) => void;
    };
}
export declare const logger: Logger;
export declare function createModuleLogger(module: string): {
    error: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
    trace: (message: string, ...args: any[]) => void;
};
export declare function configureLogger(config: Partial<LoggerConfig>): void;
/**
 * Smart console replacement that automatically reduces logging in production
 * Dramatically reduces Google Cloud Run logging costs
 *
 * Usage: Replace console.log with smartConsole.log, etc.
 */
export declare const smartConsole: {
    log: (message?: any, ...args: any[]) => void;
    info: (message?: any, ...args: any[]) => void;
    warn: (message?: any, ...args: any[]) => void;
    error: (message?: any, ...args: any[]) => void;
    debug: (message?: any, ...args: any[]) => void;
    trace: (message?: any, ...args: any[]) => void;
};
/**
 * Production-optimized logging functions
 * These only log in non-production environments or when explicitly enabled
 */
export declare const prodLog: {
    error: (message?: any, ...args: any[]) => void;
    warn: (message?: any, ...args: any[]) => void;
    info: (message?: any, ...args: any[]) => void;
    debug: (message?: any, ...args: any[]) => void;
    log: (message?: any, ...args: any[]) => void;
};
export {};
