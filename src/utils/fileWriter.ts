/**
 * File Writing System for GenSpec MCP Server
 * Handles document writing to _ai/docs/ directory with enhanced error handling, backup, and validation
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  Phase, 
  GenerationResult, 
  PHASE_OUTPUT_FILES,
  GenSpecError 
} from '../types.js';

export interface WriteOptions {
  createBackup?: boolean;
  validateContent?: boolean;
  overwriteExisting?: boolean;
  preserveTimestamp?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    wordCount: number;
    sectionCount: number;
    hasTitle: boolean;
    hasContent: boolean;
  };
}

export interface BackupInfo {
  originalPath: string;
  backupPath: string;
  timestamp: string;
  size: number;
}

export class DocumentWriter {
  private outputDirectory: string;
  private backupDirectory: string;
  private maxBackups: number;

  constructor(outputDirectory?: string, maxBackups: number = 10) {
    // Default to _ai/docs/ directory relative to current working directory
    this.outputDirectory = outputDirectory || path.resolve(process.cwd(), '_ai', 'docs');
    this.backupDirectory = path.join(this.outputDirectory, '.backups');
    this.maxBackups = maxBackups;
  }

  /**
   * Write document content to appropriate file based on phase
   * @param phase - The phase being written
   * @param content - The content to write
   * @param workspace - Optional workspace identifier for logging
   * @param options - Write options for backup, validation, etc.
   * @returns GenerationResult with file paths and metadata
   */
  async writeDocument(
    phase: Phase, 
    content: string, 
    workspace?: string, 
    options: WriteOptions = {}
  ): Promise<GenerationResult> {
    const defaultOptions: WriteOptions = {
      createBackup: true,
      validateContent: true,
      overwriteExisting: true,
      preserveTimestamp: false,
      ...options
    };

    try {
      // Ensure output directory exists
      await this.ensureOutputDirectory();
      await this.ensureBackupDirectory();

      const fileName = PHASE_OUTPUT_FILES[phase];
      const filePath = path.join(this.outputDirectory, fileName);
      const draftPath = filePath; // In this implementation, draft and final are the same

      // Validate content if requested
      if (defaultOptions.validateContent) {
        const validation = await this.validateContent(content, phase);
        if (!validation.isValid) {
          throw new Error(`Content validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Create backup if file exists and backup is requested
      let backupInfo: BackupInfo | null = null;
      if (defaultOptions.createBackup && fs.existsSync(filePath)) {
        backupInfo = await this.createBackupWithInfo(phase);
      }

      // Check overwrite permission
      if (!defaultOptions.overwriteExisting && fs.existsSync(filePath)) {
        throw new Error(`File already exists and overwrite is disabled: ${filePath}`);
      }

      // Store original timestamp if preservation is requested
      let originalTimestamp: Date | null = null;
      if (defaultOptions.preserveTimestamp && fs.existsSync(filePath)) {
        const stats = await fs.promises.stat(filePath);
        originalTimestamp = stats.mtime;
      }

      // Write content to file with atomic operation
      await this.atomicWrite(filePath, content);

      // Restore timestamp if requested
      if (originalTimestamp && defaultOptions.preserveTimestamp) {
        await fs.promises.utimes(filePath, originalTimestamp, originalTimestamp);
      }

      // Verify file was written successfully
      if (!fs.existsSync(filePath)) {
        throw new Error(`File was not created: ${filePath}`);
      }

      // Verify content integrity
      const writtenContent = await fs.promises.readFile(filePath, 'utf-8');
      if (writtenContent !== content) {
        throw new Error('Content integrity check failed - written content does not match input');
      }

      // Clean up old backups
      await this.cleanupOldBackups(phase);

      const result: GenerationResult = {
        phase,
        content,
        filePath,
        nextAction: 'approve', // Default to approve, client can change based on workflow
        draftPath
      };

      console.log(`Successfully wrote ${fileName} (${content.length} characters)`);
      if (backupInfo) {
        console.log(`Backup created: ${path.basename(backupInfo.backupPath)}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to write document for phase ${phase}: ${errorMessage}`);
    }
  }

  /**
   * Write multiple documents in sequence with enhanced error handling
   * @param documents - Array of {phase, content} objects
   * @param workspace - Optional workspace identifier
   * @param options - Write options applied to all documents
   * @returns Array of GenerationResult with success status
   */
  async writeMultipleDocuments(
    documents: Array<{ phase: Phase; content: string }>, 
    workspace?: string,
    options: WriteOptions = {}
  ): Promise<Array<{
    phase: Phase;
    success: boolean;
    result?: GenerationResult;
    error?: string;
  }>> {
    const results: Array<{
      phase: Phase;
      success: boolean;
      result?: GenerationResult;
      error?: string;
    }> = [];

    // Validate all documents first
    const validationErrors: string[] = [];
    for (const doc of documents) {
      if (!doc.content || doc.content.trim().length === 0) {
        validationErrors.push(`Phase ${doc.phase} has empty content`);
      }
    }
    
    if (validationErrors.length > 0) {
      throw new Error(`Document validation failed: ${validationErrors.join(', ')}`);
    }

    // Process documents sequentially for better error tracking
    for (const doc of documents) {
      try {
        console.log(`Writing document for phase ${doc.phase}...`);
        const result = await this.writeDocument(doc.phase, doc.content, workspace, options);
        results.push({
          phase: doc.phase,
          success: true,
          result
        });
        console.log(`Successfully wrote document for phase ${doc.phase}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to write document for phase ${doc.phase}:`, errorMessage);
        results.push({
          phase: doc.phase,
          success: false,
          error: errorMessage
        });
        
        // Optionally stop on first error (can be made configurable)
        if (options.overwriteExisting === false) {
          break;
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    console.log(`Batch write completed: ${successCount}/${totalCount} documents written successfully`);

    return results;
  }

  /**
   * Read existing document content if it exists with enhanced error handling
   * @param phase - The phase to read
   * @param options - Read options for validation, etc.
   * @returns Content string or null if file doesn't exist
   */
  async readExistingDocument(
    phase: Phase, 
    options: { validateOnRead?: boolean } = {}
  ): Promise<string | null> {
    try {
      const fileName = PHASE_OUTPUT_FILES[phase];
      const filePath = path.join(this.outputDirectory, fileName);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      // Check file accessibility before reading
      try {
        await fs.promises.access(filePath, fs.constants.R_OK);
      } catch (error) {
        throw new Error(`File exists but is not readable: ${filePath}`);
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      // Optional validation on read
      if (options.validateOnRead) {
        const validation = await this.validateContent(content, phase);
        if (validation.warnings.length > 0) {
          console.warn(`Content validation warnings for ${fileName}:`, validation.warnings);
        }
      }
      
      return content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to read existing document for phase ${phase}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Check if document exists for a phase
   * @param phase - The phase to check
   * @returns Boolean indicating if file exists
   */
  documentExists(phase: Phase): boolean {
    const fileName = PHASE_OUTPUT_FILES[phase];
    const filePath = path.join(this.outputDirectory, fileName);
    return fs.existsSync(filePath);
  }

  /**
   * Get the full file path for a phase
   * @param phase - The phase to get path for
   * @returns Full file path
   */
  getDocumentPath(phase: Phase): string {
    const fileName = PHASE_OUTPUT_FILES[phase];
    return path.join(this.outputDirectory, fileName);
  }

  /**
   * List all existing documents in the output directory
   * @returns Array of {phase, fileName, filePath, exists} objects
   */
  listDocuments(): Array<{ phase: Phase; fileName: string; filePath: string; exists: boolean }> {
    return Object.entries(PHASE_OUTPUT_FILES).map(([phaseStr, fileName]) => {
      const phase = Number(phaseStr) as Phase;
      const filePath = path.join(this.outputDirectory, fileName);
      const exists = fs.existsSync(filePath);

      return {
        phase,
        fileName,
        filePath,
        exists
      };
    });
  }

  /**
   * Delete document for a specific phase
   * @param phase - The phase to delete
   * @returns Boolean indicating success
   */
  async deleteDocument(phase: Phase): Promise<boolean> {
    try {
      const fileName = PHASE_OUTPUT_FILES[phase];
      const filePath = path.join(this.outputDirectory, fileName);

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      
      return false; // File didn't exist
    } catch (error) {
      console.error(`Failed to delete document for phase ${phase}:`, error);
      return false;
    }
  }

  /**
   * Ensure output directory exists and is writable with enhanced checking
   */
  async ensureOutputDirectory(): Promise<void> {
    try {
      // Create directory recursively if it doesn't exist
      if (!fs.existsSync(this.outputDirectory)) {
        console.log(`Creating output directory: ${this.outputDirectory}`);
        await fs.promises.mkdir(this.outputDirectory, { recursive: true });
      }

      // Verify directory was created successfully
      if (!fs.existsSync(this.outputDirectory)) {
        throw new Error(`Directory creation failed: ${this.outputDirectory}`);
      }

      // Check if directory is writable
      await fs.promises.access(this.outputDirectory, fs.constants.W_OK);
      
      // Test write capability with a temporary file
      const testFile = path.join(this.outputDirectory, '.write-test');
      try {
        await fs.promises.writeFile(testFile, 'test', 'utf-8');
        await fs.promises.unlink(testFile);
      } catch (error) {
        throw new Error(`Directory is not writable: cannot create test file`);
      }
      
      console.log(`Output directory ready: ${this.outputDirectory}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Cannot create or write to output directory ${this.outputDirectory}: ${errorMessage}`);
    }
  }

  /**
   * Get output directory path
   */
  getOutputDirectory(): string {
    return this.outputDirectory;
  }

  /**
   * Validate output directory exists and is writable
   * @returns Validation result
   */
  async validateOutputDirectory(): Promise<{ isValid: boolean; error?: string }> {
    try {
      await this.ensureOutputDirectory();
      return { isValid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { isValid: false, error: errorMessage };
    }
  }

  /**
   * Get file stats for a document
   * @param phase - The phase to get stats for
   * @returns File stats or null if file doesn't exist
   */
  async getDocumentStats(phase: Phase): Promise<fs.Stats | null> {
    try {
      const fileName = PHASE_OUTPUT_FILES[phase];
      const filePath = path.join(this.outputDirectory, fileName);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      return await fs.promises.stat(filePath);
    } catch (error) {
      console.error(`Failed to get document stats for phase ${phase}:`, error);
      return null;
    }
  }

  /**
   * Create backup of existing document before overwriting
   * @param phase - The phase to backup
   * @returns Backup file path or null if no existing file
   */
  async createBackup(phase: Phase): Promise<string | null> {
    const backupInfo = await this.createBackupWithInfo(phase);
    return backupInfo ? backupInfo.backupPath : null;
  }

  /**
   * Create backup with detailed information
   * @param phase - The phase to backup
   * @returns BackupInfo object or null if no existing file
   */
  async createBackupWithInfo(phase: Phase): Promise<BackupInfo | null> {
    try {
      const fileName = PHASE_OUTPUT_FILES[phase];
      const filePath = path.join(this.outputDirectory, fileName);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = await fs.promises.stat(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${fileName}.backup.${timestamp}`;
      const backupPath = path.join(this.backupDirectory, backupFileName);

      await fs.promises.copyFile(filePath, backupPath);
      
      const backupInfo: BackupInfo = {
        originalPath: filePath,
        backupPath,
        timestamp: new Date().toISOString(),
        size: stats.size
      };

      return backupInfo;
    } catch (error) {
      console.error(`Failed to create backup for phase ${phase}:`, error);
      return null;
    }
  }

  /**
   * Perform atomic write operation to prevent partial writes
   * @param filePath - Target file path
   * @param content - Content to write
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    
    try {
      // Write to temporary file first
      await fs.promises.writeFile(tempPath, content, 'utf-8');
      
      // Atomically move to final location
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temporary file if it exists
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Validate document content
   * @param content - Content to validate
   * @param phase - Phase for context-specific validation
   * @returns Validation result with errors and warnings
   */
  async validateContent(content: string, phase: Phase): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Basic content validation
    if (!content || content.trim().length === 0) {
      errors.push('Content is empty');
    }

    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const sectionCount = (content.match(/^#{1,6}\s/gm) || []).length;
    const hasTitle = /^#\s/.test(content.trim());
    const hasContent = wordCount > 50;

    // Phase-specific validation
    switch (phase) {
      case Phase.README:
        if (wordCount < 200) {
          warnings.push('README content seems short for a comprehensive overview');
        }
        if (!content.toLowerCase().includes('installation') && !content.toLowerCase().includes('setup')) {
          warnings.push('README should include installation or setup instructions');
        }
        break;
        
      case Phase.ROADMAP:
        if (!content.toLowerCase().includes('phase') && !content.toLowerCase().includes('milestone')) {
          warnings.push('ROADMAP should include development phases or milestones');
        }
        if (!content.toLowerCase().includes('timeline') && !content.toLowerCase().includes('week') && !content.toLowerCase().includes('month')) {
          warnings.push('ROADMAP should include timeline information');
        }
        break;
        
      case Phase.SYSTEM_ARCHITECTURE:
        if (!content.toLowerCase().includes('component') && !content.toLowerCase().includes('architecture')) {
          warnings.push('System architecture should describe system components');
        }
        if (!content.toLowerCase().includes('technology') && !content.toLowerCase().includes('stack')) {
          warnings.push('System architecture should mention technology stack');
        }
        break;
    }

    // Content quality checks
    if (wordCount < 100) {
      warnings.push('Content appears to be very brief');
    }
    
    if (sectionCount === 0) {
      warnings.push('Content lacks structured sections (headings)');
    }
    
    if (!hasTitle) {
      warnings.push('Content should start with a main title (# heading)');
    }

    // Check for common markdown issues
    if (content.includes('](') && !content.includes('[')) {
      warnings.push('Potential broken markdown links detected');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        wordCount,
        sectionCount,
        hasTitle,
        hasContent
      }
    };
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      if (!fs.existsSync(this.backupDirectory)) {
        await fs.promises.mkdir(this.backupDirectory, { recursive: true });
      }
    } catch (error) {
      console.warn('Failed to create backup directory:', error);
    }
  }

  /**
   * Clean up old backups, keeping only the most recent ones
   * @param phase - Phase to clean backups for
   */
  private async cleanupOldBackups(phase: Phase): Promise<void> {
    try {
      const fileName = PHASE_OUTPUT_FILES[phase];
      const backupPattern = `${fileName}.backup.`;
      
      const files = await fs.promises.readdir(this.backupDirectory);
      const backupFiles = files
        .filter(file => file.startsWith(backupPattern))
        .map(file => ({
          name: file,
          path: path.join(this.backupDirectory, file),
          time: fs.statSync(path.join(this.backupDirectory, file)).mtime
        }))
        .sort((a, b) => b.time.getTime() - a.time.getTime());

      // Keep only the most recent backups
      const filesToDelete = backupFiles.slice(this.maxBackups);
      
      for (const file of filesToDelete) {
        await fs.promises.unlink(file.path);
        console.log(`Cleaned up old backup: ${file.name}`);
      }
    } catch (error) {
      console.warn('Failed to clean up old backups:', error);
    }
  }

  /**
   * List available backups for a phase
   * @param phase - Phase to list backups for
   * @returns Array of backup information
   */
  async listBackups(phase: Phase): Promise<Array<{
    fileName: string;
    filePath: string;
    timestamp: Date;
    size: number;
  }>> {
    try {
      const fileName = PHASE_OUTPUT_FILES[phase];
      const backupPattern = `${fileName}.backup.`;
      
      if (!fs.existsSync(this.backupDirectory)) {
        return [];
      }

      const files = await fs.promises.readdir(this.backupDirectory);
      const backupFiles = [];
      
      for (const file of files) {
        if (file.startsWith(backupPattern)) {
          const filePath = path.join(this.backupDirectory, file);
          const stats = await fs.promises.stat(filePath);
          
          backupFiles.push({
            fileName: file,
            filePath,
            timestamp: stats.mtime,
            size: stats.size
          });
        }
      }
      
      return backupFiles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error(`Failed to list backups for phase ${phase}:`, error);
      return [];
    }
  }

  /**
   * Restore from backup
   * @param phase - Phase to restore
   * @param backupFileName - Specific backup file name to restore from
   * @returns Success status
   */
  async restoreFromBackup(phase: Phase, backupFileName: string): Promise<boolean> {
    try {
      const backupPath = path.join(this.backupDirectory, backupFileName);
      const fileName = PHASE_OUTPUT_FILES[phase];
      const filePath = path.join(this.outputDirectory, fileName);
      
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }
      
      // Create backup of current file before restoring
      if (fs.existsSync(filePath)) {
        await this.createBackup(phase);
      }
      
      // Copy backup to current file location
      await fs.promises.copyFile(backupPath, filePath);
      
      console.log(`Restored ${fileName} from backup: ${backupFileName}`);
      return true;
    } catch (error) {
      console.error(`Failed to restore from backup for phase ${phase}:`, error);
      return false;
    }
  }

  /**
   * Get comprehensive file information
   * @param phase - Phase to get information for
   * @returns Detailed file information
   */
  async getFileInfo(phase: Phase): Promise<{
    exists: boolean;
    filePath: string;
    size?: number;
    created?: Date;
    modified?: Date;
    wordCount?: number;
    lineCount?: number;
    backupCount: number;
  }> {
    const fileName = PHASE_OUTPUT_FILES[phase];
    const filePath = path.join(this.outputDirectory, fileName);
    const exists = fs.existsSync(filePath);
    
    const backups = await this.listBackups(phase);
    const backupCount = backups.length;
    
    if (!exists) {
      return {
        exists,
        filePath,
        backupCount
      };
    }
    
    try {
      const stats = await fs.promises.stat(filePath);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      const lineCount = content.split('\n').length;
      
      return {
        exists,
        filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        wordCount,
        lineCount,
        backupCount
      };
    } catch (error) {
      console.error(`Failed to get file info for phase ${phase}:`, error);
      return {
        exists,
        filePath,
        backupCount
      };
    }
  }

  /**
   * Get backup directory path
   */
  getBackupDirectory(): string {
    return this.backupDirectory;
  }

  /**
   * Set maximum number of backups to keep
   */
  setMaxBackups(maxBackups: number): void {
    this.maxBackups = Math.max(1, maxBackups);
  }

  /**
   * Get current maximum backup count
   */
  getMaxBackups(): number {
    return this.maxBackups;
  }
}

