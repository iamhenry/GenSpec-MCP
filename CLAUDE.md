# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **GenSpec MCP Server** - a Model Context Protocol server that converts user stories into structured documentation (README, ROADMAP, SYSTEM-ARCHITECTURE) through a 3-phase workflow with human approval gates.

## Key Commands

- `npm run build` - Compile TypeScript to dist/
- `npm run dev` - Development mode with tsx
- `npm run start` - Run the production server
- `npm test` - Run installation validation tests
- `npm pack` - Create distributable package
- `npm install -g .` - Install globally for MCP clients

## Architecture

### Core Components
- **Entry Point**: `src/index.ts` - MCP server initialization
- **Server Logic**: `src/server.ts` - MCP protocol implementation with 4 tools, prompts, and resources
- **Types**: `src/types.ts` - Comprehensive type definitions and workflow state
- **Utils**: `src/utils/` - Modular utilities for templates, validation, approval, file writing

### Track-Based Architecture
- **Track A**: MCP Protocol Integration
- **Track B**: Template Management System  
- **Track C**: Document Generation & Validation
- **Track D**: Tool Execution Logic

### Workflow Dependencies
- `start_genspec`: Full pipeline (README → ROADMAP → SYSTEM-ARCHITECTURE)
- `generate_readme`: Continues to ROADMAP → SYSTEM-ARCHITECTURE
- `generate_roadmap`: Requires README, continues to SYSTEM-ARCHITECTURE
- `generate_architecture`: Requires README & ROADMAP

## Key Implementation Details

### User Story Input Priority
1. Inline `userStory` parameter
2. URI reference `userStoryUri` 
3. Local `USER-STORIES.md` file fallback

### Template System
- Templates in `templates/` directory (1-generate-readme.md, 2-generate-roadmap.md, 3-generate-system-architecture.md)
- Accessed via MCP resources with `template://` URI scheme
- Cached for performance

### Approval System
- Approval keywords: "approve", "approved", "ok", "okay", "yes", "y", "lgtm"
- 5-cycle maximum for edit feedback loops
- Case-insensitive pattern matching

### Output Structure
Generated files go to `_ai/docs/`:
- `README.md` - Project overview
- `ROADMAP.md` - Development milestones  
- `SYSTEM-ARCHITECTURE.md` - Technical architecture

### State Management
- Single workspace concurrency control
- Workflow state tracking in `GenSpecServer` class
- Prerequisites validation before continuation workflows

## Development Notes

- ES Module configuration (`"type": "module"`)
- TypeScript target: ES2022 with strict type checking
- Node.js 18.0.0+ required
- MCP SDK integration for protocol compliance
- Comprehensive error handling with typed error system

## Testing

Run `npm test` which executes `test-install.js` - validates project structure, build process, entry points, templates, and MCP capabilities.

## MCP Prompt Commands

### Available Commands
- `/genspec:start-genspec` - Run full workflow (README → ROADMAP → SYSTEM-ARCHITECTURE)
- `/genspec:generate` - Alias for start-genspec
- `/genspec:start-readme` - Generate README, then continue to ROADMAP → SYSTEM-ARCHITECTURE  
- `/genspec:start-roadmap` - Generate ROADMAP, then continue to SYSTEM-ARCHITECTURE
- `/genspec:start-arch` - Generate only SYSTEM-ARCHITECTURE

### Arguments Support
All commands support optional arguments:
- `--userStory "content"` - Provide user stories inline
- `--userStoryUri "url"` - Provide URL/path to user stories file

### Usage Examples
```
/genspec:start-genspec
/genspec:start-genspec --userStory "As a user, I want to..."
/genspec:start-genspec --userStoryUri "https://gist.githubusercontent.com/..."
/genspec:generate --userStoryUri "./USER-STORIES.md"
```

## Critical Bug Fixes & Troubleshooting

### MCP Content Format Issue (RESOLVED)
**Problem**: Claude Code crashes with ZodError when using prompts like `/generate` or `/genspec:start-genspec`
```
ZodError: Expected object, received array at path ["messages", 0, "content"]
```

**Root Cause**: MCP message responses were using `content: [...]` arrays instead of `content: {...}` objects.

**Solution Applied**: 
- Fixed prompt handler responses in `src/utils/serverIntegration.ts`
- Fixed tool handler success/error responses 
- Changed from `content: [{type: "text", text: "..."}]` to `content: {type: "text", text: "..."}`

**Files Modified**: `src/utils/serverIntegration.ts` (lines 70-81, 92-102, 148-158, 167-177, 180-190)

**Verification**: 
- All MCP prompts now work without crashes
- Tool execution returns properly formatted responses
- Global installation via `npm install -g .` required for Claude Code integration

### MCP Server Configuration
**Requirements**:
- Must install globally: `npm install -g .` 
- Claude Code configuration: `claude mcp add genspec genspec-mcp -s user`
- Server command: `genspec-mcp` (not local path)

**Debugging Commands**:
- `claude mcp list` - Verify server registration
- `node test-fixed-prompt.js` - Test prompt responses locally
- `genspec-mcp` - Test global binary directly