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
      
      console.log('[ServerIntegration] === DEBUG: TOOL_CALL START ===');
      console.log(`[ServerIntegration] Tool name: ${name}`);
      console.log(`[ServerIntegration] Raw request: ${JSON.stringify(request, null, 2)}`);
      console.log(`[ServerIntegration] Arguments: ${JSON.stringify(args, null, 2)}`);
      
      logger.logMCPEvent('TOOL_CALL_RECEIVED', { toolName: name, params: request.params });
      
      logger.logToolExecution(name, args);
      logger.logTrace('TOOL_HANDLER', `Starting execution of tool: ${name}`, args);

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
        const successResponse = {
          content: {
            type: 'text',
            text: JSON.stringify({
              success: true,
              phase: result.phase,
              nextAction: result.nextAction,
              draftPath: result.draftPath,
              message: `Tool ${name} executed successfully. Phase: ${result.phase}`,
            }, null, 2),
          },
          isError: false,
        };
        
        logger.logTrace('TOOL_HANDLER', `Tool ${name} completed successfully`, successResponse);
        return successResponse;

      } catch (error) {
        logger.logError(`Tool execution: ${name}`, error instanceof Error ? error : new Error(String(error)));
        logger.logTrace('TOOL_HANDLER', `Tool ${name} failed with error`, { error: error instanceof Error ? error.message : String(error) });
        
        // Return error response
        const errorResponse = {
          content: {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              tool: name,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
          isError: true,
        };
        
        logger.logMCPEvent('TOOL_CALL_ERROR', errorResponse);
        return errorResponse;
      }
    };
  }

  /**
   * Replace the existing GetPromptRequestSchema handler in GenSpecServer
   * This method should replace the GetPromptRequestSchema handler in src/server.ts
   */
  getPromptHandler() {
    return async (request: any) => {
      try {
        const { name, arguments: args } = request.params;
        
        console.log(`[ServerIntegration] === DEBUG: PROMPT_HANDLER START ===`);
        console.log(`[ServerIntegration] Raw prompt name: "${name}"`);
        console.log(`[ServerIntegration] Request params: ${JSON.stringify(request.params, null, 2)}`);
        console.log(`[ServerIntegration] Arguments: ${JSON.stringify(args, null, 2)}`);
        
        logger.logInfo(`Prompt requested: ${name}`);

        // Handle both prefixed and non-prefixed prompt names
        const cleanName = name.includes(':') ? name.split(':')[1] : name;
        console.log(`[ServerIntegration] Clean prompt name: "${cleanName}"`);

        // Map prompt names to tool names
        const toolMapping: Record<string, string> = {
          'start-genspec': 'start_genspec',
          'start-readme': 'generate_readme',
          'start-roadmap': 'generate_roadmap',
          'start-arch': 'generate_architecture',
          'generate': 'start_genspec', // Alias for convenience
        };

        const toolName = toolMapping[cleanName];
        console.log(`[ServerIntegration] Mapped tool name: "${toolName}"`);
        
        if (!toolName) {
          console.log(`[ServerIntegration] ERROR: Unknown prompt name`);
          // Return helpful error message instead of crashing
          return {
            messages: [
              {
                role: 'assistant',
                content: {
                  type: 'text',
                  text: `Unknown prompt: "${name}" (clean: "${cleanName}"). Available prompts are: ${Object.keys(toolMapping).join(', ')}. Use one of these prompts to start the GenSpec workflow.`,
                },
              },
            ],
          };
        }

        // Extract user story arguments from prompt
        const toolArgs: { userStory?: string; userStoryUri?: string } = {};
        if (args?.userStory) {
          toolArgs.userStory = args.userStory;
          console.log(`[ServerIntegration] Using userStory argument from prompt`);
        }
        if (args?.userStoryUri) {
          toolArgs.userStoryUri = args.userStoryUri;
          console.log(`[ServerIntegration] Using userStoryUri argument from prompt`);
        }

        console.log(`[ServerIntegration] Executing tool automatically: ${toolName} with args:`, toolArgs);
        
        try {
          // Execute the tool directly with the provided arguments
          let result;
          switch (toolName) {
            case 'start_genspec':
              result = await this.toolManager.executeStartGenspec(toolArgs);
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
              throw new Error(`Tool execution not implemented: ${toolName}`);
          }

          console.log(`[ServerIntegration] Tool execution successful: ${JSON.stringify(result)}`);
          
          // Return success message with workflow results
          return {
            messages: [
              {
                role: 'assistant',
                content: {
                  type: 'text',
                  text: `✅ ${cleanName} workflow executed successfully!\n\n**Phase:** ${result.phase}\n**Next Action:** ${result.nextAction}\n**Draft Path:** ${result.draftPath}\n\nThe ${result.phase} document has been generated and is ready for review.`,
                },
              },
            ],
          };
        } catch (toolError) {
          console.error(`[ServerIntegration] Tool execution failed:`, toolError);
          
          // Return error message for tool execution failure
          return {
            messages: [
              {
                role: 'assistant',
                content: {
                  type: 'text',
                  text: `❌ Failed to execute ${cleanName} workflow.\n\n**Error:** ${toolError instanceof Error ? toolError.message : String(toolError)}\n\nPlease check the arguments and try again.`,
                },
              },
            ],
          };
        }
      } catch (globalError) {
        console.error(`[ServerIntegration] FATAL: Prompt handler crashed:`, globalError);
        
        // Return a safe error response to prevent server crash
        return {
          messages: [
            {
              role: 'assistant',
              content: {
                type: 'text',
                text: `💥 Prompt handler encountered a fatal error.\n\n**Error:** ${globalError instanceof Error ? globalError.message : String(globalError)}\n\nThe MCP server is still running. Check server logs for details.`,
              },
            },
          ],
        };
      }
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