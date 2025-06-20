/**
 * Logging Implementation for GenSpec MCP Server
 * 
 * Provides basic console output logging with workflow progress tracking,
 * error logging, and debugging across all tool operations.
 */

import { Phase, PHASE_NAMES, LogEntry } from '../types.js';

export class Logger {
  private static instance: Logger;
  private logEntries: LogEntry[] = [];

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log workflow start event
   */
  logWorkflowStart(tool: string, phase: Phase, user: string = 'user'): void {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      timestamp,
      phase: PHASE_NAMES[phase],
      status: 'start',
      user,
    };

    this.logEntries.push(entry);
    console.log(`[GenSpec MCP] ${timestamp} - WORKFLOW START: ${tool} - Phase: ${PHASE_NAMES[phase]} - User: ${user}`);
  }

  /**
   * Log workflow completion event
   */
  logWorkflowComplete(tool: string, phase: Phase, user: string = 'user', startTime?: string): void {
    const timestamp = new Date().toISOString();
    let duration: string | undefined;

    if (startTime) {
      const start = new Date(startTime);
      const end = new Date(timestamp);
      duration = `${Math.round((end.getTime() - start.getTime()) / 1000)}s`;
    }

    const entry: LogEntry = {
      timestamp,
      phase: PHASE_NAMES[phase],
      status: 'complete',
      duration,
      user,
    };

    this.logEntries.push(entry);
    console.log(`[GenSpec MCP] ${timestamp} - WORKFLOW COMPLETE: ${tool} - Phase: ${PHASE_NAMES[phase]} - User: ${user}${duration ? ` - Duration: ${duration}` : ''}`);
  }

  /**
   * Log phase transition
   */
  logPhaseTransition(fromPhase: Phase, toPhase: Phase, user: string = 'user'): void {
    const timestamp = new Date().toISOString();
    console.log(`[GenSpec MCP] ${timestamp} - PHASE TRANSITION: ${PHASE_NAMES[fromPhase]} → ${PHASE_NAMES[toPhase]} - User: ${user}`);
  }

  /**
   * Log tool execution
   */
  logToolExecution(toolName: string, args: any, user: string = 'user'): void {
    const timestamp = new Date().toISOString();
    const argsString = JSON.stringify(args);
    console.log(`[GenSpec MCP] ${timestamp} - TOOL EXECUTION: ${toolName} - Args: ${argsString} - User: ${user}`);
  }

  /**
   * Log validation events
   */
  logValidation(type: string, result: boolean, details?: string, user: string = 'user'): void {
    const timestamp = new Date().toISOString();
    const status = result ? 'PASSED' : 'FAILED';
    const message = `[GenSpec MCP] ${timestamp} - VALIDATION ${status}: ${type} - User: ${user}`;
    
    if (details) {
      console.log(`${message} - Details: ${details}`);
    } else {
      console.log(message);
    }
  }

  /**
   * Log approval detection
   */
  logApproval(message: string, isApproval: boolean, cycle?: number, user: string = 'user'): void {
    const timestamp = new Date().toISOString();
    const status = isApproval ? 'APPROVED' : 'NEEDS_EDIT';
    const cycleInfo = cycle !== undefined ? ` - Cycle: ${cycle}` : '';
    
    console.log(`[GenSpec MCP] ${timestamp} - APPROVAL ${status}: "${message.substring(0, 50)}..." - User: ${user}${cycleInfo}`);
  }

  /**
   * Log error events
   */
  logError(operation: string, error: Error | string, user: string = 'user'): void {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[GenSpec MCP] ${timestamp} - ERROR: ${operation} - ${errorMessage} - User: ${user}`);
    
    if (errorStack && process.env.NODE_ENV === 'development') {
      console.error(`[GenSpec MCP] ${timestamp} - ERROR STACK:\n${errorStack}`);
    }
  }

  /**
   * Log general information
   */
  logInfo(message: string, user: string = 'user'): void {
    const timestamp = new Date().toISOString();
    console.log(`[GenSpec MCP] ${timestamp} - INFO: ${message} - User: ${user}`);
  }

  /**
   * Log debug information (only in development)
   */
  logDebug(message: string, data?: any, user: string = 'user'): void {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      const dataString = data ? ` - Data: ${JSON.stringify(data)}` : '';
      console.log(`[GenSpec MCP] ${timestamp} - DEBUG: ${message} - User: ${user}${dataString}`);
    }
  }

  /**
   * Log warning events
   */
  logWarning(message: string, user: string = 'user'): void {
    const timestamp = new Date().toISOString();
    console.warn(`[GenSpec MCP] ${timestamp} - WARNING: ${message} - User: ${user}`);
  }

  /**
   * Log server initialization
   */
  logServerStart(): void {
    const timestamp = new Date().toISOString();
    console.log(`[GenSpec MCP] ${timestamp} - SERVER STARTED: GenSpec MCP Server initialized successfully`);
  }

  /**
   * Log server shutdown
   */
  logServerStop(): void {
    const timestamp = new Date().toISOString();
    console.log(`[GenSpec MCP] ${timestamp} - SERVER STOPPED: GenSpec MCP Server shut down`);
  }

  /**
   * Log file operations
   */
  logFileOperation(operation: string, filePath: string, success: boolean, user: string = 'user'): void {
    const timestamp = new Date().toISOString();
    const status = success ? 'SUCCESS' : 'FAILED';
    console.log(`[GenSpec MCP] ${timestamp} - FILE ${status}: ${operation} - ${filePath} - User: ${user}`);
  }

  /**
   * Log template operations
   */
  logTemplateOperation(templateName: string, operation: string, success: boolean, user: string = 'user'): void {
    const timestamp = new Date().toISOString();
    const status = success ? 'SUCCESS' : 'FAILED';
    console.log(`[GenSpec MCP] ${timestamp} - TEMPLATE ${status}: ${operation} - ${templateName} - User: ${user}`);
  }

  /**
   * Get all log entries
   */
  getLogEntries(): LogEntry[] {
    return [...this.logEntries];
  }

  /**
   * Clear log entries (for testing)
   */
  clearLogs(): void {
    this.logEntries = [];
  }

  /**
   * Get recent log entries (last N entries)
   */
  getRecentLogs(count: number = 10): LogEntry[] {
    return this.logEntries.slice(-count);
  }

  /**
   * Log workflow progress summary
   */
  logWorkflowProgress(completedPhases: Phase[], currentPhase?: Phase, user: string = 'user'): void {
    const timestamp = new Date().toISOString();
    const completed = completedPhases.map(p => PHASE_NAMES[p]).join(', ');
    const current = currentPhase ? PHASE_NAMES[currentPhase] : 'None';
    
    console.log(`[GenSpec MCP] ${timestamp} - WORKFLOW PROGRESS - Completed: [${completed}] - Current: ${current} - User: ${user}`);
  }

  /**
   * Log system information on startup
   */
  logSystemInfo(): void {
    const timestamp = new Date().toISOString();
    console.log(`[GenSpec MCP] ${timestamp} - SYSTEM INFO:`);
    console.log(`[GenSpec MCP] ${timestamp} - Node Version: ${process.version}`);
    console.log(`[GenSpec MCP] ${timestamp} - Platform: ${process.platform}`);
    console.log(`[GenSpec MCP] ${timestamp} - Architecture: ${process.arch}`);
    console.log(`[GenSpec MCP] ${timestamp} - Working Directory: ${process.cwd()}`);
    console.log(`[GenSpec MCP] ${timestamp} - Environment: ${process.env.NODE_ENV || 'production'}`);
  }
}

/**
 * Convenience function to get logger instance
 */
export const logger = Logger.getInstance();