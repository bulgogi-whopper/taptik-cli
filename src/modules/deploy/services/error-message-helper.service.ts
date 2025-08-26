import { Injectable } from '@nestjs/common';

import { DeploymentError } from '../interfaces/deployment-result.interface';
import { SupportedPlatform } from '../interfaces/deploy-options.interface';
import { HelpDocumentationService, ErrorDocumentation } from './help-documentation.service';

export interface EnhancedError extends DeploymentError {
  errorCode?: string;
  timestamp: string;
  context?: Record<string, any>;
  solutions?: Array<{
    title: string;
    steps: string[];
    automated?: boolean;
  }>;
  relatedDocs?: string[];
  quickFix?: string;
}

export interface ErrorAnalysis {
  errorCategory: 'configuration' | 'platform' | 'network' | 'permission' | 'validation' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRecoverable: boolean;
  estimatedFixTime: string;
  automaticFixAvailable: boolean;
  preventionTips: string[];
  similarErrors: string[];
}

export interface ErrorMessageTemplate {
  code: string;
  template: string;
  variables: string[];
  examples: Array<{
    input: Record<string, any>;
    output: string;
  }>;
}

@Injectable()
export class ErrorMessageHelperService {
  private readonly errorTemplates: Map<string, ErrorMessageTemplate> = new Map();
  private readonly errorMappings: Map<string, string> = new Map();
  
  constructor(private readonly helpService: HelpDocumentationService) {
    this.initializeErrorTemplates();
    this.initializeErrorMappings();
  }

  /**
   * Enhance a basic deployment error with solutions and documentation
   */
  enhanceError(
    error: DeploymentError,
    platform?: SupportedPlatform,
    context?: Record<string, any>,
  ): EnhancedError {
    const errorCode = this.detectErrorCode(error, platform, context);
    const documentation = errorCode ? this.helpService.getErrorDocumentation(errorCode) : null;
    
    const enhanced: EnhancedError = {
      ...error,
      errorCode,
      timestamp: new Date().toISOString(),
      context,
    };

    if (documentation) {
      enhanced.solutions = documentation.solutions.map(solution => ({
        title: solution.title,
        steps: solution.steps,
        automated: this.canAutomate(solution.title),
      }));
      enhanced.relatedDocs = documentation.relatedErrors;
      enhanced.quickFix = this.generateQuickFix(error, documentation);
    } else {
      enhanced.solutions = this.generateGenericSolutions(error, platform);
      enhanced.quickFix = this.generateGenericQuickFix(error);
    }

    return enhanced;
  }

  /**
   * Analyze error patterns and provide recommendations
   */
  analyzeError(error: DeploymentError, platform?: SupportedPlatform): ErrorAnalysis {
    const category = this.categorizeError(error, platform);
    const severity = this.assessSeverity(error, category);
    const isRecoverable = this.isRecoverable(error, category);
    
    return {
      errorCategory: category,
      severity,
      isRecoverable,
      estimatedFixTime: this.estimateFixTime(category, severity),
      automaticFixAvailable: this.hasAutomaticFix(error, category),
      preventionTips: this.getPreventionTips(category, platform),
      similarErrors: this.findSimilarErrors(error.message),
    };
  }

