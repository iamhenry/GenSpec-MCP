/**
 * MCP Tools Implementation for GenSpec MCP Server
 * 
 * Implements the 4 continuation workflow tools:
 * - start_genspec: Start full workflow (README→ROADMAP→ARCHITECTURE)
 * - generate_readme: Generate README (README→ROADMAP→ARCHITECTURE)
 * - generate_roadmap: Generate roadmap (ROADMAP→ARCHITECTURE)
 * - generate_architecture: Generate architecture (ARCHITECTURE only)
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  Phase,
  PHASE_NAMES,
  WORKFLOW_DEPENDENCIES,
  ToolContext,
  WorkflowState,
  GenerationResult,
  ToolOutputSchema,
  GenSpecError,
} from '../types.js';
import { ValidationManager } from './validation.js';
import { logger } from './logging.js';

export class ToolManager {
  private validationManager: ValidationManager;
  private workflowStates: Map<string, WorkflowState> = new Map();
  private workspace: string;
  private docsDir: string;

  constructor(workspace: string = process.cwd()) {
    this.workspace = workspace;
    this.docsDir = join(workspace, '_ai', 'docs');
    this.validationManager = new ValidationManager(workspace);
  }

  /**
   * Execute start_genspec tool - Start full workflow
   */
  async executeStartGenspec(args: { userStory?: string; userStoryUri?: string }): Promise<ToolOutputSchema> {
    console.log('[ToolManager] Executing start_genspec tool...');
    console.log(`[ToolManager] Arguments: ${JSON.stringify(args)}`);

    const toolName = 'start_genspec';
    const context: ToolContext = {
      workspace: this.workspace,
      userStory: args.userStory,
      userStoryUri: args.userStoryUri,
      currentPhase: Phase.README,
      isWorkflowActive: false,
    };

    try {
      // Check if workflow is already active
      if (this.isWorkflowActive(this.workspace)) {
        throw new Error('ERR_WORKFLOW_IN_PROGRESS: Another workflow is currently in progress');
      }

      // Validate user stories
      const userStoryValidation = await this.validationManager.validateUserStories(
        args.userStory,
        args.userStoryUri
      );
      if (!userStoryValidation.isValid) {
        throw new Error(userStoryValidation.error);
      }

      // Validate environment
      const envValidation = this.validationManager.validateEnvironment();
      if (!envValidation.isValid) {
        throw new Error(envValidation.error);
      }

      // Create docs directory if it doesn't exist
      this.ensureDocsDirectory();

      // Set workflow as active
      this.setWorkflowActive(this.workspace, true, Phase.README);

      // Log workflow start
      this.logWorkflowStart(toolName, Phase.README);

      const draftPath = join(this.docsDir, 'README.md');
      
      return {
        phase: PHASE_NAMES[Phase.README],
        nextAction: 'approve',
        draftPath,
      };
    } catch (error) {
      console.error(`[ToolManager] Error executing ${toolName}: ${error}`);
      this.setWorkflowActive(this.workspace, false);
      throw error;
    }
  }

  /**
   * Execute generate_readme tool - Generate README then continue
   */
  async executeGenerateReadme(): Promise<ToolOutputSchema> {
    console.log('[ToolManager] Executing generate_readme tool...');

    const toolName = 'generate_readme';
    
    try {
      // Check if workflow is already active
      if (this.isWorkflowActive(this.workspace)) {
        throw new Error('ERR_WORKFLOW_IN_PROGRESS: Another workflow is currently in progress');
      }

      // Validate environment
      const envValidation = this.validationManager.validateEnvironment();
      if (!envValidation.isValid) {
        throw new Error(envValidation.error);
      }

      // Create docs directory if it doesn't exist
      this.ensureDocsDirectory();

      // Set workflow as active
      this.setWorkflowActive(this.workspace, true, Phase.README);

      // Log workflow start
      this.logWorkflowStart(toolName, Phase.README);

      const draftPath = join(this.docsDir, 'README.md');
      
      return {
        phase: PHASE_NAMES[Phase.README],
        nextAction: 'approve',
        draftPath,
      };
    } catch (error) {
      console.error(`[ToolManager] Error executing ${toolName}: ${error}`);
      this.setWorkflowActive(this.workspace, false);
      throw error;
    }
  }

  /**
   * Execute generate_roadmap tool - Generate roadmap then continue
   */
  async executeGenerateRoadmap(): Promise<ToolOutputSchema> {
    console.log('[ToolManager] Executing generate_roadmap tool...');

    const toolName = 'generate_roadmap';
    
    try {
      // Check if workflow is already active
      if (this.isWorkflowActive(this.workspace)) {
        throw new Error('ERR_WORKFLOW_IN_PROGRESS: Another workflow is currently in progress');
      }

      // Validate dependency matrix
      const depValidation = this.validationManager.validateDependencyMatrix(toolName);
      if (!depValidation.isValid) {
        throw new Error(depValidation.error);
      }

      // Validate environment
      const envValidation = this.validationManager.validateEnvironment();
      if (!envValidation.isValid) {
        throw new Error(envValidation.error);
      }

      // Create docs directory if it doesn't exist
      this.ensureDocsDirectory();

      // Set workflow as active
      this.setWorkflowActive(this.workspace, true, Phase.ROADMAP);

      // Log workflow start
      this.logWorkflowStart(toolName, Phase.ROADMAP);

      const draftPath = join(this.docsDir, 'ROADMAP.md');
      
      return {
        phase: PHASE_NAMES[Phase.ROADMAP],
        nextAction: 'approve',
        draftPath,
      };
    } catch (error) {
      console.error(`[ToolManager] Error executing ${toolName}: ${error}`);
      this.setWorkflowActive(this.workspace, false);
      throw error;
    }
  }

  /**
   * Execute generate_architecture tool - Generate architecture only
   */
  async executeGenerateArchitecture(): Promise<ToolOutputSchema> {
    console.log('[ToolManager] Executing generate_architecture tool...');

    const toolName = 'generate_architecture';
    
    try {
      // Check if workflow is already active
      if (this.isWorkflowActive(this.workspace)) {
        throw new Error('ERR_WORKFLOW_IN_PROGRESS: Another workflow is currently in progress');
      }

      // Validate dependency matrix
      const depValidation = this.validationManager.validateDependencyMatrix(toolName);
      if (!depValidation.isValid) {
        throw new Error(depValidation.error);
      }

      // Validate environment
      const envValidation = this.validationManager.validateEnvironment();
      if (!envValidation.isValid) {
        throw new Error(envValidation.error);
      }

      // Create docs directory if it doesn't exist
      this.ensureDocsDirectory();

      // Set workflow as active
      this.setWorkflowActive(this.workspace, true, Phase.SYSTEM_ARCHITECTURE);

      // Log workflow start
      this.logWorkflowStart(toolName, Phase.SYSTEM_ARCHITECTURE);

      const draftPath = join(this.docsDir, 'SYSTEM-ARCHITECTURE.md');
      
      return {
        phase: PHASE_NAMES[Phase.SYSTEM_ARCHITECTURE],
        nextAction: 'approve',
        draftPath,
      };
    } catch (error) {
      console.error(`[ToolManager] Error executing ${toolName}: ${error}`);
      this.setWorkflowActive(this.workspace, false);
      throw error;
    }
  }

  /**
   * Handle continuation workflow - move to next phase
   */
  async handleContinuation(currentPhase: Phase, toolName: string): Promise<ToolOutputSchema> {
    console.log(`[ToolManager] Handling continuation from phase: ${PHASE_NAMES[currentPhase]}`);

    const dependency = WORKFLOW_DEPENDENCIES[toolName];
    if (!dependency) {
      throw new Error(`ERR_VALIDATION_FAILED: Unknown tool: ${toolName}`);
    }

    const { executes } = dependency;
    const currentIndex = executes.indexOf(currentPhase);
    
    if (currentIndex === -1) {
      throw new Error(`ERR_VALIDATION_FAILED: Phase ${currentPhase} not in execution list for ${toolName}`);
    }

    // Check if there's a next phase
    if (currentIndex + 1 >= executes.length) {
      // Workflow complete
      console.log('[ToolManager] Workflow completed');
      this.setWorkflowActive(this.workspace, false);
      this.logWorkflowComplete(toolName);
      
      return {
        phase: 'COMPLETE',
        nextAction: 'complete',
        draftPath: this.docsDir,
      };
    }

    // Move to next phase
    const nextPhase = executes[currentIndex + 1];
    console.log(`[ToolManager] Moving to next phase: ${PHASE_NAMES[nextPhase]}`);
    
    this.updateWorkflowPhase(this.workspace, nextPhase);
    this.logPhaseTransition(currentPhase, nextPhase);

    const nextDraftPath = join(this.docsDir, this.getPhaseOutputFile(nextPhase));
    
    return {
      phase: PHASE_NAMES[nextPhase],
      nextAction: 'approve',
      draftPath: nextDraftPath,
    };
  }

  /**
   * Check if workflow is active for workspace
   */
  private isWorkflowActive(workspace: string): boolean {
    const state = this.workflowStates.get(workspace);
    return state?.isActive || false;
  }

  /**
   * Set workflow active state
   */
  private setWorkflowActive(workspace: string, isActive: boolean, currentPhase?: Phase): void {
    if (isActive && currentPhase) {
      this.workflowStates.set(workspace, {
        isActive: true,
        currentPhase,
        completedPhases: [],
        workspace,
        startTime: new Date().toISOString(),
      });
    } else {
      this.workflowStates.delete(workspace);
    }
  }

  /**
   * Update workflow phase
   */
  private updateWorkflowPhase(workspace: string, newPhase: Phase): void {
    const state = this.workflowStates.get(workspace);
    if (state) {
      if (state.currentPhase) {
        state.completedPhases.push(state.currentPhase);
      }
      state.currentPhase = newPhase;
      this.workflowStates.set(workspace, state);
    }
  }

  /**
   * Ensure docs directory exists
   */
  private ensureDocsDirectory(): void {
    if (!existsSync(this.docsDir)) {
      console.log(`[ToolManager] Creating docs directory: ${this.docsDir}`);
      mkdirSync(this.docsDir, { recursive: true });
    }
  }

  /**
   * Get output file for phase
   */
  private getPhaseOutputFile(phase: Phase): string {
    const mapping = {
      [Phase.README]: 'README.md',
      [Phase.ROADMAP]: 'ROADMAP.md',
      [Phase.SYSTEM_ARCHITECTURE]: 'SYSTEM-ARCHITECTURE.md',
    };
    return mapping[phase];
  }

  /**
   * Log workflow start
   */
  private logWorkflowStart(toolName: string, phase: Phase): void {
    logger.logWorkflowStart(toolName, phase);
  }

  /**
   * Log workflow completion
   */
  private logWorkflowComplete(toolName: string): void {
    logger.logInfo(`Workflow completed: ${toolName}`);
  }

  /**
   * Log phase transition
   */
  private logPhaseTransition(fromPhase: Phase, toPhase: Phase): void {
    logger.logPhaseTransition(fromPhase, toPhase);
  }

  /**
   * Get current workflow state
   */
  getWorkflowState(workspace: string): WorkflowState | undefined {
    return this.workflowStates.get(workspace);
  }

  /**
   * Clear workflow state (for testing/debugging)
   */
  clearWorkflowState(workspace: string): void {
    this.workflowStates.delete(workspace);
  }
}