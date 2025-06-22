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
    console.error('[ServerIntegration] === CONSTRUCTOR CALLED ===');
    console.error('[ServerIntegration] Debug logging enabled in ServerIntegration');
    console.error(`[ServerIntegration] Workspace: ${workspace}`);
    this.toolManager = new ToolManager(workspace);
    this.validationManager = new ValidationManager(workspace);
    this.approvalManager = new ApprovalManager();
    console.error('[ServerIntegration] All managers initialized');
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

        // Return success response with tool output schema (array format)
        const successResponse = {
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
            }
          ],
          isError: false,
        };
        
        logger.logTrace('TOOL_HANDLER', `Tool ${name} completed successfully`, successResponse);
        return successResponse;

      } catch (error) {
        logger.logError(`Tool execution: ${name}`, error instanceof Error ? error : new Error(String(error)));
        logger.logTrace('TOOL_HANDLER', `Tool ${name} failed with error`, { error: error instanceof Error ? error.message : String(error) });
        
        // Return error response (array format)
        const errorResponse = {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                tool: name,
                timestamp: new Date().toISOString(),
              }, null, 2),
            }
          ],
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
        console.error(`[PROMPT_HANDLER] === ENTRY POINT REACHED ===`);
        console.error(`[PROMPT_HANDLER] Full request object: ${JSON.stringify(request, null, 2)}`);
        
        const { name, arguments: args } = request.params;
        
        console.error(`[PROMPT_HANDLER] === DEBUG: PROMPT_HANDLER START ===`);
        console.error(`[PROMPT_HANDLER] Raw prompt name: "${name}"`);
        console.error(`[PROMPT_HANDLER] Request params: ${JSON.stringify(request.params, null, 2)}`);
        console.error(`[PROMPT_HANDLER] Arguments: ${JSON.stringify(args, null, 2)}`);
        console.error(`[PROMPT_HANDLER] Arguments type: ${typeof args}`);
        console.error(`[PROMPT_HANDLER] Arguments constructor: ${args?.constructor?.name}`);
        
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
        
        // DEBUG: Show the actual structure of args
        console.error(`[PROMPT_HANDLER] === ARGUMENT PARSING DEBUG ===`);
        console.error(`[PROMPT_HANDLER] Raw args type: ${typeof args}`);
        console.error(`[PROMPT_HANDLER] Raw args is array: ${Array.isArray(args)}`);
        console.error(`[PROMPT_HANDLER] Raw args is null: ${args === null}`);
        console.error(`[PROMPT_HANDLER] Raw args is undefined: ${args === undefined}`);
        console.error(`[PROMPT_HANDLER] Raw args keys: ${args ? Object.keys(args) : 'none'}`);
        console.error(`[PROMPT_HANDLER] Raw args value: ${JSON.stringify(args)}`);
        console.error(`[PROMPT_HANDLER] Raw args length (if array): ${Array.isArray(args) ? args.length : 'N/A'}`);
        
        // Handle different argument formats
        console.error(`[PROMPT_HANDLER] === CHECKING NAMED ARGUMENTS ===`);
        if (args?.userStory) {
          toolArgs.userStory = args.userStory;
          console.error(`[PROMPT_HANDLER] ✓ Using userStory argument from prompt: ${args.userStory}`);
        } else {
          console.error(`[PROMPT_HANDLER] ✗ No userStory argument found`);
        }
        
        if (args?.userStoryUri) {
          toolArgs.userStoryUri = args.userStoryUri;
          console.error(`[PROMPT_HANDLER] ✓ Using userStoryUri argument from prompt: ${args.userStoryUri}`);
        } else {
          console.error(`[PROMPT_HANDLER] ✗ No userStoryUri argument found`);
        }
        
        // Check if args is a string (positional argument) rather than an object
        console.error(`[PROMPT_HANDLER] === CHECKING STRING ARGUMENT ===`);
        if (typeof args === 'string') {
          console.error(`[PROMPT_HANDLER] ✓ DETECTED: args is a string (positional argument): "${args}"`);
          // Assume it's a URI if it starts with http
          if (args.startsWith('http')) {
            toolArgs.userStoryUri = args;
            console.error(`[PROMPT_HANDLER] ✓ Using positional argument as userStoryUri`);
          } else {
            toolArgs.userStory = args;
            console.error(`[PROMPT_HANDLER] ✓ Using positional argument as userStory`);
          }
        } else {
          console.error(`[PROMPT_HANDLER] ✗ args is not a string`);
        }
        
        // Handle case where args might be an array with a single element
        console.error(`[PROMPT_HANDLER] === CHECKING ARRAY ARGUMENT ===`);
        if (Array.isArray(args) && args.length === 1) {
          console.error(`[PROMPT_HANDLER] ✓ DETECTED: args is an array with one element: "${args[0]}"`);
          const singleArg = args[0];
          if (typeof singleArg === 'string') {
            if (singleArg.startsWith('http')) {
              toolArgs.userStoryUri = singleArg;
              console.error(`[PROMPT_HANDLER] ✓ Using array element as userStoryUri`);
            } else {
              toolArgs.userStory = singleArg;
              console.error(`[PROMPT_HANDLER] ✓ Using array element as userStory`);
            }
          }
        } else {
          console.error(`[PROMPT_HANDLER] ✗ args is not a single-element array`);
        }

        // Final fallback: if no arguments were extracted but we have a raw request, try to extract URL from it
        console.error(`[PROMPT_HANDLER] === FALLBACK URL EXTRACTION ===`);
        if (!toolArgs.userStory && !toolArgs.userStoryUri) {
          console.error(`[PROMPT_HANDLER] ⚠️ No arguments extracted, checking raw request for URL...`);
          const requestStr = JSON.stringify(request);
          console.error(`[PROMPT_HANDLER] Full request string: ${requestStr}`);
          
          // Look for URLs in the request string
          const urlMatch = requestStr.match(/https?:\/\/[^\s"']+/);
          if (urlMatch) {
            const foundUrl = urlMatch[0];
            console.error(`[PROMPT_HANDLER] ✓ Found URL in request: ${foundUrl}`);
            toolArgs.userStoryUri = foundUrl;
          } else {
            console.error(`[PROMPT_HANDLER] ✗ No URL found in request string`);
          }
        } else {
          console.error(`[PROMPT_HANDLER] ✓ Arguments already extracted, skipping fallback`);
        }

        console.error(`[PROMPT_HANDLER] === FINAL EXECUTION ===`);
        console.error(`[PROMPT_HANDLER] Executing tool automatically: ${toolName} with args:`, toolArgs);
        console.error(`[PROMPT_HANDLER] Final toolArgs.userStory: ${toolArgs.userStory || 'undefined'}`);
        console.error(`[PROMPT_HANDLER] Final toolArgs.userStoryUri: ${toolArgs.userStoryUri || 'undefined'}`);
        
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