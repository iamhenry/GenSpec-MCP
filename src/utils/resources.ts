import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { TemplateManager } from './templates.js';
import { DocumentWriter } from './fileWriter.js';
import { PhaseNumber, TEMPLATE_MAPPINGS } from '../types.js';

/**
 * ResourceManager handles MCP resource operations for the template:// URI scheme
 * Provides access to templates and documents through the MCP protocol
 */
export class ResourceManager {
  private templateManager: TemplateManager;
  private documentWriter: DocumentWriter;

  constructor(basePath?: string) {
    this.templateManager = new TemplateManager(basePath);
    this.documentWriter = new DocumentWriter(basePath);
  }

  /**
   * List all available template resources
   * @returns Promise<Resource[]> - Array of template resources
   */
  async listTemplateResources(): Promise<Resource[]> {
    const resources: Resource[] = [];
    const phases = this.templateManager.getAvailablePhases();

    for (const phase of phases) {
      const config = this.templateManager.getTemplateConfig(phase);
      
      resources.push({
        uri: `template://phase-${phase}`,
        name: `Phase ${phase} Template`,
        description: `Template for generating ${config.outputFile}`,
        mimeType: 'text/markdown'
      });
    }

    return resources;
  }

  /**
   * Read a template resource by URI
   * @param uri - Template URI (e.g., 'template://phase-1')
   * @returns Promise<string> - Template content
   */
  async readTemplateResource(uri: string): Promise<string> {
    // Parse the URI to extract phase number
    const match = uri.match(/^template:\/\/phase-(\d+)$/);
    if (!match) {
      throw new Error(`Invalid template URI: ${uri}. Expected format: template://phase-{1|2|3}`);
    }

    const phase = parseInt(match[1]) as PhaseNumber;
    if (!this.templateManager.isValidPhase(phase)) {
      throw new Error(`Invalid phase number: ${phase}. Must be 1, 2, or 3.`);
    }

    const templateData = await this.templateManager.loadTemplate(phase);
    return templateData.content;
  }

  /**
   * List all available document resources
   * @returns Promise<Resource[]> - Array of document resources
   */
  async listDocumentResources(): Promise<Resource[]> {
    const resources: Resource[] = [];
    const phases = this.templateManager.getAvailablePhases();

    for (const phase of phases) {
      const config = TEMPLATE_MAPPINGS[phase];
      const exists = await this.documentWriter.documentExists(phase);
      
      if (exists) {
        resources.push({
          uri: `document://phase-${phase}`,
          name: config.outputFile,
          description: `Generated ${config.outputFile} document`,
          mimeType: 'text/markdown'
        });
      }
    }

    return resources;
  }

  /**
   * Read a document resource by URI
   * @param uri - Document URI (e.g., 'document://phase-1')
   * @returns Promise<string> - Document content
   */
  async readDocumentResource(uri: string): Promise<string> {
    // Parse the URI to extract phase number
    const match = uri.match(/^document:\/\/phase-(\d+)$/);
    if (!match) {
      throw new Error(`Invalid document URI: ${uri}. Expected format: document://phase-{1|2|3}`);
    }

    const phase = parseInt(match[1]) as PhaseNumber;
    if (!this.templateManager.isValidPhase(phase)) {
      throw new Error(`Invalid phase number: ${phase}. Must be 1, 2, or 3.`);
    }

    const documentPath = this.documentWriter.getDocumentPath(phase);
    const { readFile } = await import('fs/promises');
    
    try {
      return await readFile(documentPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read document for phase ${phase}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all available resources (templates and documents)
   * @returns Promise<Resource[]> - Array of all resources
   */
  async listAllResources(): Promise<Resource[]> {
    const templateResources = await this.listTemplateResources();
    const documentResources = await this.listDocumentResources();
    
    return [...templateResources, ...documentResources];
  }

  /**
   * Read any resource by URI
   * @param uri - Resource URI
   * @returns Promise<string> - Resource content
   */
  async readResource(uri: string): Promise<string> {
    if (uri.startsWith('template://')) {
      return this.readTemplateResource(uri);
    } else if (uri.startsWith('document://')) {
      return this.readDocumentResource(uri);
    } else {
      throw new Error(`Unsupported URI scheme: ${uri}. Supported schemes: template://, document://`);
    }
  }

  /**
   * Get template manager instance
   * @returns TemplateManager
   */
  getTemplateManager(): TemplateManager {
    return this.templateManager;
  }

  /**
   * Get document writer instance
   * @returns DocumentWriter
   */
  getDocumentWriter(): DocumentWriter {
    return this.documentWriter;
  }
}