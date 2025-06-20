#!/usr/bin/env node

/**
 * GenSpec MCP Server - Main Entry Point
 * 
 * This is the main entry point for the GenSpec MCP server.
 * It initializes the MCP server and starts listening for connections.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GenSpecServer } from './server.js';

async function main() {
  // Create the MCP server instance
  const server = new Server(
    {
      name: 'genspec-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
      },
    }
  );

  // Initialize the GenSpec server with MCP capabilities
  const genSpecServer = new GenSpecServer(server);
  await genSpecServer.initialize();

  // Set up stdio transport for MCP communication
  const transport = new StdioServerTransport();
  
  // Connect the server to the transport
  await server.connect(transport);

  // Log server startup
  console.error('[GenSpec MCP] Server started and listening on stdio');
  console.error('[GenSpec MCP] Capabilities: prompts, resources, tools');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('[GenSpec MCP] Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[GenSpec MCP] Shutting down server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('[GenSpec MCP] Fatal error:', error);
  process.exit(1);
}); 