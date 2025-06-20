/**
 * Document Generation Interface - Track C
 * 
 * Handles document generation without direct LLM integration.
 * Client manages all LLM communication.
 */

// Type definitions that should be provided by Track A
export interface GenerationContext {
  phase: Phase;
  templateContent: string;
  userStories: string;
  previousPhases: Record<Phase, string>;
  projectName?: string;
  description?: string;
}

export interface GenerationResult {
  content: string;
  phase: Phase;
  success: boolean;
  error?: string;
}

export enum Phase {
  README = 1,
  ROADMAP = 2,
  SYSTEM_ARCHITECTURE = 3
}

export interface EditFeedback {
  approved: boolean;
  feedback?: string;
  suggestions?: string[];
}

/**
 * DocumentGenerator class - Handles document generation interface
 * NO OpenAI API integration - client manages all LLM communication
 */
export class DocumentGenerator {
  
  /**
   * Build system prompt with template content and context
   */
  buildSystemPrompt(context: GenerationContext): string {
    const { phase, templateContent, userStories, previousPhases, projectName, description } = context;
    
    let systemPrompt = `You are a technical documentation expert. Your task is to generate high-quality ${this.getPhaseDisplayName(phase)} documentation.

TEMPLATE INSTRUCTIONS:
${templateContent}

PROJECT CONTEXT:`;

    if (projectName) {
      systemPrompt += `\nProject Name: ${projectName}`;
    }
    
    if (description) {
      systemPrompt += `\nProject Description: ${description}`;
    }

    systemPrompt += `\nUser Stories:\n${userStories}`;

    // Add previous phase context if available
    const previousPhaseEntries = Object.entries(previousPhases);
    if (previousPhaseEntries.length > 0) {
      systemPrompt += `\n\nPREVIOUS PHASE OUTPUTS:`;
      previousPhaseEntries.forEach(([phaseNum, content]) => {
        const phaseDisplayName = this.getPhaseDisplayName(parseInt(phaseNum) as Phase);
        systemPrompt += `\n\n=== ${phaseDisplayName.toUpperCase()} ===\n${content}`;
      });
    }

    systemPrompt += `\n\nIMPORTANT:
- Follow the template instructions exactly
- Use the user stories as the primary requirements source
- Build upon previous phase outputs when applicable
- Generate professional, comprehensive documentation
- Ensure consistency with previous phases`;

    return systemPrompt;
  }

  /**
   * Prepare generation request for client
   * Returns the system prompt and user prompt for the client to send to LLM
   */
  prepareGenerationRequest(context: GenerationContext): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = `Generate the ${this.getPhaseDisplayName(context.phase)} documentation following the template instructions and using the provided context.`;

    return {
      systemPrompt,
      userPrompt
    };
  }

  /**
   * Process LLM response from client
   */
  processGenerationResponse(
    response: string, 
    phase: Phase,
    context: GenerationContext
  ): GenerationResult {
    if (!response || response.trim().length === 0) {
      return {
        content: '',
        phase,
        success: false,
        error: 'Empty response from LLM'
      };
    }

    // Basic validation
    if (response.length < 100) {
      return {
        content: response,
        phase,
        success: false,
        error: 'Response too short - likely incomplete generation'
      };
    }

    return {
      content: response.trim(),
      phase,
      success: true
    };
  }

  /**
   * Build regeneration prompt incorporating edit feedback
   */
  buildRegenerationPrompt(
    originalContext: GenerationContext,
    feedback: EditFeedback,
    previousAttempt: string
  ): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const baseSystemPrompt = this.buildSystemPrompt(originalContext);
    
    const systemPrompt = `${baseSystemPrompt}

REGENERATION CONTEXT:
You are regenerating this document based on user feedback.

PREVIOUS ATTEMPT:
${previousAttempt}

USER FEEDBACK:
${feedback.feedback || 'No specific feedback provided'}`;

    if (feedback.suggestions && feedback.suggestions.length > 0) {
      systemPrompt += `\n\nSPECIFIC SUGGESTIONS:\n${feedback.suggestions.map(s => `- ${s}`).join('\n')}`;
    }

    const userPrompt = `Please regenerate the ${this.getPhaseDisplayName(originalContext.phase)} documentation incorporating the user feedback above. Improve the content while maintaining the template structure and requirements.`;

    return {
      systemPrompt,
      userPrompt
    };
  }

  /**
   * Validate generation context
   */
  validateContext(context: GenerationContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!context.templateContent || context.templateContent.trim().length === 0) {
      errors.push('Template content is required');
    }

    if (!context.userStories || context.userStories.trim().length === 0) {
      errors.push('User stories are required');
    }

    if (!Object.values(Phase).includes(context.phase)) {
      errors.push('Invalid phase specified');
    }

    // Check phase dependencies
    if (context.phase === Phase.SYSTEM_ARCHITECTURE && !context.previousPhases[Phase.ROADMAP]) {
      errors.push('SYSTEM_ARCHITECTURE phase requires ROADMAP phase to be completed first');
    }

    if (context.phase === Phase.ROADMAP && !context.previousPhases[Phase.README]) {
      errors.push('ROADMAP phase requires README phase to be completed first');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get human-readable phase name
   */
  private getPhaseDisplayName(phase: Phase): string {
    switch (phase) {
      case Phase.README:
        return 'README';
      case Phase.ROADMAP:
        return 'ROADMAP';
      case Phase.SYSTEM_ARCHITECTURE:
        return 'SYSTEM ARCHITECTURE';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Extract metadata from generated content (for validation)
   */
  extractMetadata(content: string, phase: Phase): {
    hasTitle: boolean;
    hasStructure: boolean;
    wordCount: number;
    estimatedSections: number;
  } {
    const lines = content.split('\n');
    const hasTitle = lines.some(line => line.startsWith('# '));
    const hasStructure = lines.filter(line => line.match(/^#{1,6}\s/)).length >= 2;
    const wordCount = content.split(/\s+/).length;
    const estimatedSections = lines.filter(line => line.match(/^#{1,3}\s/)).length;

    return {
      hasTitle,
      hasStructure,
      wordCount,
      estimatedSections
    };
  }
}