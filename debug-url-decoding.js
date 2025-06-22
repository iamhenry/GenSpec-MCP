#!/usr/bin/env node

/**
 * Debug script for investigating URL decoding issues in GenSpec MCP server
 * This script tests the URL decoding and fetching process to identify where the issue occurs
 */

import { readFileSync } from 'fs';

// The problematic URL from the issue
const problematicUrl = "https://gist.githubusercontent.com/iamhenry/4ac4621241044c4f8d62c6240d42940b/raw/1240b4f59b3de68a75d89b0bbeb838bfca248aba/PlaylistPort%2520User%2520Stories.md";

// Manually decoded version for comparison
const manuallyDecodedUrl = "https://gist.githubusercontent.com/iamhenry/4ac4621241044c4f8d62c6240d42940b/raw/1240b4f59b3de68a75d89b0bbeb838bfca248aba/PlaylistPort User Stories.md";

console.log('=== URL DECODING DEBUG SCRIPT ===\n');

/**
 * Replicate the safeDecodeUrl function from validation.ts
 */
function safeDecodeUrl(url) {
    console.log('[safeDecodeUrl] === URL DECODING DEBUG ===');
    console.log('[safeDecodeUrl] Input URL:', url);
    console.log('[safeDecodeUrl] URL length:', url.length);
    console.log('[safeDecodeUrl] Contains %2520:', url.includes('%2520'));
    console.log('[safeDecodeUrl] Contains %20:', url.includes('%20'));
    
    let decodedUrl = url;
    let previousUrl = '';
    let iterations = 0;
    const maxIterations = 3; // Prevent infinite loops
    
    // Keep decoding until we get a stable result or hit max iterations
    while (decodedUrl !== previousUrl && iterations < maxIterations) {
        previousUrl = decodedUrl;
        console.log(`[safeDecodeUrl] Decode iteration ${iterations + 1}:`);
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
            console.log(`[safeDecodeUrl] URL decoding failed at iteration ${iterations}:`, error);
            return previousUrl;
        }
        iterations++;
    }
    
    console.log(`[safeDecodeUrl] FINAL: URL decoded from "${url}" to "${decodedUrl}" in ${iterations} iterations`);
    return decodedUrl;
}

/**
 * Test URL validation similar to the validation logic
 */
function validateUrl(url) {
    console.log(`\n[validateUrl] Testing URL validation for: ${url}`);
    try {
        const urlObj = new URL(url);
        console.log(`[validateUrl] ✓ URL is valid`);
        console.log(`[validateUrl] Protocol: ${urlObj.protocol}`);
        console.log(`[validateUrl] Host: ${urlObj.host}`);
        console.log(`[validateUrl] Pathname: ${urlObj.pathname}`);
        return true;
    } catch (error) {
        console.log(`[validateUrl] ✗ URL is invalid:`, error.message);
        return false;
    }
}

/**
 * Test content fetching with detailed logging
 */
