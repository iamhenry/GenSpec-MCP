#!/usr/bin/env node

/**
 * GenSpec MCP Server - Main Entry Point
 * 
 * MCP server for converting USER-STORIES.md into README, ROADMAP, and SYSTEM-ARCHITECTURE documents
 * with explicit human approval gates between each phase.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GenSpecServer } from './server.js';

/**
 * Main entry point for the GenSpec MCP Server
 * Initializes the server and starts listening for MCP requests
 */
async function main(): Promise<void> {
  try {
    // Create MCP server instance
    const server = new Server(
      {
        name: 'genspec-mcp',
        version: '1.0.0',
        description: 'MCP server for GenSpec workflow - converts USER-STORIES.md into documentation artifacts'
      },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {}
        }
      }
    );

    // Initialize GenSpec server with MCP server instance
    const genSpecServer = new GenSpecServer(server);
    await genSpecServer.initialize();

    // Set up stdio transport for MCP communication
    const transport = new StdioServerTransport();
    
    // Connect server to transport
    await server.connect(transport);
    
    // Server is now ready - no console output needed for MCP protocol

  } catch (error) {
    console.error('[GenSpec MCP] Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('[GenSpec MCP] Unhandled error:', error);
  process.exit(1);
});