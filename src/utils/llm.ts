/**
 * Document Generation Interface for GenSpec MCP Server
 * Handles system prompt building, user story fetching, and generation interface (client manages all LLM calls)
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  GenerationContext, 
  GenerationResult, 
  Phase, 
  PHASE_NAMES,
  ApprovalResult 
} from '../types.js';
import { TemplateManager } from './templates.js';
import { DocumentWriter } from './fileWriter.js';

export interface SystemPromptData {
  templateContent: string;
  contextData: string;
  userStories: string;
  previousPhases: string;
  phase: Phase;
  phaseName: string;
  templateMetadata: {
    filePath: string;
    uri: string;
    sectionCount: number;
    requirementCount: number;
  };
}

export interface GenerationRequest {
  systemPrompt: string;
  context: GenerationContext;
  editFeedback?: string;
  templateGuidence: {
    structure: string[];
    requirements: string[];
    examples: string[];
  };
  qualityMetrics: {
    minWordCount: number;
    requiredSections: string[];
    validationRules: string[];
  };
}

export class DocumentGenerator {
  private templateManager: TemplateManager;
  private documentWriter: DocumentWriter;

  constructor(templateManager?: TemplateManager, documentWriter?: DocumentWriter) {
    this.templateManager = templateManager || new TemplateManager();
    this.documentWriter = documentWriter || new DocumentWriter();
  }

  /**
   * Build system prompt with template content and generation context
   * @param context - Generation context with user stories and previous phases
   * @param editFeedback - Optional edit feedback for regeneration
   * @returns SystemPromptData with all components needed for LLM call
   */
  async buildSystemPrompt(context: GenerationContext, editFeedback?: string): Promise<SystemPromptData> {
    try {
      // Load template for the current phase
      const templateData = await this.templateManager.loadTemplate(context.phase);
      
      // Build context data from previous phases
      const previousPhasesText = this.buildPreviousPhasesContext(context.previousPhases);
      
      // Build comprehensive context data
      const contextData = this.buildContextData(context, previousPhasesText, editFeedback);

      // Extract template metadata for better prompt generation
      const templateMetadata = this.extractTemplateMetadata(templateData.content);

      const systemPromptData: SystemPromptData = {
        templateContent: templateData.content,
        contextData,
        userStories: context.userStories,
        previousPhases: previousPhasesText,
        phase: context.phase,
        phaseName: PHASE_NAMES[context.phase],
        templateMetadata: {
          filePath: templateData.filePath,
          uri: templateData.uri,
          sectionCount: templateMetadata.sectionCount,
          requirementCount: templateMetadata.requirementCount
        }
      };

      return systemPromptData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to build system prompt for phase ${context.phase}: ${errorMessage}`);
    }
  }

  /**
   * Create generation request ready for client LLM call
   * @param context - Generation context
   * @param editFeedback - Optional edit feedback for regeneration
   * @returns Complete generation request with system prompt
   */
  async createGenerationRequest(context: GenerationContext, editFeedback?: string): Promise<GenerationRequest> {
    const promptData = await this.buildSystemPrompt(context, editFeedback);
    
    // Combine all components into final system prompt
    const systemPrompt = this.combineSystemPrompt(promptData, editFeedback);

    // Extract template guidance for better generation
    const templateGuidence = this.extractTemplateGuidance(promptData.templateContent);
    
    // Define quality metrics based on phase
    const qualityMetrics = this.defineQualityMetrics(context.phase);

    return {
      systemPrompt,
      context,
      editFeedback,
      templateGuidence,
      qualityMetrics
    };
  }

  /**
   * Process generation result and write to file
   * @param generatedContent - Content returned from LLM
   * @param context - Generation context
   * @returns GenerationResult with file paths and next action
   */
  async processGenerationResult(generatedContent: string, context: GenerationContext): Promise<GenerationResult> {
    try {
      // Validate generated content
      if (!generatedContent || generatedContent.trim().length === 0) {
        throw new Error('Generated content is empty');
      }

      // Write document to file
      const result = await this.documentWriter.writeDocument(
        context.phase, 
        generatedContent, 
        context.workspace
      );

      // Set next action based on phase workflow
      result.nextAction = this.determineNextAction(context.phase);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to process generation result for phase ${context.phase}: ${errorMessage}`);
    }
  }

  /**
   * Handle edit feedback and prepare for regeneration
   * @param editFeedback - User feedback for improvements
   * @param context - Original generation context
   * @returns Updated generation request with edit feedback incorporated
   */
  async incorporateEditFeedback(editFeedback: string, context: GenerationContext): Promise<GenerationRequest> {
    // Validate edit feedback
    if (!editFeedback || editFeedback.trim().length === 0) {
      throw new Error('Edit feedback cannot be empty');
    }

    // Parse edit feedback for specific improvement areas
    const parsedFeedback = this.parseEditFeedback(editFeedback);
    
    // Create enhanced generation request with structured feedback
    const request = await this.createGenerationRequest(context, editFeedback);
    
    // Enhance request with parsed feedback insights
    request.templateGuidence.requirements.push(...parsedFeedback.requirements);
    request.qualityMetrics.validationRules.push(...parsedFeedback.validationRules);

    return request;
  }

  /**
   * Validate generation prerequisites
   * @param context - Generation context to validate
   * @returns Validation result with missing prerequisites
   */
  async validateGenerationPrerequisites(context: GenerationContext): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check user stories
    if (!context.userStories || context.userStories.trim().length === 0) {
      errors.push('User stories are required but not provided');
    }

    // Check template availability
    try {
      await this.templateManager.loadTemplate(context.phase);
    } catch (error) {
      errors.push(`Template not available for phase ${context.phase}`);
    }

    // Check prerequisite phases are completed
    const missingPrerequisites = this.checkPhasePrerequisites(context.phase, context.previousPhases);
    if (missingPrerequisites.length > 0) {
      errors.push(`Missing prerequisite phases: ${missingPrerequisites.map(p => PHASE_NAMES[p]).join(', ')}`);
    }

    // Check output directory
    const outputValidation = await this.documentWriter.validateOutputDirectory();
    if (!outputValidation.isValid) {
      errors.push(`Output directory validation failed: ${outputValidation.error}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Build context data string from generation context
   */
  private buildContextData(context: GenerationContext, previousPhases: string, editFeedback?: string): string {
    const contextParts: string[] = [];

    contextParts.push(`## Generation Context`);
    contextParts.push(`Phase: ${PHASE_NAMES[context.phase]}`);
    contextParts.push(`Workspace: ${context.workspace}`);
    contextParts.push(`Timestamp: ${context.timestamp}`);
    contextParts.push('');

    if (previousPhases) {
      contextParts.push(`## Previous Phases Content`);
      contextParts.push(previousPhases);
      contextParts.push('');
    }

    if (editFeedback) {
      contextParts.push(`## Edit Feedback`);
      contextParts.push(`The following feedback was provided for improvement:`);
      contextParts.push(editFeedback);
      contextParts.push('');
    }

    return contextParts.join('\n');
  }

  /**
   * Build previous phases context string
   */
  private buildPreviousPhasesContext(previousPhases: Record<Phase, string>): string {
    const phases = Object.entries(previousPhases)
      .filter(([_, content]) => content && content.trim().length > 0)
      .map(([phase, content]) => {
        const phaseName = PHASE_NAMES[Number(phase) as Phase];
        return `### ${phaseName}\n${content}\n`;
      });

    return phases.join('\n');
  }

  /**
   * Combine all prompt components into final system prompt
   */
  private combineSystemPrompt(promptData: SystemPromptData, editFeedback?: string): string {
    const promptParts: string[] = [];

    // Add template content as primary instruction
    promptParts.push(promptData.templateContent);
    promptParts.push('');

    // Add user stories
    promptParts.push(`## User Stories`);
    promptParts.push(promptData.userStories);
    promptParts.push('');

    // Add context data
    promptParts.push(promptData.contextData);

    // Add edit feedback instruction if provided
    if (editFeedback) {
      promptParts.push(`## IMPORTANT: Edit Feedback`);
      promptParts.push(`You are regenerating this document based on user feedback. Make sure to address the feedback while maintaining the overall structure and requirements.`);
      promptParts.push('');
    }

    // Add final instructions
    promptParts.push(`## Final Instructions`);
    promptParts.push(`- Generate a comprehensive ${promptData.phaseName} document`);
    promptParts.push(`- Follow the template structure and requirements`);
    promptParts.push(`- Use the user stories as the primary source of requirements`);
    
    if (promptData.previousPhases) {
      promptParts.push(`- Build upon the content from previous phases`);
    }
    
    if (editFeedback) {
      promptParts.push(`- Address the edit feedback provided above`);
    }

    return promptParts.join('\n');
  }

  /**
   * Check if prerequisite phases are completed
   */
  private checkPhasePrerequisites(phase: Phase, previousPhases: Record<Phase, string>): Phase[] {
    const missing: Phase[] = [];

    switch (phase) {
      case Phase.ROADMAP:
        if (!previousPhases[Phase.README] || previousPhases[Phase.README].trim().length === 0) {
          missing.push(Phase.README);
        }
        break;
      case Phase.SYSTEM_ARCHITECTURE:
        if (!previousPhases[Phase.README] || previousPhases[Phase.README].trim().length === 0) {
          missing.push(Phase.README);
        }
        if (!previousPhases[Phase.ROADMAP] || previousPhases[Phase.ROADMAP].trim().length === 0) {
          missing.push(Phase.ROADMAP);
        }
        break;
      case Phase.README:
        // README has no prerequisites
        break;
    }

    return missing;
  }

  /**
   * Determine next action based on phase and workflow
   */
  private determineNextAction(phase: Phase): 'approve' | 'edit' | 'complete' {
    // Always require approval after generation
    // Client will determine if workflow continues or completes
    return 'approve';
  }

  /**
   * Get template manager instance
   */
  getTemplateManager(): TemplateManager {
    return this.templateManager;
  }

  /**
   * Get document writer instance
   */
  getDocumentWriter(): DocumentWriter {
    return this.documentWriter;
  }

  /**
   * Check if phase can be regenerated (has existing content)
   */
  async canRegeneratePhase(phase: Phase): Promise<boolean> {
    return this.documentWriter.documentExists(phase);
  }

  /**
   * Get existing content for a phase (for regeneration context)
   */
  async getExistingContent(phase: Phase): Promise<string | null> {
    return await this.documentWriter.readExistingDocument(phase);
  }

  /**
   * Fetch user stories from URL or local file
   * @param userStoryUri - URI to fetch user stories from
   * @returns User stories content as string
   */
  async fetchUserStories(userStoryUri: string): Promise<string> {
    try {
      if (userStoryUri.startsWith('http://') || userStoryUri.startsWith('https://')) {
        // Fetch from URL
        return await this.fetchUserStoriesFromUrl(userStoryUri);
      } else {
        // Fetch from local file
        return await this.fetchUserStoriesFromFile(userStoryUri);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch user stories from ${userStoryUri}: ${errorMessage}`);
    }
  }

  /**
   * Fetch user stories from URL
   */
  private async fetchUserStoriesFromUrl(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const content = await response.text();
      if (!content || content.trim().length === 0) {
        throw new Error('URL returned empty content');
      }
      
      return content;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch from URL');
    }
  }

  /**
   * Fetch user stories from local file
   */
  private async fetchUserStoriesFromFile(filePath: string): Promise<string> {
    try {
      // Handle relative paths
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
      }
      
      const content = await fs.promises.readFile(absolutePath, 'utf-8');
      if (!content || content.trim().length === 0) {
        throw new Error('File is empty');
      }
      
      return content;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to read file');
    }
  }

  /**
   * Resolve user stories from multiple sources with fallbacks
   * @param userStory - Inline user story content
   * @param userStoryUri - URI to user story file/URL
   * @returns Resolved user stories content
   */
  async resolveUserStories(userStory?: string, userStoryUri?: string): Promise<string> {
    // Priority 1: Inline user story parameter
    if (userStory && userStory.trim().length > 0) {
      return userStory;
    }
    
    // Priority 2: URI reference
    if (userStoryUri && userStoryUri.trim().length > 0) {
      try {
        return await this.fetchUserStories(userStoryUri);
      } catch (error) {
        console.warn(`Failed to fetch user stories from URI ${userStoryUri}:`, error);
        // Continue to fallback
      }
    }
    
    // Priority 3: Local USER-STORIES.md file fallback
    const localFilePath = path.resolve(process.cwd(), 'USER-STORIES.md');
    if (fs.existsSync(localFilePath)) {
      try {
        return await this.fetchUserStoriesFromFile(localFilePath);
      } catch (error) {
        console.warn(`Failed to read local USER-STORIES.md file:`, error);
      }
    }
    
    throw new Error('No user stories provided. Please provide userStory parameter, userStoryUri, or create USER-STORIES.md file.');
  }

  /**
   * Validate generated content quality
   * @param content - Generated content to validate
   * @param phase - Phase for validation context
   * @param qualityMetrics - Quality metrics to check against
   * @returns Validation result with quality score
   */
  async validateContentQuality(content: string, phase: Phase, qualityMetrics: any): Promise<{
    isValid: boolean;
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check minimum word count
    const wordCount = content.split(/\s+/).length;
    if (wordCount < qualityMetrics.minWordCount) {
      issues.push(`Content too short: ${wordCount} words, minimum ${qualityMetrics.minWordCount}`);
      suggestions.push('Add more detailed explanations and examples');
      score -= 20;
    }

    // Check required sections
    for (const section of qualityMetrics.requiredSections) {
      if (!content.toLowerCase().includes(section.toLowerCase())) {
        issues.push(`Missing required section: ${section}`);
        suggestions.push(`Add ${section} section with relevant content`);
        score -= 15;
      }
    }

    // Check validation rules
    for (const rule of qualityMetrics.validationRules) {
      if (!this.checkValidationRule(content, rule)) {
        issues.push(`Validation rule failed: ${rule}`);
        suggestions.push(`Ensure content meets requirement: ${rule}`);
        score -= 10;
      }
    }

    return {
      isValid: score >= 70, // 70% minimum quality score
      score: Math.max(0, score),
      issues,
      suggestions
    };
  }

  /**
   * Extract template metadata for enhanced prompt generation
   */
  private extractTemplateMetadata(templateContent: string): {
    sectionCount: number;
    requirementCount: number;
  } {
    const sections = (templateContent.match(/^#{1,6}\s/gm) || []).length;
    const requirements = (templateContent.match(/must|should|requirement|mandatory/gi) || []).length;
    
    return {
      sectionCount: sections,
      requirementCount: requirements
    };
  }

  /**
   * Extract template guidance for generation
   */
  private extractTemplateGuidance(templateContent: string): {
    structure: string[];
    requirements: string[];
    examples: string[];
  } {
    const lines = templateContent.split('\n');
    const structure: string[] = [];
    const requirements: string[] = [];
    const examples: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        structure.push(trimmed);
      } else if (trimmed.toLowerCase().includes('must') || trimmed.toLowerCase().includes('should')) {
        requirements.push(trimmed);
      } else if (trimmed.toLowerCase().includes('example') || trimmed.startsWith('```')) {
        examples.push(trimmed);
      }
    }

    return { structure, requirements, examples };
  }

  /**
   * Define quality metrics based on phase
   */
  private defineQualityMetrics(phase: Phase): {
    minWordCount: number;
    requiredSections: string[];
    validationRules: string[];
  } {
    const baseMetrics = {
      minWordCount: 500,
      requiredSections: [],
      validationRules: ['Contains structured content', 'Has clear headings']
    };

    switch (phase) {
      case Phase.README:
        return {
          ...baseMetrics,
          minWordCount: 400,
          requiredSections: ['Overview', 'Features', 'Getting Started'],
          validationRules: [...baseMetrics.validationRules, 'Has project title', 'Contains installation instructions']
        };
      case Phase.ROADMAP:
        return {
          ...baseMetrics,
          minWordCount: 600,
          requiredSections: ['Development Strategy', 'Milestones', 'Timeline'],
          validationRules: [...baseMetrics.validationRules, 'Has development phases', 'Contains timeline information']
        };
      case Phase.SYSTEM_ARCHITECTURE:
        return {
          ...baseMetrics,
          minWordCount: 800,
          requiredSections: ['System Components', 'Technology Stack', 'Data Flow'],
          validationRules: [...baseMetrics.validationRules, 'Has architecture diagrams or descriptions', 'Contains technical details']
        };
      default:
        return baseMetrics;
    }
  }

  /**
   * Parse edit feedback for structured improvements
   */
  private parseEditFeedback(editFeedback: string): {
    requirements: string[];
    validationRules: string[];
  } {
    const requirements: string[] = [];
    const validationRules: string[] = [];
    
    const lines = editFeedback.split('\n');
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.includes('add') || trimmed.includes('include')) {
        requirements.push(line.trim());
      } else if (trimmed.includes('ensure') || trimmed.includes('make sure')) {
        validationRules.push(line.trim());
      }
    }
    
    return { requirements, validationRules };
  }

  /**
   * Check validation rule against content
   */
  private checkValidationRule(content: string, rule: string): boolean {
    const contentLower = content.toLowerCase();
    const ruleLower = rule.toLowerCase();
    
    if (ruleLower.includes('structured content')) {
      return (content.match(/^#{1,6}\s/gm) || []).length >= 3;
    }
    if (ruleLower.includes('clear headings')) {
      return (content.match(/^#{1,3}\s/gm) || []).length >= 2;
    }
    if (ruleLower.includes('project title')) {
      return /^#\s/.test(content);
    }
    if (ruleLower.includes('installation instructions')) {
      return contentLower.includes('install') || contentLower.includes('setup');
    }
    if (ruleLower.includes('development phases')) {
      return contentLower.includes('phase') || contentLower.includes('milestone');
    }
    if (ruleLower.includes('timeline')) {
      return contentLower.includes('week') || contentLower.includes('month') || contentLower.includes('timeline');
    }
    
    return true; // Default to true for unknown rules
  }
}

// Export singleton instance for convenience
export const documentGenerator = new DocumentGenerator();