// Export singleton instance for convenience
export const documentWriter = new DocumentWriter();

/**
 * Recovery utilities for handling file operation failures
 */
export class DocumentRecovery {
  private documentWriter: DocumentWriter;

  constructor(documentWriter: DocumentWriter) {
    this.documentWriter = documentWriter;
  }

  /**
   * Attempt to recover from a failed write operation
   * @param phase - Phase that failed to write
   * @param content - Original content that failed to write
   * @param error - Original error that occurred
   * @returns Recovery result
   */
  async recoverFromWriteFailure(
    phase: Phase, 
    content: string, 
    error: Error
  ): Promise<{
    recovered: boolean;
    recoveryMethod: string;
    newPath?: string;
    error?: string;
  }> {
    console.log(`Attempting recovery for phase ${phase} write failure:`, error.message);
    
    try {
      // Method 1: Try alternative file name
      const alternativePath = await this.tryAlternativeFileName(phase, content);
      if (alternativePath) {
        return {
          recovered: true,
          recoveryMethod: 'alternative_filename',
          newPath: alternativePath
        };
      }
      
      // Method 2: Try temporary directory
      const tempPath = await this.tryTemporaryLocation(phase, content);
      if (tempPath) {
        return {
          recovered: true,
          recoveryMethod: 'temporary_location',
          newPath: tempPath
        };
      }
      
      // Method 3: Try user home directory
      const homePath = await this.tryHomeDirectory(phase, content);
      if (homePath) {
        return {
          recovered: true,
          recoveryMethod: 'home_directory',
          newPath: homePath
        };
      }
      
      return {
        recovered: false,
        recoveryMethod: 'none',
        error: 'All recovery methods failed'
      };
    } catch (recoveryError) {
      return {
        recovered: false,
        recoveryMethod: 'none',
        error: recoveryError instanceof Error ? recoveryError.message : 'Unknown recovery error'
      };
    }
  }

