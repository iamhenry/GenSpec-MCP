/**
 * GenSpec MCP Server Implementation
 * 
 * Core MCP server class that handles prompts, resources, and tools
 * for the GenSpec workflow with continuation dependencies
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { 
  Phase, 
  ToolContext, 
  TEMPLATE_URI_PATTERNS, 
  TOOL_DEPENDENCIES 
} from './types.js';

/**
 * GenSpec MCP Server class
 * Provides MCP integration for document generation workflow
 */
export class GenSpecServer {
  private server: Server;
  private toolContext: ToolContext;

  constructor(server: Server) {
    this.server = server;
    this.toolContext = {
      workingDirectory: process.cwd(),
      templates: [],
      workflowState: {
        completedPhases: []
      }
    };
  }

  /**
   * Initialize the MCP server with handlers
   */
  async initialize(): Promise<void> {
    try {
      // Set up prompt handlers
      this.setupPromptHandlers();
      
      // Set up resource handlers  
      this.setupResourceHandlers();
      
      // Set up tool handlers
      this.setupToolHandlers();

      console.error('[GenSpec MCP] Server initialized with all handlers');
    } catch (error) {
      console.error('[GenSpec MCP] Failed to initialize server:', error);
      throw error;
    }
  }

  /**
   * Set up MCP prompt handlers
   * Handles /generate command with phase-specific variations
   */
  private setupPromptHandlers(): void {
    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
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
        ]
      };
    });

    // Get specific prompt
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (name === 'generate') {
        // TODO: Track D will implement prompt handler logic
        // Placeholder implementation for now
        const phase = args?.phase as string;
        return {
          description: `Generate ${phase || 'all phases'} from USER-STORIES.md`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `[PLACEHOLDER] Generate ${phase || 'complete workflow'} - implementation pending Track D integration`
              }
            }
          ]
        };
      }
      
      throw new Error(`Unknown prompt: ${name}`);
    });
  }

  /**
   * Set up MCP resource handlers
   * Provides access to templates via template:// URI scheme
   */
  private setupResourceHandlers(): void {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: TEMPLATE_URI_PATTERNS.README,
            name: 'README Generation Template',
            description: 'Template for generating README.md from USER-STORIES.md',
            mimeType: 'text/markdown'
          },
          {
            uri: TEMPLATE_URI_PATTERNS.ROADMAP,
            name: 'Roadmap Generation Template', 
            description: 'Template for generating ROADMAP.md from README.md context',
            mimeType: 'text/markdown'
          },
          {
            uri: TEMPLATE_URI_PATTERNS.SYSTEM_ARCHITECTURE,
            name: 'System Architecture Generation Template',
            description: 'Template for generating SYSTEM-ARCHITECTURE.md from README + ROADMAP context',
            mimeType: 'text/markdown'
          }
        ]
      };
    });

    // Read specific resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      // TODO: Track B will provide template loading implementation
      // Placeholder implementation for now
      switch (uri) {
        case TEMPLATE_URI_PATTERNS.README:
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: '[PLACEHOLDER] README template content - implementation pending Track B integration'
              }
            ]
          };
        case TEMPLATE_URI_PATTERNS.ROADMAP:
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: '[PLACEHOLDER] ROADMAP template content - implementation pending Track B integration'
              }
            ]
          };
        case TEMPLATE_URI_PATTERNS.SYSTEM_ARCHITECTURE:
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: '[PLACEHOLDER] SYSTEM-ARCHITECTURE template content - implementation pending Track B integration'
              }
            ]
          };
        default:
          throw new Error(`Unknown resource URI: ${uri}`);
      }
    });
  }

  /**
   * Set up MCP tool handlers
   * Implements continuation workflow tools with dependency checking
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'start_genspec',
            description: 'Start complete GenSpec workflow: README→ROADMAP→ARCHITECTURE with approval gates',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to project directory containing USER-STORIES.md'
                }
              }
            }
          },
          {
            name: 'generate_readme',
            description: 'Generate README.md and continue through ROADMAP→ARCHITECTURE workflow',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to project directory containing USER-STORIES.md'
                }
              }
            }
          },
          {
            name: 'generate_roadmap',
            description: 'Generate ROADMAP.md and continue to ARCHITECTURE (requires existing README.md)',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to project directory with existing README.md'
                }
              }
            }
          },
          {
            name: 'generate_architecture',
            description: 'Generate SYSTEM-ARCHITECTURE.md only (requires README.md and ROADMAP.md)',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to project directory with existing README.md and ROADMAP.md'
                }
              }
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'start_genspec':
            return await this.handleStartGenspec(args);
          case 'generate_readme':
            return await this.handleGenerateReadme(args);
          case 'generate_roadmap':
            return await this.handleGenerateRoadmap(args);
          case 'generate_architecture':
            return await this.handleGenerateArchitecture(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    });
  }

  /**
   * Handle start_genspec tool - executes complete workflow
   */
  private async handleStartGenspec(args: any) {
    // TODO: Track D will provide implementation with validation and workflow execution
    const projectPath = args?.projectPath || this.toolContext.workingDirectory;
    
    return {
      content: [
        {
          type: 'text',
          text: `[PLACEHOLDER] Starting GenSpec workflow at ${projectPath}
Prerequisites: ${TOOL_DEPENDENCIES.start_genspec.prerequisites.join(', ')}
Workflow: ${TOOL_DEPENDENCIES.start_genspec.executes.map((p: Phase) => Phase[p]).join('→')}
Implementation pending Track D integration with validation, approval, and generation logic.`
        }
      ]
    };
  }

  /**
   * Handle generate_readme tool - starts from README phase
   */
  private async handleGenerateReadme(args: any) {
    // TODO: Track D will provide implementation
    const projectPath = args?.projectPath || this.toolContext.workingDirectory;
    
    return {
      content: [
        {
          type: 'text',
          text: `[PLACEHOLDER] Generating README at ${projectPath}
Prerequisites: ${TOOL_DEPENDENCIES.generate_readme.prerequisites.join(', ')}
Workflow: ${TOOL_DEPENDENCIES.generate_readme.executes.map((p: Phase) => Phase[p]).join('→')}
Implementation pending Track D integration.`
        }
      ]
    };
  }

  /**
   * Handle generate_roadmap tool - starts from ROADMAP phase
   */
  private async handleGenerateRoadmap(args: any) {
    // TODO: Track D will provide implementation
    const projectPath = args?.projectPath || this.toolContext.workingDirectory;
    
    return {
      content: [
        {
          type: 'text',
          text: `[PLACEHOLDER] Generating ROADMAP at ${projectPath}
Prerequisites: ${TOOL_DEPENDENCIES.generate_roadmap.prerequisites.join(', ')}
Workflow: ${TOOL_DEPENDENCIES.generate_roadmap.executes.map((p: Phase) => Phase[p]).join('→')}
Implementation pending Track D integration.`
        }
      ]
    };
  }

  /**
   * Handle generate_architecture tool - executes ARCHITECTURE phase only
   */
  private async handleGenerateArchitecture(args: any) {
    // TODO: Track D will provide implementation
    const projectPath = args?.projectPath || this.toolContext.workingDirectory;
    
    return {
      content: [
        {
          type: 'text',
          text: `[PLACEHOLDER] Generating SYSTEM-ARCHITECTURE at ${projectPath}
Prerequisites: ${TOOL_DEPENDENCIES.generate_architecture.prerequisites.join(', ')}
Workflow: ${TOOL_DEPENDENCIES.generate_architecture.executes.map((p: Phase) => Phase[p]).join('→')}
Implementation pending Track D integration.`
        }
      ]
    };
  }
}