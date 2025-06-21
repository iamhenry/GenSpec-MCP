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

import {
  handleListResourcesRequest,
  handleReadResourceRequest,
} from './utils/trackBIntegration.js';

import { ServerIntegration } from './utils/serverIntegration.js';

export class GenSpecServer {
  private server: Server;
  private workflowState: Map<string, boolean> = new Map(); // Track active workflows per workspace
  private serverIntegration: ServerIntegration;

  constructor(server: Server) {
    this.server = server;
    this.serverIntegration = new ServerIntegration();
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
    this.server.setRequestHandler(GetPromptRequestSchema, this.serverIntegration.getPromptHandler());
  }

  /**
   * Set up MCP resource handlers
   * Handles: template:// URI scheme for template access
   */
  private setupResourceHandlers(): void {
    // List available resources - integrated with Track B
    this.server.setRequestHandler(ListResourcesRequestSchema, handleListResourcesRequest);

    // Read specific resource - integrated with Track B
    this.server.setRequestHandler(ReadResourceRequestSchema, handleReadResourceRequest);
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
    this.server.setRequestHandler(CallToolRequestSchema, this.serverIntegration.getToolHandler());
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