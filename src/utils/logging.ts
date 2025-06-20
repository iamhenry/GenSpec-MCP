/**
 * Logging utilities for GenSpec MCP
 * Placeholder implementation for Track A compatibility
 */

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Log entry type
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: any;
}

// Logger class
export class Logger {
  private logLevel: LogLevel;
  private prefix: string;

  constructor(prefix = '[GenSpec MCP]', logLevel = LogLevel.INFO) {
    this.prefix = prefix;
    this.logLevel = logLevel;
  }

  // Static factory method for Track A compatibility
  static create(prefix?: string, logLevel?: LogLevel): Logger {
    return new Logger(prefix, logLevel);
  }

  /**
   * Log error message
   */
  error(message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(`${this.prefix} ERROR:`, message, ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(`${this.prefix} WARN:`, message, ...args);
    }
  }

  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.INFO) {
      console.log(`${this.prefix} INFO:`, message, ...args);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.log(`${this.prefix} DEBUG:`, message, ...args);
    }
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  // Track A compatibility methods
  logMessage(message: string, level?: LogLevel, context?: any): void {
    const logLevel = level ?? LogLevel.INFO;
    const entry: LogEntry = {
      level: logLevel,
      message,
      timestamp: new Date(),
      context
    };

    switch (logLevel) {
      case LogLevel.ERROR:
        this.error(message, context);
        break;
      case LogLevel.WARN:
        this.warn(message, context);
        break;
      case LogLevel.INFO:
        this.info(message, context);
        break;
      case LogLevel.DEBUG:
        this.debug(message, context);
        break;
    }
  }

  logToolStart(tool: string, args?: any): void {
    this.info(`Starting tool: ${tool}`, args);
  }

  logToolComplete(tool: string, result?: any): void {
    this.info(`Completed tool: ${tool}`, result);
  }

  logToolError(tool: string, error: string | Error): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    this.error(`Tool error: ${tool}`, errorObj);
  }

  logValidation(tool: string, result: any, args?: any): void {
    if (result.isValid) {
      this.debug(`Validation passed for ${tool}`, { result, args });
    } else {
      this.warn(`Validation failed for ${tool}`, { errors: result.errors, args });
    }
  }
}

// Default logger instance
export const logger = new Logger();

// Convenience functions
export function logError(message: string, ...args: any[]): void {
  logger.error(message, ...args);
}

export function logWarn(message: string, ...args: any[]): void {
  logger.warn(message, ...args);
}

export function logInfo(message: string, ...args: any[]): void {
  logger.info(message, ...args);
}

export function logDebug(message: string, ...args: any[]): void {
  logger.debug(message, ...args);
}