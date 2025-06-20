import { promises as fs } from 'fs';
import { PhaseNumber, TEMPLATE_MAPPINGS } from '../types.js';
import path from 'path';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PrerequisiteCheck {
  phase: PhaseNumber;
  requiredFiles: string[];
  description: string;
}

/**
 * ValidationManager handles all input validation for the GenSpec workflow
 * Including USER-STORIES.md validation, phase prerequisites, environment validation,
 * and dependency matrix validation for continuation workflows
 */
export class ValidationManager {
  private cwd: string;

  constructor(workingDirectory?: string) {
    this.cwd = workingDirectory || process.cwd();
  }

  /**
   * Validates USER-STORIES.md file existence, readability, and content
   */
  async validateUserStories(): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const userStoriesPath = path.join(this.cwd, 'USER-STORIES.md');

    try {
      // Check if file exists
      const stats = await fs.stat(userStoriesPath);
      if (!stats.isFile()) {
        result.isValid = false;
        result.errors.push('USER-STORIES.md exists but is not a file');
        return result;
      }

      // Check if file is readable
      await fs.access(userStoriesPath, fs.constants.R_OK);

      // Read and validate content
      const content = await fs.readFile(userStoriesPath, 'utf-8');
      
      if (content.trim().length === 0) {
        result.isValid = false;
        result.errors.push('USER-STORIES.md is empty');
        return result;
      }

      if (content.length < 50) {
        result.warnings.push('USER-STORIES.md is very short (less than 50 characters)');
      }

      // Basic content validation - should contain some structure
      if (!content.includes('#') && !content.includes('*') && !content.includes('-')) {
        result.warnings.push('USER-STORIES.md appears to lack structure (no headers or bullet points)');
      }

    } catch (error) {
      result.isValid = false;
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        result.errors.push('USER-STORIES.md file not found');
      } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        result.errors.push('USER-STORIES.md file is not readable (permission denied)');
      } else {
        result.errors.push(`Error reading USER-STORIES.md: ${(error as Error).message}`);
      }
    }

    return result;
  }

  /**
   * Validates phase prerequisites for continuation workflows
   */
  async validatePhasePrerequisites(targetPhase: PhaseNumber): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const prerequisites = this.getPhasePrerequisites(targetPhase);
    
    for (const prereq of prerequisites.requiredFiles) {
      const filePath = path.join(this.cwd, '_ai/docs', prereq);
      
      try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
          result.isValid = false;
          result.errors.push(`Required prerequisite ${prereq} exists but is not a file`);
          continue;
        }

        const content = await fs.readFile(filePath, 'utf-8');
        if (content.trim().length === 0) {
          result.isValid = false;
          result.errors.push(`Required prerequisite ${prereq} is empty`);
        }

      } catch (error) {
        result.isValid = false;
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          result.errors.push(`Required prerequisite ${prereq} not found`);
        } else {
          result.errors.push(`Error reading prerequisite ${prereq}: ${(error as Error).message}`);
        }
      }
    }

    return result;
  }

  /**
   * Validates environment (templates directory, permissions, output directory)
   */
  async validateEnvironment(): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check templates directory
    const templatesDir = path.join(this.cwd, 'templates');
    try {
      const stats = await fs.stat(templatesDir);
      if (!stats.isDirectory()) {
        result.isValid = false;
        result.errors.push('templates directory exists but is not a directory');
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push('templates directory not found');
    }

    // Check template files exist
    for (const phaseNum of [1, 2, 3] as PhaseNumber[]) {
      const config = TEMPLATE_MAPPINGS[phaseNum];
      const templatePath = path.join(this.cwd, config.templateFile);
      
      try {
        const stats = await fs.stat(templatePath);
        if (!stats.isFile()) {
          result.isValid = false;
          result.errors.push(`Template file ${config.templateFile} exists but is not a file`);
        }
      } catch (error) {
        result.isValid = false;
        result.errors.push(`Template file ${config.templateFile} not found`);
      }
    }

    // Check output directory permissions
    const outputDir = path.join(this.cwd, '_ai/docs');
    try {
      // Try to create output directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true });
      
      // Check write permissions
      await fs.access(outputDir, fs.constants.W_OK);
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Cannot write to output directory _ai/docs: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Validates dependency matrix for continuation workflow dependencies
   */
  validateDependencyMatrix(): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Define the dependency matrix as per PRD
    const dependencyMatrix = {
      start_genspec: {
        prerequisites: ['USER-STORIES.md'],
        executes: ['README', 'ROADMAP', 'ARCHITECTURE']
      },
      generate_readme: {
        prerequisites: ['USER-STORIES.md'],
        executes: ['README', 'ROADMAP', 'ARCHITECTURE']
      },
      generate_roadmap: {
        prerequisites: ['README.md'],
        executes: ['ROADMAP', 'ARCHITECTURE']
      },
      generate_architecture: {
        prerequisites: ['README.md', 'ROADMAP.md'],
        executes: ['ARCHITECTURE']
      }
    };

    // Validate that all phases are properly mapped
    const expectedPhases = ['README', 'ROADMAP', 'ARCHITECTURE'];
    const mappedPhases = Object.keys(TEMPLATE_MAPPINGS).map(k => {
      const num = parseInt(k) as PhaseNumber;
      return TEMPLATE_MAPPINGS[num].outputFile.replace('.md', '');
    });

    for (const phase of expectedPhases) {
      if (!mappedPhases.includes(phase)) {
        result.isValid = false;
        result.errors.push(`Phase ${phase} not properly mapped in TEMPLATE_MAPPINGS`);
      }
    }

    return result;
  }

  /**
   * Gets phase prerequisites based on the dependency matrix
   */
  private getPhasePrerequisites(phase: PhaseNumber): PrerequisiteCheck {
    switch (phase) {
      case 1: // README
        return {
          phase: 1,
          requiredFiles: [], // Only needs USER-STORIES.md which is checked separately
          description: 'README generation requires USER-STORIES.md'
        };
      case 2: // ROADMAP
        return {
          phase: 2,
          requiredFiles: ['README.md'],
          description: 'ROADMAP generation requires README.md'
        };
      case 3: // SYSTEM-ARCHITECTURE
        return {
          phase: 3,
          requiredFiles: ['README.md', 'ROADMAP.md'],
          description: 'SYSTEM-ARCHITECTURE generation requires README.md and ROADMAP.md'
        };
      default:
        return {
          phase,
          requiredFiles: [],
          description: 'Unknown phase'
        };
    }
  }

  /**
   * Runs comprehensive validation for a specific tool
   */
  async validateForTool(toolName: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Always validate environment first
    const envResult = await this.validateEnvironment();
    result.errors.push(...envResult.errors);
    result.warnings.push(...envResult.warnings);
    if (!envResult.isValid) result.isValid = false;

    // Validate dependency matrix
    const depResult = this.validateDependencyMatrix();
    result.errors.push(...depResult.errors);
    result.warnings.push(...depResult.warnings);
    if (!depResult.isValid) result.isValid = false;

    // Tool-specific validation
    switch (toolName) {
      case 'start_genspec':
      case 'generate_readme':
        // These tools need USER-STORIES.md
        const userStoriesResult = await this.validateUserStories();
        result.errors.push(...userStoriesResult.errors);
        result.warnings.push(...userStoriesResult.warnings);
        if (!userStoriesResult.isValid) result.isValid = false;
        break;

      case 'generate_roadmap':
        // Needs README.md
        const roadmapPrereqs = await this.validatePhasePrerequisites(2);
        result.errors.push(...roadmapPrereqs.errors);
        result.warnings.push(...roadmapPrereqs.warnings);
        if (!roadmapPrereqs.isValid) result.isValid = false;
        break;

      case 'generate_architecture':
        // Needs README.md and ROADMAP.md
        const archPrereqs = await this.validatePhasePrerequisites(3);
        result.errors.push(...archPrereqs.errors);
        result.warnings.push(...archPrereqs.warnings);
        if (!archPrereqs.isValid) result.isValid = false;
        break;

      default:
        result.isValid = false;
        result.errors.push(`Unknown tool: ${toolName}`);
    }

    return result;
  }
}