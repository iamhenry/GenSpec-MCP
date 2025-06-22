/**
 * Enhanced Input Validation System for GenSpec MCP Server
 * 
 * Handles comprehensive validation of user stories, prerequisites, environment checks,
 * dependency validation, and content integration validation
 * Priority order for user stories: userStory inline → userStoryUri → local USER-STORIES.md
 */

import { readFileSync, existsSync, accessSync, constants, promises as fs } from 'fs';
import { resolve, join, isAbsolute } from 'path';
import { URL } from 'url';
import {
  Phase,
  ValidationResult,
  ComprehensiveValidationResult,
  EnvironmentValidationResult,
  UserStoryValidationResult,
  DependencyValidationResult,
  GenSpecError,
  WORKFLOW_DEPENDENCIES,
  PHASE_OUTPUT_FILES,
  PHASE_TEMPLATE_FILES,
} from '../types.js';
import { logger } from './logging.js';
import { DocumentWriter } from './fileWriter.js';

export class ValidationManager {
  private workspace: string;
  private templatesDir: string;
  private docsDir: string;
  private validationCache: Map<string, { result: any; timestamp: number }> = new Map();
  private cacheEnabled: boolean;
  private maxCacheAge: number;
  private fileWriter: DocumentWriter;

  constructor(workspace: string = process.cwd(), cacheEnabled: boolean = true, maxCacheAge: number = 2 * 60 * 1000) {
    this.workspace = workspace;
    this.templatesDir = join(workspace, 'templates');
    this.docsDir = join(workspace, '_ai', 'docs');
    this.cacheEnabled = cacheEnabled;
    this.maxCacheAge = maxCacheAge;
    this.fileWriter = new DocumentWriter(this.docsDir);
  }

