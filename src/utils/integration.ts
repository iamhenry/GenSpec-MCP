/**
 * Track D Integration for GenSpec MCP Server
 * 
 * This file provides integration code for Track A to incorporate
 * validation, approval, tools, and prompt handlers into the main server
 */

import { GenSpecTools } from './tools.js';
import { GenSpecPrompts } from './prompts.js';
import { ValidationManager } from './validation.js';
import { ApprovalManager } from './approval.js';
import { Logger } from './logging.js';

export interface TrackDIntegration {
  tools: {
    handleStartGenspec: (args: any) => Promise<any>;
    handleGenerateReadme: (args: any) => Promise<any>;
    handleGenerateRoadmap: (args: any) => Promise<any>;
    handleGenerateArchitecture: (args: any) => Promise<any>;
  };
  prompts: {
    getAvailablePrompts: () => any[];
    handleGeneratePrompt: (args?: { phase?: string }) => Promise<any>;
  };
  validators: {
    ValidationManager: typeof ValidationManager;
    ApprovalManager: typeof ApprovalManager;
  };
  logger: Logger;
}

/**
 * Creates complete Track D integration for the GenSpec MCP Server
 * 
 * Usage in src/server.ts:
 * 
 * import { createTrackDIntegration } from './utils/integration.js';
 * 
 * // In GenSpecServer constructor or initialize():
 * const trackD = createTrackDIntegration(this.toolContext.workingDirectory);
 * 
 * // Replace placeholder tool handlers:
 * private async handleStartGenspec(args: any) {
 *   return await this.trackD.tools.handleStartGenspec(args);
 * }
 * 
 * // Replace placeholder prompt handlers:
 * this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
 *   if (request.params.name === 'generate') {
 *     return await this.trackD.prompts.handleGeneratePrompt(request.params.arguments);
 *   }
 *   throw new Error(`Unknown prompt: ${request.params.name}`);
 * });
 */
export function createTrackDIntegration(workingDirectory?: string): TrackDIntegration {
  const tools = GenSpecTools.createServerIntegration(workingDirectory);
  const prompts = GenSpecPrompts.createServerIntegration(workingDirectory);
  const logger = Logger.create(workingDirectory);

  logger.logMessage('INTEGRATION:TrackD STATUS:initialized');

  return {
    tools,
    prompts,
    validators: {
      ValidationManager,
      ApprovalManager
    },
    logger
  };
}

/**
 * Validation utilities for other tracks to use
 */
export { ValidationManager, ApprovalManager, Logger };

/**
 * Core tool and prompt classes for advanced integration
 */
export { GenSpecTools, GenSpecPrompts };

/**
 * Type definitions for integration
 */
export type { ToolResult, ToolExecutionContext } from './tools.js';
export type { PromptResponse } from './prompts.js';
export type { ValidationResult, PrerequisiteCheck } from './validation.js';
export type { ApprovalResult, ApprovalPrompt } from './approval.js';
export type { LogEntry } from './logging.js';