  /**
   * Generate user-friendly error message with solutions
   */
  generateUserFriendlyMessage(
    error: DeploymentError,
    platform?: SupportedPlatform,
    includeDetails: boolean = true,
  ): string {
    const enhanced = this.enhanceError(error, platform);
    const analysis = this.analyzeError(error, platform);
    
    const lines: string[] = [];
    
    // Error header
    lines.push(`🚨 ${this.getSeverityEmoji(analysis.severity)} ${error.message}`);
    
    if (enhanced.errorCode) {
      lines.push(`   Error Code: ${enhanced.errorCode}`);
    }
    
    if (platform) {
      lines.push(`   Platform: ${platform}`);
    }
    
    lines.push(`   Category: ${analysis.errorCategory}`);
    lines.push('');

    // Quick fix
    if (enhanced.quickFix) {
      lines.push('🔧 Quick Fix:');
      lines.push(`   ${enhanced.quickFix}`);
      lines.push('');
    }

    // Solutions
    if (enhanced.solutions && enhanced.solutions.length > 0) {
      lines.push('💡 Solutions:');
      enhanced.solutions.forEach((solution, index) => {
        const automatedIcon = solution.automated ? '🤖' : '👤';
        lines.push(`   ${index + 1}. ${automatedIcon} ${solution.title}`);
        solution.steps.forEach((step, stepIndex) => {
          lines.push(`      ${stepIndex + 1}. ${step}`);
        });
        lines.push('');
      });
    }

    // Additional details
    if (includeDetails) {
      if (analysis.preventionTips.length > 0) {
        lines.push('🛡️  Prevention Tips:');
        analysis.preventionTips.forEach((tip) => {
          lines.push(`   • ${tip}`);
        });
        lines.push('');
      }

      if (enhanced.relatedDocs && enhanced.relatedDocs.length > 0) {
        lines.push('📚 Related Documentation:');
        enhanced.relatedDocs.forEach((doc) => {
          lines.push(`   • ${doc}`);
        });
        lines.push('');
      }

      lines.push('ℹ️  Additional Information:');
      lines.push(`   • Estimated fix time: ${analysis.estimatedFixTime}`);
      lines.push(`   • Recoverable: ${analysis.isRecoverable ? 'Yes' : 'No'}`);
      lines.push(`   • Automatic fix: ${analysis.automaticFixAvailable ? 'Available' : 'Not available'}`);
    }

    return lines.join('\n');
  }

  /**
   * Suggest automated fixes for common errors
   */
  suggestAutomatedFix(error: DeploymentError, platform?: SupportedPlatform): {
    available: boolean;
    command?: string;
    description?: string;
    risks?: string[];
  } {
    const errorCode = this.detectErrorCode(error, platform);
    
    if (!errorCode) {
      return { available: false };
    }

    // Platform-specific automated fixes
    switch (errorCode) {
      case 'CURSOR_NOT_FOUND':
        return {
          available: true,
          command: 'taptik deploy --platform cursor-ide --cursor-path /path/to/cursor',
          description: 'Retry deployment with custom Cursor path',
          risks: ['Ensure the specified path is correct'],
        };
        
      case 'WORKSPACE_NOT_FOUND':
        return {
          available: true,
          command: 'mkdir -p ./workspace && taptik deploy --workspace-path ./workspace',
          description: 'Create workspace directory and retry deployment',
          risks: ['Directory will be created with default permissions'],
        };
        
      case 'AI_CONFIG_INVALID':
        return {
          available: true,
          command: 'taptik deploy --skip-ai-config',
          description: 'Skip AI configuration and deploy other components',
          risks: ['AI features will not be configured'],
        };
        
      case 'PERMISSION_DENIED':
        if (platform === 'cursor-ide') {
          return {
            available: true,
            command: 'sudo taptik deploy --platform cursor-ide',
            description: 'Retry deployment with elevated permissions',
            risks: ['Running with elevated permissions', 'May modify system files'],
          };
        }
        break;
    }

    return { available: false };
  }

  /**
   * Generate error message from template
   */
  generateFromTemplate(
    templateCode: string,
    variables: Record<string, any>,
  ): string {
    const template = this.errorTemplates.get(templateCode);
    if (!template) {
      return `Unknown error template: ${templateCode}`;
    }

    let message = template.template;
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return message;
  }

  /**
   * Validate error message templates
   */
  validateTemplate(templateCode: string, variables: Record<string, any>): {
    valid: boolean;
    missingVariables: string[];
    extraVariables: string[];
  } {
    const template = this.errorTemplates.get(templateCode);
    if (!template) {
      return {
        valid: false,
        missingVariables: [],
        extraVariables: Object.keys(variables),
      };
    }

    const requiredVars = new Set(template.variables);
    const providedVars = new Set(Object.keys(variables));
    
    const missingVariables = Array.from(requiredVars).filter(v => !providedVars.has(v));
    const extraVariables = Array.from(providedVars).filter(v => !requiredVars.has(v));

    return {
      valid: missingVariables.length === 0,
      missingVariables,
      extraVariables,
    };
  }

