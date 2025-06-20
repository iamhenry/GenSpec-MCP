import { ValidationManager } from './validation.js';
import { ApprovalManager } from './approval.js';
import { Logger } from './logging.js';
import { PhaseNumber, Phase } from '../types.js';

export interface ToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export interface ToolExecutionContext {
  projectPath: string;
  validator: ValidationManager;
  approvalManager: ApprovalManager;
  logger: Logger;
}

/**
 * GenSpec MCP Tools Implementation
 * Provides the 4 continuation workflow tools with validation and approval logic
 */
export class GenSpecTools {
  private validator: ValidationManager;
  private approvalManager: ApprovalManager;
  private logger: Logger;

  constructor(workingDirectory?: string) {
    this.validator = new ValidationManager(workingDirectory);
    this.approvalManager = new ApprovalManager();
    this.logger = Logger.create(workingDirectory);
  }

  /**
   * start_genspec tool - executes complete README→ROADMAP→ARCHITECTURE workflow
   */
  async handleStartGenspec(args: any): Promise<ToolResult> {
    const toolName = 'start_genspec';
    this.logger.logToolStart(toolName);

    try {
      const projectPath = args?.projectPath || process.cwd();
      const context = this.createExecutionContext(projectPath);

      // Validate prerequisites
      const validation = await context.validator.validateForTool(toolName);
      context.logger.logValidation(toolName, validation.isValid, validation.errors);

      if (!validation.isValid) {
        context.logger.logToolError(toolName, `Validation failed: ${validation.errors.join(', ')}`);
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot start GenSpec workflow. Validation errors:\n${validation.errors.map(e => `• ${e}`).join('\n')}\n\nPlease fix these issues and try again.`
          }],
          isError: true
        };
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        context.logger.logMessage(`WARNINGS: ${validation.warnings.join(', ')}`);
      }

      const result = await this.executeWorkflow([Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE], context);
      context.logger.logToolComplete(toolName);
      return result;

    } catch (error) {
      this.logger.logToolError(toolName, error instanceof Error ? error.message : String(error));
      return {
        content: [{
          type: 'text',
          text: `❌ Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  /**
   * generate_readme tool - starts from README, continues through full workflow
   */
  async handleGenerateReadme(args: any): Promise<ToolResult> {
    const toolName = 'generate_readme';
    this.logger.logToolStart(toolName);

    try {
      const projectPath = args?.projectPath || process.cwd();
      const context = this.createExecutionContext(projectPath);

      const validation = await context.validator.validateForTool(toolName);
      context.logger.logValidation(toolName, validation.isValid, validation.errors);

      if (!validation.isValid) {
        context.logger.logToolError(toolName, `Validation failed: ${validation.errors.join(', ')}`);
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot generate README. Validation errors:\n${validation.errors.map(e => `• ${e}`).join('\n')}`
          }],
          isError: true
        };
      }

      const result = await this.executeWorkflow([Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE], context);
      context.logger.logToolComplete(toolName);
      return result;

    } catch (error) {
      this.logger.logToolError(toolName, error instanceof Error ? error.message : String(error));
      return {
        content: [{
          type: 'text',
          text: `❌ Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  /**
   * generate_roadmap tool - starts from ROADMAP, continues to ARCHITECTURE
   */
  async handleGenerateRoadmap(args: any): Promise<ToolResult> {
    const toolName = 'generate_roadmap';
    this.logger.logToolStart(toolName);

    try {
      const projectPath = args?.projectPath || process.cwd();
      const context = this.createExecutionContext(projectPath);

      const validation = await context.validator.validateForTool(toolName);
      context.logger.logValidation(toolName, validation.isValid, validation.errors);

      if (!validation.isValid) {
        context.logger.logToolError(toolName, `Validation failed: ${validation.errors.join(', ')}`);
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot generate ROADMAP. Validation errors:\n${validation.errors.map(e => `• ${e}`).join('\n')}`
          }],
          isError: true
        };
      }

      const result = await this.executeWorkflow([Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE], context);
      context.logger.logToolComplete(toolName);
      return result;

    } catch (error) {
      this.logger.logToolError(toolName, error instanceof Error ? error.message : String(error));
      return {
        content: [{
          type: 'text',
          text: `❌ Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  /**
   * generate_architecture tool - executes only SYSTEM-ARCHITECTURE phase
   */
  async handleGenerateArchitecture(args: any): Promise<ToolResult> {
    const toolName = 'generate_architecture';
    this.logger.logToolStart(toolName);

    try {
      const projectPath = args?.projectPath || process.cwd();
      const context = this.createExecutionContext(projectPath);

      const validation = await context.validator.validateForTool(toolName);
      context.logger.logValidation(toolName, validation.isValid, validation.errors);

      if (!validation.isValid) {
        context.logger.logToolError(toolName, `Validation failed: ${validation.errors.join(', ')}`);
        return {
          content: [{
            type: 'text',
          text: `❌ Cannot generate SYSTEM-ARCHITECTURE. Validation errors:\n${validation.errors.map(e => `• ${e}`).join('\n')}`
          }],
          isError: true
        };
      }

      const result = await this.executeWorkflow([Phase.SYSTEM_ARCHITECTURE], context);
      context.logger.logToolComplete(toolName);
      return result;

    } catch (error) {
      this.logger.logToolError(toolName, error instanceof Error ? error.message : String(error));
      return {
        content: [{
          type: 'text',
          text: `❌ Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  /**
   * Creates execution context for tool operations
   */
  private createExecutionContext(projectPath: string): ToolExecutionContext {
    return {
      projectPath,
      validator: new ValidationManager(projectPath),
      approvalManager: this.approvalManager,
      logger: Logger.create(projectPath)
    };
  }

  /**
   * Executes workflow phases with approval gates
   * NOTE: This is a placeholder implementation since we need Track B (templates) and Track C (PhaseManager)
   * The actual generation will be handled by those tracks when they're complete
   */
  private async executeWorkflow(phases: Phase[], context: ToolExecutionContext): Promise<ToolResult> {
    const phaseNames = phases.map(p => this.getPhaseDisplayName(p));
    
    // For now, return a structured response that explains what would happen
    // This will be replaced with actual generation logic when Track B and C are ready
    let responseText = `🚀 GenSpec workflow ready to execute: ${phaseNames.join(' → ')}\n\n`;
    
    responseText += `📁 Project: ${context.projectPath}\n`;
    responseText += `📋 Phases to execute:\n`;
    
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const phaseNum = phase as PhaseNumber;
      const displayName = this.getPhaseDisplayName(phase);
      
      responseText += `  ${i + 1}. ${displayName} - Generate and await approval\n`;
    }
    
    responseText += `\n⚠️  Implementation Note: This tool requires Track B (Template System) and Track C (Document Generation Engine) to be completed for full workflow execution.\n\n`;
    responseText += `📝 Next Steps:\n`;
    responseText += `  • Track B will provide template loading and file writing\n`;
    responseText += `  • Track C will provide document generation and phase management\n`;
    responseText += `  • This tool will then execute the complete approval-based workflow\n\n`;
    responseText += `✅ Validation passed - ready for integration with other tracks`;

    return {
      content: [{
        type: 'text',
        text: responseText
      }]
    };
  }

  /**
   * Gets display name for a phase
   */
  private getPhaseDisplayName(phase: Phase): string {
    switch (phase) {
      case Phase.README:
        return 'README';
      case Phase.ROADMAP:
        return 'ROADMAP';
      case Phase.SYSTEM_ARCHITECTURE:
        return 'SYSTEM-ARCHITECTURE';
      default:
        return `Phase ${phase}`;
    }
  }

  /**
   * Integration function for Track A to use in server.ts
   * This replaces the placeholder handlers in GenSpecServer
   */
  static createServerIntegration(workingDirectory?: string) {
    const tools = new GenSpecTools(workingDirectory);
    
    return {
      handleStartGenspec: (args: any) => tools.handleStartGenspec(args),
      handleGenerateReadme: (args: any) => tools.handleGenerateReadme(args),
      handleGenerateRoadmap: (args: any) => tools.handleGenerateRoadmap(args),
      handleGenerateArchitecture: (args: any) => tools.handleGenerateArchitecture(args)
    };
  }
}