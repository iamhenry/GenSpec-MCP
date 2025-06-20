/**
 * Phase Management System - Track C
 * 
 * Handles phase execution pipeline with prerequisite checking
 * and coordinates between template loading, generation, and file writing.
 */

import { DocumentGenerator, GenerationContext, GenerationResult, Phase, EditFeedback } from './llm.js';

// Interfaces that should be provided by Track A
export interface TemplateData {
  phase: Phase;
  content: string;
  filename: string;
}

export interface PhaseExecutionResult {
  success: boolean;
  phase: Phase;
  generatedContent?: string;
  outputPath?: string;
  error?: string;
  requiresApproval?: boolean;
  generationRequest?: {
    systemPrompt: string;
    userPrompt: string;
  };
}

export interface PhaseContext {
  userStories: string;
  projectName?: string;
  description?: string;
  previousPhases: Record<Phase, string>;
  outputDirectory: string;
}

// Mock interfaces for Track B dependencies (to be replaced when Track B is complete)
interface TemplateManager {
  loadTemplate(phase: Phase): Promise<TemplateData>;
  validateTemplate(phase: Phase): boolean;
}

interface DocumentWriter {
  writeDocument(content: string, phase: Phase, outputDir: string): Promise<string>;
  ensureOutputDirectory(outputDir: string): Promise<void>;
}

/**
 * PhaseManager class - Manages phase execution pipeline
 */
export class PhaseManager {
  private documentGenerator: DocumentGenerator;
  private templateManager?: TemplateManager;
  private documentWriter?: DocumentWriter;

  constructor() {
    this.documentGenerator = new DocumentGenerator();
  }

  /**
   * Set dependencies from Track B
   */
  setDependencies(templateManager: TemplateManager, documentWriter: DocumentWriter) {
    this.templateManager = templateManager;
    this.documentWriter = documentWriter;
  }

