/**
 * Input Validation System for GenSpec MCP Server
 * 
 * Handles validation of user stories, prerequisites, and environment checks
 * Priority order for user stories: userStory inline → userStoryUri → local USER-STORIES.md
 */

import { readFileSync, existsSync, accessSync, constants } from 'fs';
import { resolve, join } from 'path';
import {
  Phase,
  ValidationResult,
  GenSpecError,
  WORKFLOW_DEPENDENCIES,
  PHASE_OUTPUT_FILES,
  PHASE_TEMPLATE_FILES,
} from '../types.js';
import { logger } from './logging.js';

export class ValidationManager {
  private workspace: string;
  private templatesDir: string;
  private docsDir: string;

  constructor(workspace: string = process.cwd()) {
    this.workspace = workspace;
    this.templatesDir = join(workspace, 'templates');
    this.docsDir = join(workspace, '_ai', 'docs');
  }

  /**
   * Validate user story source in priority order:
   * 1. userStory inline text argument
   * 2. userStoryUri argument (client responsibility to fetch)
   * 3. Fallback to local USER-STORIES.md
   */
  async validateUserStories(userStory?: string, userStoryUri?: string): Promise<ValidationResult> {
    logger.logInfo('Validating user stories...');

    // Priority 1: Check inline userStory
    if (userStory && userStory.trim()) {
      console.log('[ValidationManager] Using inline userStory argument');
      if (userStory.length < 10) {
        return {
          isValid: false,
          error: 'ERR_VALIDATION_FAILED: userStory content too short (minimum 10 characters)',
        };
      }
      return { isValid: true };
    }

    // Priority 2: Check userStoryUri (client handles fetching)
    if (userStoryUri) {
      console.log('[ValidationManager] Using userStoryUri argument (client must fetch)');
      try {
        new URL(userStoryUri); // Validate URI format
        return { isValid: true };
      } catch {
        return {
          isValid: false,
          error: 'ERR_VALIDATION_FAILED: Invalid userStoryUri format',
        };
      }
    }

    // Priority 3: Fallback to local USER-STORIES.md
    const userStoriesPath = join(this.workspace, 'USER-STORIES.md');
    console.log(`[ValidationManager] Checking local USER-STORIES.md at: ${userStoriesPath}`);

    if (!existsSync(userStoriesPath)) {
      return {
        isValid: false,
        error: 'ERR_MISSING_USER_STORIES: No user stories found. Provide userStory inline, userStoryUri, or create USER-STORIES.md',
      };
    }

    try {
      accessSync(userStoriesPath, constants.R_OK);
      const content = readFileSync(userStoriesPath, 'utf-8');
      
      if (!content.trim()) {
        return {
          isValid: false,
          error: 'ERR_VALIDATION_FAILED: USER-STORIES.md is empty',
        };
      }

      if (content.length < 10) {
        return {
          isValid: false,
          error: 'ERR_VALIDATION_FAILED: USER-STORIES.md content too short (minimum 10 characters)',
        };
      }

      console.log('[ValidationManager] Local USER-STORIES.md validated successfully');
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `ERR_VALIDATION_FAILED: Cannot read USER-STORIES.md: ${error}`,
      };
    }
  }

  /**
   * Validate phase prerequisites for continuation workflows
   */
  validatePhasePrerequisites(toolName: string, completedPhases: Phase[]): ValidationResult {
    console.log(`[ValidationManager] Validating prerequisites for tool: ${toolName}`);
    
    const dependency = WORKFLOW_DEPENDENCIES[toolName];
    if (!dependency) {
      return {
        isValid: false,
        error: `ERR_VALIDATION_FAILED: Unknown tool: ${toolName}`,
      };
    }

    const { prerequisites } = dependency;
    const missingPrerequisites = prerequisites.filter(phase => !completedPhases.includes(phase));

    if (missingPrerequisites.length > 0) {
      console.log(`[ValidationManager] Missing prerequisites: ${missingPrerequisites.join(', ')}`);
      return {
        isValid: false,
        error: 'ERR_MISSING_PREREQUISITES',
        missingPrerequisites,
      };
    }

    console.log('[ValidationManager] All prerequisites satisfied');
    return { isValid: true };
  }

  /**
   * Validate environment setup (templates, permissions)
   */
  validateEnvironment(): ValidationResult {
    console.log('[ValidationManager] Validating environment...');

    // Check templates directory exists
    if (!existsSync(this.templatesDir)) {
      return {
        isValid: false,
        error: `ERR_VALIDATION_FAILED: Templates directory not found: ${this.templatesDir}`,
      };
    }

    // Check all required template files exist
    const missingTemplates: string[] = [];
    for (const [phase, templateFile] of Object.entries(PHASE_TEMPLATE_FILES)) {
      const templatePath = join(this.templatesDir, templateFile);
      if (!existsSync(templatePath)) {
        missingTemplates.push(templateFile);
      }
    }

    if (missingTemplates.length > 0) {
      return {
        isValid: false,
        error: `ERR_TEMPLATE_NOT_FOUND: Missing template files: ${missingTemplates.join(', ')}`,
      };
    }

    // Check template files are readable
    for (const [phase, templateFile] of Object.entries(PHASE_TEMPLATE_FILES)) {
      const templatePath = join(this.templatesDir, templateFile);
      try {
        accessSync(templatePath, constants.R_OK);
      } catch {
        return {
          isValid: false,
          error: `ERR_VALIDATION_FAILED: Cannot read template file: ${templateFile}`,
        };
      }
    }

    // Check workspace is writable
    try {
      accessSync(this.workspace, constants.W_OK);
    } catch {
      return {
        isValid: false,
        error: `ERR_VALIDATION_FAILED: Workspace not writable: ${this.workspace}`,
      };
    }

    console.log('[ValidationManager] Environment validation successful');
    return { isValid: true };
  }

  /**
   * Get completed phases by checking for output files in _ai/docs/
   */
  getCompletedPhases(): Phase[] {
    console.log('[ValidationManager] Checking completed phases...');
    
    if (!existsSync(this.docsDir)) {
      console.log('[ValidationManager] Docs directory does not exist, no phases completed');
      return [];
    }

    const completedPhases: Phase[] = [];
    
    for (const [phase, outputFile] of Object.entries(PHASE_OUTPUT_FILES)) {
      const outputPath = join(this.docsDir, outputFile);
      if (existsSync(outputPath)) {
        try {
          const content = readFileSync(outputPath, 'utf-8');
          if (content.trim()) {
            completedPhases.push(parseInt(phase) as Phase);
            console.log(`[ValidationManager] Found completed phase: ${phase} (${outputFile})`);
          }
        } catch (error) {
          console.log(`[ValidationManager] Error reading ${outputFile}: ${error}`);
        }
      }
    }

    console.log(`[ValidationManager] Completed phases: ${completedPhases.join(', ')}`);
    return completedPhases;
  }

  /**
   * Validate dependency matrix for continuation workflow
   */
  validateDependencyMatrix(toolName: string): ValidationResult {
    console.log(`[ValidationManager] Validating dependency matrix for: ${toolName}`);
    
    const dependency = WORKFLOW_DEPENDENCIES[toolName];
    if (!dependency) {
      return {
        isValid: false,
        error: `ERR_VALIDATION_FAILED: Tool ${toolName} not found in dependency matrix`,
      };
    }

    const completedPhases = this.getCompletedPhases();
    const validationResult = this.validatePhasePrerequisites(toolName, completedPhases);
    
    if (!validationResult.isValid) {
      console.log(`[ValidationManager] Dependency validation failed: ${validationResult.error}`);
      return validationResult;
    }

    console.log('[ValidationManager] Dependency matrix validation successful');
    return { isValid: true };
  }

  /**
   * Get user story content from the highest priority source
   */
  async getUserStoryContent(userStory?: string, userStoryUri?: string): Promise<string> {
    console.log('[ValidationManager] Getting user story content...');

    // Priority 1: Use inline userStory
    if (userStory && userStory.trim()) {
      console.log('[ValidationManager] Using inline userStory');
      return userStory.trim();
    }

    // Priority 2: userStoryUri (client responsibility - return placeholder)
    if (userStoryUri) {
      console.log('[ValidationManager] userStoryUri provided - client must fetch content');
      return `[CLIENT_FETCH_REQUIRED] ${userStoryUri}`;
    }

    // Priority 3: Local USER-STORIES.md
    const userStoriesPath = join(this.workspace, 'USER-STORIES.md');
    if (existsSync(userStoriesPath)) {
      try {
        const content = readFileSync(userStoriesPath, 'utf-8');
        console.log('[ValidationManager] Using local USER-STORIES.md');
        return content.trim();
      } catch (error) {
        console.log(`[ValidationManager] Error reading USER-STORIES.md: ${error}`);
        throw new Error('ERR_VALIDATION_FAILED: Cannot read USER-STORIES.md');
      }
    }

    throw new Error('ERR_MISSING_USER_STORIES: No user stories available');
  }
}