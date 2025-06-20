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
8. Update todo.md with status progress for each milestone (done, in progress, queuedd, etc) and completed tasks.
9. Ensure all placeholder have been implemented without conflicts

Work independently and commit frequently. Focus only on your assigned section to avoid conflicts.

This allows multiple agents to work in parallel on different todo.md sections while maintaining git history and avoiding conflicts.
</instructions>

## 🚀 Overview
Build a production-ready MCP server with **5 parallel development tracks** to avoid conflicts and maximize development speed.

**Each track works on separate files - NO CONFLICTS!**

---

## 📋 TRACK A: Core MCP Infrastructure ✅ COMPLETE
**👤 Agent A** | **Files**: `src/index.ts`, `src/server.ts`, `src/types.ts`

### A1: Project Foundation ✅ COMPLETE
- [x] Create `package.json` with MCP dependencies (@modelcontextprotocol/sdk, typescript, tsx)
- [x] Create `tsconfig.json` for TypeScript compilation
- [x] Set up basic project structure (src/, templates/, _ai/docs/)

### A2: Core Type Definitions ✅ COMPLETE
- [x] Create `src/types.ts` with all shared interfaces
- [x] Define Phase enum (README=1, ROADMAP=2, SYSTEM_ARCHITECTURE=3)
- [x] Define GenerationContext, GenerationResult, TemplateData interfaces
- [x] Add types for continuation workflow dependencies

### A3: MCP Server Bootstrap ✅ COMPLETE
- [x] Create `src/index.ts` as main entry point with MCP server initialization
- [x] Create `src/server.ts` with GenSpecServer class structure
- [x] Set up MCP server capabilities (prompts, resources, tools)
- [x] Configure MCP server setup as server integration (NOT CLI binary)

### A4: MCP Handler Stubs ✅ COMPLETE
- [x] Create placeholder handlers for ListPromptsRequestSchema and GetPromptRequestSchema
- [x] Create placeholder handlers for ListResourcesRequestSchema and ReadResourceRequestSchema  
- [x] Create placeholder handlers for ListToolsRequestSchema and CallToolRequestSchema
- [x] Leave implementation details for other tracks to fill in

**Integration Points**: 
- Coordinate with Track B for resource handlers with exact template mappings
- Coordinate with Track D for continuation workflow tool and prompt handlers
- Coordinate with Track E for package.json scripts

Additional handler responsibilities (2025-06-18):
  - Handlers MUST return an MCP **sample-request** rather than final content.
  - Handlers MUST ensure `_ai/docs/` exists (create if necessary).
  - Emit standard start/complete log lines per phase.

---

## 📂 TRACK B: Template System & File Operations ✅ COMPLETE
**👤 Agent B** | **Files**: `src/utils/templates.ts`, `src/utils/fileWriter.ts`

### B1: Template Loading System ✅ COMPLETE
- [x] Create `src/utils/templates.ts` with TemplateManager class
- [x] Implement template file reading from /templates directory
- [x] Map phase numbers to exact template files matching PRD:
  - Phase 1: `templates/1-generate-readme.md`
  - Phase 2: `templates/2-generate-roadmap.md`
  - Phase 3: `templates/3-generate-system-architecture.md`
- [x] Add template validation and error handling
   *Templates are **merged into prompts**; template files are never copied outside the `templates/` directory.*

### B2: File Writing System ✅ COMPLETE
- [x] Create `src/utils/fileWriter.ts` with DocumentWriter class
- [x] Implement document writing to _ai/docs/ directory
- [x] Add output directory creation and permission checking
- [x] Map phases to output filenames (README.md, ROADMAP.md, SYSTEM-ARCHITECTURE.md)

### B3: MCP Resource Integration ✅ COMPLETE
- [x] Create resource handler functions for template access
- [x] Implement template:// URI scheme for MCP resources
- [x] Provide integration code for Track A to add to src/server.ts

**Dependencies**: Requires types from Track A (`src/types.ts`) ✅ COMPLETE

**Integration Deliverables**: 
- Created `src/utils/trackBIntegration.ts` with handler functions for Track A
- Provided `handleListResourcesRequest()` and `handleReadResourceRequest()` to replace placeholders
- Added utility functions for template/document validation and cross-track helpers

---

## 🤖 TRACK C: Document Generation Engine ✅ COMPLETE
**👤 Agent C** | **Files**: `src/utils/llm.ts`, `src/utils/phases.ts`

### C1: Document Generation Interface ✅ COMPLETE
- [x] Create `src/utils/llm.ts` with DocumentGenerator class  
- [x] Implement document generation interface (client handles all LLM calls)
- [x] Add system prompt building with template content and context
- [x] Handle edit feedback incorporation for regeneration
- [x] NO OpenAI API integration - client manages all LLM communication

### C2: Phase Management System ✅ COMPLETE
- [x] Create `src/utils/phases.ts` with PhaseManager class
- [x] Implement phase execution pipeline with prerequisite checking
- [x] Add context building from previous phases
- [x] Integrate template loading, LLM generation, and file writing

### C3: Generation Context Handling ✅ COMPLETE
- [x] Build generation context with user stories and previous phases
- [x] Handle phase dependencies (SYSTEM_ARCHITECTURE needs ROADMAP)
- [x] Add error handling and validation for generation pipeline

**Dependencies**: 
- Requires types from Track A (`src/types.ts`) ✅ COMPLETE
- Uses TemplateManager and DocumentWriter from Track B ✅ COMPLETE
- No external LLM dependencies - client handles all LLM calls ✅ COMPLETE