  /**
   * Execute a single phase with prerequisite checking
   */
  async executePhase(
    phase: Phase,
    context: PhaseContext,
    skipPrerequisites: boolean = false
  ): Promise<PhaseExecutionResult> {
    try {
      // Check prerequisites
      if (!skipPrerequisites) {
        const prereqCheck = this.checkPrerequisites(phase, context);
        if (!prereqCheck.satisfied) {
          return {
            success: false,
            phase,
            error: `Prerequisites not met: ${prereqCheck.missing.join(', ')}`
          };
        }
      }

      // Validate dependencies
      if (!this.templateManager || !this.documentWriter) {
        return {
          success: false,
          phase,
          error: 'Template manager and document writer dependencies not set'
        };
      }

      // Load template
      const templateData = await this.templateManager.loadTemplate(phase);
      if (!templateData) {
        return {
          success: false,
          phase,
          error: `Failed to load template for phase ${phase}`
        };
      }

      // Build generation context
      const generationContext = this.buildGenerationContext(phase, context, templateData);

      // Validate context
      const validation = this.documentGenerator.validateContext(generationContext);
      if (!validation.valid) {
        return {
          success: false,
          phase,
          error: `Invalid generation context: ${validation.errors.join(', ')}`
        };
      }

      // Prepare generation request for client
      const generationRequest = this.documentGenerator.prepareGenerationRequest(generationContext);

      // Return with generation request - client will handle LLM call
      return {
        success: true,
        phase,
        requiresApproval: true,
        generationRequest
      };

    } catch (error) {
      return {
        success: false,
        phase,
        error: `Phase execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Process LLM response and complete phase execution
   */
  async completePhaseExecution(
    phase: Phase,
    llmResponse: string,
    context: PhaseContext
  ): Promise<PhaseExecutionResult> {
    try {
      if (!this.documentWriter) {
        return {
          success: false,
          phase,
          error: 'Document writer dependency not set'
        };
      }

      // Load template for context
      const templateData = await this.templateManager!.loadTemplate(phase);
      const generationContext = this.buildGenerationContext(phase, context, templateData);

      // Process LLM response
      const generationResult = this.documentGenerator.processGenerationResponse(
        llmResponse,
        phase,
        generationContext
      );

      if (!generationResult.success) {
        return {
          success: false,
          phase,
          error: generationResult.error
        };
      }

      // Write document
      const outputPath = await this.documentWriter.writeDocument(
        generationResult.content,
        phase,
        context.outputDirectory
      );

      return {
        success: true,
        phase,
        generatedContent: generationResult.content,
        outputPath
      };

    } catch (error) {
      return {
        success: false,
        phase,
        error: `Phase completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle regeneration with edit feedback
   */
  async regeneratePhase(
    phase: Phase,
    context: PhaseContext,
    feedback: EditFeedback,
    previousAttempt: string
  ): Promise<PhaseExecutionResult> {
    try {
      if (!this.templateManager) {
        return {
          success: false,
          phase,
          error: 'Template manager dependency not set'
        };
      }

      // Load template
      const templateData = await this.templateManager.loadTemplate(phase);
      const generationContext = this.buildGenerationContext(phase, context, templateData);

      // Build regeneration prompt
      const regenerationRequest = this.documentGenerator.buildRegenerationPrompt(
        generationContext,
        feedback,
        previousAttempt
      );

      return {
        success: true,
        phase,
        requiresApproval: true,
        generationRequest: regenerationRequest
      };

    } catch (error) {
      return {
        success: false,
        phase,
        error: `Regeneration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Execute full workflow pipeline
   */
  async executeWorkflow(context: PhaseContext): Promise<PhaseExecutionResult[]> {
    const results: PhaseExecutionResult[] = [];
    const phases = [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE];

    for (const phase of phases) {
      const result = await this.executePhase(phase, context);
      results.push(result);

      // Stop on failure
      if (!result.success) {
        break;
      }

      // If requires approval, stop and wait for client to handle
      if (result.requiresApproval) {
        break;
      }

      // Update context with completed phase
      if (result.generatedContent) {
        context.previousPhases[phase] = result.generatedContent;
      }
    }

    return results;
  }

  /**
   * Check phase prerequisites
   */
  checkPrerequisites(phase: Phase, context: PhaseContext): {
    satisfied: boolean;
    missing: string[];
  } {
    const missing: string[] = [];

    // Check user stories
    if (!context.userStories || context.userStories.trim().length === 0) {
      missing.push('USER-STORIES.md');
    }

    // Check phase dependencies
    switch (phase) {
      case Phase.ROADMAP:
        if (!context.previousPhases[Phase.README]) {
          missing.push('README phase must be completed first');
        }
        break;
      case Phase.SYSTEM_ARCHITECTURE:
        if (!context.previousPhases[Phase.ROADMAP]) {
          missing.push('ROADMAP phase must be completed first');
        }
        break;
    }

    return {
      satisfied: missing.length === 0,
      missing
    };
  }

  /**
   * Get next phase in sequence
   */
  getNextPhase(currentPhase: Phase): Phase | null {
    switch (currentPhase) {
      case Phase.README:
        return Phase.ROADMAP;
      case Phase.ROADMAP:
        return Phase.SYSTEM_ARCHITECTURE;
      case Phase.SYSTEM_ARCHITECTURE:
        return null;
      default:
        return null;
    }
  }

  /**
   * Get available phases based on context
   */
  getAvailablePhases(context: PhaseContext): Phase[] {
    const available: Phase[] = [];

    // README is always available if user stories exist
    if (context.userStories && context.userStories.trim().length > 0) {
      available.push(Phase.README);
    }

    // ROADMAP available if README is completed
    if (context.previousPhases[Phase.README]) {
      available.push(Phase.ROADMAP);
    }

    // SYSTEM_ARCHITECTURE available if ROADMAP is completed
    if (context.previousPhases[Phase.ROADMAP]) {
      available.push(Phase.SYSTEM_ARCHITECTURE);
    }

    return available;
  }

  /**
   * Validate phase execution environment
   */
  async validateEnvironment(context: PhaseContext): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Check if dependencies are set
      if (!this.templateManager || !this.documentWriter) {
        errors.push('Template manager and document writer dependencies not set');
      }

      // Check if templates are available
      if (this.templateManager) {
        for (const phase of [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE]) {
          if (!this.templateManager.validateTemplate(phase)) {
            errors.push(`Template for phase ${phase} is not available`);
          }
        }
      }

      // Check output directory
      if (this.documentWriter) {
        try {
          await this.documentWriter.ensureOutputDirectory(context.outputDirectory);
        } catch (error) {
          errors.push(`Cannot access output directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      errors.push(`Environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Build generation context from phase context and template
   */
  private buildGenerationContext(
    phase: Phase,
    context: PhaseContext,
    templateData: TemplateData
  ): GenerationContext {
    return {
      phase,
      templateContent: templateData.content,
      userStories: context.userStories,
      previousPhases: context.previousPhases,
      projectName: context.projectName,
      description: context.description
    };
  }

  /**
   * Get phase display name
   */
  getPhaseDisplayName(phase: Phase): string {
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
   * Get phase output filename
   */
  getPhaseOutputFilename(phase: Phase): string {
    switch (phase) {
      case Phase.README:
        return 'README.md';
      case Phase.ROADMAP:
        return 'ROADMAP.md';
      case Phase.SYSTEM_ARCHITECTURE:
        return 'SYSTEM-ARCHITECTURE.md';
      default:
        return 'UNKNOWN.md';
    }
  }
}