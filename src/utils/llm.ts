/**
 * Document Generation Interface for GenSpec MCP Server
 * Handles system prompt building and generation interface (client manages all LLM calls)
 */

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
}

export interface GenerationRequest {
  systemPrompt: string;
  context: GenerationContext;
  editFeedback?: string;
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

      const systemPromptData: SystemPromptData = {
        templateContent: templateData.content,
        contextData,
        userStories: context.userStories,
        previousPhases: previousPhasesText,
        phase: context.phase,
        phaseName: PHASE_NAMES[context.phase]
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

    return {
      systemPrompt,
      context,
      editFeedback
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

    // Create new generation request with edit feedback
    return await this.createGenerationRequest(context, editFeedback);
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
}

// Export singleton instance for convenience
export const documentGenerator = new DocumentGenerator();