**Integration Deliverables**: 
- Created `src/utils/llm.ts` with DocumentGenerator class for system prompt building and generation interface
- Created `src/utils/phases.ts` with PhaseManager class for phase execution pipeline and workflow management
- Integrated with Track B's TemplateManager and DocumentWriter classes
- Implemented generation context handling with user stories and previous phases content
- Added phase dependency validation (SYSTEM_ARCHITECTURE requires ROADMAP and README)
- Provided comprehensive error handling and validation for the generation pipeline
- All LLM communication handled by client - server only builds system prompts and manages workflow

---

## 🎮 TRACK D: Command Interface & Validation ✅ COMPLETE
**👤 Agent D** | **Files**: `src/utils/validation.ts`, `src/utils/approval.ts`

### D1: Input Validation System ✅ COMPLETE
- [x] Create `src/utils/validation.ts` with ValidationManager class
- [x] Implement USER-STORIES.md validation (existence, readability, content)
- [x] Validate user-story source in the following priority order:
    1. `userStory` inline text argument
    2. `userStoryUri` argument → request client to fetch via MCP `ReadResource`
    3. Fallback to local `USER-STORIES.md`
 Abort with `ERR_MISSING_USER_STORIES` if none are available.
- [x] Add phase prerequisite validation for continuation workflows
- [x] Add environment validation (templates, permissions)
- [x] Add dependency matrix validation for continuation workflow dependencies

### D2: Approval Detection System ✅ COMPLETE  
- [x] Create `src/utils/approval.ts` with ApprovalManager class
- [x] Implement approval message detection using the following case-insensitive whitelist **or prefix**:
  - `approve`, `approved`, `ok`, `okay`, `yes`, `y`, `lgtm`
- [x] Add edit feedback extraction for non-approval messages and trigger re-generation. Allow up to **5** consecutive non-approval cycles per phase, then abort with an error message.

### D3: MCP Tools Implementation ✅ COMPLETE
- [x] Implement 4 specific tools with continuation logic (update **start_genspec** inputSchema to accept optional `userStory` and `userStoryUri`):
  - `start_genspec`: Start workflow (README→ROADMAP→ARCHITECTURE)
  - `generate_readme`: Generate README (README→ROADMAP→ARCHITECTURE)
  - `generate_roadmap`: Generate roadmap (ROADMAP→ARCHITECTURE)
  - `generate_architecture`: Generate architecture (ARCHITECTURE only)
- [x] Implement continuation workflow dependencies between tools. Reject a new genspec invocation if another workflow is currently in progress within the same workspace (single-workflow concurrency).
- [x] Provide integration code for Track A to add to src/server.ts. Ensure each tool registers `name`, `description`, an **empty inputSchema**, and an outputSchema containing `phase`, `nextAction`, and `draftPath`.
- [x] Handle tool execution with proper error responses

### D4: MCP Prompt Implementation ✅ COMPLETE
- [x] Create prompt handler functions for /generate command
- [x] Handle phase-specific commands (/generate readme, /generate roadmap, etc.)
- [x] Provide integration code for Track A to add to src/server.ts
+- [x] Register the following prompts via MCP `prompts` capability:
    - `/start-genspec` → invokes `start_genspec` tool
    - `/start-readme`  → invokes `generate_readme` tool
    - `/start-roadmap` → invokes `generate_roadmap` tool
    - `/start-arch`    → invokes `generate_architecture` tool
  Each `GetPrompt` handler SHALL return a single **tool-call** message that calls the mapped tool with an empty arguments object.
+- [x] Provide integration code for Track A to add to `src/server.ts`

### D5: Logging Implementation ✅ COMPLETE
- [x] Implement basic console output logging
- [x] Add simple workflow progress logging to console
- [x] Include basic error logging and debugging to console
- [x] Simple logging integration across tool operations

**Dependencies**: 
- Requires types from Track A (`src/types.ts`)
- Uses PhaseManager from Track C for execution
- Uses ValidationManager for prerequisite checking

---

## 📦 TRACK E: Production Setup & Documentation
**👤 Agent E** | **Files**: `README.md`, `.npmignore`, `test-install.js`, `RELEASE.md`

### E1: Documentation Creation ✅ COMPLETE
- [x] Create comprehensive `README.md` with installation and usage instructions
- [x] Add MCP client integration examples (Claude Desktop, VS Code, Cursor)
- [x] Document troubleshooting and common issues
- [x] Add file structure and workflow explanations

### E2: Package Configuration ✅ COMPLETE
- [x] Create `.npmignore` to exclude development files
- [x] Define npm package files list (dist/, templates/, README.md)
- [x] Add binary configuration for global installation
- [x] Coordinate with Track A for package.json scripts

### E3: Installation Testing ✅ COMPLETE
- [x] Create `test-install.js` automated installation test
- [x] Test build process, entry point, and template files
- [x] Add installation validation steps
- [x] Create post-install instructions

### E4: Release Process ✅ COMPLETE
- [x] Create `RELEASE.md` with release checklist
- [x] Define pre-release, release, and post-release steps
- [x] Add version management and npm publishing workflow
- [x] Document integration testing requirements

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
- Handlers return *sample-requests* that the client executes.
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
- [ ] Uses existing templates as system prompts (no new template files **and no template copies in _ai/docs/**)
- [ ] Generate → Present → Approve/Edit workflow functions correctly
- [ ] Phase dependencies and prerequisite checking work
- [ ] Error handling provides clear user feedback
- [ ] MCP tool list is discoverable in clients via `name` & `description` metadata

### Integration Success
- [ ] All tracks integrate successfully into working MCP server
- [ ] Installation testing passes
- [ ] End-to-end workflow validated with real MCP clients
- [ ] Ready for npm registry publication