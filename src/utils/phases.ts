/**
 * Phase Management System for GenSpec MCP Server
 * Handles phase execution pipeline with prerequisite checking and context building
 */

import { 
  Phase, 
  GenerationContext, 
  GenerationResult, 
  ValidationResult,
  WorkflowState,
  TemplateData,
  PHASE_NAMES,
  WORKFLOW_DEPENDENCIES,
  GenSpecError 
} from '../types.js';
import { DocumentGenerator, GenerationRequest } from './llm.js';
import { DocumentWriter } from './fileWriter.js';
import { TemplateManager } from './templates.js';

export interface PhaseExecutionOptions {
  userStories: string;
  workspace: string;
  editFeedback?: string;
  maxEditCycles?: number;
}

export interface PhaseExecutionResult {
  success: boolean;
  result?: GenerationResult;
  error?: string;
  editCycleCount?: number;
}

export interface WorkflowExecutionPlan {
  phases: Phase[];
  startPhase: Phase;
  totalPhases: number;
  dependencies: Record<Phase, Phase[]>;
}

export class PhaseManager {
  private documentGenerator: DocumentGenerator;
  private documentWriter: DocumentWriter;
  private templateManager: TemplateManager;
  private workflowState: WorkflowState | null = null;
  private readonly maxEditCycles: number = 5;

  constructor(
    documentGenerator?: DocumentGenerator,
    documentWriter?: DocumentWriter,
    templateManager?: TemplateManager
  ) {
    this.documentGenerator = documentGenerator || new DocumentGenerator();
    this.documentWriter = documentWriter || new DocumentWriter();
    this.templateManager = templateManager || new TemplateManager();
  }

