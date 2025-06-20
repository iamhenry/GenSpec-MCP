import { ValidationManager } from './validation.js';
import { Logger } from './logging.js';
import { Phase, PhaseNumber, TEMPLATE_MAPPINGS } from '../types.js';

export interface PromptResponse {
  description: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
}

/**
 * GenSpec MCP Prompt Handlers
 * Handles /generate command with phase-specific variations
 */
export class GenSpecPrompts {
  private validator: ValidationManager;
  private logger: Logger;

  constructor(workingDirectory?: string) {
    this.validator = new ValidationManager(workingDirectory);
    this.logger = Logger.create(workingDirectory);
  }

  /**
   * Handles the main /generate prompt with optional phase parameter
   */
  async handleGeneratePrompt(args?: { phase?: string }): Promise<PromptResponse> {
    const phase = args?.phase?.toLowerCase();
    
    this.logger.logMessage(`PROMPT:generate PHASE:${phase || 'all'} STATUS:start`);
    
    try {
      // Validate environment first
      const envValidation = await this.validator.validateEnvironment();
      if (!envValidation.isValid) {
        return this.createErrorPrompt('Environment validation failed', envValidation.errors);
      }

      // Handle phase-specific generation
      switch (phase) {
        case 'readme':
          return await this.generateReadmePrompt();
        case 'roadmap':
          return await this.generateRoadmapPrompt();
        case 'architecture':
        case 'system-architecture':
          return await this.generateArchitecturePrompt();
        case undefined:
        case null:
        case '':
        case 'all':
          return await this.generateFullWorkflowPrompt();
        default:
          return this.createErrorPrompt('Invalid phase', [`Unknown phase: ${phase}. Valid phases are: readme, roadmap, architecture, or omit for full workflow.`]);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.logMessage(`PROMPT:generate ERROR:${errorMsg}`);
      return this.createErrorPrompt('Prompt execution error', [errorMsg]);
    }
  }

  /**
   * Generates README-specific prompt
   */
  private async generateReadmePrompt(): Promise<PromptResponse> {
    // Validate USER-STORIES.md exists
    const userStoriesValidation = await this.validator.validateUserStories();
    if (!userStoriesValidation.isValid) {
      return this.createErrorPrompt('README generation requires USER-STORIES.md', userStoriesValidation.errors);
    }

    return {
      description: 'Generate README.md from USER-STORIES.md and continue through full workflow',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: this.buildGeneratePromptText('README', [
              'This will generate README.md from your USER-STORIES.md file',
              'After README generation and approval, it will continue to generate ROADMAP.md',
              'After ROADMAP approval, it will generate SYSTEM-ARCHITECTURE.md',
              'Each phase requires your approval before proceeding to the next'
            ])
          }
        }
      ]
    };
  }

  /**
   * Generates ROADMAP-specific prompt
   */
  private async generateRoadmapPrompt(): Promise<PromptResponse> {
    // Validate README.md exists (prerequisite for ROADMAP)
    const prereqValidation = await this.validator.validatePhasePrerequisites(2);
    if (!prereqValidation.isValid) {
      return this.createErrorPrompt('ROADMAP generation requires existing README.md', prereqValidation.errors);
    }

    return {
      description: 'Generate ROADMAP.md from existing README.md and continue to SYSTEM-ARCHITECTURE',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: this.buildGeneratePromptText('ROADMAP', [
              'This will generate ROADMAP.md using your existing README.md as context',
              'After ROADMAP generation and approval, it will continue to generate SYSTEM-ARCHITECTURE.md',
              'Your README.md will be used to inform the roadmap planning'
            ])
          }
        }
      ]
    };
  }

  /**
   * Generates SYSTEM-ARCHITECTURE-specific prompt
   */
  private async generateArchitecturePrompt(): Promise<PromptResponse> {
    // Validate both README.md and ROADMAP.md exist
    const prereqValidation = await this.validator.validatePhasePrerequisites(3);
    if (!prereqValidation.isValid) {
      return this.createErrorPrompt('SYSTEM-ARCHITECTURE generation requires existing README.md and ROADMAP.md', prereqValidation.errors);
    }

    return {
      description: 'Generate SYSTEM-ARCHITECTURE.md from existing README.md and ROADMAP.md',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: this.buildGeneratePromptText('SYSTEM-ARCHITECTURE', [
              'This will generate SYSTEM-ARCHITECTURE.md using your existing README.md and ROADMAP.md as context',
              'This is the final phase of the GenSpec workflow',
              'Your README and ROADMAP will inform the system architecture design'
            ])
          }
        }
      ]
    };
  }

  /**
   * Generates full workflow prompt
   */
  private async generateFullWorkflowPrompt(): Promise<PromptResponse> {
    // Validate USER-STORIES.md exists
    const userStoriesValidation = await this.validator.validateUserStories();
    if (!userStoriesValidation.isValid) {
      return this.createErrorPrompt('Full workflow requires USER-STORIES.md', userStoriesValidation.errors);
    }

    return {
      description: 'Execute complete GenSpec workflow: README → ROADMAP → SYSTEM-ARCHITECTURE',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: this.buildGeneratePromptText('Full Workflow', [
              'This will execute the complete GenSpec workflow:',
              '1. Generate README.md from USER-STORIES.md',
              '2. After your approval, generate ROADMAP.md from README.md',
              '3. After your approval, generate SYSTEM-ARCHITECTURE.md from README.md + ROADMAP.md',
              '',
              'Each phase requires your explicit approval before proceeding.',
              'You can provide feedback at any stage to regenerate that phase.'
            ])
          }
        }
      ]
    };
  }

  /**
   * Builds the prompt text for a specific generation type
   */
  private buildGeneratePromptText(type: string, details: string[]): string {
    let promptText = `🚀 GenSpec ${type} Generation\n\n`;
    
    promptText += `${details.join('\n')}\n\n`;
    
    promptText += `📋 To execute this workflow:\n`;
    promptText += `• Use the appropriate tool: start_genspec, generate_readme, generate_roadmap, or generate_architecture\n`;
    promptText += `• Each phase will present generated content for your review\n`;
    promptText += `• Respond with "approve" to continue, or provide specific feedback for regeneration\n\n`;
    
    promptText += `📁 Output Location: _ai/docs/\n`;
    promptText += `🔍 Prerequisites: All validation checks passed\n\n`;
    
    promptText += `Ready to begin ${type.toLowerCase()} generation?`;
    
    return promptText;
  }

  /**
   * Creates an error prompt response
   */
  private createErrorPrompt(title: string, errors: string[]): PromptResponse {
    return {
      description: `Error: ${title}`,
      messages: [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: `❌ ${title}\n\n${errors.map(e => `• ${e}`).join('\n')}\n\nPlease fix these issues before using the /generate command.`
          }
        }
      ]
    };
  }

  /**
   * Gets available prompt commands
   */
  getAvailablePrompts() {
    return [
      {
        name: 'generate',
        description: 'Generate documentation artifacts from USER-STORIES.md',
        arguments: [
          {
            name: 'phase',
            description: 'Specific phase to generate (readme, roadmap, architecture) or omit for full workflow',
            required: false
          }
        ]
      }
    ];
  }

  /**
   * Integration function for Track A to use in server.ts
   * This replaces the placeholder prompt handlers in GenSpecServer
   */
  static createServerIntegration(workingDirectory?: string) {
    const prompts = new GenSpecPrompts(workingDirectory);
    
    return {
      getAvailablePrompts: () => prompts.getAvailablePrompts(),
      handleGeneratePrompt: (args?: { phase?: string }) => prompts.handleGeneratePrompt(args)
    };
  }
}