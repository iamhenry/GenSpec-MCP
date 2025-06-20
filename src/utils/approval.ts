import { PhaseNumber, TEMPLATE_MAPPINGS } from '../types.js';

export interface ApprovalResult {
  isApproval: boolean;
  feedback?: string;
  confidence: number; // 0-1 scale of how confident we are in the detection
}

export interface ApprovalPrompt {
  message: string;
  phase: PhaseNumber;
  outputFile: string;
  hasPreview?: boolean;
}

/**
 * ApprovalManager handles approval detection, edit feedback extraction,
 * and generates approval prompts for user interaction
 */
export class ApprovalManager {
  private approvalKeywords: string[] = [
    'approve',
    'approved',
    'ok',
    'okay',
    'yes',
    'confirm',
    'confirmed',
    'accept',
    'accepted',
    'good',
    'looks good',
    'lgtm',
    'ship it',
    'proceed',
    'continue',
    'next'
  ];

  private rejectionKeywords: string[] = [
    'no',
    'reject',
    'rejected',
    'deny',
    'denied',
    'change',
    'modify',
    'edit',
    'fix',
    'update',
    'revise',
    'redo',
    'regenerate',
    'not good',
    'needs work',
    'try again'
  ];

  /**
   * Detects if a message is an approval or contains edit feedback
   */
  detectApproval(message: string): ApprovalResult {
    if (!message || typeof message !== 'string') {
      return {
        isApproval: false,
        feedback: 'No message provided',
        confidence: 0
      };
    }

    const normalizedMessage = message.toLowerCase().trim();
    
    // Empty message is not an approval
    if (normalizedMessage.length === 0) {
      return {
        isApproval: false,
        feedback: 'Empty message',
        confidence: 1.0
      };
    }

    // Check for explicit approval keywords at the start
    const startsWithApproval = this.approvalKeywords.some(keyword => 
      normalizedMessage.startsWith(keyword.toLowerCase())
    );

    if (startsWithApproval) {
      // High confidence approval if message starts with approval keyword
      return {
        isApproval: true,
        confidence: 0.9
      };
    }

    // Check for single-word approvals
    if (this.approvalKeywords.includes(normalizedMessage)) {
      return {
        isApproval: true,
        confidence: 1.0
      };
    }

    // Check for explicit rejection keywords
    const containsRejection = this.rejectionKeywords.some(keyword =>
      normalizedMessage.includes(keyword.toLowerCase())
    );

    if (containsRejection) {
      return {
        isApproval: false,
        feedback: this.extractEditFeedback(message),
        confidence: 0.8
      };
    }

    // Check for short positive responses
    const shortPositivePatterns = [
      /^(yes|yep|yeah|yup|sure|fine)$/i,
      /^(👍|✅|✓|👌)$/,
      /^(good|great|perfect|excellent)$/i
    ];

    for (const pattern of shortPositivePatterns) {
      if (pattern.test(normalizedMessage)) {
        return {
          isApproval: true,
          confidence: 0.7
        };
      }
    }

    // Check for question-like feedback (likely edits)
    if (normalizedMessage.includes('?') || normalizedMessage.includes('how about') || 
        normalizedMessage.includes('what if') || normalizedMessage.includes('could you')) {
      return {
        isApproval: false,
        feedback: this.extractEditFeedback(message),
        confidence: 0.6
      };
    }

    // If message is longer than a few words, it's likely feedback
    if (normalizedMessage.split(' ').length > 5) {
      return {
        isApproval: false,
        feedback: this.extractEditFeedback(message),
        confidence: 0.5
      };
    }

    // Default: treat ambiguous short messages as feedback
    return {
      isApproval: false,
      feedback: this.extractEditFeedback(message),
      confidence: 0.3
    };
  }

  /**
   * Extracts edit feedback from non-approval messages
   */
  private extractEditFeedback(message: string): string {
    if (!message || typeof message !== 'string') {
      return 'Please provide more specific feedback.';
    }

    const trimmed = message.trim();
    
    // If message is very short, ask for more details
    if (trimmed.length < 10) {
      return `User feedback: "${trimmed}". Please provide more specific guidance on what changes are needed.`;
    }

    // Clean up the feedback message
    let feedback = trimmed;
    
    // Remove common rejection prefixes to get to the actual feedback
    const prefixesToRemove = [
      /^no,?\s*/i,
      /^not\s+good,?\s*/i,
      /^please\s+/i,
      /^can\s+you\s+/i,
      /^could\s+you\s+/i
    ];

    for (const prefix of prefixesToRemove) {
      feedback = feedback.replace(prefix, '');
    }

    // Ensure feedback starts with a capital letter
    if (feedback.length > 0) {
      feedback = feedback.charAt(0).toUpperCase() + feedback.slice(1);
    }

    return `User feedback: "${feedback}"`;
  }

