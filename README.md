# GenSpec MCP Server

A Model Context Protocol (MCP) server that converts user stories into structured documentation including README, ROADMAP, and SYSTEM-ARCHITECTURE documents through a guided approval workflow.

## Overview

GenSpec MCP Server streamlines the documentation creation process by taking user stories as input and generating three key documentation artifacts:

- **README.md** - Project overview and setup instructions
- **ROADMAP.md** - Development roadmap and milestones
- **SYSTEM-ARCHITECTURE.md** - Technical architecture documentation

The server uses a continuation workflow where each phase can be approved or edited before proceeding to the next phase, ensuring high-quality documentation output.

## Features

- **MCP Integration** - Works seamlessly with Claude Desktop, VS Code with MCP extension, and Cursor
- **Template-Based Generation** - Uses predefined templates for consistent documentation structure
- **Approval Workflow** - Generate → Present → Approve/Edit cycle for each document
- **Phase Dependencies** - ROADMAP requires README, SYSTEM-ARCHITECTURE requires both
- **Multiple Entry Points** - Start from any phase or run the complete workflow
- **Resource Access** - Exposes templates via MCP resource protocol

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager

### Install from npm

```bash
npm install -g genspec-mcp
```

### Install from source

```bash
git clone <repository-url>
cd genspec-mcp
npm install
npm run build
```

## MCP Client Integration

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "genspec": {
      "command": "npx",
      "args": ["genspec-mcp"]
    }
  }
}
```

### VS Code with MCP Extension

1. Install the MCP extension for VS Code
2. Add to your VS Code settings or MCP configuration:

```json
{
  "mcp.servers": {
    "genspec": {
      "command": "npx",
      "args": ["genspec-mcp"]
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
      "args": ["genspec-mcp"]
    }
  }
}
```

## Usage

The GenSpec MCP server provides several ways to start the documentation generation workflow:

### Available Tools

- **start_genspec** - Run full workflow: README → ROADMAP → SYSTEM-ARCHITECTURE  
- **generate_readme** - Generate README, then continue through ROADMAP → SYSTEM-ARCHITECTURE
- **generate_roadmap** - Generate ROADMAP, then continue through SYSTEM-ARCHITECTURE
- **generate_architecture** - Generate only SYSTEM-ARCHITECTURE

### Available Prompts

- `/start-genspec` - Invokes start_genspec tool
- `/start-readme` - Invokes generate_readme tool  
- `/start-roadmap` - Invokes generate_roadmap tool
- `/start-arch` - Invokes generate_architecture tool

### Input Methods

The server accepts user stories in three priority order:

1. **Inline text** - Pass user stories directly as `userStory` parameter
2. **URI reference** - Provide `userStoryUri` for the client to fetch via MCP ReadResource
3. **Local file** - Falls back to `USER-STORIES.md` in the current directory

### Workflow Example

1. **Start the workflow**:
   ```
   Use the /start-genspec prompt or start_genspec tool
   ```

2. **Review and approve/edit**:
   - Generated document is presented for review
   - Respond with approval terms: "approve", "approved", "ok", "okay", "yes", "y", "lgtm"
   - Or provide edit feedback to regenerate

3. **Continue through phases**:
   - After approval, the workflow continues to the next phase
   - Each phase follows the same generate → present → approve/edit cycle

## File Structure

```
genspec-mcp/
├── dist/                   # Compiled JavaScript files
├── src/                    # TypeScript source files
│   ├── index.ts           # MCP server entry point
│   ├── server.ts          # GenSpecServer implementation
│   ├── types.ts           # Type definitions and constants
│   └── utils/             # Utility modules (Track B, C, D)
├── templates/              # Generation templates
│   ├── 1-generate-readme.md
│   ├── 2-generate-roadmap.md
│   └── 3-generate-system-architecture.md
├── _ai/docs/              # Generated documentation output
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

## Generated Output

All generated documents are saved to the `_ai/docs/` directory:

- `_ai/docs/README.md` - Generated project README
- `_ai/docs/ROADMAP.md` - Generated development roadmap
- `_ai/docs/SYSTEM-ARCHITECTURE.md` - Generated system architecture

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Running Tests

```bash
npm test
```

## Troubleshooting

### Common Issues

**Issue**: MCP server not detected by client
- **Solution**: Ensure the server is properly installed and the configuration file syntax is correct
- **Check**: Restart your MCP client after configuration changes

**Issue**: "ERR_MISSING_USER_STORIES" error
- **Solution**: Provide user stories via one of the three supported methods (inline, URI, or local file)
- **Check**: Ensure USER-STORIES.md exists if using the local file fallback

**Issue**: "ERR_MISSING_PREREQUISITES" error  
- **Solution**: Generate prerequisite phases first (README before ROADMAP, README and ROADMAP before SYSTEM-ARCHITECTURE)
- **Check**: Use continuation workflow tools that include prerequisites

**Issue**: Templates not loading
- **Solution**: Verify that templates/ directory exists and contains the required template files
- **Check**: Ensure the package was installed correctly with all files

**Issue**: Permission errors writing to _ai/docs/
- **Solution**: Ensure the current directory is writable and _ai/docs/ directory can be created
- **Check**: Run from a directory where you have write permissions

### Debugging

Enable debug logging by setting the DEBUG environment variable:

```bash
DEBUG=genspec:* npx genspec-mcp
```

### Getting Help

- Check the [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18/server) for protocol details
- Review template files in the templates/ directory for generation logic
- File issues or feature requests in the project repository

## System Requirements

- **Node.js**: 18.0.0 or higher
- **Memory**: Minimum 512MB available RAM
- **Disk Space**: 50MB for installation and generated files
- **Network**: Internet connection for npm installation

## Dependencies

### Production Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `typescript` - TypeScript compiler and runtime
- `tsx` - TypeScript execution engine

### Development Dependencies

- `@types/node` - Node.js type definitions

## Architecture

The GenSpec MCP server follows a modular architecture with five main tracks:

### Core Components

- **GenSpecServer** (`src/server.ts`) - Main MCP server implementation
- **Type System** (`src/types.ts`) - Type definitions and constants
- **Template System** (`src/utils/templates.ts`) - Template loading and management
- **Document Generation** (`src/utils/llm.ts`) - Generation interface and context building
- **Validation System** (`src/utils/validation.ts`) - Input validation and prerequisite checking
- **Approval System** (`src/utils/approval.ts`) - Approval detection and edit feedback
- **Phase Management** (`src/utils/phases.ts`) - Workflow execution and coordination

### MCP Protocol Support

- **Prompts** - Command-style prompts that invoke tools
- **Resources** - Template access via template:// URI scheme  
- **Tools** - Document generation workflow tools

### Workflow Management

- **Phase Dependencies** - Ensures proper generation order
- **Continuation Logic** - Seamless transitions between phases
- **Single-Workflow Concurrency** - Prevents conflicting workflows per workspace
- **Approval Cycles** - Up to 5 edit cycles per phase before abort

## License

MIT License - see LICENSE file for details.