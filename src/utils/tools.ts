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
import { PhaseManager } from './phases.js';

export class ToolManager {
  private validationManager: ValidationManager;
  private phaseManager: PhaseManager;
  private workflowStates: Map<string, WorkflowState> = new Map();
  private workspace: string;
  private docsDir: string;

  constructor(workspace: string = process.cwd()) {
    this.workspace = workspace;
    this.docsDir = join(workspace, '_ai', 'docs');
    this.validationManager = new ValidationManager(workspace);
    this.phaseManager = new PhaseManager();
  }

  /**
   * Execute start_genspec tool - Start full workflow
   */
  async executeStartGenspec(args: { userStory?: string; userStoryUri?: string }): Promise<ToolOutputSchema> {
    console.log('[ToolManager] === START_GENSPEC EXECUTION BEGIN ===');
    console.log('[ToolManager] Executing start_genspec tool...');
    console.log(`[ToolManager] Arguments: ${JSON.stringify(args)}`);
    console.log(`[ToolManager] Workspace: ${this.workspace}`);
    console.log(`[ToolManager] Docs directory: ${this.docsDir}`);

    const toolName = 'start_genspec';
    const context: ToolContext = {
      workspace: this.workspace,
      userStory: args.userStory,
      userStoryUri: args.userStoryUri,
      currentPhase: Phase.README,
      isWorkflowActive: false,
    };

    console.log(`[ToolManager] Created tool context: ${JSON.stringify(context)}`);

    try {
      console.log('[ToolManager] Starting validation checks...');

      // Validate user stories
      console.log('[ToolManager] Validating user stories...');
      const userStoryValidation = await this.validationManager.validateUserStories(
        args.userStory,
        args.userStoryUri
      );
      console.log(`[ToolManager] User story validation result: ${JSON.stringify(userStoryValidation)}`);
      if (!userStoryValidation.isValid) {
        console.log(`[ToolManager] ERROR: User story validation failed: ${userStoryValidation.errors.join(', ')}`);
        throw new Error(userStoryValidation.errors.join(', '));
      }

      // Validate environment
      console.log('[ToolManager] Validating environment...');
      const envValidation = await this.validationManager.validateEnvironment();
      console.log(`[ToolManager] Environment validation result: ${JSON.stringify(envValidation)}`);
      if (!envValidation.isValid) {
        console.log(`[ToolManager] ERROR: Environment validation failed: ${envValidation.errors.join(', ')}`);
        throw new Error(envValidation.errors.join(', '));
      }

      // Create docs directory if it doesn't exist
      console.log('[ToolManager] Ensuring docs directory exists...');
      this.ensureDocsDirectory();
      console.log('[ToolManager] Docs directory ready');

      // Workflow state management removed - tools are now stateless

      // Log workflow start
      console.log('[ToolManager] Logging workflow start...');
      this.logWorkflowStart(toolName, Phase.README);

      // Get user story content
      console.log('[ToolManager] Getting user story content...');
      const userStoryContent = await this.validationManager.getUserStoryContent(
        args.userStory,
        args.userStoryUri
      );
      console.log('[ToolManager] User story content retrieved');

      // Execute README phase
      console.log('[ToolManager] Executing README phase...');
      const phaseResult = await this.phaseManager.executePhase(Phase.README, {
        userStories: userStoryContent,
        workspace: this.workspace
      });

      if (!phaseResult.success) {
        console.log(`[ToolManager] Phase execution failed: ${phaseResult.error}`);
        throw new Error(phaseResult.error || 'Phase execution failed');
      }

      const draftPath = join(this.docsDir, 'README.md');
      console.log(`[ToolManager] Draft path: ${draftPath}`);
      
      const result = {
        phase: PHASE_NAMES[Phase.README],
        nextAction: 'approve',
        draftPath,
      };
      console.log(`[ToolManager] Returning result: ${JSON.stringify(result)}`);
      console.log('[ToolManager] === START_GENSPEC EXECUTION SUCCESS ===');
      
      return result;
    } catch (error) {
      console.error(`[ToolManager] === START_GENSPEC EXECUTION FAILED ===`);
      console.error(`[ToolManager] Error executing ${toolName}:`, error);
      console.error(`[ToolManager] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      if (error instanceof Error) {
        console.error(`[ToolManager] Error message: ${error.message}`);
        console.error(`[ToolManager] Error stack: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * Execute generate_readme tool - Generate README then continue
   */
  async executeGenerateReadme(): Promise<ToolOutputSchema> {
    console.log('[ToolManager] === GENERATE_README EXECUTION BEGIN ===');
    console.log('[ToolManager] Executing generate_readme tool...');
    console.log(`[ToolManager] Workspace: ${this.workspace}`);

    const toolName = 'generate_readme';
    
    try {
      console.log('[ToolManager] Starting validation checks...');

      // Validate environment
      const envValidation = await this.validationManager.validateEnvironment();
      if (!envValidation.isValid) {
        throw new Error(envValidation.errors.join(', '));
      }

      // Create docs directory if it doesn't exist
      this.ensureDocsDirectory();

      // Log workflow start
      this.logWorkflowStart(toolName, Phase.README);

      // Get user story content from local USER-STORIES.md (generate_readme doesn't take args)
      console.log('[ToolManager] Getting user story content from local sources...');
      const userStoryContent = await this.validationManager.getUserStoryContent();
      console.log('[ToolManager] User story content retrieved');

      // Execute README phase
      console.log('[ToolManager] Executing README phase...');
      const phaseResult = await this.phaseManager.executePhase(Phase.README, {
        userStories: userStoryContent,
        workspace: this.workspace
      });

      if (!phaseResult.success) {
        console.log(`[ToolManager] Phase execution failed: ${phaseResult.error}`);
        throw new Error(phaseResult.error || 'Phase execution failed');
      }

      const draftPath = join(this.docsDir, 'README.md');
      console.log(`[ToolManager] Draft path: ${draftPath}`);
      
      const result = {
        phase: PHASE_NAMES[Phase.README],
        nextAction: 'approve',
        draftPath,
      };
      console.log(`[ToolManager] Returning result: ${JSON.stringify(result)}`);
      console.log('[ToolManager] === GENERATE_README EXECUTION SUCCESS ===');
      
      return result;
    } catch (error) {
      console.error(`[ToolManager] Error executing ${toolName}: ${error}`);
      throw error;
    }
  }

  /**
   * Execute generate_roadmap tool - Generate roadmap then continue
   */
  async executeGenerateRoadmap(): Promise<ToolOutputSchema> {
    console.log('[ToolManager] === GENERATE_ROADMAP EXECUTION BEGIN ===');
    console.log('[ToolManager] Executing generate_roadmap tool...');
    console.log(`[ToolManager] Workspace: ${this.workspace}`);

    const toolName = 'generate_roadmap';
    
    try {
      console.log('[ToolManager] Starting validation checks...');

      // Validate dependency matrix
      const depValidation = await this.validationManager.validateDependencyMatrix(toolName);
      if (!depValidation.isValid) {
        console.log(`[ToolManager] Dependency validation failed: ${depValidation.errors.join(', ')}`);
        throw new Error(depValidation.errors.join(', '));
      }

      // Validate environment
      const envValidation = await this.validationManager.validateEnvironment();
      if (!envValidation.isValid) {
        throw new Error(envValidation.errors.join(', '));
      }

      // Create docs directory if it doesn't exist
      this.ensureDocsDirectory();

      // Log workflow start
      this.logWorkflowStart(toolName, Phase.ROADMAP);

      // Get user story content from local USER-STORIES.md
      console.log('[ToolManager] Getting user story content from local sources...');
      const userStoryContent = await this.validationManager.getUserStoryContent();
      console.log('[ToolManager] User story content retrieved');

      // Execute ROADMAP phase
      console.log('[ToolManager] Executing ROADMAP phase...');
      const phaseResult = await this.phaseManager.executePhase(Phase.ROADMAP, {
        userStories: userStoryContent,
        workspace: this.workspace
      });

      if (!phaseResult.success) {
        console.log(`[ToolManager] Phase execution failed: ${phaseResult.error}`);
        throw new Error(phaseResult.error || 'Phase execution failed');
      }

      const draftPath = join(this.docsDir, 'ROADMAP.md');
      console.log(`[ToolManager] Draft path: ${draftPath}`);
      
      const result = {
        phase: PHASE_NAMES[Phase.ROADMAP],
        nextAction: 'approve',
        draftPath,
      };
      console.log(`[ToolManager] Returning result: ${JSON.stringify(result)}`);
      console.log('[ToolManager] === GENERATE_ROADMAP EXECUTION SUCCESS ===');
      
      return result;
    } catch (error) {
      console.error(`[ToolManager] Error executing ${toolName}: ${error}`);
      throw error;
    }
  }

  /**
   * Execute generate_architecture tool - Generate architecture only
   */
  async executeGenerateArchitecture(): Promise<ToolOutputSchema> {
    console.log('[ToolManager] === GENERATE_ARCHITECTURE EXECUTION BEGIN ===');
    console.log('[ToolManager] Executing generate_architecture tool...');
    console.log(`[ToolManager] Workspace: ${this.workspace}`);

    const toolName = 'generate_architecture';
    
    try {
      console.log('[ToolManager] Starting validation checks...');

      // Validate dependency matrix
      const depValidation = await this.validationManager.validateDependencyMatrix(toolName);
      if (!depValidation.isValid) {
        console.log(`[ToolManager] Dependency validation failed: ${depValidation.errors.join(', ')}`);
        throw new Error(depValidation.errors.join(', '));
      }

      // Validate environment
      const envValidation = await this.validationManager.validateEnvironment();
      if (!envValidation.isValid) {
        throw new Error(envValidation.errors.join(', '));
      }

      // Create docs directory if it doesn't exist
      this.ensureDocsDirectory();

      // Log workflow start
      this.logWorkflowStart(toolName, Phase.SYSTEM_ARCHITECTURE);

      // Get user story content from local USER-STORIES.md
      console.log('[ToolManager] Getting user story content from local sources...');
      const userStoryContent = await this.validationManager.getUserStoryContent();
      console.log('[ToolManager] User story content retrieved');

      // Execute SYSTEM_ARCHITECTURE phase
      console.log('[ToolManager] Executing SYSTEM_ARCHITECTURE phase...');
      const phaseResult = await this.phaseManager.executePhase(Phase.SYSTEM_ARCHITECTURE, {
        userStories: userStoryContent,
        workspace: this.workspace
      });

      if (!phaseResult.success) {
        console.log(`[ToolManager] Phase execution failed: ${phaseResult.error}`);
        throw new Error(phaseResult.error || 'Phase execution failed');
      }

      const draftPath = join(this.docsDir, 'SYSTEM-ARCHITECTURE.md');
      console.log(`[ToolManager] Draft path: ${draftPath}`);
      
      const result = {
        phase: PHASE_NAMES[Phase.SYSTEM_ARCHITECTURE],
        nextAction: 'approve',
        draftPath,
      };
      console.log(`[ToolManager] Returning result: ${JSON.stringify(result)}`);
      console.log('[ToolManager] === GENERATE_ARCHITECTURE EXECUTION SUCCESS ===');
      
      return result;
    } catch (error) {
      console.error(`[ToolManager] Error executing ${toolName}: ${error}`);
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
   * DISABLED: Tools are now stateless
   */
  private isWorkflowActive(workspace: string): boolean {
    return false; // Always return false - tools are stateless
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