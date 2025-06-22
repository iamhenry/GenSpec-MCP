/**
 * Unit tests for ValidationManager URL validation
 * 
 * PRIMARY FOCUS: Double-encoded URL bug regression test
 * 
 * Tests the fix for the double-encoding bug where URLs with %2520 (double-encoded spaces) 
 * would fail because they weren't properly decoded before fetching. The ValidationManager
 * now uses safeDecodeUrl() to handle multiple levels of URL encoding.
 * 
 * Bug: https://gist.githubusercontent.com/.../PlaylistPort%2520User%2520Stories.md
 * Fix: Decodes %2520 -> %20 -> space before making HTTP requests
 */

import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { ValidationManager } from '../validation.js';

// Mock fetch globally
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
vi.stubGlobal('fetch', mockFetch);

describe('ValidationManager URL Validation', () => {
  let validationManager: ValidationManager;

  beforeEach(() => {
    validationManager = new ValidationManager('/tmp/test-workspace', false); // Disable cache for tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should decode URLs with multiple levels of encoding', () => {
    // Test the private safeDecodeUrl method through the public interface
    // This verifies the core URL decoding logic
    
    // Access the private method for testing using TypeScript's type assertion
    const validationManagerAny = validationManager as any;
    
    // Test cases for different encoding levels
    const testCases = [
      {
        input: 'https://example.com/file%2520name.md',
        expected: 'https://example.com/file name.md',
        description: 'double-encoded space (%2520 -> %20 -> space)'
      },
      {
        input: 'https://example.com/file%20name.md',
        expected: 'https://example.com/file name.md',
        description: 'single-encoded space (%20 -> space)'
      },
      {
        input: 'https://example.com/filename.md',
        expected: 'https://example.com/filename.md',
        description: 'no encoding needed'
      },
      {
        input: 'https://example.com/file%252520name.md',
        expected: 'https://example.com/file name.md',
        description: 'triple-encoded limited to 3 iterations'
      }
    ];
    
    testCases.forEach(({ input, expected, description }) => {
      const result = validationManagerAny.safeDecodeUrl(input);
      expect(result).toBe(expected);
      console.log(`✓ ${description}: "${input}" -> "${result}"`);
    });
  });

  it('should handle the exact failing URL that caused the original bug', async () => {
    // EXACT REGRESSION TEST: This is the precise URL that was failing with "too few words" error
    // This URL contains %2520 (double-encoded spaces) that need proper decoding
    const exactFailingUrl = "https://gist.githubusercontent.com/iamhenry/4ac4621241044c4f8d62c6240d42940b/raw/1240b4f59b3de68a75d89b0bbeb838bfca248aba/PlaylistPort%2520User%2520Stories.md";
    
    // Mock the actual content that this URL returns
    const actualContent = `# PlaylistPort User Stories

## Core Features

### User Story 1: Playlist Transfer Between Services
**As a music enthusiast**, I want to transfer my playlists between different streaming services, so that I can switch platforms without losing my carefully curated music collections.

**Acceptance Criteria:**
- I can connect to multiple streaming services (Spotify, Apple Music, YouTube Music, etc.)
- I can select source and destination platforms
- The system transfers all available songs from my playlist
- I receive a detailed transfer report showing successful and failed transfers
- Missing songs are identified with alternative suggestions

### User Story 2: Playlist Backup and Export
**As a dedicated music collector**, I want to backup my playlists to prevent data loss, so that my years of curation work is preserved.

**Acceptance Criteria:**
- I can export playlists in multiple formats (JSON, CSV, M3U)
- Backup includes metadata (playlist name, description, creation date)
- I can schedule automatic backups
- Exported data includes track information, artists, albums, and timestamps

### User Story 3: Cross-Platform Playlist Sync
**As someone who uses multiple devices**, I want my playlists to stay synchronized across all platforms, so that I have consistent access to my music everywhere.

**Acceptance Criteria:**
- Real-time sync between connected platforms
- Conflict resolution for simultaneous edits
- Offline access to cached playlist data
- Sync status notifications and error handling

This represents a comprehensive music playlist management solution with robust transfer, backup, and synchronization capabilities.`;

    // Mock successful fetch response with realistic content
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => actualContent,
    } as Response);

    // This validation should now pass with the URL decoding fix
    const result = await validationManager.validateUserStories(undefined, exactFailingUrl);

    // Critical assertions: the validation should pass with sufficient word count
    expect(result.isValid).toBe(true);
    expect(result.source).toBe('uri');
    expect(result.content).toBe(actualContent);
    expect(result.metadata.wordCount).toBeGreaterThanOrEqual(5); // Must exceed minimum
    expect(result.metadata.wordCount).toBeGreaterThan(200); // Realistic expectation
    expect(result.errors).toHaveLength(0);
    
    // Verify fetch was called and URL was properly decoded
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchUrl = mockFetch.mock.calls[0][0] as string;
    
    // The critical fix: ensure double-encoding was removed
    expect(fetchUrl).not.toContain('%2520'); // No more double-encoding
    expect(fetchUrl).toContain('PlaylistPort User Stories.md'); // Properly decoded
    
    console.log(`✓ Exact failing URL test passed: ${result.metadata.wordCount} words found`);
  });

  it('should handle double-encoded URLs and fetch content successfully', async () => {
    // REGRESSION TEST: This is the exact problematic URL from the original bug report
    // The bug was that URLs with %2520 (double-encoded spaces) would fail because 
    // they weren't decoded before fetching. This test ensures the fix remains working.
    const doubleEncodedUrl = "https://gist.githubusercontent.com/iamhenry/4ac4621241044c4f8d62c6240d42940b/raw/1240b4f59b3de68a75d89b0bbeb838bfca248aba/PlaylistPort%2520User%2520Stories.md";
    
    // Mock realistic user story content that would be returned
    const mockUserStoryContent = `# PlaylistPort User Stories

## Core User Stories

### As a music enthusiast, I want to transfer my playlists between streaming services
**Story**: As a music enthusiast who uses multiple streaming platforms, I want to seamlessly transfer my carefully curated playlists from one service to another, so that I can switch platforms without losing my music collection.

**Acceptance Criteria**:
- Given I have a playlist on Spotify
- When I select "Transfer to Apple Music" 
- Then my playlist should be recreated on Apple Music with all available songs
- And I should receive a report showing which songs were successfully transferred

### As a user, I want to backup my playlists
**Story**: As someone who has spent years building playlists, I want to backup my music collections to prevent losing them due to service changes or account issues.

**Requirements**:
- Must support multiple streaming platforms
- Should provide export in standard formats
- Must handle large playlists (1000+ songs)`;

    // Mock successful fetch response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => mockUserStoryContent,
    } as Response);

    // Test the validation - this should now pass with the fixed implementation
    const result = await validationManager.validateUserStories(undefined, doubleEncodedUrl);

    // Verify the validation passes and content is properly retrieved
    expect(result.isValid).toBe(true);
    expect(result.source).toBe('uri');
    expect(result.content).toBe(mockUserStoryContent);
    expect(result.metadata.wordCount).toBeGreaterThan(100);
    expect(result.metadata.hasStructure).toBe(true);
    expect(result.metadata.hasRequirements).toBe(true);
    
    // Verify that fetch was called exactly once
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // CRITICAL ASSERTION: Verify the URL was properly decoded before fetching
    const fetchCallUrl = mockFetch.mock.calls[0][0] as string;
    console.log('Fetch called with URL:', fetchCallUrl);
    
    // The fix ensures URL is decoded: %2520 -> %20 -> actual space
    // Verify that the double-encoded %2520 was removed and properly decoded
    const hasDuplicateEncoding = fetchCallUrl.includes('%2520');
    const hasProperSpaceEncoding = fetchCallUrl.includes('PlaylistPort User Stories.md');
    
    if (hasDuplicateEncoding) {
      console.log('BUG: URL still contains double-encoded spaces (%2520)');
    } else {
      console.log('FIXED: URL was properly decoded before fetching');
    }
    
    // Verify the bug is fixed: no double-encoding in the actual fetch call
    expect(hasDuplicateEncoding).toBe(false);
    // Verify the URL was decoded to contain actual spaces (or single encoding)
    expect(hasProperSpaceEncoding).toBe(true);
  });

  it('should handle network failures gracefully during URL fetching', async () => {
    const problematicUrl = "https://gist.githubusercontent.com/invalid/PlaylistPort%2520User%2520Stories.md";
    
    // Mock network failure
    mockFetch.mockRejectedValueOnce(new Error('Network error: Failed to fetch'));
    
    const result = await validationManager.validateUserStories(undefined, problematicUrl);
    
    // Should return invalid result with appropriate error
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Failed to fetch from URL');
    expect(result.errors[0]).toContain('Network error');
    expect(result.source).toBe('uri');
    expect(result.metadata.wordCount).toBe(0);
  });

  it('should handle empty content from URL fetching', async () => {
    const validUrl = "https://example.com/empty%2520file.md";
    
    // Mock empty response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK', 
      text: async () => '',
    } as Response);
    
    const result = await validationManager.validateUserStories(undefined, validUrl);
    
    // Should fail validation due to empty content (actual implementation behavior)
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('URL returned empty content');
    expect(result.metadata.wordCount).toBe(0);
  });

  describe('Comprehensive URL handling scenarios', () => {
    it('should handle various URL encoding levels', async () => {
      const testCases = [
        { url: 'https://example.com/file%20name.md', desc: 'single encoding' },
        { url: 'https://example.com/file%2520name.md', desc: 'double encoding' },
        { url: 'https://example.com/file%252520name.md', desc: 'triple encoding' }
      ];

      const mockContent = 'This is a test user story with sufficient words for validation.';
      
      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => mockContent,
        } as Response);

        const result = await validationManager.validateUserStories(undefined, testCase.url);
        
        expect(result.isValid).toBe(true);
        expect(result.metadata.wordCount).toBeGreaterThanOrEqual(5);
        
        // Verify proper URL decoding
        const fetchUrl = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
        expect(fetchUrl).not.toContain('%2520');
        
        console.log(`✓ ${testCase.desc} handled correctly`);
      }
    });

    it('should handle HTTP error status codes', async () => {
      const errorCases = [
        { status: 404, statusText: 'Not Found' },
        { status: 403, statusText: 'Forbidden' },
        { status: 500, statusText: 'Internal Server Error' }
      ];

      for (const errorCase of errorCases) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: errorCase.status,
          statusText: errorCase.statusText,
        } as Response);

        const result = await validationManager.validateUserStories(undefined, 'https://example.com/test.md');
        
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain(`Failed to fetch URL: HTTP ${errorCase.status}`);
        expect(result.metadata.wordCount).toBe(0);
      }
    });

    it('should handle special characters in URLs beyond spaces', async () => {
      const specialCharUrls = [
        'https://example.com/file%26name.md', // & character
        'https://example.com/file%2Bname.md', // + character  
        'https://example.com/file%40name.md', // @ character
      ];

      const mockContent = 'Valid user story content with enough words to pass validation checks.';

      for (const url of specialCharUrls) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => mockContent,
        } as Response);

        const result = await validationManager.validateUserStories(undefined, url);
        expect(result.isValid).toBe(true);
        expect(result.metadata.wordCount).toBeGreaterThan(5);
      }
    });
  });

  describe('Word count validation edge cases', () => {
    it('should reject content with exactly 4 words', async () => {
      const shortContent = 'Only four words here';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => shortContent,
      } as Response);
      
      const result = await validationManager.validateUserStories(undefined, 'https://example.com/short.md');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User story has too few words (minimum 5 words)');
      expect(result.metadata.wordCount).toBe(4);
    });

    it('should accept content with exactly 5 words', async () => {
      const minimalContent = 'Exactly five words are here';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK', 
        text: async () => minimalContent,
      } as Response);
      
      const result = await validationManager.validateUserStories(undefined, 'https://example.com/minimal.md');
      
      expect(result.isValid).toBe(true);
      expect(result.metadata.wordCount).toBe(5);
      expect(result.errors).toHaveLength(0);
    });
  });
});