  /**
   * Comprehensive user story validation with enhanced analysis
   * Priority order: userStory inline → userStoryUri → local USER-STORIES.md
   */
  async validateUserStories(userStory?: string, userStoryUri?: string): Promise<UserStoryValidationResult> {
    console.log('[ValidationManager] === VALIDATION DEBUG START ===');
    console.log('[ValidationManager] Arguments received:');
    console.log('  userStory:', userStory ? `"${userStory.substring(0, 100)}..."` : 'undefined');
    console.log('  userStoryUri:', userStoryUri || 'undefined');
    console.log('  workspace:', this.workspace);
    
    logger.logInfo('Validating user stories...');
    
    const cacheKey = `user_stories_${userStory ? 'inline' : ''}${userStoryUri || ''}${this.workspace}`;
    
    // Check cache first
    if (this.cacheEnabled) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        console.log('[ValidationManager] Returning cached result');
        return cached as UserStoryValidationResult;
      }
    }

    let result: UserStoryValidationResult;

    // Priority 1: Check inline userStory
    if (userStory && userStory.trim()) {
      console.log('[ValidationManager] FLOW: Using inline userStory argument');
      result = await this.validateUserStoryContent(userStory, 'inline');
    }
    // Priority 2: Check userStoryUri
    else if (userStoryUri) {
      console.log('[ValidationManager] FLOW: Using userStoryUri argument');
      console.log('[ValidationManager] About to call validateUserStoryUri with:', userStoryUri);
      result = await this.validateUserStoryUri(userStoryUri);
    }
    // Priority 3: Fallback to local USER-STORIES.md
    else {
      const userStoriesPath = join(this.workspace, 'USER-STORIES.md');
      console.log(`[ValidationManager] FLOW: Checking local USER-STORIES.md at: ${userStoriesPath}`);
      result = await this.validateLocalUserStories(userStoriesPath);
    }

    // Cache the result
    if (this.cacheEnabled) {
      this.setCachedResult(cacheKey, result);
    }

    console.log('[ValidationManager] === VALIDATION DEBUG END ===');
    console.log('[ValidationManager] Final result:', {
      isValid: result.isValid,
      source: result.source,
      wordCount: result.metadata.wordCount,
      errorCount: result.errors.length,
      errors: result.errors
    });

    return result;
  }

  /**
   * Enhanced phase prerequisites validation with detailed feedback
   */
  validatePhasePrerequisites(toolName: string, completedPhases: Phase[]): ComprehensiveValidationResult {
    console.log(`[ValidationManager] Validating prerequisites for tool: ${toolName}`);
    
    const dependency = WORKFLOW_DEPENDENCIES[toolName];
    if (!dependency) {
      return {
        isValid: false,
        error: `ERR_VALIDATION_FAILED: Unknown tool: ${toolName}`,
        warnings: ['Verify tool name is spelled correctly'],
        recommendations: ['Available tools: ' + Object.keys(WORKFLOW_DEPENDENCIES).join(', ')],
        metadata: {
          source: 'validation',
          contentLength: 0,
          wordCount: 0,
          lastValidated: new Date()
        }
      };
    }

    const { prerequisites } = dependency;
    const missingPrerequisites = prerequisites.filter(phase => !completedPhases.includes(phase));
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check quality of completed phases
    for (const phase of completedPhases) {
      const outputFile = PHASE_OUTPUT_FILES[phase];
      const outputPath = join(this.docsDir, outputFile);
      
      if (existsSync(outputPath)) {
        try {
          const content = readFileSync(outputPath, 'utf-8');
          const wordCount = content.split(/\s+/).length;
          
          if (wordCount < 100) {
            warnings.push(`${outputFile} seems quite short (${wordCount} words), consider expanding it`);
          }
          
          if (!content.includes('#')) {
            warnings.push(`${outputFile} lacks structure (no headers), consider adding sections`);
          }
        } catch (error) {
          warnings.push(`Cannot analyze content quality of ${outputFile}`);
        }
      }
    }

    if (missingPrerequisites.length > 0) {
      console.log(`[ValidationManager] Missing prerequisites: ${missingPrerequisites.join(', ')}`);
      
      // Generate specific recommendations
      const missingFiles = missingPrerequisites.map(phase => PHASE_OUTPUT_FILES[phase]);
      recommendations.push(`Generate missing files: ${missingFiles.join(', ')}`);
      
      return {
        isValid: false,
        error: 'ERR_MISSING_PREREQUISITES',
        missingPrerequisites,
        warnings,
        recommendations,
        metadata: {
          source: 'validation',
          contentLength: 0,
          wordCount: 0,
          lastValidated: new Date()
        }
      };
    }

    if (warnings.length === 0) {
      recommendations.push('All prerequisites satisfied and content quality looks good!');
    } else {
      recommendations.push('Consider improving prerequisite content quality before proceeding');
    }

    console.log('[ValidationManager] All prerequisites satisfied');
    return { 
      isValid: true,
      warnings,
      recommendations,
      metadata: {
        source: 'validation',
        contentLength: completedPhases.length,
        wordCount: completedPhases.length,
        lastValidated: new Date()
      }
    };
  }

  /**
   * Comprehensive environment validation with detailed analysis
   */
  async validateEnvironment(): Promise<EnvironmentValidationResult> {
    console.log('[ValidationManager] Validating environment...');
    
    const cacheKey = `environment_${this.workspace}`;
    
    // Check cache first
    if (this.cacheEnabled) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached as EnvironmentValidationResult;
      }
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const checks = {
      templatesDirectory: false,
      templateFiles: false,
      outputDirectory: false,
      permissions: false,
      dependencies: false
    };

    // Check templates directory
    const templateDirCheck = await this.validateTemplatesDirectory();
    checks.templatesDirectory = templateDirCheck.isValid;
    if (!templateDirCheck.isValid) {
      errors.push(...templateDirCheck.errors);
    }
    warnings.push(...templateDirCheck.warnings);

    // Check template files
    const templateFilesCheck = await this.validateTemplateFiles();
    checks.templateFiles = templateFilesCheck.isValid;
    if (!templateFilesCheck.isValid) {
      errors.push(...templateFilesCheck.errors);
    }
    warnings.push(...templateFilesCheck.warnings);

    // Check output directory
    const outputDirCheck = await this.validateOutputDirectory();
    checks.outputDirectory = outputDirCheck.isValid;
    if (!outputDirCheck.isValid) {
      errors.push(...outputDirCheck.errors);
    }
    warnings.push(...outputDirCheck.warnings);

    // Check permissions
    const permissionsCheck = await this.validatePermissions();
    checks.permissions = permissionsCheck.isValid;
    if (!permissionsCheck.isValid) {
      errors.push(...permissionsCheck.errors);
    }
    warnings.push(...permissionsCheck.warnings);

    // Check dependencies
    const dependenciesCheck = await this.validateDependencies();
    checks.dependencies = dependenciesCheck.isValid;
    if (!dependenciesCheck.isValid) {
      errors.push(...dependenciesCheck.errors);
    }
    warnings.push(...dependenciesCheck.warnings);

    // Generate recommendations
    if (errors.length === 0) {
      recommendations.push('Environment validation passed! All systems are ready for generation workflows.');
    } else {
      recommendations.push('Fix the identified errors before running generation workflows.');
    }

    if (warnings.length > 0) {
      recommendations.push('Consider addressing the warnings to improve system reliability.');
    }

    const totalChecks = Object.keys(checks).length;
    const passedChecks = Object.values(checks).filter(check => check).length;
    const failedChecks = totalChecks - passedChecks;

    const result: EnvironmentValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      checks,
      recommendations,
      summary: {
        totalChecks,
        passedChecks,
        failedChecks,
        warningCount: warnings.length
      }
    };

    console.log(`[ValidationManager] Environment validation completed: ${passedChecks}/${totalChecks} checks passed`);
    
    // Cache the result
    if (this.cacheEnabled) {
      this.setCachedResult(cacheKey, result);
    }

    return result;
  }

  /**
   * Enhanced dependency matrix validation with detailed analysis
   */
  async validateDependencyMatrix(toolName: string): Promise<DependencyValidationResult> {
    console.log(`[ValidationManager] Validating dependency matrix for: ${toolName}`);
    
    const cacheKey = `dependency_matrix_${toolName}_${this.workspace}`;
    
    // Check cache first
    if (this.cacheEnabled) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached as DependencyValidationResult;
      }
    }

    const errors: string[] = [];
    const missingDependencies: string[] = [];
    const availableDependencies: string[] = [];
    const recommendations: string[] = [];
    
    const dependency = WORKFLOW_DEPENDENCIES[toolName];
    if (!dependency) {
      errors.push(`Tool ${toolName} not found in dependency matrix`);
      return {
        isValid: false,
        errors,
        missingDependencies,
        availableDependencies,
        dependencyGraph: {},
        recommendations: ['Verify tool name is correct and supported by the system']
      };
    }

    const completedPhases = this.getCompletedPhases();
    const dependencyGraph: Record<string, string[]> = {};
    
    // Build dependency graph
    for (const [tool, deps] of Object.entries(WORKFLOW_DEPENDENCIES)) {
      dependencyGraph[tool] = deps.prerequisites.map(phase => PHASE_OUTPUT_FILES[phase]);
    }

    // Check each prerequisite
    for (const requiredPhase of dependency.prerequisites) {
      const outputFile = PHASE_OUTPUT_FILES[requiredPhase];
      
      if (completedPhases.includes(requiredPhase)) {
        availableDependencies.push(outputFile);
      } else {
        missingDependencies.push(outputFile);
        errors.push(`Missing prerequisite phase ${requiredPhase} (${outputFile})`);
      }
    }

    // Generate recommendations
    if (missingDependencies.length > 0) {
      recommendations.push(`Run prerequisite commands to generate: ${missingDependencies.join(', ')}`);
      
      // Suggest specific commands based on missing dependencies
      const missingPhases = dependency.prerequisites.filter(phase => !completedPhases.includes(phase));
      for (const phase of missingPhases) {
        switch (phase) {
          case Phase.README:
            recommendations.push('Run "generate_readme" or "start_genspec" to create README.md');
            break;
          case Phase.ROADMAP:
            recommendations.push('Run "generate_roadmap" to create ROADMAP.md (requires README.md)');
            break;
          case Phase.SYSTEM_ARCHITECTURE:
            recommendations.push('Run "generate_architecture" to create SYSTEM-ARCHITECTURE.md (requires README.md and ROADMAP.md)');
            break;
        }
      }
    } else {
      recommendations.push(`All prerequisites satisfied for ${toolName}`);
    }

    const result: DependencyValidationResult = {
      isValid: missingDependencies.length === 0,
      errors,
      missingDependencies,
      availableDependencies,
      dependencyGraph,
      recommendations
    };

    console.log(`[ValidationManager] Dependency validation completed: ${availableDependencies.length}/${dependency.prerequisites.length} dependencies satisfied`);
    
    // Cache the result
    if (this.cacheEnabled) {
      this.setCachedResult(cacheKey, result);
    }

    return result;
  }

  /**
   * Get completed phases with enhanced analysis and validation
   */
  getCompletedPhases(): Phase[] {
    console.log('[ValidationManager] Checking completed phases...');
    
    const cacheKey = `completed_phases_${this.workspace}`;
    
    // Check cache first (shorter cache time for this data)
    if (this.cacheEnabled) {
      const cached = this.getCachedResult(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 30000) { // 30 second cache
        return cached as Phase[];
      }
    }
    
    if (!existsSync(this.docsDir)) {
      console.log('[ValidationManager] Docs directory does not exist, no phases completed');
      return [];
    }

    const completedPhases: Phase[] = [];
    
    for (const [phase, outputFile] of Object.entries(PHASE_OUTPUT_FILES)) {
      const outputPath = join(this.docsDir, outputFile);
      if (existsSync(outputPath)) {
        try {
          const content = readFileSync(outputPath, 'utf-8');
          const trimmedContent = content.trim();
          
          if (trimmedContent) {
            // Additional quality checks
            const wordCount = trimmedContent.split(/\s+/).length;
            const hasStructure = trimmedContent.includes('#');
            
            if (wordCount >= 10) { // Minimum viable content
              completedPhases.push(parseInt(phase) as Phase);
              console.log(`[ValidationManager] Found completed phase: ${phase} (${outputFile}) - ${wordCount} words, ${hasStructure ? 'structured' : 'unstructured'}`);
            } else {
              console.log(`[ValidationManager] Phase ${phase} file exists but content too short (${wordCount} words)`);
            }
          } else {
            console.log(`[ValidationManager] Phase ${phase} file exists but is empty`);
          }
        } catch (error) {
          console.log(`[ValidationManager] Error reading ${outputFile}: ${error}`);
        }
      }
    }

    console.log(`[ValidationManager] Completed phases: ${completedPhases.join(', ')}`);
    
    // Cache the result with shorter TTL
    if (this.cacheEnabled) {
      this.setCachedResult(cacheKey, completedPhases);
    }
    
    return completedPhases;
  }

  /**
   * Get detailed phase completion status with quality metrics
   */
  getDetailedPhaseStatus(): Array<{
    phase: Phase;
    isComplete: boolean;
    outputFile: string;
    filePath: string;
    exists: boolean;
    wordCount: number;
    hasStructure: boolean;
    quality: 'excellent' | 'good' | 'fair' | 'poor' | 'empty';
    lastModified?: Date;
  }> {
    const phases = [Phase.README, Phase.ROADMAP, Phase.SYSTEM_ARCHITECTURE];
    const statusList = [];

    for (const phase of phases) {
      const outputFile = PHASE_OUTPUT_FILES[phase];
      const filePath = join(this.docsDir, outputFile);
      const exists = existsSync(filePath);
      
      let wordCount = 0;
      let hasStructure = false;
      let quality: 'excellent' | 'good' | 'fair' | 'poor' | 'empty' = 'empty';
      let lastModified: Date | undefined;
      
      if (exists) {
        try {
          const content = readFileSync(filePath, 'utf-8').trim();
          
          if (content) {
            wordCount = content.split(/\s+/).length;
            hasStructure = content.includes('#');
            
            // Determine quality based on content analysis
            if (wordCount >= 500 && hasStructure) {
              quality = 'excellent';
            } else if (wordCount >= 200 && hasStructure) {
              quality = 'good';
            } else if (wordCount >= 50) {
              quality = 'fair';
            } else if (wordCount >= 10) {
              quality = 'poor';
            }
            
            try {
              // Would need fs.stat for real lastModified
              lastModified = new Date();
            } catch {
              // Ignore stat errors
            }
          }
        } catch (error) {
          console.log(`Error analyzing ${outputFile}:`, error);
        }
      }
      
      statusList.push({
        phase,
        isComplete: exists && wordCount >= 10,
        outputFile,
        filePath,
        exists,
        wordCount,
        hasStructure,
        quality,
        lastModified
      });
    }
    
    return statusList;
  }

  /**
   * Get user story content from the highest priority source with enhanced error handling
   */
  async getUserStoryContent(userStory?: string, userStoryUri?: string): Promise<string> {
    console.log('[ValidationManager] Getting user story content...');

    const validation = await this.validateUserStories(userStory, userStoryUri);
    
    if (!validation.isValid) {
      throw new Error(`ERR_VALIDATION_FAILED: ${validation.errors.join(', ')}`);
    }

    if (validation.content) {
      console.log(`[ValidationManager] Using ${validation.source} user story source`);
      return validation.content;
    }

    throw new Error('ERR_MISSING_USER_STORIES: No user stories available');
  }

  /**
   * Validate user story content and extract metadata
   */
  private async validateUserStoryContent(content: string, source: 'inline' | 'uri' | 'local_file'): Promise<UserStoryValidationResult> {
    console.log('[ValidationManager] === CONTENT VALIDATION DEBUG ===');
    console.log('[ValidationManager] Source:', source);
    console.log('[ValidationManager] Content length:', content?.length || 0);
    console.log('[ValidationManager] Content preview (first 100 chars):', content?.substring(0, 100) || 'undefined');
    
    // CRITICAL FIX: If the "content" is actually a URL, redirect to URI validation
    if (source === 'inline' && content && (content.startsWith('http://') || content.startsWith('https://'))) {
      console.log('[ValidationManager] REDIRECT: Inline content is a URL, redirecting to URI validation');
      return await this.validateUserStoryUri(content);
    }
    
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Basic validation
    if (!content || content.trim().length === 0) {
      console.log('[ValidationManager] ERROR: Content is empty or undefined');
      errors.push('User story content is empty');
      return {
        isValid: false,
        source,
        errors,
        warnings,
        metadata: {
          contentLength: 0,
          wordCount: 0,
          sectionCount: 0,
          hasStructure: false,
          hasRequirements: false,
          hasAcceptanceCriteria: false
        },
        recommendations
      };
    }

    const trimmedContent = content.trim();
    const wordCount = trimmedContent.split(/\s+/).length;
    const sectionCount = (trimmedContent.match(/^#{1,6}\s/gm) || []).length;
    const hasStructure = sectionCount > 0;
    const hasRequirements = /\b(requirement|must|should|shall)\b/i.test(trimmedContent);
    const hasAcceptanceCriteria = /\b(acceptance criteria|given|when|then|scenario)\b/i.test(trimmedContent);

    console.log('[ValidationManager] Analysis results:');
    console.log('  Trimmed length:', trimmedContent.length);
    console.log('  Word count:', wordCount);
    console.log('  Section count:', sectionCount);
    console.log('  Has structure:', hasStructure);
    console.log('  Has requirements:', hasRequirements);
    console.log('  Has acceptance criteria:', hasAcceptanceCriteria);

    // Content quality validation
    if (trimmedContent.length < 10) {
      console.log('[ValidationManager] ERROR: Content too short (<10 chars)');
      errors.push('User story content too short (minimum 10 characters)');
    } else if (trimmedContent.length < 50) {
      console.log('[ValidationManager] WARNING: Content very short (<50 chars)');
      warnings.push('User story content is very short, consider adding more detail');
    }

    if (wordCount < 5) {
      console.log('[ValidationManager] ERROR: Too few words (<5)');
      errors.push(`User story has too few words (minimum 5 words). Received ${wordCount} words from source: ${source}. Content preview: "${trimmedContent.substring(0, 100)}"`);
    } else if (wordCount < 20) {
      console.log('[ValidationManager] WARNING: Content brief (<20 words)');
      warnings.push('User story is quite brief, consider adding more context');
    }

    if (!hasStructure && wordCount > 100) {
      recommendations.push('Consider structuring long user stories with headers for better readability');
    }

    if (!hasRequirements) {
      warnings.push('User story lacks explicit requirements (use keywords like must, should, requirement)');
      recommendations.push('Add clear requirements using words like "must", "should", or "requirement"');
    }

    if (!hasAcceptanceCriteria && wordCount > 50) {
      recommendations.push('Consider adding acceptance criteria (Given/When/Then format) for better clarity');
    }

    // Content structure analysis
    if (trimmedContent.includes('As a') || trimmedContent.includes('As an')) {
      recommendations.push('Great! User story follows standard "As a..." format');
    } else if (wordCount > 20) {
      recommendations.push('Consider using standard user story format: "As a [user], I want [goal] so that [benefit]"');
    }

    return {
      isValid: errors.length === 0,
      source,
      content: trimmedContent,
      errors,
      warnings,
      metadata: {
        contentLength: trimmedContent.length,
        wordCount,
        sectionCount,
        hasStructure,
        hasRequirements,
        hasAcceptanceCriteria
      },
      recommendations
    };
  }

  /**
   * Safely decode URL with support for multiple levels of encoding
   * This handles cases where URLs are double-encoded (e.g., %2520 -> %20 -> space)
   */
  private safeDecodeUrl(url: string): string {
    console.log('[ValidationManager] === URL DECODING DEBUG ===');
    console.log('[ValidationManager] Input URL:', url);
    console.log('[ValidationManager] URL length:', url.length);
    console.log('[ValidationManager] Contains %2520:', url.includes('%2520'));
    console.log('[ValidationManager] Contains %20:', url.includes('%20'));
    console.log('[ValidationManager] Raw URL bytes:', Array.from(url).map(c => c.charCodeAt(0)).join(','));
    
    let decodedUrl = url;
    let previousUrl = '';
    let iterations = 0;
    const maxIterations = 3; // Prevent infinite loops
    
    // Keep decoding until we get a stable result or hit max iterations
    while (decodedUrl !== previousUrl && iterations < maxIterations) {
      previousUrl = decodedUrl;
      console.log(`[ValidationManager] Decode iteration ${iterations + 1}:`);
      console.log('  Before:', decodedUrl);
      
      try {
        // Only decode if it contains encoded characters
        if (decodedUrl.includes('%')) {
          decodedUrl = decodeURIComponent(decodedUrl);
          console.log('  After decode:', decodedUrl);
        } else {
          console.log('  No % characters, skipping decode');
        }
      } catch (error) {
        // If decoding fails, return the last valid version
        console.log(`[ValidationManager] URL decoding failed at iteration ${iterations}:`, error);
        return previousUrl;
      }
      iterations++;
    }
    
    console.log(`[ValidationManager] FINAL: URL decoded from "${url}" to "${decodedUrl}" in ${iterations} iterations`);
    return decodedUrl;
  }

  /**
   * Write user story content to local USER-STORIES.md file
   */
  private async writeUserStoriesToLocal(content: string): Promise<void> {
    try {
      const userStoriesPath = join(this.workspace, 'USER-STORIES.md');
      console.log(`[ValidationManager] Writing user story content to ${userStoriesPath}`);
      
      await fs.writeFile(userStoriesPath, content, 'utf-8');
      console.log(`[ValidationManager] Successfully wrote USER-STORIES.md (${content.length} characters)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ValidationManager] Failed to write USER-STORIES.md:`, errorMessage);
      // Don't throw here - this is a nice-to-have feature, not critical
    }
  }

  /**
   * Validate user story URI and attempt to fetch if it's a URL
   */
  private async validateUserStoryUri(userStoryUri: string): Promise<UserStoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check if it's a valid URL
      if (userStoryUri.startsWith('http://') || userStoryUri.startsWith('https://')) {
        // Decode the URL safely to handle double-encoding issues
        const decodedUri = this.safeDecodeUrl(userStoryUri);
        
        // Validate the decoded URL is still valid
        try {
          const url = new URL(decodedUri);
          console.log(`[ValidationManager] Fetching from decoded URL: ${decodedUri}`);
        } catch (urlError) {
          errors.push(`Invalid URL after decoding: ${decodedUri}`);
          return {
            isValid: false,
            source: 'uri',
            errors,
            warnings,
            metadata: {
              contentLength: 0,
              wordCount: 0,
              sectionCount: 0,
              hasStructure: false,
              hasRequirements: false,
              hasAcceptanceCriteria: false
            },
            recommendations
          };
        }
        
        // Fetch content from decoded URL
        try {
          console.log('[ValidationManager] Starting fetch...');
          console.log('[ValidationManager] Final URL being fetched:', decodedUri);
          const response = await fetch(decodedUri);
          console.log('[ValidationManager] Fetch completed. Status:', response.status, response.statusText);
          
          if (!response.ok) {
            console.log('[ValidationManager] ERROR: Fetch failed with status:', response.status);
            errors.push(`Failed to fetch URL: HTTP ${response.status} ${response.statusText}`);
            return {
              isValid: false,
              source: 'uri',
              errors,
              warnings,
              metadata: {
                contentLength: 0,
                wordCount: 0,
                sectionCount: 0,
                hasStructure: false,
                hasRequirements: false,
                hasAcceptanceCriteria: false
              },
              recommendations
            };
          }
          
          console.log('[ValidationManager] Reading response text...');
          const content = await response.text();
          console.log('[ValidationManager] Response text length:', content.length);
          console.log('[ValidationManager] First 200 chars:', content.substring(0, 200));
          console.log('[ValidationManager] Content type:', response.headers.get('content-type'));
          
          if (!content || content.trim().length === 0) {
            console.log('[ValidationManager] ERROR: Content is empty');
            errors.push('URL returned empty content');
            return {
              isValid: false,
              source: 'uri',
              errors,
              warnings,
              metadata: {
                contentLength: 0,
                wordCount: 0,
                sectionCount: 0,
                hasStructure: false,
                hasRequirements: false,
                hasAcceptanceCriteria: false
              },
              recommendations
            };
          }
          
          console.log('[ValidationManager] Content retrieved successfully, validating...');
          console.log('[ValidationManager] About to call validateUserStoryContent with content length:', content.length);
          // Validate the fetched content
          const contentValidation = await this.validateUserStoryContent(content, 'uri');
          console.log('[ValidationManager] Content validation result:', {
            isValid: contentValidation.isValid,
            wordCount: contentValidation.metadata.wordCount,
            contentLength: contentValidation.metadata.contentLength,
            errors: contentValidation.errors,
            warnings: contentValidation.warnings
          });
          
          // If content validation passes, write to local USER-STORIES.md file
          if (contentValidation.isValid) {
            await this.writeUserStoriesToLocal(content);
          }
          
          return {
            isValid: contentValidation.isValid,
            source: 'uri',
            content: content,
            errors: [...errors, ...contentValidation.errors],
            warnings: [...warnings, ...contentValidation.warnings],
            metadata: contentValidation.metadata,
            recommendations: [...recommendations, ...contentValidation.recommendations]
          };
          
        } catch (fetchError) {
          const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
          errors.push(`Failed to fetch from URL: ${errorMessage}`);
          return {
            isValid: false,
            source: 'uri',
            errors,
            warnings,
            metadata: {
              contentLength: 0,
              wordCount: 0,
              sectionCount: 0,
              hasStructure: false,
              hasRequirements: false,
              hasAcceptanceCriteria: false
            },
            recommendations
          };
        }
      } else {
        // Treat as local file path
        const filePath = isAbsolute(userStoryUri) ? userStoryUri : join(this.workspace, userStoryUri);
        return await this.validateLocalUserStories(filePath);
      }
    } catch (error) {
      errors.push(`Invalid userStoryUri format: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        isValid: false,
        source: 'uri',
        errors,
        warnings,
        metadata: {
          contentLength: 0,
          wordCount: 0,
          sectionCount: 0,
          hasStructure: false,
          hasRequirements: false,
          hasAcceptanceCriteria: false
        },
        recommendations
      };
    }
  }

  /**
   * Validate local user stories file
   */
  private async validateLocalUserStories(filePath: string): Promise<UserStoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (!existsSync(filePath)) {
      errors.push(`User stories file not found: ${filePath}`);
      recommendations.push('Create USER-STORIES.md file or provide user stories inline');
      
      return {
        isValid: false,
        source: 'local_file',
        errors,
        warnings,
        metadata: {
          contentLength: 0,
          wordCount: 0,
          sectionCount: 0,
          hasStructure: false,
          hasRequirements: false,
          hasAcceptanceCriteria: false
        },
        recommendations
      };
    }

    try {
      accessSync(filePath, constants.R_OK);
      const content = readFileSync(filePath, 'utf-8');
      return await this.validateUserStoryContent(content, 'local_file');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Cannot read user stories file: ${errorMessage}`);
      
      return {
        isValid: false,
        source: 'local_file',
        errors,
        warnings,
        metadata: {
          contentLength: 0,
          wordCount: 0,
          sectionCount: 0,
          hasStructure: false,
          hasRequirements: false,
          hasAcceptanceCriteria: false
        },
        recommendations
      };
    }
  }

  /**
   * Validate templates directory
   */
  private async validateTemplatesDirectory(): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!existsSync(this.templatesDir)) {
      errors.push(`Templates directory not found: ${this.templatesDir}`);
      return { isValid: false, errors, warnings };
    }

    try {
      const stats = await fs.stat(this.templatesDir);
      if (!stats.isDirectory()) {
        errors.push(`Templates path is not a directory: ${this.templatesDir}`);
        return { isValid: false, errors, warnings };
      }

      // Check permissions
      try {
        await fs.access(this.templatesDir, constants.R_OK);
      } catch {
        errors.push(`Templates directory is not readable: ${this.templatesDir}`);
      }
    } catch (error) {
      errors.push(`Error accessing templates directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate template files
   */
  private async validateTemplateFiles(): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [phase, templateFile] of Object.entries(PHASE_TEMPLATE_FILES)) {
      const templatePath = join(this.templatesDir, templateFile);
      
      if (!existsSync(templatePath)) {
        errors.push(`Missing template file: ${templateFile}`);
        continue;
      }

      try {
        await fs.access(templatePath, constants.R_OK);
        
        // Check if file is empty
        const stats = await fs.stat(templatePath);
        if (stats.size === 0) {
          errors.push(`Template file is empty: ${templateFile}`);
        } else if (stats.size < 100) {
          warnings.push(`Template file is very small: ${templateFile} (${stats.size} bytes)`);
        }
      } catch {
        errors.push(`Cannot read template file: ${templateFile}`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate output directory
   */
  private async validateOutputDirectory(): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Create output directory if it doesn't exist
    if (!existsSync(this.docsDir)) {
      try {
        await fs.mkdir(this.docsDir, { recursive: true });
        warnings.push(`Created output directory: ${this.docsDir}`);
      } catch (error) {
        errors.push(`Cannot create output directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return { isValid: false, errors, warnings };
      }
    }

    try {
      const stats = await fs.stat(this.docsDir);
      if (!stats.isDirectory()) {
        errors.push(`Output path is not a directory: ${this.docsDir}`);
        return { isValid: false, errors, warnings };
      }

      // Check write permissions
      try {
        await fs.access(this.docsDir, constants.W_OK);
      } catch {
        errors.push(`Output directory is not writable: ${this.docsDir}`);
      }
    } catch (error) {
      errors.push(`Error accessing output directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate workspace permissions
   */
  private async validatePermissions(): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check workspace read permission
      await fs.access(this.workspace, constants.R_OK);
    } catch {
      errors.push(`Workspace is not readable: ${this.workspace}`);
    }

    try {
      // Check workspace write permission
      await fs.access(this.workspace, constants.W_OK);
    } catch {
      errors.push(`Workspace is not writable: ${this.workspace}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate system dependencies
   */
  private async validateDependencies(): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check Node.js version
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
      
      if (majorVersion < 18) {
        warnings.push(`Node.js version ${nodeVersion} is below recommended version 18.x`);
      }
    } catch {
      warnings.push('Could not determine Node.js version');
    }

    // Check if we have required permissions for file operations
    try {
      const testFile = join(this.workspace, '.genspec-test-write');
      await fs.writeFile(testFile, 'test', 'utf-8');
      await fs.unlink(testFile);
    } catch {
      errors.push('Cannot perform file write operations in workspace');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Cache management methods
   */
  private getCachedResult(key: string): any | null {
    if (!this.cacheEnabled) return null;
    
    const cached = this.validationCache.get(key);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.maxCacheAge) {
      this.validationCache.delete(key);
      return null;
    }
    
    return cached.result;
  }

  private setCachedResult(key: string, result: any): void {
    if (!this.cacheEnabled) return;
    
    this.validationCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    enabled: boolean;
    size: number;
    maxAge: number;
  } {
    return {
      enabled: this.cacheEnabled,
      size: this.validationCache.size,
      maxAge: this.maxCacheAge
    };
  }

  /**
   * Set cache configuration
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }

  setMaxCacheAge(maxAge: number): void {
    this.maxCacheAge = maxAge;
  }
}