/**
 * Track B Integration Code for Track A
 * 
 * This file contains the integration functions that Track A should import
 * and use in src/server.ts to replace the placeholder implementations.
 */

import { 
  listTemplateResources, 
  readTemplateResource, 
  templateManager 
} from './templates.js';
import { documentWriter } from './fileWriter.js';
import { Phase } from '../types.js';

/**
 * MCP Resource Handler for Track A to replace the placeholder in setupResourceHandlers()
 * 
 * Usage in src/server.ts:
 * Replace the ListResourcesRequestSchema handler with:
 * this.server.setRequestHandler(ListResourcesRequestSchema, handleListResourcesRequest);
 */
export async function handleListResourcesRequest() {
  try {
    const templateResources = await listTemplateResources();
    
    return {
      resources: templateResources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }))
    };
  } catch (error) {
    console.error('[Track B] Failed to list template resources:', error);
    // Return empty array to prevent MCP errors
    return { resources: [] };
  }
}

/**
 * MCP Resource Reader for Track A to replace the placeholder in setupResourceHandlers()
 * 
 * Usage in src/server.ts:
 * Replace the ReadResourceRequestSchema handler with:
 * this.server.setRequestHandler(ReadResourceRequestSchema, handleReadResourceRequest);
 */
export async function handleReadResourceRequest(request: { params: { uri: string } }) {
  const { uri } = request.params;
  
  try {
    if (uri.startsWith('template://')) {
      const result = await readTemplateResource(uri);
      
      if (!result) {
        throw new Error(`Template not found: ${uri}`);
      }
      
      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: result.contents[0].text
          }
        ]
      };
    }
    
    throw new Error(`Unsupported resource URI: ${uri}`);
  } catch (error) {
    console.error(`[Track B] Failed to read resource ${uri}:`, error);
    throw new Error(`Failed to read resource: ${uri}`);
  }
}

/**
 * Utility function for Track A to ensure _ai/docs/ directory exists
 * 
 * Usage: Call this before any document generation operations
 */
export async function ensureDocsDirectory(): Promise<void> {
  try {
    await documentWriter.ensureOutputDirectory();
  } catch (error) {
    console.error('[Track B] Failed to ensure docs directory:', error);
    throw error;
  }
}

/**
 * Utility function for Track A to validate template system
 * 
 * Usage: Call this during server initialization to validate templates
 */
export function validateTemplateSystem(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // Check if templates directory exists
    if (!templateManager.checkTemplatesDirectory()) {
      errors.push(`Templates directory not found: ${templateManager.getTemplatesPath()}`);
    }
    
    // Validate individual template files
    const validation = templateManager.validateTemplates();
    if (!validation.isValid) {
      validation.missingFiles.forEach(file => {
        errors.push(`Missing template file: ${file}`);
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Template validation error: ${errorMessage}`);
    return {
      isValid: false,
      errors
    };
  }
}

/**
 * Utility function for Track A to validate output directory
 * 
 * Usage: Call this during server initialization to validate output directory
 */
export async function validateOutputDirectory(): Promise<{ isValid: boolean; error?: string }> {
  try {
    return await documentWriter.validateOutputDirectory();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      isValid: false,
      error: errorMessage
    };
  }
}

/**
 * Integration helper for Track C - Load template for phase
 * 
 * Usage: Track C can use this to get template content for generation
 */
export async function getTemplateForPhase(phase: Phase): Promise<string> {
  try {
    const template = await templateManager.loadTemplate(phase);
    return template.content;
  } catch (error) {
    console.error(`[Track B] Failed to load template for phase ${phase}:`, error);
    throw error;
  }
}

/**
 * Integration helper for Track C - Write generated document
 * 
 * Usage: Track C can use this to write generated content to files
 */
export async function writeGeneratedDocument(phase: Phase, content: string, workspace?: string) {
  try {
    return await documentWriter.writeDocument(phase, content, workspace);
  } catch (error) {
    console.error(`[Track B] Failed to write document for phase ${phase}:`, error);
    throw error;
  }
}

/**
 * Integration helper for Track D - Check if document exists
 * 
 * Usage: Track D can use this for prerequisite validation
 */
export function checkDocumentExists(phase: Phase): boolean {
  return documentWriter.documentExists(phase);
}

/**
 * Integration helper - Get all document statuses
 * 
 * Usage: For status checking and validation across tracks
 */
export function getDocumentStatuses(): Array<{ phase: Phase; exists: boolean; filePath: string }> {
  return documentWriter.listDocuments().map(doc => ({
    phase: doc.phase,
    exists: doc.exists,
    filePath: doc.filePath
  }));
}