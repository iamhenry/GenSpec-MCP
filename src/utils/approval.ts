/**
 * Approval Detection System for GenSpec MCP Server
 * 
 * Handles approval message detection and edit feedback extraction
 * Supports case-insensitive whitelist/prefix matching for approval detection
 */

import { ApprovalResult } from '../types.js';
import { logger } from './logging.js';

export class ApprovalManager {
  // Case-insensitive approval whitelist and prefixes
  private static readonly APPROVAL_PATTERNS = [
    'approve',
    'approved', 
    'ok',
    'okay',
    'yes',
    'y',
    'lgtm'
  ];

  private static readonly MAX_EDIT_CYCLES = 5;

  constructor() {}

  /**
   * Detect if a message contains approval or extract edit feedback
   * Uses case-insensitive whitelist/prefix matching
   */
  detectApproval(message: string): ApprovalResult {
    logger.logDebug('Analyzing message for approval');
    
    if (!message || !message.trim()) {
      console.log('[ApprovalManager] Empty message received');
      return {
        isApproval: false,
        editFeedback: 'Please provide feedback or approval',
      };
    }

    const normalizedMessage = message.trim().toLowerCase();
    console.log(`[ApprovalManager] Normalized message: "${normalizedMessage.substring(0, 50)}..."`);

    // Check for exact matches or prefixes
    const isApproval = this.checkApprovalPatterns(normalizedMessage);

    if (isApproval) {
      console.log('[ApprovalManager] Approval detected');
      return {
        isApproval: true,
      };
    }

    // Not an approval - treat as edit feedback
    console.log('[ApprovalManager] No approval detected, treating as edit feedback');
    return {
      isApproval: false,
      editFeedback: message.trim(),
    };
  }

  /**
   * Check if message matches approval patterns (exact match or prefix)
   */
  private checkApprovalPatterns(normalizedMessage: string): boolean {
    // Check for exact word matches first
    const words = normalizedMessage.split(/\s+/);
    
    for (const word of words) {
      if (ApprovalManager.APPROVAL_PATTERNS.includes(word)) {
        console.log(`[ApprovalManager] Exact approval match found: "${word}"`);
        return true;
      }
    }

    // Check for prefix matches
    for (const pattern of ApprovalManager.APPROVAL_PATTERNS) {
      if (normalizedMessage.startsWith(pattern)) {
        console.log(`[ApprovalManager] Prefix approval match found: "${pattern}"`);
        return true;
      }
    }

    // Check if the entire message is just an approval pattern
    if (ApprovalManager.APPROVAL_PATTERNS.includes(normalizedMessage)) {
      console.log(`[ApprovalManager] Full message approval match: "${normalizedMessage}"`);
      return true;
    }

    return false;
  }

  /**
   * Process approval or extract edit feedback with cycle tracking
   */
  processApprovalCycle(message: string, currentCycle: number): ApprovalResult & { shouldAbort?: boolean; cycleCount: number } {
    console.log(`[ApprovalManager] Processing approval cycle ${currentCycle}/${ApprovalManager.MAX_EDIT_CYCLES}`);
    
    const result = this.detectApproval(message);
    const newCycleCount = result.isApproval ? 0 : currentCycle + 1;

    // Check if we've exceeded max edit cycles
    if (!result.isApproval && newCycleCount > ApprovalManager.MAX_EDIT_CYCLES) {
      console.log(`[ApprovalManager] Max edit cycles exceeded (${ApprovalManager.MAX_EDIT_CYCLES})`);
      return {
        ...result,
        shouldAbort: true,
        cycleCount: newCycleCount,
        editFeedback: `Maximum edit cycles exceeded (${ApprovalManager.MAX_EDIT_CYCLES}). Aborting generation.`,
      };
    }

    return {
      ...result,
      shouldAbort: false,
      cycleCount: newCycleCount,
    };
  }

  /**
   * Extract meaningful edit feedback from non-approval messages
   */
  extractEditFeedback(message: string): string {
    console.log('[ApprovalManager] Extracting edit feedback...');
    
    const trimmed = message.trim();
    
    if (!trimmed) {
      return 'Please provide specific feedback for improvements';
    }

    // If message is very short and not an approval, ask for more detail
    if (trimmed.length < 10) {
      return `Please provide more detailed feedback. You said: "${trimmed}"`;
    }

    // Clean up the feedback message
    let feedback = trimmed;
    
    // Remove common prefixes that don't add value
    const prefixesToRemove = [
      'no,',
      'nope,',
      'not quite,',
      'not good,',
      'please',
      'can you',
      'could you'
    ];

    for (const prefix of prefixesToRemove) {
      const regex = new RegExp(`^${prefix}\\s*`, 'i');
      feedback = feedback.replace(regex, '');
    }

    // Ensure feedback starts with capital letter
    if (feedback.length > 0) {
      feedback = feedback.charAt(0).toUpperCase() + feedback.slice(1);
    }

    // Ensure feedback ends with proper punctuation
    if (feedback.length > 0 && !/[.!?]$/.test(feedback)) {
      feedback += '.';
    }

    console.log(`[ApprovalManager] Extracted feedback: "${feedback}"`);
    return feedback;
  }

  /**
   * Validate approval patterns (used for testing/debugging)
   */
  static getApprovalPatterns(): string[] {
    return [...ApprovalManager.APPROVAL_PATTERNS];
  }

  /**
   * Get maximum edit cycles allowed
   */
  static getMaxEditCycles(): number {
    return ApprovalManager.MAX_EDIT_CYCLES;
  }

  /**
   * Test if a message would be detected as approval (utility method)
   */
  isApprovalMessage(message: string): boolean {
    return this.detectApproval(message).isApproval;
  }

  /**
   * Batch process multiple messages to find the first approval
   */
  findFirstApproval(messages: string[]): { foundApproval: boolean; approvalIndex?: number; allFeedback: string[] } {
    console.log(`[ApprovalManager] Processing batch of ${messages.length} messages`);
    
    const allFeedback: string[] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const result = this.detectApproval(messages[i]);
      
      if (result.isApproval) {
        console.log(`[ApprovalManager] Found approval at index ${i}`);
        return {
          foundApproval: true,
          approvalIndex: i,
          allFeedback,
        };
      }
      
      if (result.editFeedback) {
        allFeedback.push(result.editFeedback);
      }
    }
    
    console.log('[ApprovalManager] No approval found in batch');
    return {
      foundApproval: false,
      allFeedback,
    };
  }
}