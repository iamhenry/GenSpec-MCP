/**
 * Enhanced Template Loading System for GenSpec MCP Server
 * Handles template file reading, caching, validation, and metadata extraction
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { 
  Phase, 
  TemplateData, 
  TemplateMetadata,
  TemplateValidationResult,
  EnhancedTemplateData,
  PHASE_TEMPLATE_FILES, 
  PHASE_TEMPLATE_URIS,
  GenSpecError 
} from '../types.js';

export class TemplateManager {
  private templateCache: Map<Phase, EnhancedTemplateData> = new Map();
  private metadataCache: Map<Phase, TemplateMetadata> = new Map();
  private validationCache: Map<Phase, TemplateValidationResult> = new Map();
  private checksumCache: Map<Phase, string> = new Map();
  private templatesPath: string;
  private cacheEnabled: boolean;
  private maxCacheAge: number; // in milliseconds

  constructor(templatesPath?: string, cacheEnabled: boolean = true, maxCacheAge: number = 5 * 60 * 1000) {
    // Default to templates/ directory relative to project root
    this.templatesPath = templatesPath || path.resolve(process.cwd(), 'templates');
    this.cacheEnabled = cacheEnabled;
    this.maxCacheAge = maxCacheAge;
  }

  /**
   * Load template content for a specific phase with enhanced caching and validation
   * @param phase - The phase to load template for
   * @param forceReload - Force reload from disk, bypassing cache
   * @returns Enhanced TemplateData with content, metadata, and validation results
   */
  async loadTemplate(phase: Phase, forceReload: boolean = false): Promise<EnhancedTemplateData> {
    const templateFileName = PHASE_TEMPLATE_FILES[phase];
    const templateFilePath = path.join(this.templatesPath, templateFileName);
    const templateUri = PHASE_TEMPLATE_URIS[phase];

    // Check cache first (if enabled and not forcing reload)
    if (this.cacheEnabled && !forceReload && this.templateCache.has(phase)) {
      const cached = this.templateCache.get(phase)!;
      
      // Check if cache is still valid by comparing file modification time
      try {
        const stats = await fs.promises.stat(templateFilePath);
        const currentChecksum = await this.calculateFileChecksum(templateFilePath);
        
        if (cached.metadata.checksum === currentChecksum && 
            cached.metadata.lastModified.getTime() === stats.mtime.getTime()) {
          return cached;
        }
        
        // Cache is stale, remove it
        this.clearPhaseCache(phase);
      } catch (error) {
        // File might not exist, continue to load
        this.clearPhaseCache(phase);
      }
    }

    try {
      // Validate template file exists
      if (!fs.existsSync(templateFilePath)) {
        throw new Error(`Template file not found: ${templateFilePath}`);
      }

      // Get file stats
      const stats = await fs.promises.stat(templateFilePath);
      
      // Read template content
      const content = await fs.promises.readFile(templateFilePath, 'utf-8');
      
      if (!content.trim()) {
        throw new Error(`Template file is empty: ${templateFilePath}`);
      }

      // Extract metadata
      const metadata = await this.extractTemplateMetadata(content, templateFilePath, stats);
      
      // Validate template structure and content
      const validation = await this.validateTemplate(content, phase, metadata);

      const enhancedTemplateData: EnhancedTemplateData = {
        phase,
        content,
        uri: templateUri,
        filePath: templateFilePath,
        metadata,
        isValid: validation.isValid,
        validationErrors: validation.errors
      };

      // Cache the enhanced template data
      if (this.cacheEnabled) {
        this.templateCache.set(phase, enhancedTemplateData);
        this.metadataCache.set(phase, metadata);
        this.validationCache.set(phase, validation);
        this.checksumCache.set(phase, metadata.checksum);
      }
      
      return enhancedTemplateData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load template for phase ${phase}: ${errorMessage}`);
    }
  }

  /**
   * Load all templates and return as array with enhanced error handling
   * @param forceReload - Force reload from disk, bypassing cache
   * @returns Array of all enhanced TemplateData with validation results
   */
  async loadAllTemplates(forceReload: boolean = false): Promise<EnhancedTemplateData[]> {
    const phases = [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE];
    const templates: EnhancedTemplateData[] = [];
    const errors: Array<{ phase: Phase; error: string }> = [];

    // Load templates in parallel for better performance
    const promises = phases.map(async (phase) => {
      try {
        const template = await this.loadTemplate(phase, forceReload);
        return { phase, template, error: null };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to load template for phase ${phase}:`, errorMessage);
        errors.push({ phase, error: errorMessage });
        return { phase, template: null, error: errorMessage };
      }
    });

    const results = await Promise.all(promises);
    
    for (const result of results) {
      if (result.template) {
        templates.push(result.template);
      }
    }

    // Log summary of loading results
    console.log(`Loaded ${templates.length}/${phases.length} templates successfully`);
    if (errors.length > 0) {
      console.warn(`Failed to load ${errors.length} templates:`, errors);
    }

    return templates;
  }

  /**
   * Get template by URI (for MCP resources) with enhanced error handling
   * @param uri - Template URI (e.g., 'template://1-generate-readme')
   * @param forceReload - Force reload from disk, bypassing cache
   * @returns Enhanced TemplateData or null if not found
   */
  async getTemplateByUri(uri: string, forceReload: boolean = false): Promise<EnhancedTemplateData | null> {
    // Find phase by URI
    const phaseEntry = Object.entries(PHASE_TEMPLATE_URIS).find(
      ([_, templateUri]) => templateUri === uri
    );

    if (!phaseEntry) {
      console.warn(`Template URI not found: ${uri}`);
      return null;
    }

    const phase = Number(phaseEntry[0]) as Phase;

    try {
      return await this.loadTemplate(phase, forceReload);
    } catch (error) {
      console.error(`Failed to get template by URI ${uri}:`, error);
      return null;
    }
  }

  /**
   * Comprehensive template validation with detailed error reporting
   * @returns Enhanced validation result with errors, warnings, and recommendations
   */
  async validateTemplates(): Promise<{
    isValid: boolean;
    missingFiles: string[];
    invalidTemplates: Array<{ phase: Phase; errors: string[] }>;
    warnings: string[];
    recommendations: string[];
    summary: {
      totalTemplates: number;
      validTemplates: number;
      invalidTemplates: number;
      missingTemplates: number;
    };
  }> {
    const missingFiles: string[] = [];
    const invalidTemplates: Array<{ phase: Phase; errors: string[] }> = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    let validCount = 0;
    let invalidCount = 0;
    let missingCount = 0;
    
    // Check each template file
    for (const [phaseStr, fileName] of Object.entries(PHASE_TEMPLATE_FILES)) {
      const phase = Number(phaseStr) as Phase;
      const filePath = path.join(this.templatesPath, fileName);
      
      if (!fs.existsSync(filePath)) {
        missingFiles.push(fileName);
        missingCount++;
        continue;
      }
      
      try {
        // Validate file accessibility
        await fs.promises.access(filePath, fs.constants.R_OK);
        
        // Load and validate template content
        const template = await this.loadTemplate(phase, true); // Force reload for validation
        
        if (template.isValid) {
          validCount++;
          
          // Check for potential improvements
          if (template.metadata.sectionCount < 3) {
            warnings.push(`Template ${fileName} has few sections (${template.metadata.sectionCount}), consider adding more structure`);
          }
          
          if (template.metadata.requirementCount === 0) {
            warnings.push(`Template ${fileName} has no explicit requirements, consider adding guidance`);
          }
          
          if (template.metadata.exampleCount === 0) {
            recommendations.push(`Template ${fileName} could benefit from examples to guide generation`);
          }
        } else {
          invalidCount++;
          invalidTemplates.push({
            phase,
            errors: template.validationErrors
          });
        }
      } catch (error) {
        invalidCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        invalidTemplates.push({
          phase,
          errors: [`Failed to validate template: ${errorMessage}`]
        });
      }
    }
    
    // Add general recommendations
    if (validCount === Object.keys(PHASE_TEMPLATE_FILES).length) {
      recommendations.push('All templates are valid! Consider periodic reviews for content updates.');
    }
    
    if (missingCount > 0 || invalidCount > 0) {
      recommendations.push('Fix missing or invalid templates before running generation workflows.');
    }

    const totalTemplates = Object.keys(PHASE_TEMPLATE_FILES).length;
    
    return {
      isValid: missingCount === 0 && invalidCount === 0,
      missingFiles,
      invalidTemplates,
      warnings,
      recommendations,
      summary: {
        totalTemplates,
        validTemplates: validCount,
        invalidTemplates: invalidCount,
        missingTemplates: missingCount
      }
    };
  }

  /**
   * Clear template cache with options for selective clearing
   * @param phase - Optional specific phase to clear, if not provided clears all
   */
  clearCache(phase?: Phase): void {
    if (phase !== undefined) {
      this.clearPhaseCache(phase);
    } else {
      this.templateCache.clear();
      this.metadataCache.clear();
      this.validationCache.clear();
      this.checksumCache.clear();
    }
  }
  
  /**
   * Clear cache for a specific phase
   * @param phase - Phase to clear from cache
   */
  private clearPhaseCache(phase: Phase): void {
    this.templateCache.delete(phase);
    this.metadataCache.delete(phase);
    this.validationCache.delete(phase);
    this.checksumCache.delete(phase);
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

  /**
   * Comprehensive templates directory validation
   * @returns Detailed directory validation result
   */
  async checkTemplatesDirectoryDetailed(): Promise<{
    exists: boolean;
    isDirectory: boolean;
    isReadable: boolean;
    isWritable: boolean;
    path: string;
    permissions: string;
    errors: string[];
  }> {
    const result = {
      exists: false,
      isDirectory: false,
      isReadable: false,
      isWritable: false,
      path: this.templatesPath,
      permissions: '',
      errors: [] as string[]
    };
    
    try {
      // Check if path exists
      result.exists = fs.existsSync(this.templatesPath);
      
      if (!result.exists) {
        result.errors.push(`Templates directory does not exist: ${this.templatesPath}`);
        return result;
      }
      
      // Check if it's a directory
      const stats = await fs.promises.stat(this.templatesPath);
      result.isDirectory = stats.isDirectory();
      
      if (!result.isDirectory) {
        result.errors.push(`Templates path is not a directory: ${this.templatesPath}`);
        return result;
      }
      
      // Check permissions
      try {
        await fs.promises.access(this.templatesPath, fs.constants.R_OK);
        result.isReadable = true;
      } catch {
        result.errors.push(`Templates directory is not readable: ${this.templatesPath}`);
      }
      
      try {
        await fs.promises.access(this.templatesPath, fs.constants.W_OK);
        result.isWritable = true;
      } catch {
        // Write access is not critical for templates directory
        result.errors.push(`Templates directory is not writable: ${this.templatesPath}`);
      }
      
      // Get permission string
      const mode = stats.mode;
      result.permissions = (mode & parseInt('777', 8)).toString(8);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Error checking templates directory: ${errorMessage}`);
    }
    
    return result;
  }

  /**
   * Extract comprehensive metadata from template content
   * @param content - Template content to analyze
   * @param filePath - Path to template file
   * @param stats - File stats for metadata
   * @returns Detailed template metadata
   */
  private async extractTemplateMetadata(content: string, filePath: string, stats: fs.Stats): Promise<TemplateMetadata> {
    const lines = content.split('\n');
    const structureElements: string[] = [];
    const requirements: string[] = [];
    const examples: string[] = [];
    
    let sectionCount = 0;
    let requirementCount = 0;
    let exampleCount = 0;
    let instructionCount = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Count sections (headers)
      if (trimmed.match(/^#{1,6}\s/)) {
        sectionCount++;
        structureElements.push(trimmed);
      }
      
      // Count requirements
      if (trimmed.toLowerCase().match(/\b(must|should|requirement|mandatory|required)\b/)) {
        requirementCount++;
        requirements.push(trimmed);
      }
      
      // Count examples
      if (trimmed.toLowerCase().includes('example') || trimmed.startsWith('```')) {
        exampleCount++;
        examples.push(trimmed);
      }
      
      // Count instructions
      if (trimmed.toLowerCase().match(/\b(generate|create|write|include|provide)\b/) &&
          !trimmed.startsWith('#')) {
        instructionCount++;
      }
    }
    
    // Calculate file checksum
    const checksum = await this.calculateFileChecksum(filePath);
    
    return {
      sectionCount,
      requirementCount,
      exampleCount,
      instructionCount,
      structureElements,
      requirements,
      examples,
      checksum,
      lastModified: stats.mtime,
      fileSize: stats.size
    };
  }
  
  /**
   * Calculate file checksum for cache validation
   * @param filePath - Path to file
   * @returns SHA256 checksum of file content
   */
  private async calculateFileChecksum(filePath: string): Promise<string> {
    const content = await fs.promises.readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  }
  
  /**
   * Validate template structure and content
   * @param content - Template content to validate
   * @param phase - Phase for context-specific validation
   * @param metadata - Template metadata for validation
   * @returns Validation result with errors and warnings
   */
  private async validateTemplate(content: string, phase: Phase, metadata: TemplateMetadata): Promise<TemplateValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Basic content validation
    if (!content || content.trim().length === 0) {
      errors.push('Template content is empty');
      return { isValid: false, errors, warnings };
    }
    
    if (content.length < 100) {
      warnings.push('Template content is very short, consider adding more guidance');
    }
    
    // Structure validation
    if (metadata.sectionCount === 0) {
      errors.push('Template has no sections (headers), add structure with # headers');
    } else if (metadata.sectionCount < 2) {
      warnings.push('Template has only one section, consider adding more structure');
    }
    
    // Content quality validation
    if (metadata.requirementCount === 0) {
      warnings.push('Template has no explicit requirements, consider adding guidance keywords (must, should, required)');
    }
    
    if (metadata.instructionCount === 0) {
      errors.push('Template has no instructions, add action keywords (generate, create, write, include)');
    }
    
    // Phase-specific validation
    const phaseValidation = this.validatePhaseSpecificRequirements(content, phase);
    errors.push(...phaseValidation.errors);
    warnings.push(...phaseValidation.warnings);
    
    // Check for common template issues
    if (content.includes('TODO') || content.includes('FIXME')) {
      warnings.push('Template contains TODO or FIXME comments, consider completing them');
    }
    
    if (!content.includes('{{') && !content.includes('${')) {
      warnings.push('Template appears to have no placeholders, consider adding dynamic content markers');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata
    };
  }
  
  /**
   * Validate phase-specific template requirements
   * @param content - Template content
   * @param phase - Phase to validate for
   * @returns Phase-specific validation errors and warnings
   */
  private validatePhaseSpecificRequirements(content: string, phase: Phase): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const contentLower = content.toLowerCase();
    
    switch (phase) {
      case Phase.README:
        if (!contentLower.includes('overview') && !contentLower.includes('description')) {
          warnings.push('README template should include overview or description section');
        }
        if (!contentLower.includes('install') && !contentLower.includes('setup')) {
          warnings.push('README template should include installation or setup instructions');
        }
        if (!contentLower.includes('feature') && !contentLower.includes('functionality')) {
          warnings.push('README template should describe features or functionality');
        }
        break;
        
      case Phase.ROADMAP:
        if (!contentLower.includes('milestone') && !contentLower.includes('phase')) {
          warnings.push('ROADMAP template should include milestones or development phases');
        }
        if (!contentLower.includes('timeline') && !contentLower.includes('schedule')) {
          warnings.push('ROADMAP template should include timeline or schedule information');
        }
        if (!contentLower.includes('priority') && !contentLower.includes('order')) {
          warnings.push('ROADMAP template should indicate development priorities or order');
        }
        break;
        
      case Phase.SYSTEM_ARCHITECTURE:
        if (!contentLower.includes('component') && !contentLower.includes('module')) {
          warnings.push('SYSTEM-ARCHITECTURE template should describe system components or modules');
        }
        if (!contentLower.includes('technology') && !contentLower.includes('stack')) {
          warnings.push('SYSTEM-ARCHITECTURE template should specify technology stack');
        }
        if (!contentLower.includes('data') && !contentLower.includes('flow')) {
          warnings.push('SYSTEM-ARCHITECTURE template should describe data flow or architecture');
        }
        break;
    }
    
    return { errors, warnings };
  }
  
  /**
   * Get template metadata without loading full content (from cache if available)
   * @param phase - Phase to get metadata for
   * @returns Template metadata or null if not cached
   */
  getTemplateMetadata(phase: Phase): TemplateMetadata | null {
    return this.metadataCache.get(phase) || null;
  }
  
  /**
   * Get template validation result from cache
   * @param phase - Phase to get validation for
   * @returns Validation result or null if not cached
   */
  getTemplateValidation(phase: Phase): TemplateValidationResult | null {
    return this.validationCache.get(phase) || null;
  }
  
  /**
   * Get cache statistics for monitoring and debugging
   * @returns Cache statistics object
   */
  getCacheStats(): {
    enabled: boolean;
    templatesCached: number;
    metadataCached: number;
    validationsCached: number;
    checksumsCached: number;
    maxAge: number;
  } {
    return {
      enabled: this.cacheEnabled,
      templatesCached: this.templateCache.size,
      metadataCached: this.metadataCache.size,
      validationsCached: this.validationCache.size,
      checksumsCached: this.checksumCache.size,
      maxAge: this.maxCacheAge
    };
  }
  
  /**
   * Enable or disable caching
   * @param enabled - Whether to enable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }
  
  /**
   * Set maximum cache age
   * @param maxAge - Maximum cache age in milliseconds
   */
  setMaxCacheAge(maxAge: number): void {
    this.maxCacheAge = maxAge;
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
      console.warn(`Template resource not found: ${uri}`);
      return null;
    }

    // Include validation warnings in the response if template has issues
    let content = template.content;
    
    if (!template.isValid && template.validationErrors.length > 0) {
      content = `<!-- TEMPLATE VALIDATION WARNINGS:\n${template.validationErrors.join('\n')}\n-->\n\n${content}`;
    }

    return {
      contents: [{
        type: 'text',
        text: content
      }]
    };
  } catch (error) {
    console.error(`Failed to read template resource ${uri}:`, error);
    return null;
  }
}