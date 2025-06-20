# Product Requirements Document  
### MCP Server for GenSpec Workflow

MCP Server Docs: https://modelcontextprotocol.io/specification/2025-06-18/server

---

## 1  Purpose
Create a streamlined, chat-driven pipeline that converts a user-provided **`USER-STORIES.md`** (manually authored by user) into three sequential artifacts—`README.md`, `ROADMAP.md`, and `SYSTEM-ARCHITECTURE.md`—with explicit human approval gates between each phase. This is an MCP server (npm package) that must run in any MCP-compliant client (chat, CLI, VS Code, Cursor, Windsurf).

---

## 2  Scope
| In Scope                                | Out of Scope                           |
|-----------------------------------------|----------------------------------------|
| LLM-based generation using existing templates | Auto-writing or editing `USER-STORIES.md` |
| MCP tools `start_genspec` and phase-specific tools | Git commits, branching, external shell calls |
| Approval loop (`approve` / edit & re-run) | Automatic cascaded updates after run completion |
| Writing files to `_ai/docs/…`           | Advanced telemetry dashboards |
| Template reference and system prompt usage from existing templates | Creating new templates from scratch |

---

## 3  User Stories
1. **As a developer** I run `start_genspec` and receive a drafted `README.md` that I can approve or tweak.  
2. **As a tech-lead** I want to type `approve` in chat so the module immediately produces the next artifact without further commands.  
3. **As a CLI user** I need `generate_roadmap` to refresh only the roadmap after I manually edited the README.  
4. **As a VS Code user** I expect an inline diff of the generated file before I approve it.  

---

## 4  Functional Requirements
| ID | Requirement |
|----|-------------|
| FR-1 | The module SHALL abort if `USER-STORIES.md` is missing. |
| FR-2 | `start_genspec` SHALL execute phases in order: README → ROADMAP → SYSTEM-ARCHITECTURE. |
| FR-3 | Each phase SHALL generate the document, present it to the user, then wait for explicit approval before continuing to the next phase. |
| FR-4 | A message that begins with `approve` (case-insensitive) SHALL be interpreted as approval. |
| FR-5 | Any other message while awaiting approval SHALL be treated as edits and re-run the current phase. |
| FR-6 | Phase-specific tools (`generate_readme`, `generate_roadmap`, `generate_architecture`) SHALL run only their respective phase and enforce prerequisite checks. |
| FR-7 | Generated files SHALL overwrite `_ai/docs/{README,ROADMAP,SYSTEM-ARCHITECTURE}.md`. |
| FR-8 | The tool SHALL output generation time and token count to console with format: [timestamp] PHASE:name STATUS:start/complete DURATION:Xs USER:project. |

## 4.1 Tool Specification
The MCP server exposes the following tools with continuation workflow:

- **start_genspec**: Executes README→ROADMAP→ARCHITECTURE pipeline
- **generate_readme**: Starts from README, continues through README→ROADMAP→ARCHITECTURE
- **generate_roadmap**: Starts from ROADMAP, continues through ROADMAP→ARCHITECTURE
- **generate_architecture**: Executes only SYSTEM-ARCHITECTURE phase

### Tool Dependencies
| Tool | Prerequisites | Executes |
|------|--------------|----------|
| start_genspec | USER-STORIES.md | README→ROADMAP→ARCHITECTURE |
| generate_readme | USER-STORIES.md | README→ROADMAP→ARCHITECTURE |
| generate_roadmap | README.md | ROADMAP→ARCHITECTURE |
| generate_architecture | README.md + ROADMAP.md | ARCHITECTURE |

---

## 5  Non-Functional Requirements
* **Portability:** Works identically in all MCP clients.  
* **Security:** No shell execution or external HTTP calls.  
* **Performance:** Each phase should complete within 30 s for ≤5 000-token user story files.  
* **Reliability:** Clear error messages for missing prerequisites; no silent failures.  

---

## 6  User Interaction Flow
```mermaid
sequenceDiagram
    participant U as User
    participant M as MCP Module
    U->>M: start_genspec
    M->>M: Generate README.md
    M->>U: Present draft README.md
    U->>M: approve
    M->>M: Generate ROADMAP.md
    M->>U: Present draft ROADMAP.md
    U->>M: "Change timeline…" (edit)
    M->>M: Regenerate ROADMAP.md with edits
    M->>U: Present updated ROADMAP.md
    U->>M: approve
    M->>M: Generate SYSTEM-ARCHITECTURE.md
    M->>U: Present draft SYSTEM-ARCHITECTURE.md
    U->>M: approve
    M-->>U: ✔ Workflow complete
````

---

## 7  Dependencies

* MCP primitives: Prompts, Resources, Tool invocation.
* Existing template files (authoritative system prompts/styleguides):
  * `templates/1-generate-readme.md` - README generation template with step-by-step instructions and output format
  * `templates/2-generate-roadmap.md` - ROADMAP generation template with step-by-step instructions and output format
  * `templates/3-generate-system-architecture.md` - SYSTEM-ARCHITECTURE generation template with step-by-step instructions and output format

### MCP Resource URI Scheme
* `template://1-generate-readme` - README generation template resource
* `template://2-generate-roadmap` - ROADMAP generation template resource
* `template://3-generate-system-architecture` - SYSTEM-ARCHITECTURE generation template resource

---

## 8  Success Metrics

| Metric                              | Target                |
| ----------------------------------- | --------------------- |
| First-run completion rate           | ≥ 95 % without errors |
| Avg. approval iterations per phase  | ≤ 1.5                 |
| Avg. generation latency             | ≤ 30 s per phase      |
| User satisfaction (post-run survey) | ≥ 4 / 5               |

---
