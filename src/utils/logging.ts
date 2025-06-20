import path from 'path';

export interface LogEntry {
  timestamp: string;
  phase: string;
  status: 'start' | 'complete' | 'error';
  duration?: number;
  user: string;
  message?: string;
}

/**
 * Simple console logger for GenSpec workflow
 * Format: [timestamp] PHASE:name STATUS:start/complete DURATION:Xs USER:project
 */
export class Logger {
  private startTimes: Map<string, number> = new Map();
  private projectName: string;

  constructor(workingDirectory?: string) {
    this.projectName = this.extractProjectName(workingDirectory || process.cwd());
  }

  /**
   * Logs the start of a phase
   */
  logPhaseStart(phase: string): void {
    const key = `${phase}_start`;
    this.startTimes.set(key, Date.now());
    
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      phase,
      status: 'start',
      user: this.projectName
    };

    console.log(this.formatLogEntry(entry));
  }

  /**
   * Logs the completion of a phase
   */
  logPhaseComplete(phase: string): void {
    const key = `${phase}_start`;
    const startTime = this.startTimes.get(key);
    const duration = startTime ? (Date.now() - startTime) / 1000 : undefined;
    
    // Clean up start time
    this.startTimes.delete(key);

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      phase,
      status: 'complete',
      duration,
      user: this.projectName
    };

    console.log(this.formatLogEntry(entry));
  }

  /**
   * Logs an error in a phase
   */
  logPhaseError(phase: string, error: string): void {
    const key = `${phase}_start`;
    const startTime = this.startTimes.get(key);
    const duration = startTime ? (Date.now() - startTime) / 1000 : undefined;
    
    // Clean up start time
    this.startTimes.delete(key);

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      phase,
      status: 'error',
      duration,
      user: this.projectName,
      message: error
    };

    console.log(this.formatLogEntry(entry));
  }

  /**
   * Logs a general message
   */
  logMessage(message: string): void {
    console.log(`[${this.formatTimestamp()}] ${message}`);
  }

  /**
   * Logs tool execution start
   */
  logToolStart(toolName: string): void {
    this.logPhaseStart(`TOOL:${toolName}`);
  }

  /**
   * Logs tool execution completion
   */
  logToolComplete(toolName: string): void {
    this.logPhaseComplete(`TOOL:${toolName}`);
  }

  /**
   * Logs tool execution error
   */
  logToolError(toolName: string, error: string): void {
    this.logPhaseError(`TOOL:${toolName}`, error);
  }

  /**
   * Logs validation results
   */
  logValidation(toolName: string, isValid: boolean, errors: string[] = []): void {
    if (isValid) {
      this.logMessage(`VALIDATION:${toolName} RESULT:passed`);
    } else {
      this.logMessage(`VALIDATION:${toolName} RESULT:failed ERRORS:${errors.length}`);
      errors.forEach(error => {
        this.logMessage(`  - ${error}`);
      });
    }
  }

  /**
   * Logs approval detection results
   */
  logApproval(phase: string, isApproval: boolean, confidence: number): void {
    this.logMessage(`APPROVAL:${phase} RESULT:${isApproval ? 'approved' : 'feedback'} CONFIDENCE:${confidence.toFixed(2)}`);
  }

  /**
   * Formats a log entry according to the specified format
   */
  private formatLogEntry(entry: LogEntry): string {
    let logLine = `[${entry.timestamp}] PHASE:${entry.phase} STATUS:${entry.status}`;
    
    if (entry.duration !== undefined) {
      logLine += ` DURATION:${entry.duration.toFixed(1)}s`;
    }
    
    logLine += ` USER:${entry.user}`;
    
    if (entry.message) {
      logLine += ` - ${entry.message}`;
    }
    
    return logLine;
  }

  /**
   * Formats timestamp in ISO format
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Extracts project name from working directory
   */
  private extractProjectName(workingDirectory: string): string {
    const projectName = path.basename(workingDirectory);
    // Clean up project name for logging
    return projectName.replace(/[^\w-]/g, '_').toLowerCase();
  }

  /**
   * Creates a logger instance for a specific working directory
   */
  static create(workingDirectory?: string): Logger {
    return new Logger(workingDirectory);
  }
}