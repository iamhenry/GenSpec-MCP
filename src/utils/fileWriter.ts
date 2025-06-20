/**
 * File Writing System for GenSpec MCP Server
 * Handles document writing to _ai/docs/ directory with proper error handling
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  Phase, 
  GenerationResult, 
  PHASE_OUTPUT_FILES,
  GenSpecError 
} from '../types.js';

export class DocumentWriter {
  private outputDirectory: string;

  constructor(outputDirectory?: string) {
    // Default to _ai/docs/ directory relative to current working directory
    this.outputDirectory = outputDirectory || path.resolve(process.cwd(), '_ai', 'docs');
  }

  /**
   * Write document content to appropriate file based on phase
   * @param phase - The phase being written
   * @param content - The content to write
   * @param workspace - Optional workspace identifier for logging
   * @returns GenerationResult with file paths and metadata
   */
  async writeDocument(phase: Phase, content: string, workspace?: string): Promise<GenerationResult> {
    try {
      // Ensure output directory exists
      await this.ensureOutputDirectory();

      const fileName = PHASE_OUTPUT_FILES[phase];
      const filePath = path.join(this.outputDirectory, fileName);
      const draftPath = filePath; // In this implementation, draft and final are the same

      // Validate content
      if (!content || content.trim().length === 0) {
        throw new Error(`Content is empty for phase ${phase}`);
      }

      // Write content to file
      await fs.promises.writeFile(filePath, content, 'utf-8');

      // Verify file was written successfully
      if (!fs.existsSync(filePath)) {
        throw new Error(`File was not created: ${filePath}`);
      }

      const result: GenerationResult = {
        phase,
        content,
        filePath,
        nextAction: 'approve', // Default to approve, client can change based on workflow
        draftPath
      };

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to write document for phase ${phase}: ${errorMessage}`);
    }
  }

  /**
   * Write multiple documents in sequence
   * @param documents - Array of {phase, content} objects
   * @param workspace - Optional workspace identifier
   * @returns Array of GenerationResult
   */
  async writeMultipleDocuments(
    documents: Array<{ phase: Phase; content: string }>, 
    workspace?: string
  ): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];

    for (const doc of documents) {
      try {
        const result = await this.writeDocument(doc.phase, doc.content, workspace);
        results.push(result);
      } catch (error) {
        console.error(`Failed to write document for phase ${doc.phase}:`, error);
        // Continue with other documents even if one fails
      }
    }

    return results;
  }

  /**
   * Read existing document content if it exists
   * @param phase - The phase to read
   * @returns Content string or null if file doesn't exist
   */
  async readExistingDocument(phase: Phase): Promise<string | null> {
    try {
      const fileName = PHASE_OUTPUT_FILES[phase];
      const filePath = path.join(this.outputDirectory, fileName);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error(`Failed to read existing document for phase ${phase}:`, error);
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
   * Ensure output directory exists and is writable
   */
  async ensureOutputDirectory(): Promise<void> {
    try {
      // Create directory recursively if it doesn't exist
      if (!fs.existsSync(this.outputDirectory)) {
        await fs.promises.mkdir(this.outputDirectory, { recursive: true });
      }

      // Check if directory is writable
      await fs.promises.access(this.outputDirectory, fs.constants.W_OK);
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
    try {
      const fileName = PHASE_OUTPUT_FILES[phase];
      const filePath = path.join(this.outputDirectory, fileName);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${fileName}.backup.${timestamp}`;
      const backupPath = path.join(this.outputDirectory, backupFileName);

      await fs.promises.copyFile(filePath, backupPath);
      return backupPath;
    } catch (error) {
      console.error(`Failed to create backup for phase ${phase}:`, error);
      return null;
    }
  }
}

// Export singleton instance for convenience
export const documentWriter = new DocumentWriter();