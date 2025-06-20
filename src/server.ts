/**
 * GenSpec MCP Server Implementation
 * 
 * This class implements the GenSpec MCP server with support for:
 * - Prompts: /start-genspec, /start-readme, /start-roadmap, /start-arch
 * - Resources: template:// URI scheme for template access
 * - Tools: start_genspec, generate_readme, generate_roadmap, generate_architecture
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  Phase,
  PHASE_NAMES,
  PHASE_TEMPLATE_URIS,
  WORKFLOW_DEPENDENCIES,
  ToolOutputSchema,
} from './types.js';

export class GenSpecServer {
  private server: Server;
  private workflowState: Map<string, boolean> = new Map(); // Track active workflows per workspace

  constructor(server: Server) {
    this.server = server;
  }

  async initialize(): Promise<void> {
    // Set up MCP handlers
    this.setupPromptHandlers();
    this.setupResourceHandlers();
    this.setupToolHandlers();

    console.error('[GenSpec MCP] Server initialized with all handlers');
  }

  /**
   * Set up MCP prompt handlers
   * Handles: /start-genspec, /start-readme, /start-roadmap, /start-arch
   */
  private setupPromptHandlers(): void {
    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'start-genspec',
            description: 'Run full GenSpec workflow: README → ROADMAP → SYSTEM-ARCHITECTURE',
          },
          {
            name: 'start-readme',
            description: 'Regenerate README, then continue through ROADMAP → SYSTEM-ARCHITECTURE',
          },
          {
            name: 'start-roadmap',
            description: 'Start at ROADMAP, then continue through SYSTEM-ARCHITECTURE',
          },
          {
            name: 'start-arch',
            description: 'Generate only SYSTEM-ARCHITECTURE',
          },
        ],
      };
    });

    // Get specific prompt - returns tool-call message
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name } = request.params;
      
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

      return {
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `Invoking ${toolName} tool...`,
            },
          },
        ],
      };
    });
  }

  /**
   * Set up MCP resource handlers
   * Handles: template:// URI scheme for template access
   */
  private setupResourceHandlers(): void {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: PHASE_TEMPLATE_URIS[Phase.README],
            name: 'README Generation Template',
            description: 'Template for generating README.md documents',
            mimeType: 'text/markdown',
          },
          {
            uri: PHASE_TEMPLATE_URIS[Phase.ROADMAP],
            name: 'Roadmap Generation Template',
            description: 'Template for generating ROADMAP.md documents',
            mimeType: 'text/markdown',
          },
          {
            uri: PHASE_TEMPLATE_URIS[Phase.SYSTEM_ARCHITECTURE],
            name: 'System Architecture Generation Template',
            description: 'Template for generating SYSTEM-ARCHITECTURE.md documents',
            mimeType: 'text/markdown',
          },
        ],
      };
    });

    // Read specific resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      // TODO: Track B will implement template loading
      // This is a placeholder that will be filled by Track B
      if (uri.startsWith('template://')) {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: `[PLACEHOLDER] Template content for ${uri} - Track B will implement template loading`,
            },
          ],
        };
      }
      
      throw new Error(`Unsupported resource URI: ${uri}`);
    });
  }

  /**
   * Set up MCP tool handlers
   * Handles: start_genspec, generate_readme, generate_roadmap, generate_architecture
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'start_genspec',
            description: 'Start full GenSpec workflow: README → ROADMAP → SYSTEM-ARCHITECTURE',
            inputSchema: {
              type: 'object',
              properties: {
                userStory: {
                  type: 'string',
                  description: 'Raw markdown content of the user stories',
                },
                userStoryUri: {
                  type: 'string',
                  format: 'uri',
                  description: 'URI that resolves to the user-story markdown',
                },
              },
              additionalProperties: false,
            },
          },
          {
            name: 'generate_readme',
            description: 'Generate README, then continue through ROADMAP → SYSTEM-ARCHITECTURE',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: 'generate_roadmap',
            description: 'Generate ROADMAP, then continue through SYSTEM-ARCHITECTURE',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: 'generate_architecture',
            description: 'Generate only SYSTEM-ARCHITECTURE',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      // TODO: Track D will implement tool execution logic
      // This is a placeholder that will be filled by Track D
      
      const outputSchema: ToolOutputSchema = {
        phase: 'PLACEHOLDER',
        nextAction: 'approve',
        draftPath: '_ai/docs/PLACEHOLDER.md',
      };

      switch (name) {
        case 'start_genspec':
          return {
            content: [
              {
                type: 'text',
                text: `[PLACEHOLDER] start_genspec tool called - Track D will implement execution logic\nArguments: ${JSON.stringify(args)}`,
              },
            ],
            isError: false,
          };

        case 'generate_readme':
          return {
            content: [
              {
                type: 'text',
                text: '[PLACEHOLDER] generate_readme tool called - Track D will implement execution logic',
              },
            ],
            isError: false,
          };

        case 'generate_roadmap':
          return {
            content: [
              {
                type: 'text',
                text: '[PLACEHOLDER] generate_roadmap tool called - Track D will implement execution logic',
              },
            ],
            isError: false,
          };

        case 'generate_architecture':
          return {
            content: [
              {
                type: 'text',
                text: '[PLACEHOLDER] generate_architecture tool called - Track D will implement execution logic',
              },
            ],
            isError: false,
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  /**
   * Check if a workflow is currently active for a workspace
   */
  private isWorkflowActive(workspace: string): boolean {
    return this.workflowState.get(workspace) || false;
  }

  /**
   * Set workflow state for a workspace
   */
  private setWorkflowState(workspace: string, isActive: boolean): void {
    this.workflowState.set(workspace, isActive);
  }
} 