  /**
   * Get error statistics and patterns
   */
  getErrorStatistics(errors: DeploymentError[]): {
    totalErrors: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    byPlatform: Record<string, number>;
    mostCommon: Array<{ message: string; count: number }>;
    trends: Array<{ pattern: string; frequency: number }>;
  } {
    const stats = {
      totalErrors: errors.length,
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      byPlatform: {} as Record<string, number>,
      mostCommon: [] as Array<{ message: string; count: number }>,
      trends: [] as Array<{ pattern: string; frequency: number }>,
    };

    const messageCounts = new Map<string, number>();
    
    for (const error of errors) {
      // Count by severity
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      
      // Count message frequency
      messageCounts.set(error.message, (messageCounts.get(error.message) || 0) + 1);
      
      // Analyze category and platform (would need additional context)
      const category = this.categorizeError(error);
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    }

    // Find most common errors
    stats.mostCommon = Array.from(messageCounts.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  // Private helper methods

  private initializeErrorTemplates(): void {
    this.errorTemplates.set('PLATFORM_NOT_FOUND', {
      code: 'PLATFORM_NOT_FOUND',
      template: '{{platform}} is not installed or not found in PATH. Please install {{platform}} or specify custom path with --{{platform}}-path',
      variables: ['platform'],
      examples: [
        {
          input: { platform: 'Cursor IDE' },
          output: 'Cursor IDE is not installed or not found in PATH. Please install Cursor IDE or specify custom path with --cursor-path',
        },
      ],
    });

    this.errorTemplates.set('COMPONENT_INVALID', {
      code: 'COMPONENT_INVALID',
      template: 'Component "{{component}}" is not valid for platform {{platform}}. Valid components: {{validComponents}}',
      variables: ['component', 'platform', 'validComponents'],
      examples: [
        {
          input: { 
            component: 'invalid-component', 
            platform: 'cursor-ide', 
            validComponents: 'ai-config, workspace-settings, extensions' 
          },
          output: 'Component "invalid-component" is not valid for platform cursor-ide. Valid components: ai-config, workspace-settings, extensions',
        },
      ],
    });

    this.errorTemplates.set('WORKSPACE_PERMISSION_DENIED', {
      code: 'WORKSPACE_PERMISSION_DENIED',
      template: 'Permission denied accessing workspace "{{workspacePath}}". Please check file permissions or run with elevated privileges',
      variables: ['workspacePath'],
      examples: [
        {
          input: { workspacePath: '/path/to/workspace' },
          output: 'Permission denied accessing workspace "/path/to/workspace". Please check file permissions or run with elevated privileges',
        },
      ],
    });
  }

  private initializeErrorMappings(): void {
    // Map common error patterns to error codes
    this.errorMappings.set(/cursor.*not found/i.source, 'CURSOR_NOT_FOUND');
    this.errorMappings.set(/workspace.*not found/i.source, 'WORKSPACE_NOT_FOUND');
    this.errorMappings.set(/permission denied/i.source, 'PERMISSION_DENIED');
    this.errorMappings.set(/invalid.*component/i.source, 'COMPONENT_INVALID');
    this.errorMappings.set(/ai.*config.*invalid/i.source, 'AI_CONFIG_INVALID');
    this.errorMappings.set(/network.*error/i.source, 'NETWORK_ERROR');
    this.errorMappings.set(/timeout/i.source, 'TIMEOUT_ERROR');
    this.errorMappings.set(/file.*not found/i.source, 'FILE_NOT_FOUND');
    this.errorMappings.set(/syntax.*error/i.source, 'SYNTAX_ERROR');
    this.errorMappings.set(/validation.*failed/i.source, 'VALIDATION_ERROR');
  }

  private detectErrorCode(
    error: DeploymentError,
    platform?: SupportedPlatform,
    context?: Record<string, any>,
  ): string | undefined {
    // First check for explicit error codes in the error object
    if ('code' in error && error.code) {
      return error.code as string;
    }

    // Check error message patterns
    for (const [pattern, code] of this.errorMappings.entries()) {
      if (new RegExp(pattern, 'i').test(error.message)) {
        return code;
      }
    }

    // Platform-specific detection
    if (platform === 'cursor-ide') {
      if (error.message.includes('cursor') && error.message.includes('not found')) {
        return 'CURSOR_NOT_FOUND';
      }
      if (error.message.includes('.cursorrules')) {
        return 'AI_CONFIG_INVALID';
      }
    }

    // Component-specific detection
    if (error.component && error.message.includes('invalid')) {
      return 'COMPONENT_INVALID';
    }

    return undefined;
  }

  private categorizeError(error: DeploymentError, platform?: SupportedPlatform): ErrorAnalysis['errorCategory'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('permission') || message.includes('access')) {
      return 'permission';
    }
    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('config') || message.includes('setting') || message.includes('invalid')) {
      return 'configuration';
    }
    if (message.includes('not found') || message.includes('missing') || message.includes('install')) {
      return 'platform';
    }
    if (message.includes('validation') || message.includes('syntax') || message.includes('format')) {
      return 'validation';
    }
    
    return 'unknown';
  }

