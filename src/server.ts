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
    this.resourceManager = new ResourceManager();
    this.templateManager = new TemplateManager();
    this.documentWriter = new DocumentWriter();
    
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
            name: 'load_template',
            description: 'Load a template by phase number (1=README, 2=ROADMAP, 3=SYSTEM-ARCHITECTURE)',
            inputSchema: {
              type: 'object',
              properties: {
                phase: {
                  type: 'number',
                  description: 'Phase number (1, 2, or 3)',
                  enum: [1, 2, 3]
                }
              },
              required: ['phase']
            }
          },
          {
            name: 'write_document',
            description: 'Write generated document content to the appropriate file in _ai/docs/',
            inputSchema: {
              type: 'object',
              properties: {
                phase: {
                  type: 'number',
                  description: 'Phase number (1, 2, or 3)',
                  enum: [1, 2, 3]
                },
                content: {
                  type: 'string',
                  description: 'Generated document content to write'
                }
              },
              required: ['phase', 'content']
            }
          },
          {
            name: 'generate_document',
            description: 'Load template and prepare for document generation by AI',
            inputSchema: {
              type: 'object',
              properties: {
                phase: {
                  type: 'number',
                  description: 'Phase number (1, 2, or 3)',
                  enum: [1, 2, 3]
                },
                context: {
                  type: 'object',
                  description: 'Optional context data for template processing',
                  properties: {
                    projectName: { type: 'string' },
                    userStories: { type: 'string' },
                    overview: { type: 'string' },
                    roadmap: { type: 'string' }
                  }
                }
              },
              required: ['phase']
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
          case 'load_template':
            return await this.handleLoadTemplate(args);
          case 'write_document':
            return await this.handleWriteDocument(args);
          case 'generate_document':
            return await this.handleGenerateDocument(args);
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
   * Handle load_template tool - loads template content by phase
   */
  private async handleLoadTemplate(args: any) {
    try {
      if (!this.templateManager.isValidPhase(args.phase)) {
        throw new Error(`Invalid phase number: ${args.phase}. Must be 1, 2, or 3.`);
      }
      
      const templateData = await this.templateManager.loadTemplate(args.phase);
      const config = this.templateManager.getTemplateConfig(args.phase);
      
      return {
        content: [{
          type: 'text',
          text: `Template loaded for Phase ${args.phase}:\n\nOutput file: ${config.outputFile}\nOutput path: ${config.outputPath}\n\nTemplate content:\n${templateData.content}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error loading template: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Handle write_document tool - writes document content to file
   */
  private async handleWriteDocument(args: any) {
    try {
      if (!this.templateManager.isValidPhase(args.phase)) {
        throw new Error(`Invalid phase number: ${args.phase}. Must be 1, 2, or 3.`);
      }
      
      const result = await this.documentWriter.writeDocument(args.phase, args.content);
      
      if (result.success) {
        return {
          content: [{
            type: 'text',
            text: `Document successfully written to: ${result.filePath}`
          }]
        };
      } else {
        return {
          content: [{
            type: 'text',
            text: `Error writing document: ${result.error}`
          }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error writing document: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Handle generate_document tool - loads template and prepares for AI generation
   */
  private async handleGenerateDocument(args: any) {
    try {
      if (!this.templateManager.isValidPhase(args.phase)) {
        throw new Error(`Invalid phase number: ${args.phase}. Must be 1, 2, or 3.`);
      }
      
      const templateData = await this.templateManager.loadTemplate(args.phase);
      const config = this.templateManager.getTemplateConfig(args.phase);
      
      // Process template with context if provided
      let processedContent = templateData.content;
      if (args.context) {
        processedContent = this.templateManager.processTemplate(templateData.content, args.context);
      }
      
      return {
        content: [{
          type: 'text',
          text: `Template loaded for ${config.outputFile} generation:\n\n${processedContent}\n\n---\n\nPlease generate the ${config.outputFile} document based on this template and write it to ${config.outputPath}/${config.outputFile}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error generating document: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
}