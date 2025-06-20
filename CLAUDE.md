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