  private assessSeverity(error: DeploymentError, category: ErrorAnalysis['errorCategory']): ErrorAnalysis['severity'] {
    // Use existing severity if available
    if (error.severity === 'high') return 'critical';
    if (error.severity === 'medium') return 'high';
    if (error.severity === 'low') return 'medium';

    // Assess based on category
    switch (category) {
      case 'platform':
        return 'critical'; // Can't deploy without platform
      case 'permission':
        return 'high'; // Usually fixable but blocks deployment
      case 'configuration':
        return 'medium'; // Usually fixable with config changes
      case 'validation':
        return 'medium'; // Data issues
      case 'network':
        return 'high'; // May be temporary
      default:
        return 'medium';
    }
  }

  private isRecoverable(error: DeploymentError, category: ErrorAnalysis['errorCategory']): boolean {
    switch (category) {
      case 'platform':
        return true; // Can install or specify path
      case 'permission':
        return true; // Can fix permissions
      case 'configuration':
        return true; // Can fix config
      case 'validation':
        return true; // Can fix data
      case 'network':
        return true; // May be temporary
      default:
        return false;
    }
  }

  private estimateFixTime(category: ErrorAnalysis['errorCategory'], severity: ErrorAnalysis['severity']): string {
    const timeMap = {
      platform: { critical: '10-30 minutes', high: '5-15 minutes', medium: '2-10 minutes', low: '1-5 minutes' },
      permission: { critical: '5-15 minutes', high: '2-10 minutes', medium: '1-5 minutes', low: '1-2 minutes' },
      configuration: { critical: '5-20 minutes', high: '2-10 minutes', medium: '1-5 minutes', low: '1-2 minutes' },
      validation: { critical: '10-30 minutes', high: '5-15 minutes', medium: '2-10 minutes', low: '1-5 minutes' },
      network: { critical: '5-60 minutes', high: '2-30 minutes', medium: '1-15 minutes', low: '1-5 minutes' },
      unknown: { critical: '30-120 minutes', high: '15-60 minutes', medium: '5-30 minutes', low: '2-15 minutes' },
    };

    return timeMap[category]?.[severity] || '5-30 minutes';
  }

  private hasAutomaticFix(error: DeploymentError, category: ErrorAnalysis['errorCategory']): boolean {
    switch (category) {
      case 'platform':
        return false; // Usually requires manual installation
      case 'permission':
        return true; // Can try with sudo or fix permissions
      case 'configuration':
        return true; // Can try default configs or skip components
      case 'validation':
        return false; // Usually requires manual data fixes
      case 'network':
        return true; // Can retry
      default:
        return false;
    }
  }

