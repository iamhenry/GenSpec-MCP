/**
 * Core type definitions for GenSpec MCP Server
 */

// Phase enum mapping to template files
export enum Phase {
  README = 1,
  ROADMAP = 2,
  SYSTEM_ARCHITECTURE = 3
}

// Phase names for logging and display
export const PHASE_NAMES: Record<Phase, string> = {
  [Phase.README]: 'README',
  [Phase.ROADMAP]: 'ROADMAP', 
  [Phase.SYSTEM_ARCHITECTURE]: 'SYSTEM_ARCHITECTURE'
};

// Output file mapping
export const PHASE_OUTPUT_FILES: Record<Phase, string> = {
  [Phase.README]: 'README.md',
  [Phase.ROADMAP]: 'ROADMAP.md',
  [Phase.SYSTEM_ARCHITECTURE]: 'SYSTEM-ARCHITECTURE.md'
};

// Template file mapping
export const PHASE_TEMPLATE_FILES: Record<Phase, string> = {
  [Phase.README]: '1-generate-readme.md',
  [Phase.ROADMAP]: '2-generate-roadmap.md',
  [Phase.SYSTEM_ARCHITECTURE]: '3-generate-system-architecture.md'
};

// Template URI mapping for MCP resources
export const PHASE_TEMPLATE_URIS: Record<Phase, string> = {
  [Phase.README]: 'template://1-generate-readme',
  [Phase.ROADMAP]: 'template://2-generate-roadmap',
  [Phase.SYSTEM_ARCHITECTURE]: 'template://3-generate-system-architecture'
};

// Generation context interface
export interface GenerationContext {
  userStories: string;
  phase: Phase;
  previousPhases: Record<Phase, string>;
  workspace: string;
  timestamp: string;
}

// Generation result interface
export interface GenerationResult {
  phase: Phase;
  content: string;
  filePath: string;
  nextAction: 'approve' | 'edit' | 'complete';
  draftPath: string;
}

// Template data interface
export interface TemplateData {
  phase: Phase;
  content: string;
  uri: string;
  filePath: string;
}

// Tool execution context
export interface ToolContext {
  workspace: string;
  userStory?: string;
  userStoryUri?: string;
  currentPhase?: Phase;
  isWorkflowActive: boolean;
}

// Approval detection result
export interface ApprovalResult {
  isApproval: boolean;
  editFeedback?: string;
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  missingPrerequisites?: Phase[];
}

// Workflow state
export interface WorkflowState {
  isActive: boolean;
  currentPhase?: Phase;
  completedPhases: Phase[];
  workspace: string;
  startTime: string;
}

// Error types
export type GenSpecError = 
  | 'ERR_MISSING_USER_STORIES'
  | 'ERR_MISSING_PREREQUISITES'
  | 'ERR_WORKFLOW_IN_PROGRESS'
  | 'ERR_VALIDATION_FAILED'
  | 'ERR_FILE_WRITE_FAILED'
  | 'ERR_TEMPLATE_NOT_FOUND'
  | 'ERR_MAX_EDIT_CYCLES_EXCEEDED';

// Continuation workflow dependencies
export const WORKFLOW_DEPENDENCIES: Record<string, { prerequisites: Phase[], executes: Phase[] }> = {
  'start_genspec': { prerequisites: [], executes: [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE] },
  'generate_readme': { prerequisites: [], executes: [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE] },
  'generate_roadmap': { prerequisites: [Phase.README], executes: [Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE] },
  'generate_architecture': { prerequisites: [Phase.README, Phase.ROADMAP], executes: [Phase.SYSTEM_ARCHITECTURE] }
};

// MCP tool schema types
export interface ToolOutputSchema {
  phase: string;
  nextAction: string;
  draftPath: string;
}

// Logging format
export interface LogEntry {
  timestamp: string;
  phase: string;
  status: 'start' | 'complete';
  duration?: string;
  user: string;
} 