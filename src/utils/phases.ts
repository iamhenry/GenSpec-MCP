/**
 * Phase Management System for GenSpec MCP Server
 * Handles phase execution pipeline with prerequisite checking and context building
 */

import { 
  Phase, 
  GenerationContext, 
  GenerationResult, 
  ValidationResult,
  WorkflowState,
  PHASE_NAMES,
  WORKFLOW_DEPENDENCIES,
  GenSpecError 
} from '../types.js';
import { DocumentGenerator } from './llm.js';
import { DocumentWriter } from './fileWriter.js';
import { TemplateManager } from './templates.js';

export interface PhaseExecutionOptions {
  userStories: string;
  workspace: string;
  editFeedback?: string;
  maxEditCycles?: number;
}

export interface PhaseExecutionResult {
  success: boolean;
  result?: GenerationResult;
  error?: string;
  editCycleCount?: number;
}

export interface WorkflowExecutionPlan {
  phases: Phase[];
  startPhase: Phase;
  totalPhases: number;
  dependencies: Record<Phase, Phase[]>;
}

export class PhaseManager {
  private documentGenerator: DocumentGenerator;
  private documentWriter: DocumentWriter;
  private templateManager: TemplateManager;
  private workflowState: WorkflowState | null = null;
  private readonly maxEditCycles: number = 5;

  constructor(
    documentGenerator?: DocumentGenerator,
    documentWriter?: DocumentWriter,
    templateManager?: TemplateManager
  ) {
    this.documentGenerator = documentGenerator || new DocumentGenerator();
    this.documentWriter = documentWriter || new DocumentWriter();
    this.templateManager = templateManager || new TemplateManager();
  }

