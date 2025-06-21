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
import { logger } from './utils/logging.js';

async function main() {
  logger.logServerEvent('MAIN_START', { pid: process.pid, nodeVersion: process.version });
  
  // Create the MCP server instance
  logger.logTrace('MAIN', 'Creating MCP server instance');
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
  
  logger.logTrace('MAIN', 'MCP server instance created');

  // Initialize the GenSpec server with MCP capabilities
  logger.logTrace('MAIN', 'Creating GenSpec server instance');
  const genSpecServer = new GenSpecServer(server);
  logger.logTrace('MAIN', 'Initializing GenSpec server');
  await genSpecServer.initialize();
  logger.logTrace('MAIN', 'GenSpec server initialization complete');

  // Set up stdio transport for MCP communication
  logger.logTrace('MAIN', 'Creating stdio transport');
  const transport = new StdioServerTransport();
  
  // Connect the server to the transport
  logger.logTrace('MAIN', 'Connecting server to transport');
  await server.connect(transport);
  logger.logTrace('MAIN', 'Server connected to transport');

  // Log server startup
  console.error('[GenSpec MCP] Server started and listening on stdio');
  console.error('[GenSpec MCP] Capabilities: prompts, resources, tools');
  logger.logServerEvent('SERVER_READY', { transport: 'stdio', capabilities: ['prompts', 'resources', 'tools'] });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.logServerEvent('SHUTDOWN_SIGINT');
  console.error('[GenSpec MCP] Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.logServerEvent('SHUTDOWN_SIGTERM');
  console.error('[GenSpec MCP] Shutting down server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  logger.logServerEvent('FATAL_ERROR', { error: error.message, stack: error.stack });
  console.error('[GenSpec MCP] Fatal error:', error);
  process.exit(1);
}); 