  /**
   * Try writing with alternative file name
   */
  private async tryAlternativeFileName(phase: Phase, content: string): Promise<string | null> {
    try {
      const baseFileName = PHASE_OUTPUT_FILES[phase];
      const outputDir = this.documentWriter.getOutputDirectory();
      const timestamp = Date.now();
      const alternativeName = `${baseFileName.replace('.md', '')}-recovery-${timestamp}.md`;
      const alternativePath = path.join(outputDir, alternativeName);
      
      await fs.promises.writeFile(alternativePath, content, 'utf-8');
      console.log(`Recovery successful using alternative filename: ${alternativeName}`);
      return alternativePath;
    } catch (error) {
      return null;
    }
  }

  /**
   * Try writing to temporary directory
   */
  private async tryTemporaryLocation(phase: Phase, content: string): Promise<string | null> {
    try {
      const tempDir = path.join(process.cwd(), 'temp-genspec-recovery');
      await fs.promises.mkdir(tempDir, { recursive: true });
      
      const fileName = PHASE_OUTPUT_FILES[phase];
      const tempPath = path.join(tempDir, fileName);
      
      await fs.promises.writeFile(tempPath, content, 'utf-8');
      console.log(`Recovery successful using temporary location: ${tempPath}`);
      return tempPath;
    } catch (error) {
      return null;
    }
  }

