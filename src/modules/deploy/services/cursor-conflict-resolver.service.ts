import { Injectable, Logger } from '@nestjs/common';

import { ConflictStrategy } from '../interfaces/conflict-strategy.interface';

export interface ConflictResolutionResult {
  action: 'skip' | 'overwrite' | 'merge' | 'backup';
  mergedContent?: unknown;
  backupPath?: string;
  message?: string;
}

export interface ConflictContext {
  filePath: string;
  existingContent: unknown;
  newContent: unknown;
  strategy: ConflictStrategy;
  fileType: 'json' | 'markdown' | 'text';
}

export interface MarkdownConflictAnalysis {
  hasStructuralChanges: boolean;
  hasContentChanges: boolean;
  conflictingSections: string[];
  mergeableContent: boolean;
}

@Injectable()
export class CursorConflictResolverService {
  private readonly logger = new Logger(CursorConflictResolverService.name);
  /**
   * Resolves conflicts for any type of file based on the conflict strategy
   */
  async resolveConflict(context: ConflictContext): Promise<ConflictResolutionResult> {
    // Validate context
    if (!context.filePath || !context.strategy) {
      throw new Error('Invalid conflict context: filePath and strategy are required');
    }

    // Log conflict resolution attempt
    this.logger.debug(`Resolving conflict for ${context.filePath} using strategy: ${context.strategy}`);

    // Check for unsupported strategy first
    const supportedStrategies: ConflictStrategy[] = ['skip', 'overwrite', 'backup', 'merge', 'prompt'];
    if (!supportedStrategies.includes(context.strategy)) {
      throw new Error(`Unsupported conflict strategy: ${context.strategy}`);
    }

    try {
      let result: ConflictResolutionResult;

      switch (context.strategy) {
        case 'skip':
          result = this.skipConflict(context);
          break;
        case 'overwrite':
          result = this.overwriteConflict(context);
          break;
        case 'backup':
          result = await this.backupAndOverwrite(context);
          break;
        case 'merge':
          result = await this.mergeConflict(context);
          break;
        case 'prompt':
          result = await this.promptUserForResolution(context);
          break;
        default:
          // This should never be reached due to the check above
          throw new Error(`Unsupported conflict strategy: ${context.strategy}`);
      }

      // Validate the result
      if (!this.validateResolutionResult(result)) {
        throw new Error(`Invalid resolution result for strategy: ${context.strategy}`);
      }

      this.logger.debug(`Conflict resolved successfully: ${result.action} - ${result.message}`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to resolve conflict for ${context.filePath}: ${error.message}`);
      
      // Only fallback to skip strategy if the chosen strategy fails during execution
      // and it's not already skip strategy, and it's not an unsupported strategy error
      if (context.strategy !== 'skip' && !error.message.includes('Unsupported conflict strategy')) {
        this.logger.warn('Falling back to skip strategy due to execution error');
        return this.skipConflict(context);
      }
      
      throw error;
    }
  }

  /**
   * Resolves settings file conflicts with intelligent JSON merging
   */
  async resolveSettingsConflict(
    existingSettings: Record<string, unknown>,
    newSettings: Record<string, unknown>,
    strategy: ConflictStrategy,
  ): Promise<ConflictResolutionResult> {
    const context: ConflictContext = {
      filePath: 'settings.json',
      existingContent: existingSettings,
      newContent: newSettings,
      strategy,
      fileType: 'json',
    };

    return this.resolveConflict(context);
  }

  /**
   * Resolves markdown file conflicts for AI prompts and rules
   */
  async resolveMarkdownConflict(
    existingContent: string,
    newContent: string,
    strategy: ConflictStrategy,
    filePath: string,
  ): Promise<ConflictResolutionResult> {
    const context: ConflictContext = {
      filePath,
      existingContent,
      newContent,
      strategy,
      fileType: 'markdown',
    };

    return this.resolveConflict(context);
  }

  private skipConflict(context: ConflictContext): ConflictResolutionResult {
    return {
      action: 'skip',
      message: `Skipped ${context.filePath} due to conflict`,
    };
  }

  private overwriteConflict(context: ConflictContext): ConflictResolutionResult {
    return {
      action: 'overwrite',
      mergedContent: context.newContent,
      message: `Overwritten ${context.filePath}`,
    };
  }

  private async backupAndOverwrite(context: ConflictContext): Promise<ConflictResolutionResult> {
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
    const backupPath = `${context.filePath}.backup.${timestamp}`;

    return {
      action: 'backup',
      mergedContent: context.newContent,
      backupPath,
      message: `Backed up ${context.filePath} to ${backupPath} and overwritten`,
    };
  }

  private async mergeConflict(context: ConflictContext): Promise<ConflictResolutionResult> {
    switch (context.fileType) {
      case 'json':
        return this.mergeJsonContent(context);
      case 'markdown':
        return this.mergeMarkdownContentContext(context);
      default:
        return this.overwriteConflict(context);
    }
  }

  private mergeJsonContent(context: ConflictContext): ConflictResolutionResult {
    const existing = context.existingContent as Record<string, unknown>;
    const newContent = context.newContent as Record<string, unknown>;

    // Intelligent merge with user customization preservation
    const merged = this.intelligentJsonMerge(existing, newContent);

    return {
      action: 'merge',
      mergedContent: merged,
      message: `Merged ${context.filePath} with intelligent conflict resolution`,
    };
  }

  /**
   * Performs intelligent JSON merging with user customization preservation
   */
  private intelligentJsonMerge(existing: Record<string, unknown>, newContent: Record<string, unknown>): Record<string, unknown> {
    const merged = { ...existing };

    // Define settings that should preserve user customizations
    const userCustomizableSettings = new Set([
      'editor.fontSize',
      'editor.fontFamily',
      'editor.tabSize',
      'workbench.colorTheme',
      'workbench.iconTheme',
      'terminal.integrated.fontSize',
      'terminal.integrated.fontFamily',
      'cursor.ai.temperature',
      'cursor.ai.maxTokens',
    ]);

    // Define settings that should always be updated from new content
    const systemSettings = new Set([
      'cursor.ai.enabled',
      'cursor.ai.model',
      'cursor.ai.contextWindow',
      'extensions.autoUpdate',
      'security.workspace.trust.enabled',
    ]);

    for (const key in newContent) {
      if (Object.prototype.hasOwnProperty.call(newContent, key)) {
        if (systemSettings.has(key)) {
          // Always update system settings
          merged[key] = newContent[key];
        } else if (userCustomizableSettings.has(key) && Object.prototype.hasOwnProperty.call(existing, key)) {
          // Preserve user customizations for these settings
          // Only update if the existing value is a default value
          if (this.isDefaultValue(key, existing[key])) {
            merged[key] = newContent[key];
          }
          // Otherwise keep existing user customization
        } else if (this.isObject(newContent[key]) && this.isObject(existing[key])) {
          // Recursively merge nested objects
          merged[key] = this.intelligentJsonMerge(
            existing[key] as Record<string, unknown>, 
            newContent[key] as Record<string, unknown>
          );
        } else {
          // For other settings, prefer new content
          merged[key] = newContent[key];
        }
      }
    }

    return merged;
  }

  /**
   * Checks if a value is a default value for a given setting
   */
  private isDefaultValue(settingKey: string, value: unknown): boolean {
    const defaultValues: Record<string, unknown> = {
      'editor.fontSize': 14,
      'editor.fontFamily': 'Consolas',
      'editor.tabSize': 2,
      'workbench.colorTheme': 'Default Dark+',
      'workbench.iconTheme': 'vs-seti',
      'terminal.integrated.fontSize': 12,
      'terminal.integrated.fontFamily': 'Consolas',
      'cursor.ai.temperature': 0.7,
      'cursor.ai.maxTokens': 4000,
    };

    return defaultValues[settingKey] === value;
  }

  private mergeMarkdownContentContext(context: ConflictContext): ConflictResolutionResult {
    const existingContent = context.existingContent as string;
    const newContent = context.newContent as string;

    // Analyze markdown content for conflicts
    const analysis = this.analyzeMarkdownConflict(existingContent, newContent);

    if (!analysis.mergeableContent) {
      // If content is not mergeable, fall back to overwrite
      return this.overwriteConflict(context);
    }

    // Perform intelligent markdown merge
    const mergedContent = this.intelligentMarkdownMerge(existingContent, newContent, analysis);

    return {
      action: 'merge',
      mergedContent,
      message: `Merged ${context.filePath} with content-based analysis`,
    };
  }



  /**
   * Prompts user for conflict resolution with interactive options
   */
  private async promptUserForResolution(context: ConflictContext): Promise<ConflictResolutionResult> {
    // Display conflict information
    this.logger.warn(`Conflict detected in: ${context.filePath}`);
    this.logger.debug(`File type: ${context.fileType}`);
    
    if (context.fileType === 'json') {
      this.displayJsonConflictPreview(context.existingContent as Record<string, unknown>, context.newContent as Record<string, unknown>);
    } else if (context.fileType === 'markdown') {
      this.displayMarkdownConflictPreview(context.existingContent, context.newContent);
    }

    // Get conflict statistics to help with decision
    const stats = this.getConflictStats(context);
    this.logger.log(`Conflict analysis: ${stats.conflictCount} conflicts, complexity: ${stats.complexity}`);

    // In a real CLI implementation, this would use inquirer or similar
    // For now, we'll implement a decision logic based on file type and content
    const recommendedStrategy = this.getRecommendedStrategy(context);
    
    this.logger.log(`Recommended strategy: ${recommendedStrategy}`);
    
    // In a real implementation, you would prompt the user here:
    // const userChoice = await this.promptUserChoice(context, recommendedStrategy);
    // For now, we'll use the recommended strategy
    
    this.logger.log('Applying recommended strategy...');

    // Apply the recommended strategy
    const updatedContext = { ...context, strategy: recommendedStrategy };
    return this.resolveConflict(updatedContext);
  }

  /**
   * Prompts user to choose conflict resolution strategy (placeholder for real CLI implementation)
   */
  private async promptUserChoice(context: ConflictContext, recommended: ConflictStrategy): Promise<ConflictStrategy> {
    // This would be implemented with inquirer.js or similar in a real CLI
    // For now, return the recommended strategy
    
    const _availableStrategies: ConflictStrategy[] = ['merge', 'overwrite', 'backup', 'skip'];
    const stats = this.getConflictStats(context);
    
    this.logger.log('\nAvailable conflict resolution strategies:');
    this.logger.log('1. merge - Intelligently merge the files (recommended for low complexity)');
    this.logger.log('2. overwrite - Replace existing file with new content');
    this.logger.log('3. backup - Create backup of existing file and overwrite');
    this.logger.log('4. skip - Keep existing file unchanged');
    
    this.logger.log(`\nRecommended: ${recommended} (based on ${stats.complexity} complexity)`);
    
    // In a real implementation:
    // const answer = await inquirer.prompt([{
    //   type: 'list',
    //   name: 'strategy',
    //   message: 'How would you like to resolve this conflict?',
    //   choices: _availableStrategies,
    //   default: recommended
    // }]);
    // return answer.strategy;
    
    return recommended;
  }

  /**
   * Displays JSON conflict preview to help user make decision
   */
  private displayJsonConflictPreview(existing: Record<string, unknown>, newContent: Record<string, unknown>): void {
    this.logger.debug('Settings Conflict Preview:');
    
    const conflictingKeys = this.findConflictingJsonKeys(existing, newContent);
    
    if (conflictingKeys.length === 0) {
      this.logger.debug('No conflicting keys found - safe to merge');
      return;
    }

    this.logger.warn(`${conflictingKeys.length} conflicting setting(s):`);
    
    conflictingKeys.slice(0, 5).forEach(key => {
      this.logger.debug(`${key}: Current: ${JSON.stringify(existing[key])}, New: ${JSON.stringify(newContent[key])}`);
    });

    if (conflictingKeys.length > 5) {
      this.logger.debug(`... and ${conflictingKeys.length - 5} more conflicts`);
    }
  }

  /**
   * Displays markdown conflict preview
   */
  private displayMarkdownConflictPreview(existing: unknown, newContent: unknown): void {
    this.logger.debug('Markdown Conflict Preview:');
    
    const analysis = this.analyzeMarkdownConflict(existing as string, newContent as string);
    
    this.logger.debug(`Structure changes: ${analysis.hasStructuralChanges ? 'Yes' : 'No'}`);
    this.logger.debug(`Content changes: ${analysis.hasContentChanges ? 'Yes' : 'No'}`);
    this.logger.debug(`Mergeable: ${analysis.mergeableContent ? 'Yes' : 'No'}`);
    
    if (analysis.conflictingSections.length > 0) {
      this.logger.debug(`Conflicts (${Math.min(analysis.conflictingSections.length, 3)} shown):`);
      analysis.conflictingSections.slice(0, 3).forEach(conflict => {
        this.logger.debug(`${conflict}`);
      });
    }
  }

  /**
   * Gets recommended strategy based on conflict analysis
   */
  private getRecommendedStrategy(context: ConflictContext): ConflictStrategy {
    if (context.fileType === 'json') {
      const existing = context.existingContent as Record<string, unknown>;
      const newContent = context.newContent as Record<string, unknown>;
      const conflictingKeys = this.findConflictingJsonKeys(existing, newContent);
      
      // If few conflicts and mostly system settings, recommend merge
      if (conflictingKeys.length <= 5) {
        return 'merge';
      }
      
      // If many conflicts, recommend backup to preserve existing settings
      return 'backup';
    }

    if (context.fileType === 'markdown') {
      const analysis = this.analyzeMarkdownConflict(
        context.existingContent as string,
        context.newContent as string
      );
      
      // If mergeable, recommend merge
      if (analysis.mergeableContent) {
        return 'merge';
      }
      
      // If not mergeable but no structural changes, overwrite
      if (!analysis.hasStructuralChanges) {
        return 'overwrite';
      }
      
      // Complex structural changes - skip to preserve user content
      return 'skip';
    }

    // Default strategy for other file types
    return 'overwrite';
  }

  /**
   * Finds conflicting keys between two JSON objects
   */
  private findConflictingJsonKeys(existing: Record<string, unknown>, newContent: Record<string, unknown>): string[] {
    const conflicts: string[] = [];
    
    for (const key in newContent) {
      if (Object.prototype.hasOwnProperty.call(existing, key) && existing[key] !== newContent[key]) {
        // Skip if it's a nested object that can be merged
        if (this.isObject(existing[key]) && this.isObject(newContent[key])) {
          const nestedConflicts = this.findConflictingJsonKeys(
            existing[key] as Record<string, unknown>, 
            newContent[key] as Record<string, unknown>
          );
          conflicts.push(...nestedConflicts.map(nestedKey => `${key}.${nestedKey}`));
        } else {
          conflicts.push(key);
        }
      }
    }
    
    return conflicts;
  }

  private isObject(item: unknown): item is Record<string, unknown> {
    return item !== null && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Analyzes markdown content for conflicts with content-based analysis
   */
  private analyzeMarkdownConflict(existing: string, newContent: string): MarkdownConflictAnalysis {
    const existingLines = existing.split('\n');
    const newLines = newContent.split('\n');

    const hasStructuralChanges = this.hasMarkdownStructuralChanges(existingLines, newLines);
    const hasContentChanges = existing !== newContent;
    const conflictingSections = this.findConflictingSections(existingLines, newLines);

    // More sophisticated mergeability analysis
    const mergeableContent = this.isMarkdownMergeable(existingLines, newLines, hasStructuralChanges);

    return {
      hasStructuralChanges,
      hasContentChanges,
      conflictingSections,
      mergeableContent,
    };
  }

  /**
   * Determines if markdown content can be safely merged
   */
  private isMarkdownMergeable(existingLines: string[], newLines: string[], hasStructuralChanges: boolean): boolean {
    // If there are no structural changes and content is similar, it's mergeable
    if (!hasStructuralChanges) {
      const similarity = this.calculateContentSimilarity(existingLines, newLines);
      return similarity > 0.1; // Lower threshold for better mergeability
    }

    // Check if it's just adding new sections
    const existingHeaders = this.extractHeaders(existingLines);
    const newHeaders = this.extractHeaders(newLines);
    
    // If new content only adds headers, it's mergeable
    const isAdditive = existingHeaders.every(header => newHeaders.includes(header));
    
    // Even with structural changes, we can merge if it's not too complex
    const complexityScore = Math.abs(existingHeaders.length - newHeaders.length) / Math.max(existingHeaders.length, newHeaders.length, 1);
    
    return isAdditive || complexityScore < 0.8; // Allow merge for most structural changes
  }

  /**
   * Calculates content similarity between two sets of lines
   */
  private calculateContentSimilarity(lines1: string[], lines2: string[]): number {
    const set1 = new Set(lines1.filter(line => line.trim() !== ''));
    const set2 = new Set(lines2.filter(line => line.trim() !== ''));
    
    const intersection = new Set([...set1].filter(line => set2.has(line)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Extracts headers from markdown lines
   */
  private extractHeaders(lines: string[]): string[] {
    return lines.filter(line => line.trim().startsWith('#')).map(line => line.trim());
  }

  private hasMarkdownStructuralChanges(existingLines: string[], newLines: string[]): boolean {
    const existingHeaders = existingLines.filter(line => line.startsWith('#'));
    const newHeaders = newLines.filter(line => line.startsWith('#'));

    return existingHeaders.length !== newHeaders.length ||
           !existingHeaders.every((header, index) => header === newHeaders[index]);
  }

  private findConflictingSections(existingLines: string[], newLines: string[]): string[] {
    const conflicts: string[] = [];
    const maxLines = Math.max(existingLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const existingLine = existingLines[i] || '';
      const newLine = newLines[i] || '';

      if (existingLine !== newLine && existingLine.trim() !== '' && newLine.trim() !== '') {
        conflicts.push(`Line ${i + 1}: "${existingLine}" vs "${newLine}"`);
      }
    }

    return conflicts;
  }

  /**
   * Performs intelligent markdown merge with content-based analysis
   */
  private intelligentMarkdownMerge(existing: string, newContent: string, analysis: MarkdownConflictAnalysis): string {
    const existingLines = existing.split('\n');
    const newLines = newContent.split('\n');

    if (!analysis.hasStructuralChanges) {
      // No structural changes - merge content intelligently
      return this.mergeMarkdownContent(existingLines, newLines);
    }

    // Structural changes detected - check if it's additive
    const existingHeaders = this.extractHeaders(existingLines);
    const newHeaders = this.extractHeaders(newLines);
    
    if (this.isAdditiveChange(existingHeaders, newHeaders)) {
      // Additive change - append new sections
      return this.appendNewSections(existing, newContent, existingHeaders, newHeaders);
    }

    // Complex structural changes - prefer new content with preservation note
    return this.createMergedContentWithNote(existing, newContent);
  }

  /**
   * Merges markdown content when there are no structural changes
   */
  private mergeMarkdownContent(existingLines: string[], newLines: string[]): string {
    const merged: string[] = [];
    const maxLength = Math.max(existingLines.length, newLines.length);

    for (let i = 0; i < maxLength; i++) {
      const existingLine = existingLines[i] || '';
      const newLine = newLines[i] || '';

      if (existingLine === newLine) {
        merged.push(existingLine);
      } else if (existingLine.trim() === '' && newLine.trim() !== '') {
        merged.push(newLine);
      } else if (newLine.trim() === '' && existingLine.trim() !== '') {
        merged.push(existingLine);
      } else {
        // Both lines have content but are different - prefer new content
        merged.push(newLine);
        if (existingLine.trim() !== '' && !newLine.includes(existingLine.trim())) {
          merged.push(`<!-- Previous content: ${existingLine.trim()} -->`);
        }
      }
    }

    return merged.join('\n');
  }

  /**
   * Checks if the change is purely additive (only new headers added)
   */
  private isAdditiveChange(existingHeaders: string[], newHeaders: string[]): boolean {
    return existingHeaders.every(header => newHeaders.includes(header)) && 
           newHeaders.length > existingHeaders.length;
  }

  /**
   * Appends new sections to existing content
   */
  private appendNewSections(existing: string, newContent: string, existingHeaders: string[], newHeaders: string[]): string {
    const newSectionHeaders = newHeaders.filter(header => !existingHeaders.includes(header));
    
    if (newSectionHeaders.length === 0) {
      return existing;
    }

    const newLines = newContent.split('\n');
    const newSections: string[] = [];

    for (const header of newSectionHeaders) {
      const headerIndex = newLines.findIndex(line => line.trim() === header);
      if (headerIndex !== -1) {
        const nextHeaderIndex = newLines.findIndex((line, index) => 
          index > headerIndex && line.trim().startsWith('#')
        );
        
        const sectionEnd = nextHeaderIndex !== -1 ? nextHeaderIndex : newLines.length;
        const section = newLines.slice(headerIndex, sectionEnd).join('\n');
        newSections.push(section);
      }
    }

    return `${existing}\n\n<!-- New sections added during merge -->\n${newSections.join('\n\n')}`;
  }

  /**
   * Creates merged content with preservation note for complex changes
   */
  private createMergedContentWithNote(existing: string, newContent: string): string {
    const timestamp = new Date().toISOString();
    
    return `${newContent}

<!-- 
Merge Note (${timestamp}):
The following content was preserved from the original file due to structural conflicts.
Please review and integrate manually if needed.

Original Content:
${existing.split('\n').map(line => `  ${line}`).join('\n')}
-->`;
  }

  /**
   * Validates conflict resolution result
   */
  validateResolutionResult(result: ConflictResolutionResult): boolean {
    if (!result.action) {
      return false;
    }

    // Validate based on action type
    switch (result.action) {
      case 'merge':
        return result.mergedContent !== undefined;
      case 'backup':
        return result.mergedContent !== undefined && result.backupPath !== undefined;
      case 'overwrite':
        return result.mergedContent !== undefined;
      case 'skip':
        return true; // Skip action is always valid
      default:
        return false;
    }
  }

  /**
   * Gets conflict resolution statistics
   */
  getConflictStats(context: ConflictContext): {
    conflictCount: number;
    conflictType: string;
    complexity: 'low' | 'medium' | 'high';
    recommendation: ConflictStrategy;
  } {
    let conflictCount = 0;
    let conflictType = 'unknown';
    let complexity: 'low' | 'medium' | 'high' = 'low';

    if (context.fileType === 'json') {
      const existing = context.existingContent as Record<string, unknown>;
      const newContent = context.newContent as Record<string, unknown>;
      const conflicts = this.findConflictingJsonKeys(existing, newContent);
      
      conflictCount = conflicts.length;
      conflictType = 'settings';
      complexity = conflicts.length > 10 ? 'high' : conflicts.length > 3 ? 'medium' : 'low';
    } else if (context.fileType === 'markdown') {
      const analysis = this.analyzeMarkdownConflict(
        context.existingContent as string,
        context.newContent as string
      );
      
      conflictCount = analysis.conflictingSections.length;
      conflictType = analysis.hasStructuralChanges ? 'structural' : 'content';
      complexity = analysis.hasStructuralChanges ? 'high' : 
                   analysis.conflictingSections.length > 5 ? 'medium' : 'low';
    }

    const recommendation = this.getRecommendedStrategy(context);

    return {
      conflictCount,
      conflictType,
      complexity,
      recommendation,
    };
  }

  /**
   * Resolves multiple conflicts with the same strategy
   */
  async resolveBatchConflicts(
    contexts: ConflictContext[],
    globalStrategy?: ConflictStrategy
  ): Promise<ConflictResolutionResult[]> {
    const results: ConflictResolutionResult[] = [];
    
    this.logger.log(`Resolving ${contexts.length} conflicts...`);

    // Process conflicts sequentially to avoid race conditions
    for (const context of contexts) {
      try {
        // Use global strategy if provided, otherwise use context strategy
        const effectiveContext = globalStrategy 
          ? { ...context, strategy: globalStrategy }
          : context;

        // eslint-disable-next-line no-await-in-loop
        const result = await this.resolveConflict(effectiveContext);
        results.push(result);

        // Log progress
        this.logger.debug(`Resolved ${results.length}/${contexts.length}: ${context.filePath}`);

      } catch (error) {
        this.logger.error(`Failed to resolve conflict for ${context.filePath}: ${error.message}`);
        
        // Add failed result
        results.push({
          action: 'skip',
          message: `Failed to resolve conflict: ${error.message}`,
        });
      }
    }

    // Log summary
    const successful = results.filter(r => r.action !== 'skip').length;
    const skipped = results.length - successful;
    
    this.logger.log(`Batch conflict resolution complete: ${successful} resolved, ${skipped} skipped`);

    return results;
  }

  /**
   * Analyzes conflicts and suggests optimal batch strategy
   */
  suggestBatchStrategy(contexts: ConflictContext[]): {
    recommendedStrategy: ConflictStrategy;
    confidence: 'low' | 'medium' | 'high';
    reasoning: string;
  } {
    if (contexts.length === 0) {
      return {
        recommendedStrategy: 'skip',
        confidence: 'high',
        reasoning: 'No conflicts to resolve'
      };
    }

    // Analyze all contexts
    const stats = contexts.map(ctx => this.getConflictStats(ctx));
    const complexities = stats.map(s => s.complexity);
    const recommendations = stats.map(s => s.recommendation);

    // Count strategy recommendations
    const strategyCounts = recommendations.reduce((acc, strategy) => {
      acc[strategy] = (acc[strategy] || 0) + 1;
      return acc;
    }, {} as Record<ConflictStrategy, number>);

    // Find most recommended strategy
    const mostRecommended = Object.entries(strategyCounts)
      .sort(([,a], [,b]) => b - a)[0][0] as ConflictStrategy;

    // Determine confidence based on consensus
    const consensus = strategyCounts[mostRecommended] / contexts.length;
    const avgComplexity = complexities.filter(c => c === 'high').length / contexts.length;

    let confidence: 'low' | 'medium' | 'high';
    let reasoning: string;

    if (consensus >= 0.8 && avgComplexity < 0.3) {
      confidence = 'high';
      reasoning = `Strong consensus (${Math.round(consensus * 100)}%) for ${mostRecommended} with low complexity`;
    } else if (consensus >= 0.6) {
      confidence = 'medium';
      reasoning = `Moderate consensus (${Math.round(consensus * 100)}%) for ${mostRecommended}`;
    } else {
      confidence = 'low';
      reasoning = `Low consensus, mixed conflict types detected. Consider using 'prompt' strategy`;
    }

    return {
      recommendedStrategy: confidence === 'low' ? 'prompt' : mostRecommended,
      confidence,
      reasoning
    };
  }
}