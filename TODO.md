# GenSpec MCP Server - Parallel Development Plan

MCP Server Docs: https://modelcontextprotocol.io/specification/2025-06-18/server

<instructions>
You are a specialized agent working on a specific section of todo.md. Your tasks:

1. Read the current todo.md file to understand your assigned section
2. Briefly use the OODA framework
3. Complete your specific milestone/phase as outlined in the file
4. Update todo.md with your progress and mark your section complete
5. Commit your changes to git with a descriptive message following the format: "feat: complete [section-name] milestone in todo.md"
6. If your work depends on other agents, check their commit history first
7. Report back when your milestone is complete with a summary of changes made

Work independently and commit frequently. Focus only on your assigned section to avoid conflicts.

This allows multiple agents to work in parallel on different todo.md sections while maintaining git history and avoiding conflicts.
</instructions>

## 🚀 Overview
Build a production-ready MCP server with **5 parallel development tracks** to avoid conflicts and maximize development speed.

**Each track works on separate files - NO CONFLICTS!**

---

## 📋 TRACK A: Core MCP Infrastructure
**👤 Agent A** | **Files**: `src/index.ts`, `src/server.ts`, `src/types.ts`

### A1: Project Foundation 
- [ ] Create `package.json` with MCP dependencies (@modelcontextprotocol/sdk, typescript, tsx)
- [ ] Create `tsconfig.json` for TypeScript compilation
- [ ] Set up basic project structure (src/, templates/, _ai/docs/)

### A2: Core Type Definitions
- [ ] Create `src/types.ts` with all shared interfaces
- [ ] Define Phase enum (README=1, ROADMAP=2, SYSTEM_ARCHITECTURE=3)
- [ ] Define GenerationContext, GenerationResult, TemplateData interfaces
- [ ] Add types for continuation workflow dependencies

### A3: MCP Server Bootstrap
- [ ] Create `src/index.ts` as main entry point with MCP server initialization
- [ ] Create `src/server.ts` with GenSpecServer class structure
- [ ] Set up MCP server capabilities (prompts, resources, tools)
- [ ] Configure MCP server setup as server integration (NOT CLI binary)

### A4: MCP Handler Stubs
- [ ] Create placeholder handlers for ListPromptsRequestSchema and GetPromptRequestSchema
- [ ] Create placeholder handlers for ListResourcesRequestSchema and ReadResourceRequestSchema  
- [ ] Create placeholder handlers for ListToolsRequestSchema and CallToolRequestSchema
- [ ] Leave implementation details for other tracks to fill in

**Integration Points**: 
- Coordinate with Track B for resource handlers with exact template mappings
- Coordinate with Track D for continuation workflow tool and prompt handlers
- Coordinate with Track E for package.json scripts

---

## 📂 TRACK B: Template System & File Operations  
**👤 Agent B** | **Files**: `src/utils/templates.ts`, `src/utils/fileWriter.ts`

### B1: Template Loading System
- [ ] Create `src/utils/templates.ts` with TemplateManager class
- [ ] Implement template file reading from /templates directory
- [ ] Map phase numbers to exact template files matching PRD:
  - Phase 1: `templates/1-generate-readme.md`
  - Phase 2: `templates/2-generate-roadmap.md`
  - Phase 3: `templates/3-generate-system-architecture.md`
- [ ] Add template validation and error handling

### B2: File Writing System  
- [ ] Create `src/utils/fileWriter.ts` with DocumentWriter class
- [ ] Implement document writing to _ai/docs/ directory
- [ ] Add output directory creation and permission checking
- [ ] Map phases to output filenames (README.md, ROADMAP.md, SYSTEM-ARCHITECTURE.md)

### B3: MCP Resource Integration
- [ ] Create resource handler functions for template access
- [ ] Implement template:// URI scheme for MCP resources
- [ ] Provide integration code for Track A to add to src/server.ts

**Dependencies**: Requires types from Track A (`src/types.ts`)

---

## 🤖 TRACK C: Document Generation Engine
**👤 Agent C** | **Files**: `src/utils/llm.ts`, `src/utils/phases.ts`

### C1: Document Generation Interface
- [ ] Create `src/utils/llm.ts` with DocumentGenerator class  
- [ ] Implement document generation interface (client handles all LLM calls)
- [ ] Add system prompt building with template content and context
- [ ] Handle edit feedback incorporation for regeneration
- [ ] NO OpenAI API integration - client manages all LLM communication

### C2: Phase Management System
- [ ] Create `src/utils/phases.ts` with PhaseManager class
- [ ] Implement phase execution pipeline with prerequisite checking
- [ ] Add context building from previous phases
- [ ] Integrate template loading, LLM generation, and file writing

### C3: Generation Context Handling
- [ ] Build generation context with user stories and previous phases
- [ ] Handle phase dependencies (SYSTEM_ARCHITECTURE needs ROADMAP)
- [ ] Add error handling and validation for generation pipeline

**Dependencies**: 
- Requires types from Track A (`src/types.ts`)
- Uses TemplateManager and DocumentWriter from Track B
- No external LLM dependencies - client handles all LLM calls

---

## 🎮 TRACK D: Command Interface & Validation
**👤 Agent D** | **Files**: `src/utils/validation.ts`, `src/utils/approval.ts`