  /**
   * Try writing to user home directory
   */
  private async tryHomeDirectory(phase: Phase, content: string): Promise<string | null> {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      if (!homeDir) {
        return null;
      }
      
      const recoveryDir = path.join(homeDir, 'genspec-recovery');
      await fs.promises.mkdir(recoveryDir, { recursive: true });
      
      const fileName = PHASE_OUTPUT_FILES[phase];
      const homePath = path.join(recoveryDir, fileName);
      
      await fs.promises.writeFile(homePath, content, 'utf-8');
      console.log(`Recovery successful using home directory: ${homePath}`);
      return homePath;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check system health for file operations
   */
  async checkSystemHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    try {
      // Check output directory accessibility
      const outputDir = this.documentWriter.getOutputDirectory();
      try {
        await fs.promises.access(outputDir, fs.constants.W_OK);
      } catch (error) {
        issues.push(`Output directory not writable: ${outputDir}`);
        suggestions.push('Check directory permissions or create the directory manually');
      }
      
      // Check available disk space (basic check)
      try {
        const stats = await fs.promises.statfs(outputDir);
        const freeSpace = stats.bavail * stats.bsize;
        if (freeSpace < 1024 * 1024) { // Less than 1MB
          issues.push('Low disk space available');
          suggestions.push('Free up disk space before writing large documents');
        }
      } catch (error) {
        // statfs not available on all systems, skip this check
      }
      
      // Check backup directory
      const backupDir = this.documentWriter.getBackupDirectory();
      if (fs.existsSync(backupDir)) {
        try {
          await fs.promises.access(backupDir, fs.constants.W_OK);
        } catch (error) {
          issues.push(`Backup directory not writable: ${backupDir}`);
          suggestions.push('Check backup directory permissions');
        }
      }
      
      return {
        healthy: issues.length === 0,
        issues,
        suggestions
      };
    } catch (error) {
      return {
        healthy: false,
        issues: ['System health check failed'],
        suggestions: ['Check system permissions and available resources']
      };
    }
  }
}

// Export recovery instance
export const documentRecovery = new DocumentRecovery(documentWriter);