  /**
   * Generates approval prompt for user interaction
   */
  generateApprovalPrompt(phase: PhaseNumber, generatedContent?: string): ApprovalPrompt {
    const config = TEMPLATE_MAPPINGS[phase];
    const phaseName = this.getPhaseDisplayName(phase);
    
    let message = `Generated ${phaseName} document (${config.outputFile}).\n\n`;
    
    if (generatedContent) {
      // Show preview of generated content
      const preview = this.createContentPreview(generatedContent);
      message += `Preview:\n${preview}\n\n`;
    }

    message += `To approve and continue: Reply with "approve", "ok", "yes", or similar.\n`;
    message += `To request changes: Provide specific feedback on what needs to be modified.\n\n`;
    message += `The document has been saved to _ai/docs/${config.outputFile}`;

    return {
      message,
      phase,
      outputFile: config.outputFile,
      hasPreview: !!generatedContent
    };
  }

  /**
   * Generates continuation prompt after approval
   */
  generateContinuationPrompt(currentPhase: PhaseNumber): string {
    const nextPhase = this.getNextPhase(currentPhase);
    
    if (!nextPhase) {
      return '✅ GenSpec workflow completed successfully! All documents have been generated.';
    }

    const nextPhaseDisplay = this.getPhaseDisplayName(nextPhase);
    const nextConfig = TEMPLATE_MAPPINGS[nextPhase];
    
    return `✅ ${this.getPhaseDisplayName(currentPhase)} approved. Proceeding to generate ${nextPhaseDisplay} (${nextConfig.outputFile})...`;
  }

  /**
   * Generates edit feedback prompt for regeneration
   */
  generateEditPrompt(phase: PhaseNumber, feedback: string): string {
    const phaseName = this.getPhaseDisplayName(phase);
    const config = TEMPLATE_MAPPINGS[phase];
    
    return `Regenerating ${phaseName} document with your feedback:\n${feedback}\n\nUpdating ${config.outputFile}...`;
  }

  /**
   * Creates a preview of generated content (first 500 characters + structure info)
   */
  private createContentPreview(content: string): string {
    if (!content || content.length === 0) {
      return '[Empty document]';
    }

    const lines = content.split('\n');
    const preview = content.substring(0, 500);
    const hasMore = content.length > 500;
    
    // Count headers to show document structure
    const headerCount = lines.filter(line => line.startsWith('#')).length;
    const structureInfo = headerCount > 0 ? ` (${headerCount} sections)` : '';
    
    return `${preview}${hasMore ? '\n\n[... content continues ...]' : ''}${structureInfo}`;
  }

  /**
   * Gets the display name for a phase
   */
  private getPhaseDisplayName(phase: PhaseNumber): string {
    switch (phase) {
      case 1:
        return 'README';
      case 2:
        return 'ROADMAP';
      case 3:
        return 'SYSTEM-ARCHITECTURE';
      default:
        return `Phase ${phase}`;
    }
  }

  /**
   * Gets the next phase in the workflow
   */
  private getNextPhase(currentPhase: PhaseNumber): PhaseNumber | null {
    switch (currentPhase) {
      case 1:
        return 2;
      case 2:
        return 3;
      case 3:
        return null; // No next phase
      default:
        return null;
    }
  }

  /**
   * Checks if approval confidence is high enough to proceed
   */
  isHighConfidenceApproval(result: ApprovalResult): boolean {
    return result.isApproval && result.confidence >= 0.7;
  }

  /**
   * Checks if we should ask for clarification due to low confidence
   */
  shouldAskForClarification(result: ApprovalResult): boolean {
    return result.confidence < 0.5;
  }

  /**
   * Generates clarification prompt for ambiguous responses
   */
  generateClarificationPrompt(originalMessage: string): string {
    return `I'm not sure if you want to approve or request changes. ` +
           `Your message: "${originalMessage}"\n\n` +
           `Please respond clearly with:\n` +
           `• "approve" or "ok" to accept the current document\n` +
           `• Specific feedback if you want changes made`;
  }
}