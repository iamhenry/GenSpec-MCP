# GenSpec MCP Server

A streamlined MCP (Model Context Protocol) server that converts user stories into structured documentation through an AI-driven workflow. Generate README, ROADMAP, and SYSTEM-ARCHITECTURE documents with human approval gates between each phase.

## Overview

GenSpec MCP Server enables a chat-driven pipeline that transforms a user-provided `USER-STORIES.md` file into three sequential documentation artifacts:

1. **README.md** - Project overview and features
2. **ROADMAP.md** - Development timeline and milestones  
3. **SYSTEM-ARCHITECTURE.md** - Technical architecture and components

Each phase includes explicit human approval gates, allowing you to review, edit, and approve each document before proceeding to the next phase.

## Features

- **Continuation Workflow**: Seamless phase-to-phase progression with approval gates
- **Template-Based Generation**: Uses proven templates for consistent output quality
- **Multi-Client Support**: Works with Claude Desktop, VS Code, Cursor, and other MCP clients
- **Phase-Specific Tools**: Generate individual documents or run the complete workflow
- **Edit & Regenerate**: Provide feedback for document improvements before approval
- **File Management**: Automatically creates and manages output in `_ai/docs/` directory

## System Requirements

- Node.js 18+ 
- npm 8+
- MCP-compatible client (Claude Desktop, VS Code with MCP extension, Cursor, etc.)

## Installation

### Via npm (Recommended)

```bash
npm install -g genspec-mcp-server
```

### From Source

```bash
git clone https://github.com/yourusername/genspec-mcp-server
cd genspec-mcp-server
npm install
npm run build
npm link
```

## MCP Client Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "genspec": {
      "command": "npx",
      "args": ["genspec-mcp-server"]
    }
  }
}
```

### VS Code with MCP Extension

1. Install the MCP extension for VS Code
2. Add to your VS Code settings.json:

```json
{
  "mcp.servers": {
    "genspec": {
      "command": "npx",
      "args": ["genspec-mcp-server"]
    }
  }
}
```

### Cursor

Add to your Cursor MCP configuration:

```json
{
  "mcpServers": {
    "genspec": {
      "command": "npx",
      "args": ["genspec-mcp-server"]
    }
  }
}
```

## Usage

### 1. Prepare Your User Stories

Create a `USER-STORIES.md` file in your project root with your project requirements:

```markdown
# My Project User Stories

## Overview
This project aims to...

## User Stories
1. As a user, I want to...
2. As a developer, I need to...
3. As an admin, I should be able to...
```

### 2. Start the Workflow

In your MCP client, use one of these commands:

**Complete Workflow** (README → ROADMAP → ARCHITECTURE):
```
start_genspec
```

**Individual Phases**:
```
generate_readme        # Generates README → ROADMAP → ARCHITECTURE
generate_roadmap       # Generates ROADMAP → ARCHITECTURE (requires existing README)
generate_architecture  # Generates ARCHITECTURE only (requires README + ROADMAP)
```

### 3. Review and Approve

For each phase:
1. Review the generated document
2. Type `approve` to continue to the next phase
3. OR provide feedback to regenerate with improvements

Example interaction:
```
User: start_genspec
Server: [Generates README.md draft]
User: approve
Server: [Generates ROADMAP.md draft]
User: Make the timeline more aggressive
Server: [Regenerates ROADMAP.md with shorter timeline]
User: approve
Server: [Generates SYSTEM-ARCHITECTURE.md draft]
User: approve
Server: ✅ Workflow complete! All documents generated.
```

## Available Tools

| Tool | Prerequisites | Description |
|------|--------------|-------------|
| `start_genspec` | USER-STORIES.md | Complete workflow: README→ROADMAP→ARCHITECTURE |
| `generate_readme` | USER-STORIES.md | Generate README, then continue to ROADMAP→ARCHITECTURE |
| `generate_roadmap` | README.md exists | Generate ROADMAP, then continue to ARCHITECTURE |
| `generate_architecture` | README.md + ROADMAP.md exist | Generate ARCHITECTURE only |

## Available Resources

Access templates through MCP resources:

- `template://1-generate-readme` - README generation template
- `template://2-generate-roadmap` - ROADMAP generation template  
- `template://3-generate-system-architecture` - SYSTEM-ARCHITECTURE generation template

## File Structure

```
your-project/
├── USER-STORIES.md           # Your input (manually created)
├── _ai/
│   └── docs/
│       ├── README.md         # Generated project README
│       ├── ROADMAP.md        # Generated development roadmap
│       └── SYSTEM-ARCHITECTURE.md  # Generated system architecture
└── ...
```

## Architecture

The GenSpec MCP Server consists of:

- **MCP Server Core**: Handles MCP protocol communication
- **Template System**: Loads and manages generation templates
- **Phase Manager**: Orchestrates the three-phase workflow
- **Document Generator**: Interfaces with LLM for content generation
- **File Writer**: Manages output to `_ai/docs/` directory
- **Validation System**: Ensures prerequisites and dependencies

## Core Components

### Server (`src/server.ts`)
Main MCP server implementation handling:
- Tool registration and execution
- Resource serving (templates)
- Prompt handling

### Template Manager (`src/utils/templates.ts`)
- Loads templates from `/templates` directory
- Maps phases to template files
- Provides template content for generation

### Phase Manager (`src/utils/phases.ts`)
- Orchestrates phase execution pipeline
- Handles phase dependencies and prerequisites
- Builds generation context from previous phases

### Document Generator (`src/utils/llm.ts`)
- Manages document generation workflow
- Builds system prompts with template content
- Handles edit feedback incorporation

### Validation Manager (`src/utils/validation.ts`)
- Validates USER-STORIES.md existence and content
- Checks phase prerequisites
- Validates environment and permissions

## Troubleshooting

### Common Issues

**Error: "USER-STORIES.md not found"**
- Ensure `USER-STORIES.md` exists in your current working directory
- Check file permissions are readable

**Error: "README.md required for roadmap generation"**
- Run `generate_readme` first, or use `start_genspec` for the complete workflow
- Ensure `_ai/docs/README.md` exists and is not empty

**Error: "MCP server not responding"**
- Restart your MCP client
- Check that the server command is correct in your MCP configuration
- Verify Node.js and npm are properly installed

**Templates not loading**
- Ensure the package installation includes the `templates/` directory
- Check template files exist in the installation path

### Debug Mode

Set environment variable for detailed logging:
```bash
DEBUG=genspec:* npx genspec-mcp-server
```

### Performance

- Each phase typically completes within 30 seconds
- Large USER-STORIES.md files (>5000 tokens) may take longer
- Generation time logged to console: `[timestamp] PHASE:name STATUS:complete DURATION:Xs`

## Development

### Building from Source

```bash
git clone https://github.com/yourusername/genspec-mcp-server
cd genspec-mcp-server
npm install
npm run build
```

### Running Tests

```bash
npm test
npm run test:integration
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues: [Report bugs and request features](https://github.com/yourusername/genspec-mcp-server/issues)
- Documentation: [View complete docs](https://github.com/yourusername/genspec-mcp-server/wiki)
- MCP Protocol: [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-06-18/server)