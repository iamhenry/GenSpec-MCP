# Track D Integration Instructions

This document provides instructions for Track A to integrate Track D's command interface and validation functionality into the main MCP server.

## Overview

Track D has implemented:
- ✅ ValidationManager for USER-STORIES.md validation, phase prerequisites, environment validation, and dependency matrix validation
- ✅ ApprovalManager for approval detection, edit feedback extraction, and approval prompts  
- ✅ 4 MCP tools with continuation logic: start_genspec, generate_readme, generate_roadmap, generate_architecture
- ✅ MCP prompt handlers for /generate commands with phase-specific support
- ✅ Basic console logging with format: [timestamp] PHASE:name STATUS:start/complete DURATION:Xs USER:project

## Files Created

Track D has created the following files in `src/utils/`:
- `validation.ts` - ValidationManager class
- `approval.ts` - ApprovalManager class  
- `tools.ts` - GenSpecTools class with 4 MCP tool implementations
- `prompts.ts` - GenSpecPrompts class with /generate command handlers
- `logging.ts` - Logger class for console output
- `integration.ts` - Integration utilities for Track A

## Integration Steps for Track A

### Step 1: Update src/server.ts Imports

Add the following imports to the top of `src/server.ts`:

```typescript
import { createTrackDIntegration, TrackDIntegration } from './utils/integration.js';
```

### Step 2: Add Track D Integration to GenSpecServer Class

Add a private property and initialize it in the constructor:

```typescript
export class GenSpecServer {
  private server: Server;
  private toolContext: ToolContext;
  private trackD: TrackDIntegration; // Add this line

  constructor(server: Server) {
    this.server = server;
    this.toolContext = {
      workingDirectory: process.cwd(),
      templates: [],
      workflowState: {
        completedPhases: []
      }
    };
    
    // Initialize Track D integration
    this.trackD = createTrackDIntegration(this.toolContext.workingDirectory);
  }
```

### Step 3: Replace Placeholder Tool Handlers

Replace the placeholder tool handler methods (lines 287-362) with:

```typescript
/**
 * Handle start_genspec tool - executes complete workflow
 */
private async handleStartGenspec(args: any) {
  return await this.trackD.tools.handleStartGenspec(args);
}

/**
 * Handle generate_readme tool - starts from README phase
 */
private async handleGenerateReadme(args: any) {
  return await this.trackD.tools.handleGenerateReadme(args);
}

/**
 * Handle generate_roadmap tool - starts from ROADMAP phase
 */
private async handleGenerateRoadmap(args: any) {
  return await this.trackD.tools.handleGenerateRoadmap(args);
}

/**
 * Handle generate_architecture tool - executes ARCHITECTURE phase only
 */
private async handleGenerateArchitecture(args: any) {
  return await this.trackD.tools.handleGenerateArchitecture(args);
}
```

### Step 4: Replace Placeholder Prompt Handlers

Replace the GetPromptRequestSchema handler (lines 88-111) with:

```typescript
// Get specific prompt
this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'generate') {
    return await this.trackD.prompts.handleGeneratePrompt(args);
  }
  
  throw new Error(`Unknown prompt: ${name}`);
});
```

And replace the ListPromptsRequestSchema handler (lines 70-86) with:

```typescript
// List available prompts
this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: this.trackD.prompts.getAvailablePrompts()
  };
});
```

### Step 5: Remove Placeholder Comments

Remove or update the TODO comments referencing Track D implementation, as the integration is now complete.

## Functionality Provided

### Tool Validation
All tools now validate:
- USER-STORIES.md existence and content
- Phase prerequisites (README.md for ROADMAP, README.md + ROADMAP.md for ARCHITECTURE)
- Environment setup (templates directory, output directory permissions)
- Dependency matrix validation

### Tool Execution
All tools provide:
- Comprehensive error handling and logging
- Structured validation feedback
- Clear success/error responses
- Integration readiness for Track B and Track C

### Prompt Handling
The /generate prompt supports:
- Phase-specific generation (readme, roadmap, architecture)
- Full workflow execution
- Prerequisite validation before prompt execution
- Clear error messages and guidance

### Logging
All operations log to console with format:
- `[timestamp] PHASE:name STATUS:start/complete DURATION:Xs USER:project`
- Validation results and error details
- Tool execution progress

## Current Status

Track D is COMPLETE and ready for integration. The tools provide:

1. ✅ Full validation workflow for all MCP tools
2. ✅ Structured error handling and user feedback
3. ✅ Approval detection and feedback extraction logic
4. ✅ Console logging for all operations
5. ✅ Integration-ready design for Track B (templates) and Track C (generation)

## Dependencies

Track D tools are designed to work immediately with the current codebase. They will automatically integrate with:
- **Track B**: When template loading and file writing is complete
- **Track C**: When document generation and phase management is complete

The tools currently provide structured placeholder responses that explain what will happen when the full workflow is available.

## Testing

You can test the integration by:
1. Running the MCP server
2. Using any MCP client to call the tools or prompts
3. Checking console output for validation and logging messages
4. Verifying error handling with invalid inputs

All validation and approval logic is fully functional and ready for production use.