  /**
   * Execute a single phase with prerequisite checking
   * @param phase - Phase to execute
   * @param options - Execution options with user stories and workspace
   * @returns Phase execution result
   */
  async executePhase(phase: Phase, options: PhaseExecutionOptions): Promise<PhaseExecutionResult> {
    try {
      // Validate phase prerequisites
      const validation = await this.validatePhasePrerequisites(phase, options.workspace);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Phase prerequisites not met: ${validation.error}`
        };
      }

      // Build generation context
      const context = await this.buildGenerationContext(phase, options);

      // Execute generation with edit cycle handling
      const result = await this.executeWithEditCycles(context, options);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Phase execution failed: ${errorMessage}`
      };
    }
  }

  /**
   * Execute multiple phases in sequence (workflow)
   * @param phases - Array of phases to execute
   * @param options - Execution options
   * @returns Array of execution results
   */
  async executeWorkflow(phases: Phase[], options: PhaseExecutionOptions): Promise<PhaseExecutionResult[]> {
    const results: PhaseExecutionResult[] = [];

    // Initialize workflow state
    this.workflowState = {
      isActive: true,
      currentPhase: phases[0],
      completedPhases: [],
      workspace: options.workspace,
      startTime: new Date().toISOString()
    };

    try {
      for (const phase of phases) {
        this.workflowState.currentPhase = phase;

        console.log(`Starting phase: ${PHASE_NAMES[phase]}`);
        
        const result = await this.executePhase(phase, options);
        results.push(result);

        if (!result.success) {
          console.error(`Phase ${PHASE_NAMES[phase]} failed: ${result.error}`);
          break;
        }

        this.workflowState.completedPhases.push(phase);
        console.log(`Completed phase: ${PHASE_NAMES[phase]}`);
      }
    } finally {
      // Clear workflow state
      this.workflowState = null;
    }

    return results;
  }

  /**
   * Get execution plan for a workflow tool
   * @param toolName - Name of the workflow tool
   * @returns Execution plan with phases and dependencies
   */
  getWorkflowExecutionPlan(toolName: string): WorkflowExecutionPlan | null {
    const workflow = WORKFLOW_DEPENDENCIES[toolName];
    if (!workflow) {
      return null;
    }

    const phases = workflow.executes;
    const dependencies = {} as Record<Phase, Phase[]>;

    // Build dependency map
    phases.forEach(phase => {
      dependencies[phase] = this.getPhasePrerequisites(phase);
    });

    return {
      phases,
      startPhase: phases[0],
      totalPhases: phases.length,
      dependencies
    };
  }

  /**
   * Validate phase prerequisites
   * @param phase - Phase to validate
   * @param workspace - Workspace identifier
   * @returns Validation result
   */
  async validatePhasePrerequisites(phase: Phase, workspace: string): Promise<ValidationResult> {
    try {
      const missingPrerequisites: Phase[] = [];
      const errors: string[] = [];

      // Check prerequisite phases exist
      const prerequisites = this.getPhasePrerequisites(phase);
      
      for (const prereqPhase of prerequisites) {
        const exists = this.documentWriter.documentExists(prereqPhase);
        if (!exists) {
          missingPrerequisites.push(prereqPhase);
        }
      }

      if (missingPrerequisites.length > 0) {
        const missingNames = missingPrerequisites.map(p => PHASE_NAMES[p]).join(', ');
        errors.push(`Missing prerequisite phases: ${missingNames}`);
      }

      // Validate template availability
      try {
        await this.templateManager.loadTemplate(phase);
      } catch (error) {
        errors.push(`Template not available for phase ${PHASE_NAMES[phase]}`);
      }

      // Validate output directory
      const outputValidation = await this.documentWriter.validateOutputDirectory();
      if (!outputValidation.isValid) {
        errors.push(`Output directory validation failed: ${outputValidation.error}`);
      }

      return {
        isValid: errors.length === 0,
        error: errors.length > 0 ? errors.join('; ') : undefined,
        missingPrerequisites: missingPrerequisites.length > 0 ? missingPrerequisites : undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        isValid: false,
        error: `Validation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Build generation context for a phase
   * @param phase - Phase to build context for
   * @param options - Execution options
   * @returns Complete generation context
   */
  async buildGenerationContext(phase: Phase, options: PhaseExecutionOptions): Promise<GenerationContext> {
    // Get content from previous phases
    const previousPhases = {} as Record<Phase, string>;
    const prerequisites = this.getPhasePrerequisites(phase);

    for (const prereqPhase of prerequisites) {
      const content = await this.documentWriter.readExistingDocument(prereqPhase);
      if (content) {
        previousPhases[prereqPhase] = content;
      }
    }

    const context: GenerationContext = {
      userStories: options.userStories,
      phase,
      previousPhases,
      workspace: options.workspace,
      timestamp: new Date().toISOString()
    };

    return context;
  }

  /**
   * Check if workflow is currently active
   * @returns Current workflow state
   */
  getWorkflowState(): WorkflowState | null {
    return this.workflowState;
  }

  /**
   * Check if a specific phase is completed
   * @param phase - Phase to check
   * @returns Boolean indicating completion
   */
  isPhaseCompleted(phase: Phase): boolean {
    return this.documentWriter.documentExists(phase);
  }

  /**
   * Get all completed phases
   * @returns Array of completed phases
   */
  getCompletedPhases(): Phase[] {
    const completed: Phase[] = [];
    const allPhases = [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE];

    for (const phase of allPhases) {
      if (this.isPhaseCompleted(phase)) {
        completed.push(phase);
      }
    }

    return completed;
  }

  /**
   * Get phase execution status
   * @param phase - Phase to check
   * @returns Status information
   */
  async getPhaseStatus(phase: Phase): Promise<{
    phase: Phase;
    name: string;
    completed: boolean;
    hasPrerequisites: boolean;
    prerequisites: Phase[];
    canExecute: boolean;
    filePath?: string;
    lastModified?: Date;
  }> {
    const prerequisites = this.getPhasePrerequisites(phase);
    const completed = this.isPhaseCompleted(phase);
    const hasPrerequisites = prerequisites.length > 0;
    
    // Check if can execute (prerequisites met)
    let canExecute = true;
    for (const prereq of prerequisites) {
      if (!this.isPhaseCompleted(prereq)) {
        canExecute = false;
        break;
      }
    }

    let filePath: string | undefined;
    let lastModified: Date | undefined;

    if (completed) {
      filePath = this.documentWriter.getDocumentPath(phase);
      const stats = await this.documentWriter.getDocumentStats(phase);
      if (stats) {
        lastModified = stats.mtime;
      }
    }

    return {
      phase,
      name: PHASE_NAMES[phase],
      completed,
      hasPrerequisites,
      prerequisites,
      canExecute,
      filePath,
      lastModified
    };
  }

  /**
   * Get overview of all phases
   * @returns Array of phase status information
   */
  async getAllPhasesStatus(): Promise<Array<{
    phase: Phase;
    name: string;
    completed: boolean;
    hasPrerequisites: boolean;
    prerequisites: Phase[];
    canExecute: boolean;
    filePath?: string;
    lastModified?: Date;
  }>> {
    const allPhases = [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE];
    const statuses = [];

    for (const phase of allPhases) {
      const status = await this.getPhaseStatus(phase);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Execute phase with edit cycle handling
   */
  private async executeWithEditCycles(
    context: GenerationContext, 
    options: PhaseExecutionOptions
  ): Promise<PhaseExecutionResult> {
    const maxCycles = options.maxEditCycles || this.maxEditCycles;
    let editCycleCount = 0;
    let currentEditFeedback = options.editFeedback;

    while (editCycleCount < maxCycles) {
      try {
        // Create generation request using template-based system
        const request = await this.documentGenerator.createGenerationRequest(context, currentEditFeedback);
        
        console.log(`Generation request prepared for phase ${PHASE_NAMES[context.phase]}`);
        console.log(`Edit cycle: ${editCycleCount + 1}/${maxCycles}`);
        
        // Generate content using template-based approach
        const generatedContent = await this.generateContentWithTemplate(context, request);
        
        // Process the generated content and write to file
        const result = await this.documentGenerator.processGenerationResult(generatedContent, context);

        console.log(`Successfully generated ${PHASE_NAMES[context.phase]} and wrote to: ${result.filePath}`);

        return {
          success: true,
          result,
          editCycleCount: editCycleCount + 1
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error in edit cycle ${editCycleCount + 1} for phase ${PHASE_NAMES[context.phase]}: ${errorMessage}`);
        
        // For testing purposes, if we get an error, we can fallback to mock content
        // but in production this should propagate the error
        editCycleCount++;
        if (editCycleCount >= maxCycles) {
          return {
            success: false,
            error: errorMessage,
            editCycleCount: editCycleCount
          };
        }
      }
    }

    return {
      success: false,
      error: `Maximum edit cycles (${maxCycles}) exceeded`,
      editCycleCount: maxCycles
    };
  }

  /**
   * Get prerequisite phases for a given phase
   */
  private getPhasePrerequisites(phase: Phase): Phase[] {
    switch (phase) {
      case Phase.README:
        return [];
      case Phase.ROADMAP:
        return [Phase.README];
      case Phase.SYSTEM_ARCHITECTURE:
        return [Phase.README, Phase.ROADMAP];
      default:
        return [];
    }
  }

  /**
   * Reset workflow state (for testing or error recovery)
   */
  resetWorkflowState(): void {
    this.workflowState = null;
  }

  /**
   * Get document generator instance
   */
  getDocumentGenerator(): DocumentGenerator {
    return this.documentGenerator;
  }

  /**
   * Get document writer instance
   */
  getDocumentWriter(): DocumentWriter {
    return this.documentWriter;
  }

  /**
   * Get template manager instance
   */
  getTemplateManager(): TemplateManager {
    return this.templateManager;
  }

  /**
   * Delete phase document (for testing or reset)
   * @param phase - Phase to delete
   * @returns Success status
   */
  async deletePhaseDocument(phase: Phase): Promise<boolean> {
    return await this.documentWriter.deleteDocument(phase);
  }

  /**
   * Create backup of phase document
   * @param phase - Phase to backup
   * @returns Backup file path or null
   */
  async backupPhaseDocument(phase: Phase): Promise<string | null> {
    return await this.documentWriter.createBackup(phase);
  }

  /**
   * Validate entire workflow prerequisites
   * @param toolName - Workflow tool name
   * @param workspace - Workspace identifier
   * @returns Validation result for workflow
   */
  async validateWorkflowPrerequisites(toolName: string, workspace: string): Promise<ValidationResult> {
    const workflow = WORKFLOW_DEPENDENCIES[toolName];
    if (!workflow) {
      return {
        isValid: false,
        error: `Unknown workflow tool: ${toolName}`
      };
    }

    const errors: string[] = [];
    const missingPrerequisites: Phase[] = [];

    // Check if workflow can start based on prerequisites
    for (const prereqPhase of workflow.prerequisites) {
      const exists = this.documentWriter.documentExists(prereqPhase);
      if (!exists) {
        missingPrerequisites.push(prereqPhase);
      }
    }

    if (missingPrerequisites.length > 0) {
      const missingNames = missingPrerequisites.map(p => PHASE_NAMES[p]).join(', ');
      errors.push(`Workflow ${toolName} requires completed phases: ${missingNames}`);
    }

    // Skip workflow concurrency check - tools are now stateless
    // Allow concurrent workflow execution

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      missingPrerequisites: missingPrerequisites.length > 0 ? missingPrerequisites : undefined
    };
  }

  /**
   * Generate content using template-based approach
   * This method uses the template system to generate structured content
   */
  private async generateContentWithTemplate(context: GenerationContext, request: GenerationRequest): Promise<string> {
    const { phase, userStories, previousPhases } = context;
    const phaseName = PHASE_NAMES[phase];
    
    console.log(`Generating template-based content for phase: ${phaseName}`);
    
    try {
      // Load template for this phase
      const templateData = await this.templateManager.loadTemplate(phase);
      console.log(`Loaded template for ${phaseName}: ${templateData.filePath}`);
      
      // Build the content using template structure and user stories
      return this.buildContentFromTemplate(templateData, context);
    } catch (error) {
      console.error(`Failed to generate template-based content for ${phaseName}:`, error);
      
      // Fallback to structured content generation for now
      console.log(`Falling back to structured content generation for ${phaseName}`);
      return this.generateStructuredContent(context);
    }
  }

  /**
   * Build content from template and context
   */
  private async buildContentFromTemplate(templateData: TemplateData, context: GenerationContext): Promise<string> {
    const { phase, userStories, previousPhases, workspace, timestamp } = context;
    const phaseName = PHASE_NAMES[phase];
    
    console.log(`Building content from template for ${phaseName}`);
    
    // For now, use a structured approach based on the template
    // In a full implementation, this would use the template as a prompt for LLM generation
    return this.generateStructuredContentWithTemplate(templateData, context);
  }

  /**
   * Generate structured content using template guidance
   */
  private generateStructuredContentWithTemplate(templateData: TemplateData, context: GenerationContext): string {
    const { phase, userStories, previousPhases, workspace, timestamp } = context;
    
    // Extract user stories title and description
    const userStoriesLines = userStories.split('\n').filter(line => line.trim());
    const projectTitle = userStoriesLines.find(line => line.startsWith('# '))?.replace('# ', '') || 'Project';
    const firstParagraph = userStoriesLines.find(line => !line.startsWith('#') && line.length > 20) || 'Project based on user requirements';
    
    switch (phase) {
      case Phase.README:
        return this.generateStructuredReadme(projectTitle, firstParagraph, userStories, context);
      case Phase.ROADMAP:
        return this.generateStructuredRoadmap(projectTitle, userStories, previousPhases[Phase.README] || '', context);
      case Phase.SYSTEM_ARCHITECTURE:
        return this.generateStructuredArchitecture(projectTitle, userStories, previousPhases, context);
      default:
        throw new Error(`Unsupported phase: ${phase}`);
    }
  }

  /**
   * Generate structured README content
   */
  private generateStructuredReadme(projectTitle: string, description: string, userStories: string, context: GenerationContext): string {
    const timestamp = new Date().toISOString();
    
    // Extract features from user stories
    const features = this.extractFeaturesFromUserStories(userStories);
    
    return `# ${projectTitle}

## Overview
${description}

## Features
${features.map(feature => `- ${feature}`).join('\n')}

## System Requirements
- Node.js 18.0.0 or higher
- npm or yarn package manager

## Dependencies
Core dependencies will be determined during development phase.

## Architecture
The system follows a modular architecture with clear separation of concerns:
- Frontend layer for user interactions
- Backend services for business logic
- Data layer for persistence

## Core Components
- User interface components
- API services
- Data models
- Authentication system

## Getting Started
1. Clone the repository
2. Install dependencies: \`npm install\`
3. Set up environment variables
4. Run the application: \`npm start\`

## Development
See ROADMAP.md for development phases and guidelines.

## Contributing
Please follow the established coding standards and create pull requests for any changes.

## License
TBD

---
*Generated on ${timestamp} from user stories*
*Workspace: ${context.workspace}*
`;
  }

  /**
   * Generate structured ROADMAP content
   */
  private generateStructuredRoadmap(projectTitle: string, userStories: string, readmeContent: string, context: GenerationContext): string {
    const timestamp = new Date().toISOString();
    
    // Extract features and requirements from user stories and README
    const features = this.extractFeaturesFromUserStories(userStories);
    const phases = this.generateDevelopmentPhases(features);
    
    return `# ${projectTitle} - Development Roadmap

## Project Overview
This roadmap outlines the development phases for ${projectTitle} based on the defined requirements and user stories.

## Development Strategy
The project will be developed in iterative phases, each building upon the previous phase to ensure systematic progress and early validation.

${phases.map((phase, index) => `## Phase ${index + 1}: ${phase.name} (${phase.timeline})
${phase.tasks.map(task => `- ${task}`).join('\n')}

### Deliverables
${phase.deliverables.map(deliverable => `- ${deliverable}`).join('\n')}
`).join('\n')}

## Milestones & Timeline
${phases.map((phase, index) => `- [ ] ${phase.timeline.split(' ')[1]}: ${phase.name} complete`).join('\n')}

## Resources Required
- Development team (2-3 developers)
- UI/UX designer
- QA testing environment
- Cloud infrastructure for deployment
- Database services

## Risk Mitigation Strategy
- Weekly progress reviews
- Continuous integration and testing
- Regular stakeholder communication
- Flexible scope management
- Documentation maintenance

## Success Criteria
- All user stories implemented and tested
- System performance meets requirements
- Documentation complete and up-to-date
- Production deployment successful

---
*Generated on ${timestamp} from user stories and README*
*Workspace: ${context.workspace}*
`;
  }

  /**
   * Generate structured SYSTEM_ARCHITECTURE content
   */
  private generateStructuredArchitecture(projectTitle: string, userStories: string, previousPhases: Record<Phase, string>, context: GenerationContext): string {
    const timestamp = new Date().toISOString();
    const readmeContent = previousPhases[Phase.README] || '';
    const roadmapContent = previousPhases[Phase.ROADMAP] || '';
    
    // Extract technical requirements from user stories
    const techStack = this.determineTechnologyStack(userStories);
    const components = this.extractSystemComponents(userStories);
    
    return `# ${projectTitle} - System Architecture

## Overview
This document defines the technical architecture for ${projectTitle}, providing a comprehensive view of system components, data flow, and technology decisions based on the requirements and development roadmap.

## Architecture Principles
- **Modularity**: Clear separation of concerns
- **Scalability**: Designed for growth
- **Maintainability**: Clean, readable code structure
- **Security**: Security-first approach
- **Performance**: Optimized for efficiency

## System Components

### Frontend Layer
- **User Interface**: React/Vue.js components
- **State Management**: Redux/Vuex for application state
- **Routing**: Client-side routing for SPA
- **API Integration**: Axios/Fetch for backend communication

### Backend Layer
- **API Gateway**: Express.js/FastAPI RESTful services
- **Business Logic**: Service layer with domain models
- **Authentication**: JWT-based auth system
- **Data Processing**: Background job processing

### Data Layer
- **Primary Database**: ${techStack.database}
- **Caching**: Redis for session and query caching
- **File Storage**: Cloud storage for media files
- **Data Models**: Normalized relational schema

## Technology Stack
- **Frontend**: ${techStack.frontend}
- **Backend**: ${techStack.backend}
- **Database**: ${techStack.database}
- **Infrastructure**: ${techStack.infrastructure}
- **DevOps**: Docker, CI/CD pipelines

## Data Flow Architecture
\`\`\`
User Interface → API Gateway → Service Layer → Data Layer
       ↑                                              ↓
   Response ←── Processing ←── Business Logic ←── Data Access
\`\`\`

### Request Flow
1. User interactions captured by frontend components
2. API calls routed through backend services
3. Business logic processes requests
4. Data layer handles persistence
5. Responses formatted and returned to frontend

## Security Architecture
- **Authentication**: Multi-factor authentication
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: Encryption at rest and in transit
- **Input Validation**: Comprehensive input sanitization
- **API Security**: Rate limiting, CORS, security headers

## Scalability Design
- **Horizontal Scaling**: Load balancer with multiple server instances
- **Database Scaling**: Read replicas and connection pooling
- **Caching Strategy**: Multi-layer caching (browser, CDN, application, database)
- **Microservices**: Modular services for independent scaling

## Development Architecture
- **Environment Separation**: Development, staging, production
- **CI/CD Pipeline**: Automated testing and deployment
- **Code Quality**: Linting, testing, code reviews
- **Documentation**: Auto-generated API docs

## Monitoring & Observability
- **Application Monitoring**: Performance metrics and health checks
- **Error Tracking**: Centralized logging and error reporting
- **Analytics**: User behavior and system usage tracking
- **Alerting**: Proactive monitoring and incident response

## Deployment Strategy
- **Containerization**: Docker containers for consistency
- **Orchestration**: Kubernetes for production deployment
- **Blue-Green Deployment**: Zero-downtime deployments
- **Rollback Strategy**: Quick rollback capabilities

## Maintenance & Operations
- **Backup Strategy**: Automated daily backups
- **Update Process**: Scheduled maintenance windows
- **Performance Tuning**: Regular optimization reviews
- **Security Patches**: Timely security updates

---
*Generated on ${timestamp} from user stories, README, and roadmap*
*Workspace: ${context.workspace}*
`;
  }

  /**
   * Generate structured content as fallback when template loading fails
   */
  private generateStructuredContent(context: GenerationContext): string {
    const { phase, userStories, previousPhases } = context;
    const phaseName = PHASE_NAMES[phase];
    
    console.log(`Generating fallback structured content for phase: ${phaseName}`);
    
    // Extract basic information from user stories
    const userStoriesLines = userStories.split('\n').filter(line => line.trim());
    const projectTitle = userStoriesLines.find(line => line.startsWith('# '))?.replace('# ', '') || 'Project';
    const firstParagraph = userStoriesLines.find(line => !line.startsWith('#') && line.length > 20) || 'Project based on user requirements';
    
    switch (phase) {
      case Phase.README:
        return this.generateStructuredReadme(projectTitle, firstParagraph, userStories, context);
      case Phase.ROADMAP:
        return this.generateStructuredRoadmap(projectTitle, userStories, previousPhases[Phase.README] || '', context);
      case Phase.SYSTEM_ARCHITECTURE:
        return this.generateStructuredArchitecture(projectTitle, userStories, previousPhases, context);
      default:
        throw new Error(`Unsupported phase: ${phase}`);
    }
  }

  /**
   * Extract features from user stories
   */
  private extractFeaturesFromUserStories(userStories: string): string[] {
    const lines = userStories.split('\n');
    const features: string[] = [];
    
    // Look for bullet points, numbered lists, or feature keywords
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        features.push(trimmed.substring(2));
      } else if (/^\d+\.\s/.test(trimmed)) {
        features.push(trimmed.replace(/^\d+\.\s/, ''));
      } else if (trimmed.toLowerCase().includes('feature') || trimmed.toLowerCase().includes('functionality')) {
        features.push(trimmed);
      }
    }
    
    // If no features found, generate generic ones
    if (features.length === 0) {
      features.push('User authentication and authorization');
      features.push('Core application functionality');
      features.push('Data management and persistence');
      features.push('User interface and experience');
    }
    
    return features.slice(0, 8); // Limit to first 8 features
  }

  /**
   * Generate development phases based on features
   */
  private generateDevelopmentPhases(features: string[]): Array<{
    name: string;
    timeline: string;
    tasks: string[];
    deliverables: string[];
  }> {
    return [
      {
        name: 'Foundation',
        timeline: 'Weeks 1-2',
        tasks: [
          'Set up development environment and project structure',
          'Initialize version control and CI/CD pipeline',
          'Create basic application framework',
          'Set up testing infrastructure'
        ],
        deliverables: [
          'Project repository with basic structure',
          'Development environment setup guide',
          'Initial CI/CD pipeline',
          'Basic testing framework'
        ]
      },
      {
        name: 'Core Features',
        timeline: 'Weeks 3-6',
        tasks: [
          'Implement authentication system',
          'Develop primary user interfaces',
          'Create core business logic',
          'Set up database and data models'
        ],
        deliverables: [
          'User authentication system',
          'Core application features',
          'Database schema and models',
          'API endpoints for core functionality'
        ]
      },
      {
        name: 'Feature Enhancement',
        timeline: 'Weeks 7-10',
        tasks: [
          'Implement advanced features',
          'Add user experience improvements',
          'Optimize performance',
          'Enhance security measures'
        ],
        deliverables: [
          'Complete feature set implementation',
          'Performance optimization',
          'Security audit and improvements',
          'User experience enhancements'
        ]
      },
      {
        name: 'Testing & Deployment',
        timeline: 'Weeks 11-12',
        tasks: [
          'Comprehensive system testing',
          'User acceptance testing',
          'Production environment setup',
          'Deployment and monitoring'
        ],
        deliverables: [
          'Test coverage reports',
          'Production deployment',
          'Monitoring and alerting setup',
          'Documentation completion'
        ]
      }
    ];
  }

  /**
   * Determine technology stack based on user stories
   */
  private determineTechnologyStack(userStories: string): {
    frontend: string;
    backend: string;
    database: string;
    infrastructure: string;
  } {
    const stories = userStories.toLowerCase();
    
    // Simple heuristics based on keywords in user stories
    const techStack = {
      frontend: 'React.js with TypeScript',
      backend: 'Node.js with Express.js',
      database: 'PostgreSQL with Redis caching',
      infrastructure: 'AWS/Docker containers'
    };
    
    // Adjust based on content (basic keyword matching)
    if (stories.includes('mobile') || stories.includes('ios') || stories.includes('android')) {
      techStack.frontend = 'React Native or Flutter';
    }
    
    if (stories.includes('python') || stories.includes('ml') || stories.includes('ai')) {
      techStack.backend = 'Python with FastAPI/Django';
    }
    
    if (stories.includes('nosql') || stories.includes('mongodb')) {
      techStack.database = 'MongoDB with Redis caching';
    }
    
    return techStack;
  }

  /**
   * Extract system components from user stories
   */
  private extractSystemComponents(userStories: string): string[] {
    const stories = userStories.toLowerCase();
    const components: string[] = [];
    
    // Basic component detection based on keywords
    if (stories.includes('user') || stories.includes('auth')) {
      components.push('User Management System');
    }
    if (stories.includes('data') || stories.includes('store')) {
      components.push('Data Storage Layer');
    }
    if (stories.includes('api') || stories.includes('service')) {
      components.push('API Services');
    }
    if (stories.includes('ui') || stories.includes('interface')) {
      components.push('User Interface Components');
    }
    
    return components.length > 0 ? components : ['Core Application Components'];
  }
}

// Export singleton instance for convenience
export const phaseManager = new PhaseManager();