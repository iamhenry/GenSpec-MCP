#!/usr/bin/env node

/**
 * Debug script for testing the exact validation flow used by GenSpec MCP server
 * This script imports and tests the ValidationManager class directly
 */

import { ValidationManager } from './dist/utils/validation.js';
import { join } from 'path';

// The problematic URL from the issue
const problematicUrl = "https://gist.githubusercontent.com/iamhenry/4ac4621241044c4f8d62c6240d42940b/raw/1240b4f59b3de68a75d89b0bbeb838bfca248aba/PlaylistPort%2520User%2520Stories.md";

console.log('=== VALIDATION FLOW DEBUG SCRIPT ===\n');

async function testValidationManager() {
    console.log('Creating ValidationManager instance...');
    
    // Use current directory as workspace
    const workspace = process.cwd();
    console.log('Workspace:', workspace);
    
    // Create ValidationManager with caching disabled for debugging
    const validationManager = new ValidationManager(workspace, false); // Disable cache
    
    console.log('\n=== Testing validateUserStories method ===');
    
    try {
        console.log('Calling validateUserStories with userStoryUri:', problematicUrl);
        
        const result = await validationManager.validateUserStories(undefined, problematicUrl);
        
        console.log('\n=== VALIDATION RESULT ===');
        console.log('Is Valid:', result.isValid);
        console.log('Source:', result.source);
        console.log('Errors:', result.errors);
        console.log('Warnings:', result.warnings);
        console.log('Recommendations:', result.recommendations);
        console.log('\nMetadata:');
        console.log('  - Content Length:', result.metadata?.contentLength);
        console.log('  - Word Count:', result.metadata?.wordCount);
        console.log('  - Section Count:', result.metadata?.sectionCount);
        console.log('  - Has Structure:', result.metadata?.hasStructure);
        console.log('  - Has Requirements:', result.metadata?.hasRequirements);
        console.log('  - Has Acceptance Criteria:', result.metadata?.hasAcceptanceCriteria);
        
        if (result.content) {
            console.log('\nContent Preview (first 300 characters):');
            console.log('"' + result.content.substring(0, 300) + '..."');
        } else {
            console.log('\nNo content returned!');
        }
        
        // Test the content validation specifically
        if (result.content) {
            console.log('\n=== DIRECT CONTENT VALIDATION TEST ===');
            const directResult = await testDirectContentValidation(result.content);
            console.log('Direct validation result:', directResult);
        }
        
        return result;
        
    } catch (error) {
        console.error('\n=== VALIDATION ERROR ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        return null;
    }
}

async function testDirectContentValidation(content) {
    console.log('Testing content validation directly...');
    console.log('Content length:', content.length);
    
    const trimmedContent = content.trim();
    const wordCount = trimmedContent.split(/\s+/).length;
    const sectionCount = (trimmedContent.match(/^#{1,6}\s/gm) || []).length;
    
    console.log('Analysis:');
    console.log('  - Trimmed length:', trimmedContent.length);
    console.log('  - Word count:', wordCount);
    console.log('  - Section count:', sectionCount);
    
    // Check validation conditions
    const validations = {
        notEmpty: trimmedContent.length > 0,
        minLength: trimmedContent.length >= 10,
        minWords: wordCount >= 5,
        reasonable: wordCount >= 20
    };
    
    console.log('Validation checks:');
    Object.entries(validations).forEach(([check, passed]) => {
        console.log(`  - ${check}: ${passed ? '✓' : '✗'}`);
    });
    
    return validations;
}

async function testGetUserStoryContent() {
    console.log('\n=== Testing getUserStoryContent method ===');
    
    const validationManager = new ValidationManager(process.cwd(), false);
    
    try {
        const content = await validationManager.getUserStoryContent(undefined, problematicUrl);
        console.log('✓ getUserStoryContent succeeded');
        console.log('Content length:', content.length);
        console.log('Word count:', content.trim().split(/\s+/).length);
        return content;
    } catch (error) {
        console.log('✗ getUserStoryContent failed');
        console.log('Error:', error.message);
        return null;
    }
}

async function testWithDifferentParameters() {
    console.log('\n=== Testing with different parameter combinations ===');
    
    const validationManager = new ValidationManager(process.cwd(), false);
    
    const testCases = [
        { userStory: undefined, userStoryUri: problematicUrl, label: 'Only URI' },
        { userStory: '', userStoryUri: problematicUrl, label: 'Empty string + URI' },
        { userStory: '   ', userStoryUri: problematicUrl, label: 'Whitespace + URI' },
        { userStory: null, userStoryUri: problematicUrl, label: 'Null + URI' }
    ];
    
    for (const testCase of testCases) {
        console.log(`\nTesting: ${testCase.label}`);
        console.log(`  userStory: ${JSON.stringify(testCase.userStory)}`);
        console.log(`  userStoryUri: ${testCase.userStoryUri}`);
        
        try {
            const result = await validationManager.validateUserStories(testCase.userStory, testCase.userStoryUri);
            console.log(`  Result: ${result.isValid ? '✓ Valid' : '✗ Invalid'}`);
            if (!result.isValid) {
                console.log(`  Errors: ${result.errors.join(', ')}`);
            }
            console.log(`  Word count: ${result.metadata?.wordCount || 0}`);
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
    }
}

async function testEnvironmentValidation() {
    console.log('\n=== Testing environment validation ===');
    
    const validationManager = new ValidationManager(process.cwd(), false);
    
    try {
        const envResult = await validationManager.validateEnvironment();
        console.log('Environment validation result:');
        console.log('  Is Valid:', envResult.isValid);
        console.log('  Errors:', envResult.errors);
        console.log('  Warnings:', envResult.warnings);
        console.log('  Checks:', envResult.checks);
    } catch (error) {
        console.log('Environment validation error:', error.message);
    }
}

async function main() {
    console.log('Starting comprehensive validation flow debugging...\n');
    
    // Test environment first
    await testEnvironmentValidation();
    
    // Test the main validation flow
    const validationResult = await testValidationManager();
    
    // Test getUserStoryContent method
    await testGetUserStoryContent();
    
    // Test with different parameter combinations
    await testWithDifferentParameters();
    
    console.log('\n=== SUMMARY ===');
    if (validationResult) {
        if (validationResult.isValid) {
            console.log('✓ Validation should work - no issues found in the validation flow');
            console.log('The error might be occurring in a different part of the system');
        } else {
            console.log('✗ Validation failed as reported');
            console.log('Issues found:', validationResult.errors.join(', '));
        }
    } else {
        console.log('✗ Validation threw an exception');
    }
    
    console.log('\nNext steps:');
    console.log('1. Check if the issue occurs during tool execution');
    console.log('2. Check if there are timing/async issues');
    console.log('3. Check if the error occurs in a different validation path');
}

// Run the comprehensive test
main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});