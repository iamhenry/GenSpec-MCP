// Core types for GenSpec MCP server

export interface PhaseMapping {
  1: 'README.md';
  2: 'ROADMAP.md';
  3: 'SYSTEM-ARCHITECTURE.md';
}

export interface TemplateConfig {
  phase: number;
  templateFile: string;
  outputFile: string;
  outputPath: string;
}

export interface DocumentContext {
  projectName: string;
  userStories?: string;
  overview?: string;
  roadmap?: string;
  [key: string]: any;
}

export interface TemplateData {
  content: string;
  metadata: {
    phase: number;
    template: string;
    outputFile: string;
  };
}

export interface WriteResult {
  success: boolean;
  filePath: string;
  error?: string;
}

export type PhaseNumber = 1 | 2 | 3;

// Phase enum for Track A compatibility
export enum Phase {
  README = 1,
  ROADMAP = 2,
  SYSTEM_ARCHITECTURE = 3
}

// Tool context for Track A compatibility
export interface ToolContext {
  workingDirectory: string;
  templates: any[];
  workflowState: {
    completedPhases: Phase[];
  };
}

// Template URI patterns for Track A compatibility
export const TEMPLATE_URI_PATTERNS = {
  README: 'template://phase-1',
  ROADMAP: 'template://phase-2', 
  SYSTEM_ARCHITECTURE: 'template://phase-3'
};

// Tool dependencies for Track A compatibility
export const TOOL_DEPENDENCIES = {
  start_genspec: {
    prerequisites: ['USER-STORIES.md'],
    executes: [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE]
  },
  generate_readme: {
    prerequisites: ['USER-STORIES.md'],
    executes: [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE]
  },
  generate_roadmap: {
    prerequisites: ['README.md'],
    executes: [Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE]
  },
  generate_architecture: {
    prerequisites: ['README.md', 'ROADMAP.md'],
    executes: [Phase.SYSTEM_ARCHITECTURE]
  }
};

export const TEMPLATE_MAPPINGS: Record<PhaseNumber, TemplateConfig> = {
  1: {
    phase: 1,
    templateFile: 'templates/1-generate-readme.md',
    outputFile: 'README.md',
    outputPath: '_ai/docs'
  },
  2: {
    phase: 2,
    templateFile: 'templates/2-generate-roadmap.md',
    outputFile: 'ROADMAP.md',
    outputPath: '_ai/docs'
  },
  3: {
    phase: 3,
    templateFile: 'templates/3-generate-system-architecture.md',
    outputFile: 'SYSTEM-ARCHITECTURE.md',
    outputPath: '_ai/docs'
  }
};