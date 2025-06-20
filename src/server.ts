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
import { ResourceManager } from './utils/resources.js';
import { TemplateManager } from './utils/templates.js';
import { DocumentWriter } from './utils/fileWriter.js';
import { GenSpecTools } from './utils/tools.js';
import { DocumentGenerator } from './utils/generator.js';

/**
 * GenSpec MCP Server class
 * Provides MCP integration for document generation workflow
 */
export class GenSpecServer {
  private server: Server;
  private toolContext: ToolContext;
  private resourceManager: ResourceManager;
  private templateManager: TemplateManager;
  private documentWriter: DocumentWriter;
  private genSpecTools: GenSpecTools;
  private documentGenerator: DocumentGenerator;

  constructor(server: Server) {
    this.server = server;
    this.toolContext = {
      workingDirectory: process.cwd(),
      templates: [],
      workflowState: {
        completedPhases: []
      }
    };
    
    // Initialize Track B components
    this.resourceManager = new ResourceManager(this.toolContext.workingDirectory);
    this.templateManager = new TemplateManager();
    this.documentWriter = new DocumentWriter(this.toolContext.workingDirectory);
    
    // Initialize document generation components
    this.documentGenerator = new DocumentGenerator(this.toolContext.workingDirectory);
    
    // Initialize Track D components
    this.genSpecTools = new GenSpecTools(this.toolContext.workingDirectory);
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

      // Server initialized successfully
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
        try {
          const phase = args?.phase as string;
          const projectPath = this.toolContext.workingDirectory;
          
          if (phase) {
            // Generate prompt for specific phase
            const phaseEnum = this.parsePhase(phase);
            const systemPrompt = await this.documentGenerator.getSystemPrompt(phaseEnum, projectPath);
            
            return {
              description: `Generate ${phase.toUpperCase()} document from USER-STORIES.md`,
              messages: [
                {
                  role: 'system',
                  content: {
                    type: 'text',
                    text: systemPrompt
                  }
                }
              ]
            };
          } else {
            // Generate prompt for complete workflow
            const readmePrompt = await this.documentGenerator.getSystemPrompt(Phase.README, projectPath);
            
            return {
              description: 'Generate complete documentation workflow from USER-STORIES.md',
              messages: [
                {
                  role: 'system',
                  content: {
                    type: 'text',
                    text: `You will generate a complete documentation set (README, ROADMAP, and SYSTEM-ARCHITECTURE) based on user stories. Start with the README:\n\n${readmePrompt}`
                  }
                }
              ]
            };
          }
        } catch (error) {
          throw new Error(`Failed to generate prompt: ${error instanceof Error ? error.message : String(error)}`);
        }
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
      try {
        const resources = await this.resourceManager.listAllResources();
        return { resources };
      } catch (error) {
        throw new Error(`Failed to list resources: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Read specific resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      try {
        const content = await this.resourceManager.readResource(uri);
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: content
            }
          ]
        };
      } catch (error) {
        throw new Error(`Failed to read resource ${uri}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            description: 'Start complete GenSpec workflow: README→ROADMAP→SYSTEM-ARCHITECTURE with approval gates',
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
            description: 'Generate README.md and continue through ROADMAP→SYSTEM-ARCHITECTURE workflow',
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
            description: 'Generate ROADMAP.md and continue to SYSTEM-ARCHITECTURE (requires existing README.md)',
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
    const result = await this.genSpecTools.handleStartGenspec(args);
    return {
      content: result.content,
      isError: result.isError
    };
  }

  /**
   * Handle generate_readme tool - starts from README phase
   */
  private async handleGenerateReadme(args: any) {
    const result = await this.genSpecTools.handleGenerateReadme(args);
    return {
      content: result.content,
      isError: result.isError
    };
  }

  /**
   * Handle generate_roadmap tool - starts from ROADMAP phase
   */
  private async handleGenerateRoadmap(args: any) {
    const result = await this.genSpecTools.handleGenerateRoadmap(args);
    return {
      content: result.content,
      isError: result.isError
    };
  }

  /**
   * Handle generate_architecture tool - executes ARCHITECTURE phase only
   */
  private async handleGenerateArchitecture(args: any) {
    const result = await this.genSpecTools.handleGenerateArchitecture(args);
    return {
      content: result.content,
      isError: result.isError
    };
  }

  /**
   * Parse phase string to Phase enum
   */
  private parsePhase(phase: string): Phase {
    switch (phase.toLowerCase()) {
      case 'readme':
        return Phase.README;
      case 'roadmap':
        return Phase.ROADMAP;
      case 'architecture':
      case 'system-architecture':
        return Phase.SYSTEM_ARCHITECTURE;
      default:
        throw new Error(`Unknown phase: ${phase}`);
    }
  }

}