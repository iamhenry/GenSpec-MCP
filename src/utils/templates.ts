/**
 * Template Loading System for GenSpec MCP Server
 * Handles template file reading and management with phase mapping
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  Phase, 
  TemplateData, 
  PHASE_TEMPLATE_FILES, 
  PHASE_TEMPLATE_URIS,
  GenSpecError 
} from '../types.js';

export class TemplateManager {
  private templateCache: Map<Phase, TemplateData> = new Map();
  private templatesPath: string;

  constructor(templatesPath?: string) {
    // Default to templates/ directory relative to project root
    this.templatesPath = templatesPath || path.resolve(process.cwd(), 'templates');
  }

  /**
   * Load template content for a specific phase
   * @param phase - The phase to load template for
   * @returns TemplateData with content and metadata
   */
  async loadTemplate(phase: Phase): Promise<TemplateData> {
    // Check cache first
    if (this.templateCache.has(phase)) {
      return this.templateCache.get(phase)!;
    }

    const templateFileName = PHASE_TEMPLATE_FILES[phase];
    const templateFilePath = path.join(this.templatesPath, templateFileName);
    const templateUri = PHASE_TEMPLATE_URIS[phase];

    try {
      // Validate template file exists
      if (!fs.existsSync(templateFilePath)) {
        throw new Error(`Template file not found: ${templateFilePath}`);
      }

      // Read template content
      const content = await fs.promises.readFile(templateFilePath, 'utf-8');
      
      if (!content.trim()) {
        throw new Error(`Template file is empty: ${templateFilePath}`);
      }

      const templateData: TemplateData = {
        phase,
        content,
        uri: templateUri,
        filePath: templateFilePath
      };

      // Cache the template data
      this.templateCache.set(phase, templateData);
      
      return templateData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load template for phase ${phase}: ${errorMessage}`);
    }
  }

  /**
   * Load all templates and return as array
   * @returns Array of all TemplateData
   */
  async loadAllTemplates(): Promise<TemplateData[]> {
    const phases = [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE];
    const templates: TemplateData[] = [];

    for (const phase of phases) {
      try {
        const template = await this.loadTemplate(phase);
        templates.push(template);
      } catch (error) {
        console.error(`Failed to load template for phase ${phase}:`, error);
        // Continue loading other templates even if one fails
      }
    }

    return templates;
  }

  /**
   * Get template by URI (for MCP resources)
   * @param uri - Template URI (e.g., 'template://1-generate-readme')
   * @returns TemplateData or null if not found
   */
  async getTemplateByUri(uri: string): Promise<TemplateData | null> {
    // Find phase by URI
    const phaseEntry = Object.entries(PHASE_TEMPLATE_URIS).find(
      ([_, templateUri]) => templateUri === uri
    );

    if (!phaseEntry) {
      return null;
    }

    const phase = Number(phaseEntry[0]) as Phase;

    try {
      return await this.loadTemplate(phase);
    } catch (error) {
      console.error(`Failed to get template by URI ${uri}:`, error);
      return null;
    }
  }

  /**
   * Validate that all required template files exist
   * @returns Validation result with missing files
   */
  validateTemplates(): { isValid: boolean; missingFiles: string[] } {
    const missingFiles: string[] = [];
    
    Object.values(PHASE_TEMPLATE_FILES).forEach(fileName => {
      const filePath = path.join(this.templatesPath, fileName);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(fileName);
      }
    });

    return {
      isValid: missingFiles.length === 0,
      missingFiles
    };
  }

  /**
   * Clear template cache (useful for testing or dynamic reloading)
   */
  clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Get templates directory path
   */
  getTemplatesPath(): string {
    return this.templatesPath;
  }

  /**
   * Check if templates directory exists and is readable
   */
  checkTemplatesDirectory(): boolean {
    try {
      const stats = fs.statSync(this.templatesPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance for convenience
export const templateManager = new TemplateManager();

// MCP Resource handler functions for integration with Track A
export async function listTemplateResources(): Promise<Array<{ uri: string; name: string; description: string; mimeType: string }>> {
  const resources = Object.entries(PHASE_TEMPLATE_URIS).map(([phase, uri]) => ({
    uri,
    name: `Template ${phase}`,
    description: `Template for generating ${PHASE_TEMPLATE_FILES[Number(phase) as Phase]}`,
    mimeType: 'text/markdown'
  }));

  return resources;
}

export async function readTemplateResource(uri: string): Promise<{ contents: [{ type: 'text'; text: string }] } | null> {
  try {
    const template = await templateManager.getTemplateByUri(uri);
    if (!template) {
      return null;
    }

    return {
      contents: [{
        type: 'text',
        text: template.content
      }]
    };
  } catch (error) {
    console.error(`Failed to read template resource ${uri}:`, error);
    return null;
  }
}