  private getPreventionTips(category: ErrorAnalysis['errorCategory'], platform?: SupportedPlatform): string[] {
    const tips = [];
    
    switch (category) {
      case 'platform':
        tips.push('Verify platform installation before deployment');
        tips.push('Keep platform software up to date');
        if (platform === 'cursor-ide') {
          tips.push('Add Cursor to system PATH for easier access');
        }
        break;
      case 'permission':
        tips.push('Run deployment from appropriate user account');
        tips.push('Check file and directory permissions beforehand');
        tips.push('Avoid running with unnecessary elevated privileges');
        break;
      case 'configuration':
        tips.push('Validate configuration before deployment');
        tips.push('Use configuration templates for consistency');
        tips.push('Keep backups of working configurations');
        break;
      case 'validation':
        tips.push('Use schema validation tools');
        tips.push('Test with minimal configurations first');
        tips.push('Follow platform-specific formatting guidelines');
        break;
      case 'network':
        tips.push('Ensure stable network connection');
        tips.push('Check firewall and proxy settings');
        tips.push('Consider local deployment options when possible');
        break;
    }
    
    return tips;
  }

  private findSimilarErrors(message: string): string[] {
    // This would normally search through a database of known errors
    // For now, return some common similar patterns
    const commonPatterns = [
      'File not found',
      'Permission denied',
      'Network timeout',
      'Invalid configuration',
      'Platform not found',
    ];
    
    return commonPatterns.filter(pattern => 
      this.calculateSimilarity(message.toLowerCase(), pattern.toLowerCase()) > 0.3
    );
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private canAutomate(solutionTitle: string): boolean {
    const automateKeywords = ['retry', 'restart', 'reload', 'install', 'create', 'skip'];
    return automateKeywords.some(keyword => 
      solutionTitle.toLowerCase().includes(keyword)
    );
  }

  private generateQuickFix(error: DeploymentError, documentation: ErrorDocumentation): string {
    if (documentation.solutions.length > 0) {
      const solution = documentation.solutions[0];
      if (solution.steps.length > 0) {
        return solution.steps[0];
      }
    }
    return this.generateGenericQuickFix(error);
  }

  private generateGenericQuickFix(error: DeploymentError): string {
    if (error.suggestion) {
      return error.suggestion;
    }
    
    const message = error.message.toLowerCase();
    if (message.includes('not found')) {
      return 'Check if the required software is installed and accessible';
    }
    if (message.includes('permission')) {
      return 'Check file permissions or try running with appropriate privileges';
    }
    if (message.includes('invalid')) {
      return 'Verify the configuration format and values';
    }
    
    return 'Check the error details and try the suggested solutions';
  }

  private generateGenericSolutions(error: DeploymentError, platform?: SupportedPlatform): EnhancedError['solutions'] {
    const solutions: NonNullable<EnhancedError['solutions']> = [];
    
    // Generic solution based on error type
    if (error.suggestion) {
      solutions.push({
        title: 'Follow Error Suggestion',
        steps: [error.suggestion],
        automated: false,
      });
    }
    
    // Platform-specific solutions
    if (platform) {
      solutions.push({
        title: 'Validate Platform Installation',
        steps: [
          `Verify ${platform} is properly installed`,
          'Check if the platform is accessible from command line',
          'Update platform to latest version if needed',
        ],
        automated: false,
      });
    }
    
    // General troubleshooting
    solutions.push({
      title: 'General Troubleshooting',
      steps: [
        'Run deployment with --dry-run to test configuration',
        'Check system logs for additional error details',
        'Try deployment with minimal configuration first',
        'Contact support if issue persists',
      ],
      automated: false,
    });
    
    return solutions;
  }

  private getSeverityEmoji(severity: ErrorAnalysis['severity']): string {
    switch (severity) {
      case 'critical': return '💥';
      case 'high': return '🔥';
      case 'medium': return '⚠️';
      case 'low': return 'ℹ️';
      default: return '❓';
    }
  }
}
