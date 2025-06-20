import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { TemplateConfig, TemplateData, PhaseNumber, TEMPLATE_MAPPINGS, DocumentContext } from '../types.js';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * TemplateManager handles loading and processing of GenSpec templates
 * Maps phase numbers to specific template files and manages template data
 */
export class TemplateManager {
  private basePath: string;

  constructor(basePath?: string) {
    // Default to project root directory
    this.basePath = basePath || resolve(__dirname, '../..');
  }

  /**
   * Load template content by phase number
   * @param phase - Phase number (1, 2, or 3)
   * @returns Promise<TemplateData> - Template content and metadata
   */
  async loadTemplate(phase: PhaseNumber): Promise<TemplateData> {
    const config = TEMPLATE_MAPPINGS[phase];
    if (!config) {
      throw new Error(`Invalid phase number: ${phase}. Must be 1, 2, or 3.`);
    }

    const templatePath = join(this.basePath, config.templateFile);
    
    try {
      const content = await readFile(templatePath, 'utf-8');
      
      return {
        content,
        metadata: {
          phase: config.phase,
          template: config.templateFile,
          outputFile: config.outputFile
        }
      };
    } catch (error) {
      throw new Error(`Failed to load template for phase ${phase}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get template configuration for a specific phase
   * @param phase - Phase number (1, 2, or 3)
   * @returns TemplateConfig - Configuration object for the phase
   */
  getTemplateConfig(phase: PhaseNumber): TemplateConfig {
    const config = TEMPLATE_MAPPINGS[phase];
    if (!config) {
      throw new Error(`Invalid phase number: ${phase}. Must be 1, 2, or 3.`);
    }
    return config;
  }

  /**
   * Load all available templates
   * @returns Promise<Record<PhaseNumber, TemplateData>> - All templates indexed by phase
   */
  async loadAllTemplates(): Promise<Record<PhaseNumber, TemplateData>> {
    const templates: Partial<Record<PhaseNumber, TemplateData>> = {};
    
    for (const phase of [1, 2, 3] as PhaseNumber[]) {
      try {
        templates[phase] = await this.loadTemplate(phase);
      } catch (error) {
        console.error(`Warning: Failed to load template for phase ${phase}:`, error);
      }
    }
    
    return templates as Record<PhaseNumber, TemplateData>;
  }

  /**
   * Process template content with context data
   * This is a simple implementation that can be extended for more complex templating
   * @param templateContent - Raw template content
   * @param context - Context data for template processing
   * @returns string - Processed template content
   */
  processTemplate(templateContent: string, context: DocumentContext): string {
    let processed = templateContent;
    
    // Simple template variable replacement
    // Replace [Project Name] with actual project name
    if (context.projectName) {
      processed = processed.replace(/\[Project Name\]/g, context.projectName);
    }
    
    // Add more template processing logic here as needed
    // For now, return the content as-is for the AI to process
    return processed;
  }

  /**
   * Get the full output path for a phase
   * @param phase - Phase number (1, 2, or 3)
   * @returns string - Full path where the document should be written
   */
  getOutputPath(phase: PhaseNumber): string {
    const config = this.getTemplateConfig(phase);
    return join(this.basePath, config.outputPath, config.outputFile);
  }

  /**
   * List all available template phases
   * @returns PhaseNumber[] - Array of available phase numbers
   */
  getAvailablePhases(): PhaseNumber[] {
    return Object.keys(TEMPLATE_MAPPINGS).map(Number) as PhaseNumber[];
  }

  /**
   * Validate if a phase number is valid
   * @param phase - Phase number to validate
   * @returns boolean - True if phase is valid
   */
  isValidPhase(phase: number): phase is PhaseNumber {
    return phase in TEMPLATE_MAPPINGS;
  }
}