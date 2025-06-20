# Track D Integration Guide for Track A

This document provides step-by-step instructions for Track A to integrate Track D's Command Interface & Validation system into `src/server.ts`.

## Files Implemented by Track D

- `/src/utils/validation.ts` - ValidationManager class for input validation and prerequisites
- `/src/utils/approval.ts` - ApprovalManager class for approval detection and edit feedback
- `/src/utils/tools.ts` - ToolManager class for MCP tool execution
- `/src/utils/logging.ts` - Logger class for comprehensive logging
- `/src/utils/serverIntegration.ts` - ServerIntegration class that provides ready-to-use handlers

## Integration Steps

### Step 1: Import the ServerIntegration Class

Add this import to the top of `src/server.ts`:

```typescript
import { ServerIntegration } from './utils/serverIntegration.js';
import { logger } from './utils/logging.js';
```

### Step 2: Add ServerIntegration Property

Add this property to the `GenSpecServer` class:

```typescript
export class GenSpecServer {
  private server: Server;
  private workflowState: Map<string, boolean> = new Map();
  private serverIntegration: ServerIntegration; // Add this line

  constructor(server: Server) {
    this.server = server;
    this.serverIntegration = new ServerIntegration(); // Add this line
  }
```

### Step 3: Update the initialize() Method

Add logging to the initialize method:

```typescript
async initialize(): Promise<void> {
  // Set up MCP handlers
  this.setupPromptHandlers();
  this.setupResourceHandlers();
  this.setupToolHandlers();

  logger.logServerStart(); // Add this line
  logger.logSystemInfo();  // Add this line
  console.error('[GenSpec MCP] Server initialized with all handlers');
}
```

### Step 4: Replace Tool Handler

In the `setupToolHandlers()` method, replace the existing `CallToolRequestSchema` handler:

```typescript
// Handle tool calls - REPLACE THIS ENTIRE HANDLER
this.server.setRequestHandler(CallToolRequestSchema, this.serverIntegration.getToolHandler());
```

### Step 5: Replace Prompt Handler

In the `setupPromptHandlers()` method, replace the existing `GetPromptRequestSchema` handler:

```typescript
// Get specific prompt - REPLACE THIS ENTIRE HANDLER  
this.server.setRequestHandler(GetPromptRequestSchema, this.serverIntegration.getPromptHandler());
```

### Step 6: Keep Existing List Handlers

The existing `ListToolsRequestSchema` and `ListPromptsRequestSchema` handlers should remain unchanged - they provide the correct metadata that clients need.

## What Track D Provides

### ValidationManager
- User story validation (inline → URI → local file priority)
- Phase prerequisite validation for continuation workflows
- Environment validation (templates, permissions)
- Dependency matrix validation

### ApprovalManager  
- Case-insensitive approval detection (approve, approved, ok, okay, yes, y, lgtm)
- Edit feedback extraction
- Maximum 5 edit cycles per phase before abort

### ToolManager
- Implementation of 4 MCP tools with continuation logic:
  - `start_genspec`: Full workflow (README→ROADMAP→ARCHITECTURE)
  - `generate_readme`: README then continue (README→ROADMAP→ARCHITECTURE)  
  - `generate_roadmap`: ROADMAP then continue (ROADMAP→ARCHITECTURE)
  - `generate_architecture`: ARCHITECTURE only
- Single-workflow concurrency per workspace
- Proper error handling and logging

### Logger
- Comprehensive logging system with workflow progress tracking
- Console output for all operations
- Error logging and debugging support
- System information logging

## Tool Output Schema

All tools return this schema:

```typescript
{
  phase: string,        // Current phase name (README, ROADMAP, SYSTEM_ARCHITECTURE)
  nextAction: string,   // "approve", "edit", or "complete"
  draftPath: string     // Path to draft file in _ai/docs/
}
```

## Error Handling

Track D handles all these error types:
- `ERR_MISSING_USER_STORIES` - No user stories found
- `ERR_MISSING_PREREQUISITES` - Phase prerequisites not met
- `ERR_WORKFLOW_IN_PROGRESS` - Another workflow already active
- `ERR_VALIDATION_FAILED` - General validation failure
- `ERR_FILE_WRITE_FAILED` - File system errors
- `ERR_TEMPLATE_NOT_FOUND` - Missing template files
- `ERR_MAX_EDIT_CYCLES_EXCEEDED` - Too many edit cycles

## Logging Output Examples

```
[GenSpec MCP] 2024-06-20T10:30:00.000Z - SERVER STARTED: GenSpec MCP Server initialized successfully
[GenSpec MCP] 2024-06-20T10:30:05.123Z - TOOL EXECUTION: start_genspec - Args: {"userStory":"..."} - User: user
[GenSpec MCP] 2024-06-20T10:30:06.456Z - WORKFLOW START: start_genspec - Phase: README - User: user
[GenSpec MCP] 2024-06-20T10:35:12.789Z - PHASE TRANSITION: README → ROADMAP - User: user
[GenSpec MCP] 2024-06-20T10:40:18.012Z - WORKFLOW COMPLETE: start_genspec - Phase: SYSTEM_ARCHITECTURE - User: user
```

## Testing the Integration

After integration, test with:

1. Call `start_genspec` tool with user story
2. Verify logging output appears in console
3. Check that tool returns correct output schema
4. Test error handling with invalid inputs
5. Verify single-workflow concurrency works

## Dependencies

Track D requires:
- All types from `src/types.ts` (already implemented by Track A)
- Template files in `/templates/` directory
- Writable `_ai/docs/` directory (created automatically)

Track D is self-contained and doesn't depend on Track B or Track C implementations.