import { writeFile, mkdir, access, constants } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { WriteResult, PhaseNumber, TEMPLATE_MAPPINGS } from '../types.js';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * DocumentWriter handles writing generated documents to the _ai/docs/ directory
 * Manages file operations and ensures proper directory structure
 */
export class DocumentWriter {
  private basePath: string;
  private docsPath: string;

  constructor(projectPath?: string) {
    // Use the user's project directory (where documents should be written)
    this.basePath = projectPath || process.cwd();
    this.docsPath = join(this.basePath, '_ai', 'docs');
  }

  /**
   * Ensure the _ai/docs directory exists
   * @returns Promise<void>
   */
  private async ensureDocsDirectory(): Promise<void> {
    try {
      await access(this.docsPath, constants.F_OK);
    } catch {
      // Directory doesn't exist, create it
      await mkdir(this.docsPath, { recursive: true });
    }
  }

  /**
   * Write a document for a specific phase
   * @param phase - Phase number (1, 2, or 3)
   * @param content - Document content to write
   * @returns Promise<WriteResult> - Result of the write operation
   */
  async writeDocument(phase: PhaseNumber, content: string): Promise<WriteResult> {
    const config = TEMPLATE_MAPPINGS[phase];
    if (!config) {
      return {
        success: false,
        filePath: '',
        error: `Invalid phase number: ${phase}. Must be 1, 2, or 3.`
      };
    }

    const filePath = join(this.docsPath, config.outputFile);

    try {
      // Ensure directory exists
      await this.ensureDocsDirectory();

      // Write the file
      await writeFile(filePath, content, 'utf-8');

      return {
        success: true,
        filePath: filePath
      };
    } catch (error) {
      return {
        success: false,
        filePath: filePath,
        error: `Failed to write document: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Write a document with a custom filename
   * @param filename - Custom filename (e.g., 'CUSTOM-DOC.md')
   * @param content - Document content to write
   * @returns Promise<WriteResult> - Result of the write operation
   */
  async writeCustomDocument(filename: string, content: string): Promise<WriteResult> {
    const filePath = join(this.docsPath, filename);

    try {
      // Ensure directory exists
      await this.ensureDocsDirectory();

      // Write the file
      await writeFile(filePath, content, 'utf-8');

      return {
        success: true,
        filePath: filePath
      };
    } catch (error) {
      return {
        success: false,
        filePath: filePath,
        error: `Failed to write custom document: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Write multiple documents at once
   * @param documents - Array of [phase, content] or [filename, content] pairs
   * @returns Promise<WriteResult[]> - Array of write results
   */
  async writeMultipleDocuments(documents: Array<[PhaseNumber | string, string]>): Promise<WriteResult[]> {
    const results: WriteResult[] = [];

    for (const [phaseOrFilename, content] of documents) {
      let result: WriteResult;
      
      if (typeof phaseOrFilename === 'number') {
        result = await this.writeDocument(phaseOrFilename, content);
      } else {
        result = await this.writeCustomDocument(phaseOrFilename, content);
      }
      
      results.push(result);
    }

    return results;
  }

  /**
   * Get the full path for a document by phase
   * @param phase - Phase number (1, 2, or 3)
   * @returns string - Full path where the document would be written
   */
  getDocumentPath(phase: PhaseNumber): string {
    const config = TEMPLATE_MAPPINGS[phase];
    if (!config) {
      throw new Error(`Invalid phase number: ${phase}. Must be 1, 2, or 3.`);
    }
    return join(this.docsPath, config.outputFile);
  }

  /**
   * Get the full path for a custom document
   * @param filename - Custom filename
   * @returns string - Full path where the document would be written
   */
  getCustomDocumentPath(filename: string): string {
    return join(this.docsPath, filename);
  }

  /**
   * Check if a document exists for a specific phase
   * @param phase - Phase number (1, 2, or 3)
   * @returns Promise<boolean> - True if document exists
   */
  async documentExists(phase: PhaseNumber): Promise<boolean> {
    const filePath = this.getDocumentPath(phase);
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a custom document exists
   * @param filename - Custom filename
   * @returns Promise<boolean> - True if document exists
   */
  async customDocumentExists(filename: string): Promise<boolean> {
    const filePath = this.getCustomDocumentPath(filename);
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the docs directory path
   * @returns string - Path to the _ai/docs directory
   */
  getDocsPath(): string {
    return this.docsPath;
  }

  /**
   * Get the base project path
   * @returns string - Base project path
   */
  getBasePath(): string {
    return this.basePath;
  }
}