### D1: Input Validation System
- [ ] Create `src/utils/validation.ts` with ValidationManager class
- [ ] Implement USER-STORIES.md validation (existence, readability, content)
- [ ] Add phase prerequisite validation for continuation workflows
- [ ] Add environment validation (templates, permissions)
- [ ] Add dependency matrix validation for continuation workflow dependencies

### D2: Approval Detection System  
- [ ] Create `src/utils/approval.ts` with ApprovalManager class
- [ ] Implement approval message detection ("approve", "ok", "yes", etc.)
- [ ] Add edit feedback extraction for non-approval messages
- [ ] Generate approval prompts for user interaction

### D3: MCP Tools Implementation
- [ ] Implement 4 specific tools with continuation logic:
  - `start_genspec`: Start workflow (README→ROADMAP→ARCHITECTURE)
  - `generate_readme`: Generate README (README→ROADMAP→ARCHITECTURE)
  - `generate_roadmap`: Generate roadmap (ROADMAP→ARCHITECTURE)
  - `generate_architecture`: Generate architecture (ARCHITECTURE only)
- [ ] Implement continuation workflow dependencies between tools
- [ ] Provide integration code for Track A to add to src/server.ts
- [ ] Handle tool execution with proper error responses

### D4: MCP Prompt Implementation
- [ ] Create prompt handler functions for /generate command
- [ ] Handle phase-specific commands (/generate readme, /generate roadmap, etc.)
- [ ] Provide integration code for Track A to add to src/server.ts

### D5: Logging Implementation
- [ ] Implement basic console output logging
- [ ] Add simple workflow progress logging to console
- [ ] Include basic error logging and debugging to console
- [ ] Simple logging integration across tool operations

**Dependencies**: 
- Requires types from Track A (`src/types.ts`)
- Uses PhaseManager from Track C for execution
- Uses ValidationManager for prerequisite checking

---

## 📦 TRACK E: Production Setup & Documentation
**👤 Agent E** | **Files**: `README.md`, `.npmignore`, `test-install.js`, `RELEASE.md`

### E1: Documentation Creation
- [ ] Create comprehensive `README.md` with installation and usage instructions
- [ ] Add MCP client integration examples (Claude Desktop, VS Code, Cursor)
- [ ] Document troubleshooting and common issues
- [ ] Add file structure and workflow explanations

### E2: Package Configuration
- [ ] Create `.npmignore` to exclude development files
- [ ] Define npm package files list (dist/, templates/, README.md)
- [ ] Add binary configuration for global installation
- [ ] Coordinate with Track A for package.json scripts

### E3: Installation Testing
- [ ] Create `test-install.js` automated installation test
- [ ] Test build process, entry point, and template files
- [ ] Add installation validation steps
- [ ] Create post-install instructions

### E4: Release Process
- [ ] Create `RELEASE.md` with release checklist
- [ ] Define pre-release, release, and post-release steps
- [ ] Add version management and npm publishing workflow
- [ ] Document integration testing requirements

**Integration Points**: Coordinates with Track A for package.json configuration

---

## 🔄 Integration Strategy

### Parallel Work Phase (Day 1-2)
1. **Track A** creates foundation and type definitions
2. **Track B** builds template and file systems  
3. **Track C** implements generation engine
4. **Track E** creates documentation and packaging

### Integration Phase (Day 3)
1. **Track D** integrates validation, continuation workflow commands, and basic logging (after Track A types ready)
2. **Track B** provides resource handlers to Track A with exact template mappings
3. **Track C** coordinates with Track A for dependencies (NO LLM dependencies - client handles all LLM)  
4. **Track D** provides 4 continuation workflow tool handlers and basic logging to Track A
5. **Track E** finalizes package configuration with Track A

### File Ownership (NO CONFLICTS)
- **Agent A**: `src/index.ts`, `src/server.ts`, `src/types.ts`, `package.json`, `tsconfig.json`
- **Agent B**: `src/utils/templates.ts`, `src/utils/fileWriter.ts`
- **Agent C**: `src/utils/llm.ts`, `src/utils/phases.ts`
- **Agent D**: `src/utils/validation.ts`, `src/utils/approval.ts`
- **Agent E**: `README.md`, `.npmignore`, `test-install.js`, `RELEASE.md`

### Communication Protocol
- Each agent documents their integration points in their files
- Integration code provided as functions/classes for Track A to import
- Clear continuation workflow dependency chains documented with dependency matrix validation
- No agent modifies another agent's files directly
- Template file mappings must exactly match PRD specifications
- ALL LLM integration handled by client, NOT server
- Basic console logging integrated across all tracks for workflow monitoring

---

## ✅ Success Criteria

### Parallel Development
- [ ] All 5 tracks work simultaneously without file conflicts
- [ ] Clear dependency management between tracks
- [ ] Structured integration handoffs

### Production Ready
- [ ] MCP server installs via npm without issues
- [ ] Works with Claude Desktop, VS Code, Cursor
- [ ] Complete documentation and troubleshooting guides

### Core Functionality  
- [ ] Uses existing templates as system prompts (no new template files)
- [ ] Generate → Present → Approve/Edit workflow functions correctly
- [ ] Phase dependencies and prerequisite checking work
- [ ] Error handling provides clear user feedback

### Integration Success
- [ ] All tracks integrate successfully into working MCP server
- [ ] Installation testing passes
- [ ] End-to-end workflow validated with real MCP clients
- [ ] Ready for npm registry publication