  /**
   * Execute a single phase with prerequisite checking
   * @param phase - Phase to execute
   * @param options - Execution options with user stories and workspace
   * @returns Phase execution result
   */
  async executePhase(phase: Phase, options: PhaseExecutionOptions): Promise<PhaseExecutionResult> {
    try {
      // Validate phase prerequisites
      const validation = await this.validatePhasePrerequisites(phase, options.workspace);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Phase prerequisites not met: ${validation.error}`
        };
      }

      // Build generation context
      const context = await this.buildGenerationContext(phase, options);

      // Execute generation with edit cycle handling
      const result = await this.executeWithEditCycles(context, options);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Phase execution failed: ${errorMessage}`
      };
    }
  }

  /**
   * Execute multiple phases in sequence (workflow)
   * @param phases - Array of phases to execute
   * @param options - Execution options
   * @returns Array of execution results
   */
  async executeWorkflow(phases: Phase[], options: PhaseExecutionOptions): Promise<PhaseExecutionResult[]> {
    const results: PhaseExecutionResult[] = [];

    // Initialize workflow state
    this.workflowState = {
      isActive: true,
      currentPhase: phases[0],
      completedPhases: [],
      workspace: options.workspace,
      startTime: new Date().toISOString()
    };

    try {
      for (const phase of phases) {
        this.workflowState.currentPhase = phase;

        console.log(`Starting phase: ${PHASE_NAMES[phase]}`);
        
        const result = await this.executePhase(phase, options);
        results.push(result);

        if (!result.success) {
          console.error(`Phase ${PHASE_NAMES[phase]} failed: ${result.error}`);
          break;
        }

        this.workflowState.completedPhases.push(phase);
        console.log(`Completed phase: ${PHASE_NAMES[phase]}`);
      }
    } finally {
      // Clear workflow state
      this.workflowState = null;
    }

    return results;
  }

  /**
   * Get execution plan for a workflow tool
   * @param toolName - Name of the workflow tool
   * @returns Execution plan with phases and dependencies
   */
  getWorkflowExecutionPlan(toolName: string): WorkflowExecutionPlan | null {
    const workflow = WORKFLOW_DEPENDENCIES[toolName];
    if (!workflow) {
      return null;
    }

    const phases = workflow.executes;
    const dependencies = {} as Record<Phase, Phase[]>;

    // Build dependency map
    phases.forEach(phase => {
      dependencies[phase] = this.getPhasePrerequisites(phase);
    });

    return {
      phases,
      startPhase: phases[0],
      totalPhases: phases.length,
      dependencies
    };
  }

  /**
   * Validate phase prerequisites
   * @param phase - Phase to validate
   * @param workspace - Workspace identifier
   * @returns Validation result
   */
  async validatePhasePrerequisites(phase: Phase, workspace: string): Promise<ValidationResult> {
    try {
      const missingPrerequisites: Phase[] = [];
      const errors: string[] = [];

      // Check prerequisite phases exist
      const prerequisites = this.getPhasePrerequisites(phase);
      
      for (const prereqPhase of prerequisites) {
        const exists = this.documentWriter.documentExists(prereqPhase);
        if (!exists) {
          missingPrerequisites.push(prereqPhase);
        }
      }

      if (missingPrerequisites.length > 0) {
        const missingNames = missingPrerequisites.map(p => PHASE_NAMES[p]).join(', ');
        errors.push(`Missing prerequisite phases: ${missingNames}`);
      }

      // Validate template availability
      try {
        await this.templateManager.loadTemplate(phase);
      } catch (error) {
        errors.push(`Template not available for phase ${PHASE_NAMES[phase]}`);
      }

      // Validate output directory
      const outputValidation = await this.documentWriter.validateOutputDirectory();
      if (!outputValidation.isValid) {
        errors.push(`Output directory validation failed: ${outputValidation.error}`);
      }

      return {
        isValid: errors.length === 0,
        error: errors.length > 0 ? errors.join('; ') : undefined,
        missingPrerequisites: missingPrerequisites.length > 0 ? missingPrerequisites : undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        isValid: false,
        error: `Validation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Build generation context for a phase
   * @param phase - Phase to build context for
   * @param options - Execution options
   * @returns Complete generation context
   */
  async buildGenerationContext(phase: Phase, options: PhaseExecutionOptions): Promise<GenerationContext> {
    // Get content from previous phases
    const previousPhases = {} as Record<Phase, string>;
    const prerequisites = this.getPhasePrerequisites(phase);

    for (const prereqPhase of prerequisites) {
      const content = await this.documentWriter.readExistingDocument(prereqPhase);
      if (content) {
        previousPhases[prereqPhase] = content;
      }
    }

    const context: GenerationContext = {
      userStories: options.userStories,
      phase,
      previousPhases,
      workspace: options.workspace,
      timestamp: new Date().toISOString()
    };

    return context;
  }

  /**
   * Check if workflow is currently active
   * @returns Current workflow state
   */
  getWorkflowState(): WorkflowState | null {
    return this.workflowState;
  }

  /**
   * Check if a specific phase is completed
   * @param phase - Phase to check
   * @returns Boolean indicating completion
   */
  isPhaseCompleted(phase: Phase): boolean {
    return this.documentWriter.documentExists(phase);
  }

  /**
   * Get all completed phases
   * @returns Array of completed phases
   */
  getCompletedPhases(): Phase[] {
    const completed: Phase[] = [];
    const allPhases = [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE];

    for (const phase of allPhases) {
      if (this.isPhaseCompleted(phase)) {
        completed.push(phase);
      }
    }

    return completed;
  }

  /**
   * Get phase execution status
   * @param phase - Phase to check
   * @returns Status information
   */
  async getPhaseStatus(phase: Phase): Promise<{
    phase: Phase;
    name: string;
    completed: boolean;
    hasPrerequisites: boolean;
    prerequisites: Phase[];
    canExecute: boolean;
    filePath?: string;
    lastModified?: Date;
  }> {
    const prerequisites = this.getPhasePrerequisites(phase);
    const completed = this.isPhaseCompleted(phase);
    const hasPrerequisites = prerequisites.length > 0;
    
    // Check if can execute (prerequisites met)
    let canExecute = true;
    for (const prereq of prerequisites) {
      if (!this.isPhaseCompleted(prereq)) {
        canExecute = false;
        break;
      }
    }

    let filePath: string | undefined;
    let lastModified: Date | undefined;

    if (completed) {
      filePath = this.documentWriter.getDocumentPath(phase);
      const stats = await this.documentWriter.getDocumentStats(phase);
      if (stats) {
        lastModified = stats.mtime;
      }
    }

    return {
      phase,
      name: PHASE_NAMES[phase],
      completed,
      hasPrerequisites,
      prerequisites,
      canExecute,
      filePath,
      lastModified
    };
  }

  /**
   * Get overview of all phases
   * @returns Array of phase status information
   */
  async getAllPhasesStatus(): Promise<Array<{
    phase: Phase;
    name: string;
    completed: boolean;
    hasPrerequisites: boolean;
    prerequisites: Phase[];
    canExecute: boolean;
    filePath?: string;
    lastModified?: Date;
  }>> {
    const allPhases = [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE];
    const statuses = [];

    for (const phase of allPhases) {
      const status = await this.getPhaseStatus(phase);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Execute phase with edit cycle handling
   */
  private async executeWithEditCycles(
    context: GenerationContext, 
    options: PhaseExecutionOptions
  ): Promise<PhaseExecutionResult> {
    const maxCycles = options.maxEditCycles || this.maxEditCycles;
    let editCycleCount = 0;
    let currentEditFeedback = options.editFeedback;

    while (editCycleCount < maxCycles) {
      try {
        // Create generation request
        const request = await this.documentGenerator.createGenerationRequest(context, currentEditFeedback);
        
        // NOTE: This is where the client would make the LLM call
        // For now, we return the request for the client to handle
        console.log(`Generation request prepared for phase ${PHASE_NAMES[context.phase]}`);
        console.log(`Edit cycle: ${editCycleCount + 1}/${maxCycles}`);
        
        // Since we can't actually call the LLM, we return a success result
        // The actual implementation would process the LLM response here
        const result: GenerationResult = {
          phase: context.phase,
          content: `[Generated content for ${PHASE_NAMES[context.phase]} - client handles LLM call]`,
          filePath: this.documentWriter.getDocumentPath(context.phase),
          nextAction: 'approve',
          draftPath: this.documentWriter.getDocumentPath(context.phase)
        };

        return {
          success: true,
          result,
          editCycleCount: editCycleCount + 1
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: errorMessage,
          editCycleCount: editCycleCount + 1
        };
      }
    }

    return {
      success: false,
      error: `Maximum edit cycles (${maxCycles}) exceeded`,
      editCycleCount: maxCycles
    };
  }

  /**
   * Get prerequisite phases for a given phase
   */
  private getPhasePrerequisites(phase: Phase): Phase[] {
    switch (phase) {
      case Phase.README:
        return [];
      case Phase.ROADMAP:
        return [Phase.README];
      case Phase.SYSTEM_ARCHITECTURE:
        return [Phase.README, Phase.ROADMAP];
      default:
        return [];
    }
  }

  /**
   * Reset workflow state (for testing or error recovery)
   */
  resetWorkflowState(): void {
    this.workflowState = null;
  }

  /**
   * Get document generator instance
   */
  getDocumentGenerator(): DocumentGenerator {
    return this.documentGenerator;
  }

  /**
   * Get document writer instance
   */
  getDocumentWriter(): DocumentWriter {
    return this.documentWriter;
  }

  /**
   * Get template manager instance
   */
  getTemplateManager(): TemplateManager {
    return this.templateManager;
  }

  /**
   * Delete phase document (for testing or reset)
   * @param phase - Phase to delete
   * @returns Success status
   */
  async deletePhaseDocument(phase: Phase): Promise<boolean> {
    return await this.documentWriter.deleteDocument(phase);
  }

  /**
   * Create backup of phase document
   * @param phase - Phase to backup
   * @returns Backup file path or null
   */
  async backupPhaseDocument(phase: Phase): Promise<string | null> {
    return await this.documentWriter.createBackup(phase);
  }

  /**
   * Validate entire workflow prerequisites
   * @param toolName - Workflow tool name
   * @param workspace - Workspace identifier
   * @returns Validation result for workflow
   */
  async validateWorkflowPrerequisites(toolName: string, workspace: string): Promise<ValidationResult> {
    const workflow = WORKFLOW_DEPENDENCIES[toolName];
    if (!workflow) {
      return {
        isValid: false,
        error: `Unknown workflow tool: ${toolName}`
      };
    }

    const errors: string[] = [];
    const missingPrerequisites: Phase[] = [];

    // Check if workflow can start based on prerequisites
    for (const prereqPhase of workflow.prerequisites) {
      const exists = this.documentWriter.documentExists(prereqPhase);
      if (!exists) {
        missingPrerequisites.push(prereqPhase);
      }
    }

    if (missingPrerequisites.length > 0) {
      const missingNames = missingPrerequisites.map(p => PHASE_NAMES[p]).join(', ');
      errors.push(`Workflow ${toolName} requires completed phases: ${missingNames}`);
    }

    // Check if another workflow is active
    if (this.workflowState && this.workflowState.isActive) {
      errors.push(`Another workflow is currently active in workspace ${this.workflowState.workspace}`);
    }

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      missingPrerequisites: missingPrerequisites.length > 0 ? missingPrerequisites : undefined
    };
  }
}

// Export singleton instance for convenience
export const phaseManager = new PhaseManager();