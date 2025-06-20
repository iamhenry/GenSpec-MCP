/**
 * Server Integration Code for Track D (Command Interface & Validation)
 * 
 * This file provides the integration code that should be added to src/server.ts
 * to implement the MCP tools and prompts with continuation logic.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ToolManager } from './tools.js';
import { ValidationManager } from './validation.js';
import { ApprovalManager } from './approval.js';
import { logger } from './logging.js';

export class ServerIntegration {
  private toolManager: ToolManager;
  private validationManager: ValidationManager;
  private approvalManager: ApprovalManager;

  constructor(workspace: string = process.cwd()) {
    this.toolManager = new ToolManager(workspace);
    this.validationManager = new ValidationManager(workspace);
    this.approvalManager = new ApprovalManager();
  }

  /**
   * Replace the existing CallToolRequestSchema handler in GenSpecServer
   * This method should replace the CallToolRequestSchema handler in src/server.ts
   */
  getToolHandler() {
    return async (request: any) => {
      const { name, arguments: args } = request.params;
      
      logger.logToolExecution(name, args);

      try {
        let result;

        switch (name) {
          case 'start_genspec':
            result = await this.toolManager.executeStartGenspec(args);
            break;

          case 'generate_readme':
            result = await this.toolManager.executeGenerateReadme();
            break;

          case 'generate_roadmap':
            result = await this.toolManager.executeGenerateRoadmap();
            break;

          case 'generate_architecture':
            result = await this.toolManager.executeGenerateArchitecture();
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        // Return success response with tool output schema
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                phase: result.phase,
                nextAction: result.nextAction,
                draftPath: result.draftPath,
                message: `Tool ${name} executed successfully. Phase: ${result.phase}`,
              }, null, 2),
            },
          ],
          isError: false,
        };

      } catch (error) {
        logger.logError(`Tool execution: ${name}`, error instanceof Error ? error : new Error(String(error)));
        
        // Return error response
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                tool: name,
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    };
  }

  /**
   * Replace the existing GetPromptRequestSchema handler in GenSpecServer
   * This method should replace the GetPromptRequestSchema handler in src/server.ts
   */
  getPromptHandler() {
    return async (request: any) => {
      const { name } = request.params;
      
      logger.logInfo(`Prompt requested: ${name}`);

      // Map prompt names to tool names
      const toolMapping: Record<string, string> = {
        'start-genspec': 'start_genspec',
        'start-readme': 'generate_readme',
        'start-roadmap': 'generate_roadmap',
        'start-arch': 'generate_architecture',
      };

      const toolName = toolMapping[name];
      if (!toolName) {
        throw new Error(`Unknown prompt: ${name}`);
      }

      // Return a message that instructs the client to call the mapped tool
      return {
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `To execute the ${name} workflow, please call the ${toolName} tool with appropriate arguments.`,
            },
          },
          {
            role: 'assistant',
            content: {
              type: 'tool_use',
              id: `tool_${Date.now()}`,
              name: toolName,
              input: toolName === 'start_genspec' ? {} : {}, // All tools have empty input schema except start_genspec can have userStory/userStoryUri
            },
          },
        ],
      };
    };
  }

  /**
   * Integration instructions for Track A to modify src/server.ts
   */
  static getIntegrationInstructions(): string {
    return `
/**
 * INTEGRATION INSTRUCTIONS FOR TRACK A (src/server.ts)
 * 
 * 1. Import the ServerIntegration class:
 *    import { ServerIntegration } from './utils/serverIntegration.js';
 * 
 * 2. Add a private property to GenSpecServer class:
 *    private serverIntegration: ServerIntegration;
 * 
 * 3. Initialize in the constructor:
 *    this.serverIntegration = new ServerIntegration();
 * 
 * 4. Replace the CallToolRequestSchema handler in setupToolHandlers():
 *    this.server.setRequestHandler(CallToolRequestSchema, this.serverIntegration.getToolHandler());
 * 
 * 5. Replace the GetPromptRequestSchema handler in setupPromptHandlers():
 *    this.server.setRequestHandler(GetPromptRequestSchema, this.serverIntegration.getPromptHandler());
 * 
 * 6. The existing tool and prompt definitions in ListToolsRequestSchema and ListPromptsRequestSchema 
 *    handlers can remain as they are - they provide the correct metadata.
 */
`;
  }

  /**
   * Get validation manager for external use
   */
  getValidationManager(): ValidationManager {
    return this.validationManager;
  }

  /**
   * Get approval manager for external use
   */
  getApprovalManager(): ApprovalManager {
    return this.approvalManager;
  }

  /**
   * Get tool manager for external use
   */
  getToolManager(): ToolManager {
    return this.toolManager;
  }
}