async function testFetch(url, label) {
    console.log(`\n[testFetch] ${label}`);
    console.log(`[testFetch] URL: ${url}`);
    
    try {
        console.log('[testFetch] Starting fetch...');
        const startTime = Date.now();
        
        const response = await fetch(url);
        const fetchTime = Date.now() - startTime;
        
        console.log(`[testFetch] Fetch completed in ${fetchTime}ms`);
        console.log(`[testFetch] Status: ${response.status} ${response.statusText}`);
        console.log(`[testFetch] Headers:`, Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            console.log('[testFetch] ✗ Fetch failed with non-OK status');
            return null;
        }
        
        console.log('[testFetch] Reading response text...');
        const content = await response.text();
        
        console.log(`[testFetch] ✓ Content retrieved successfully`);
        console.log(`[testFetch] Content length: ${content.length} characters`);
        console.log(`[testFetch] Content type: ${response.headers.get('content-type')}`);
        
        // Analyze content
        const trimmedContent = content.trim();
        const wordCount = trimmedContent.split(/\s+/).length;
        const lineCount = trimmedContent.split('\n').length;
        const hasMarkdownHeaders = trimmedContent.includes('#');
        
        console.log(`[testFetch] Content analysis:`);
        console.log(`  - Trimmed length: ${trimmedContent.length}`);
        console.log(`  - Word count: ${wordCount}`);
        console.log(`  - Line count: ${lineCount}`);
        console.log(`  - Has markdown headers: ${hasMarkdownHeaders}`);
        console.log(`  - First 200 characters: "${trimmedContent.substring(0, 200)}"`);
        console.log(`  - Last 200 characters: "${trimmedContent.substring(Math.max(0, trimmedContent.length - 200))}"`);
        
        // Check for common issues
        if (content.includes('404') || content.includes('Not Found')) {
            console.log('[testFetch] ⚠️  Content may indicate a 404 error');
        }
        
        if (content.includes('<html>') || content.includes('<!DOCTYPE')) {
            console.log('[testFetch] ⚠️  Content appears to be HTML instead of markdown');
        }
        
        // Test the validation logic
        if (wordCount < 5) {
            console.log('[testFetch] ✗ VALIDATION FAILURE: Content has too few words (minimum 5 words)');
            console.log('[testFetch] This matches the error reported in the issue!');
        } else {
            console.log('[testFetch] ✓ Content passes word count validation');
        }
        
        return content;
        
    } catch (error) {
        console.log(`[testFetch] ✗ Fetch failed with error:`, error.message);
        console.log(`[testFetch] Error type:`, error.constructor.name);
        if (error.cause) {
            console.log(`[testFetch] Error cause:`, error.cause);
        }
        return null;
    }
}

/**
 * Test decoding behavior with different encoding patterns
 */
function testDecodingPatterns() {
    console.log('\n=== TESTING DECODING PATTERNS ===');
    
    const testUrls = [
        "PlaylistPort%2520User%2520Stories.md",  // Double encoded
        "PlaylistPort%20User%20Stories.md",      // Single encoded
        "PlaylistPort User Stories.md",          // Not encoded
        "%2520",  // Just the double-encoded space
        "%20",    // Just the single-encoded space
        " ",      // Just a space
    ];
    
    testUrls.forEach((testUrl, index) => {
        console.log(`\nTest ${index + 1}: "${testUrl}"`);
        const decoded = safeDecodeUrl(testUrl);
        console.log(`Result: "${decoded}"`);
    });
}

/**
 * Main test execution
 */
async function main() {
    console.log('Testing URL decoding for GenSpec MCP server...\n');
    
    // Test decoding patterns
    testDecodingPatterns();
    
    // Test the problematic URL decoding
    console.log('\n=== TESTING PROBLEMATIC URL ===');
    const decodedUrl = safeDecodeUrl(problematicUrl);
    
    // Validate both URLs
    console.log('\n=== URL VALIDATION TESTS ===');
    const originalValid = validateUrl(problematicUrl);
    const decodedValid = validateUrl(decodedUrl);
    const manualValid = validateUrl(manuallyDecodedUrl);
    
    console.log(`\nValidation results:`);
    console.log(`- Original URL valid: ${originalValid}`);
    console.log(`- Auto-decoded URL valid: ${decodedValid}`);
    console.log(`- Manually decoded URL valid: ${manualValid}`);
    
    // Test fetching with all variations
    console.log('\n=== FETCH TESTS ===');
    
    const results = await Promise.allSettled([
        testFetch(problematicUrl, 'ORIGINAL URL (double-encoded)'),
        testFetch(decodedUrl, 'AUTO-DECODED URL'),
        testFetch(manuallyDecodedUrl, 'MANUALLY DECODED URL')
    ]);
    
    console.log('\n=== FETCH RESULTS SUMMARY ===');
    results.forEach((result, index) => {
        const labels = ['Original', 'Auto-decoded', 'Manual'];
        if (result.status === 'fulfilled') {
            const content = result.value;
            if (content) {
                const wordCount = content.trim().split(/\s+/).length;
                console.log(`${labels[index]} URL: ✓ Success (${wordCount} words)`);
            } else {
                console.log(`${labels[index]} URL: ✗ Failed (no content)`);
            }
        } else {
            console.log(`${labels[index]} URL: ✗ Error (${result.reason})`);
        }
    });
    
    console.log('\n=== DIAGNOSIS ===');
    console.log('If one URL works and another doesn\'t, we\'ve found the issue!');
    console.log('Check the fetch results above to see which URL retrieves the content properly.');
}

// Run the tests
main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});