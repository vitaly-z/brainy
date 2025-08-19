/**
 * Centralized logging utility for Brainy
 * Provides configurable log levels and consistent logging across the codebase
 * Automatically reduces logging in production environments to minimize costs
 */
import { isProductionEnvironment, getLogLevel } from './environment.js';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
    LogLevel[LogLevel["TRACE"] = 4] = "TRACE";
})(LogLevel || (LogLevel = {}));
class Logger {
    constructor() {
        this.config = {
            level: LogLevel.ERROR, // Default to ERROR in production for cost optimization
            timestamps: false, // Disable timestamps in production to reduce log size
            includeModule: true
        };
        // Auto-detect production environment and set appropriate defaults
        this.applyEnvironmentDefaults();
        // Set log level from environment variable if available (overrides auto-detection)
        const envLogLevel = process.env.BRAINY_LOG_LEVEL;
        if (envLogLevel) {
            const level = LogLevel[envLogLevel.toUpperCase()];
            if (level !== undefined) {
                this.config.level = level;
            }
        }
        // Parse module-specific log levels
        const moduleLogLevels = process.env.BRAINY_MODULE_LOG_LEVELS;
        if (moduleLogLevels) {
            try {
                this.config.modules = JSON.parse(moduleLogLevels);
            }
            catch (e) {
                // Ignore parsing errors
            }
        }
    }
    applyEnvironmentDefaults() {
        const envLogLevel = getLogLevel();
        // Convert environment log level to Logger LogLevel
        switch (envLogLevel) {
            case 'silent':
                this.config.level = -1; // Below ERROR to silence all logs
                break;
            case 'error':
                this.config.level = LogLevel.ERROR;
                this.config.timestamps = false; // Minimize log size in production
                break;
            case 'warn':
                this.config.level = LogLevel.WARN;
                this.config.timestamps = false;
                break;
            case 'info':
                this.config.level = LogLevel.INFO;
                this.config.timestamps = true;
                break;
            case 'verbose':
                this.config.level = LogLevel.DEBUG;
                this.config.timestamps = true;
                break;
        }
        // In production environments, be extra conservative to minimize costs
        if (isProductionEnvironment()) {
            this.config.level = Math.min(this.config.level, LogLevel.ERROR);
            this.config.timestamps = false;
            this.config.includeModule = false; // Reduce log size
        }
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    configure(config) {
        this.config = { ...this.config, ...config };
    }
    shouldLog(level, module) {
        // Check module-specific level first
        if (this.config.modules && this.config.modules[module] !== undefined) {
            return level <= this.config.modules[module];
        }
        // Otherwise use global level
        return level <= this.config.level;
    }
    formatMessage(level, module, message) {
        const parts = [];
        if (this.config.timestamps) {
            parts.push(`[${new Date().toISOString()}]`);
        }
        parts.push(`[${LogLevel[level]}]`);
        if (this.config.includeModule) {
            parts.push(`[${module}]`);
        }
        parts.push(message);
        return parts.join(' ');
    }
    log(level, module, message, ...args) {
        if (!this.shouldLog(level, module)) {
            return;
        }
        if (this.config.handler) {
            this.config.handler(level, module, message, ...args);
            return;
        }
        const formattedMessage = this.formatMessage(level, module, message);
        switch (level) {
            case LogLevel.ERROR:
                console.error(formattedMessage, ...args);
                break;
            case LogLevel.WARN:
                console.warn(formattedMessage, ...args);
                break;
            case LogLevel.INFO:
                console.info(formattedMessage, ...args);
                break;
            case LogLevel.DEBUG:
            case LogLevel.TRACE:
                console.log(formattedMessage, ...args);
                break;
        }
    }
    error(module, message, ...args) {
        this.log(LogLevel.ERROR, module, message, ...args);
    }
    warn(module, message, ...args) {
        this.log(LogLevel.WARN, module, message, ...args);
    }
    info(module, message, ...args) {
        this.log(LogLevel.INFO, module, message, ...args);
    }
    debug(module, message, ...args) {
        this.log(LogLevel.DEBUG, module, message, ...args);
    }
    trace(module, message, ...args) {
        this.log(LogLevel.TRACE, module, message, ...args);
    }
    // Create a module-specific logger
    createModuleLogger(module) {
        return {
            error: (message, ...args) => this.error(module, message, ...args),
            warn: (message, ...args) => this.warn(module, message, ...args),
            info: (message, ...args) => this.info(module, message, ...args),
            debug: (message, ...args) => this.debug(module, message, ...args),
            trace: (message, ...args) => this.trace(module, message, ...args)
        };
    }
}
// Export singleton instance
export const logger = Logger.getInstance();
// Export convenience function for creating module loggers
export function createModuleLogger(module) {
    return logger.createModuleLogger(module);
}
// Export function to configure logger
export function configureLogger(config) {
    logger.configure(config);
}
/**
 * Smart console replacement that automatically reduces logging in production
 * Dramatically reduces Google Cloud Run logging costs
 *
 * Usage: Replace console.log with smartConsole.log, etc.
 */
export const smartConsole = {
    log: (message, ...args) => {
        if (logger['shouldLog'](LogLevel.INFO, 'console')) {
            console.log(message, ...args);
        }
    },
    info: (message, ...args) => {
        if (logger['shouldLog'](LogLevel.INFO, 'console')) {
            console.info(message, ...args);
        }
    },
    warn: (message, ...args) => {
        if (logger['shouldLog'](LogLevel.WARN, 'console')) {
            console.warn(message, ...args);
        }
    },
    error: (message, ...args) => {
        if (logger['shouldLog'](LogLevel.ERROR, 'console')) {
            console.error(message, ...args);
        }
    },
    debug: (message, ...args) => {
        if (logger['shouldLog'](LogLevel.DEBUG, 'console')) {
            console.debug(message, ...args);
        }
    },
    trace: (message, ...args) => {
        if (logger['shouldLog'](LogLevel.TRACE, 'console')) {
            console.trace(message, ...args);
        }
    }
};
/**
 * Production-optimized logging functions
 * These only log in non-production environments or when explicitly enabled
 */
export const prodLog = {
    // Only log errors in production (always visible)
    error: (message, ...args) => {
        console.error(message, ...args);
    },
    // These are suppressed in production unless BRAINY_LOG_LEVEL is set
    warn: (message, ...args) => smartConsole.warn(message, ...args),
    info: (message, ...args) => smartConsole.info(message, ...args),
    debug: (message, ...args) => smartConsole.debug(message, ...args),
    log: (message, ...args) => smartConsole.log(message, ...args)
};
//# sourceMappingURL=logger.js.map