/**
 * Document Generation Engine
 * 
 * Handles the core document generation workflow by:
 * 1. Loading user stories and templates
 * 2. Generating AI prompts for document creation
 * 3. Processing approval workflow
 * 4. Writing generated documents to files
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TemplateManager } from './templates.js';
import { DocumentWriter } from './fileWriter.js';
import { ApprovalManager } from './approval.js';
import { Logger } from './logging.js';
import { Phase } from '../types.js';

export interface GenerationContext {
  projectPath: string;
  userStories: string;
  templateManager: TemplateManager;
  documentWriter: DocumentWriter;
  approvalManager: ApprovalManager;
  logger: Logger;
}

export interface GenerationResult {
  success: boolean;
  content?: string;
  filePath?: string;
  error?: string;
}

/**
 * Core document generation engine for GenSpec MCP
 */
export class DocumentGenerator {
  private templateManager: TemplateManager;
  private documentWriter: DocumentWriter;
  private approvalManager: ApprovalManager;
  private logger: Logger;

  constructor(workingDirectory: string) {
    this.templateManager = new TemplateManager();
    this.documentWriter = new DocumentWriter(workingDirectory);
    this.approvalManager = new ApprovalManager();
    this.logger = Logger.create(workingDirectory);
  }

  /**
   * Generates a document for the specified phase
   */
  async generateDocument(phase: Phase, projectPath: string): Promise<GenerationResult> {
    try {
      // Load user stories
      const userStories = await this.loadUserStories(projectPath);
      
      // Load template for phase
      const templateData = await this.templateManager.loadTemplate(phase);
      
      // Generate system prompt
      const systemPrompt = this.buildSystemPrompt(templateData.content, userStories, phase);
      
      // For MCP, we return the prompt for the client to process
      // In a real implementation, this would be processed by the MCP client
      const generatedContent = await this.processWithAI(systemPrompt, phase);
      
      // Write document to file
      const fileName = this.getDocumentFileName(phase);
      const writeResult = await this.documentWriter.writeDocument(phase, generatedContent);
      
      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Failed to write document');
      }
      
      this.logger.logMessage(`Generated ${fileName} successfully`);
      
      return {
        success: true,
        content: generatedContent,
        filePath: writeResult.filePath
      };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.logMessage(`Failed to generate document: ${errorMsg}`);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Loads user stories from USER-STORIES.md file
   */
  private async loadUserStories(projectPath: string): Promise<string> {
    const userStoriesPath = path.join(projectPath, 'USER-STORIES.md');
    
    try {
      const content = await fs.readFile(userStoriesPath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to load USER-STORIES.md: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Builds system prompt combining template and user stories
   */
  private buildSystemPrompt(template: string, userStories: string, phase: Phase): string {
    const phaseDisplayName = this.getPhaseDisplayName(phase);
    
    const systemPrompt = `You are a technical documentation specialist generating a ${phaseDisplayName} document based on user stories.

TEMPLATE INSTRUCTIONS:
${template}

USER STORIES TO PROCESS:
${userStories}

TASK:
Generate a complete ${phaseDisplayName}.md document following the template instructions above. The output should be:
1. Well-structured markdown
2. Based entirely on the provided user stories
3. Professional and comprehensive
4. Ready to save as ${phaseDisplayName}.md

Generate the complete document content below:`;

    return systemPrompt;
  }

  /**
   * Processes prompt with AI (placeholder for MCP client integration)
   * In a real MCP environment, this would be handled by the client
   */
  private async processWithAI(systemPrompt: string, phase: Phase): Promise<string> {
    // For now, return a structured placeholder that shows what would be generated
    // In the real implementation, this prompt would be sent to the MCP client
    const phaseDisplayName = this.getPhaseDisplayName(phase);
    
    return `# ${phaseDisplayName}

## Generated from User Stories

This document was generated from the USER-STORIES.md file using the GenSpec MCP workflow.

### System Prompt Used:
\`\`\`
${systemPrompt}
\`\`\`

### Next Steps:
1. This placeholder will be replaced with actual AI-generated content
2. The MCP client will process the system prompt above
3. Generated content will be written to _ai/docs/${phaseDisplayName}.md

### Template Processing:
- Phase: ${phaseDisplayName}
- Template loaded successfully
- User stories processed
- Ready for AI generation

---
*Generated by GenSpec MCP Server*`;
  }

  /**
   * Gets the appropriate file name for a phase
   */
  private getDocumentFileName(phase: Phase): string {
    switch (phase) {
      case Phase.README:
        return 'README.md';
      case Phase.ROADMAP:
        return 'ROADMAP.md';
      case Phase.SYSTEM_ARCHITECTURE:
        return 'SYSTEM-ARCHITECTURE.md';
      default:
        return `PHASE-${phase}.md`;
    }
  }

  /**
   * Gets display name for a phase
   */
  private getPhaseDisplayName(phase: Phase): string {
    switch (phase) {
      case Phase.README:
        return 'README';
      case Phase.ROADMAP:
        return 'ROADMAP';
      case Phase.SYSTEM_ARCHITECTURE:
        return 'SYSTEM-ARCHITECTURE';
      default:
        return `Phase ${phase}`;
    }
  }

  /**
   * Executes approval workflow for generated content
   */
  async handleApprovalWorkflow(content: string, phase: Phase): Promise<{ approved: boolean; feedback?: string }> {
    // This would integrate with the MCP client for user approval
    // For now, return auto-approval for testing
    return { approved: true };
  }

  /**
   * Gets the system prompt for a phase (for MCP client processing)
   */
  async getSystemPrompt(phase: Phase, projectPath: string): Promise<string> {
    const userStories = await this.loadUserStories(projectPath);
    const templateData = await this.templateManager.loadTemplate(phase);
    return this.buildSystemPrompt(templateData.content, userStories, phase);
  }
}