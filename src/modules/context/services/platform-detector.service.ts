import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { AIPlatform } from '../interfaces';
import { FileSystemUtility } from '../utils/file-system.utility';

export interface DetectionResult {
  platform: AIPlatform;
  confidence: number; // 0-100
  indicators: string[];
}

export interface DetectionReport {
  detected: DetectionResult[];
  primary: AIPlatform | null;
  ambiguous: boolean;
  details: Map<AIPlatform, DetectionResult>;
}

@Injectable()
export class PlatformDetectorService {
  private readonly logger = new Logger(PlatformDetectorService.name);

  constructor(private readonly fileSystem: FileSystemUtility) {}

  /**
   * Detect all platforms with confidence scores
   */
  async detectAll(path?: string): Promise<DetectionReport> {
    const basePath = path || process.cwd();
    const detected: DetectionResult[] = [];
    const details = new Map<AIPlatform, DetectionResult>();

    // Check each platform
    const kiroResult = await this.detectKiro(basePath);
    if (kiroResult.confidence > 0) {
      detected.push(kiroResult);
      details.set(AIPlatform.KIRO, kiroResult);
    }

    const claudeResult = await this.detectClaudeCode(basePath);
    if (claudeResult.confidence > 0) {
      detected.push(claudeResult);
      details.set(AIPlatform.CLAUDE_CODE, claudeResult);
    }

    const cursorResult = await this.detectCursor(basePath);
    if (cursorResult.confidence > 0) {
      detected.push(cursorResult);
      details.set(AIPlatform.CURSOR, cursorResult);
    }

    // Sort by confidence
    detected.sort((a, b) => b.confidence - a.confidence);

    // Determine primary platform and ambiguity
    const primary = detected.length > 0 ? detected[0].platform : null;
    const ambiguous =
      detected.length > 1 &&
      detected[0].confidence - detected[1].confidence < 20;

    return {
      detected,
      primary,
      ambiguous,
      details,
    };
  }

  /**
   * Detect primary platform with highest confidence
   */
  async detectPrimary(path?: string): Promise<AIPlatform | null> {
    const report = await this.detectAll(path);
    return report.primary;
  }

  /**
   * Check if a specific platform is present
   */
  async isPlatformPresent(
    platform: AIPlatform,
    path?: string,
  ): Promise<boolean> {
    const basePath = path || process.cwd();

    switch (platform) {
      case AIPlatform.KIRO:
        return (await this.detectKiro(basePath)).confidence > 0;
      case AIPlatform.CLAUDE_CODE:
        return (await this.detectClaudeCode(basePath)).confidence > 0;
      case AIPlatform.CURSOR:
        return (await this.detectCursor(basePath)).confidence > 0;
      default:
        return false;
    }
  }

  /**
   * Detect Kiro platform with confidence scoring
   */
  private async detectKiro(basePath: string): Promise<DetectionResult> {
    const indicators: string[] = [];
    let confidence = 0;

    try {
      const kiroPath = join(basePath, '.kiro');

      // Check main .kiro directory (40 points)
      if (await this.fileSystem.exists(kiroPath)) {
        indicators.push('.kiro directory');
        confidence += 40;

        // Check for specs directory (20 points)
        if (await this.fileSystem.exists(join(kiroPath, 'specs'))) {
          indicators.push('.kiro/specs directory');
          confidence += 20;

          // Check for actual spec directories (10 points)
          try {
            const specs = await this.fileSystem.readDirectory(
              join(kiroPath, 'specs'),
            );
            if (specs.length > 0) {
              indicators.push(`${specs.length} spec(s) found`);
              confidence += 10;
            }
          } catch {
            // Ignore read errors
          }
        }

        // Check for steering directory (20 points)
        if (await this.fileSystem.exists(join(kiroPath, 'steering'))) {
          indicators.push('.kiro/steering directory');
          confidence += 20;

          // Check for steering files (5 points)
          try {
            const files = await this.fileSystem.readDirectory(
              join(kiroPath, 'steering'),
            );
            const mdFiles = files.filter((f) => f.endsWith('.md'));
            if (mdFiles.length > 0) {
              indicators.push(`${mdFiles.length} steering rule(s)`);
              confidence += 5;
            }
          } catch {
            // Ignore read errors
          }
        }

        // Check for hooks directory (5 points)
        if (await this.fileSystem.exists(join(kiroPath, 'hooks'))) {
          indicators.push('.kiro/hooks directory');
          confidence += 5;
        }

        // Check for MCP settings (5 points)
        if (
          (await this.fileSystem.exists(
            join(kiroPath, 'settings', 'mcp.json'),
          )) ||
          (await this.fileSystem.exists(join(kiroPath, 'mcp.json')))
        ) {
          indicators.push('MCP configuration');
          confidence += 5;
        }
      }

      // Cap confidence at 100
      confidence = Math.min(confidence, 100);
    } catch (error) {
      this.logger.debug(`Error detecting Kiro: ${error.message}`);
    }

    return {
      platform: AIPlatform.KIRO,
      confidence,
      indicators,
    };
  }

  /**
   * Detect Claude Code platform with confidence scoring
   */
  private async detectClaudeCode(basePath: string): Promise<DetectionResult> {
    const indicators: string[] = [];
    let confidence = 0;

    try {
      // Check .claude directory (30 points)
      const claudeDirectory = join(basePath, '.claude');
      if (await this.fileSystem.exists(claudeDirectory)) {
        indicators.push('.claude directory');
        confidence += 30;

        // Check for settings.json (15 points)
        if (await this.fileSystem.exists(join(claudeDirectory, 'settings.json'))) {
          indicators.push('.claude/settings.json');
          confidence += 15;
        }

        // Check for mcp.json (15 points)
        if (await this.fileSystem.exists(join(claudeDirectory, 'mcp.json'))) {
          indicators.push('.claude/mcp.json');
          confidence += 15;
        }

        // Check for commands.json (10 points)
        if (await this.fileSystem.exists(join(claudeDirectory, 'commands.json'))) {
          indicators.push('.claude/commands.json');
          confidence += 10;
        }
      }

      // Check CLAUDE.md (20 points)
      if (await this.fileSystem.exists(join(basePath, 'CLAUDE.md'))) {
        indicators.push('CLAUDE.md');
        confidence += 20;

        // Check file size for meaningful content (5 points)
        try {
          const content = await this.fileSystem.readFile(
            join(basePath, 'CLAUDE.md'),
          );
          if (content.length > 100) {
            indicators.push('CLAUDE.md has content');
            confidence += 5;
          }
        } catch {
          // Ignore read errors
        }
      }

      // Check CLAUDE.local.md (15 points)
      if (await this.fileSystem.exists(join(basePath, 'CLAUDE.local.md'))) {
        indicators.push('CLAUDE.local.md');
        confidence += 15;
      }

      // Check for user-level Claude configuration (10 points)
      const userClaudeDirectory = join(process.env.HOME || '', '.claude');
      if (
        (await this.fileSystem.exists(userClaudeDirectory)) && // Only add points if we have project-level indicators too
        confidence > 0
      ) {
        indicators.push('User-level .claude config');
        confidence += 10;
      }

      // Cap confidence at 100
      confidence = Math.min(confidence, 100);
    } catch (error) {
      this.logger.debug(`Error detecting Claude Code: ${error.message}`);
    }

    return {
      platform: AIPlatform.CLAUDE_CODE,
      confidence,
      indicators,
    };
  }

  /**
   * Detect Cursor platform with confidence scoring
   */
  private async detectCursor(basePath: string): Promise<DetectionResult> {
    const indicators: string[] = [];
    let confidence = 0;

    try {
      // Check .cursor directory (40 points)
      const cursorDirectory = join(basePath, '.cursor');
      if (await this.fileSystem.exists(cursorDirectory)) {
        indicators.push('.cursor directory');
        confidence += 40;

        // Check for settings file (20 points)
        if (await this.fileSystem.exists(join(cursorDirectory, 'settings.json'))) {
          indicators.push('.cursor/settings.json');
          confidence += 20;
        }

        // Check for rules file (20 points)
        if (await this.fileSystem.exists(join(cursorDirectory, 'rules.md'))) {
          indicators.push('.cursor/rules.md');
          confidence += 20;
        }

        // Check for prompts directory (10 points)
        if (await this.fileSystem.exists(join(cursorDirectory, 'prompts'))) {
          indicators.push('.cursor/prompts directory');
          confidence += 10;
        }
      }

      // Check .cursorrules file (20 points)
      if (await this.fileSystem.exists(join(basePath, '.cursorrules'))) {
        indicators.push('.cursorrules file');
        confidence += 20;
      }

      // Check .cursorignore file (10 points)
      if (await this.fileSystem.exists(join(basePath, '.cursorignore'))) {
        indicators.push('.cursorignore file');
        confidence += 10;
      }

      // Cap confidence at 100
      confidence = Math.min(confidence, 100);
    } catch (error) {
      this.logger.debug(`Error detecting Cursor: ${error.message}`);
    }

    return {
      platform: AIPlatform.CURSOR,
      confidence,
      indicators,
    };
  }

  /**
   * Get detection hints for improving confidence
   */
  getDetectionHints(result: DetectionResult): string[] {
    const hints: string[] = [];

    switch (result.platform) {
      case AIPlatform.KIRO:
        if (result.confidence < 40) {
          hints.push('Create .kiro directory to identify as Kiro project');
        }
        if (!result.indicators.includes('.kiro/specs directory')) {
          hints.push('Add .kiro/specs directory for specifications');
        }
        if (!result.indicators.includes('.kiro/steering directory')) {
          hints.push('Add .kiro/steering directory for steering rules');
        }
        break;

      case AIPlatform.CLAUDE_CODE:
        if (result.confidence < 30) {
          hints.push('Create .claude directory or CLAUDE.md file');
        }
        if (!result.indicators.includes('CLAUDE.md')) {
          hints.push('Add CLAUDE.md for project instructions');
        }
        if (!result.indicators.includes('.claude/mcp.json')) {
          hints.push('Configure MCP servers in .claude/mcp.json');
        }
        break;

      case AIPlatform.CURSOR:
        if (result.confidence < 40) {
          hints.push('Create .cursor directory to identify as Cursor project');
        }
        if (!result.indicators.includes('.cursorrules file')) {
          hints.push('Add .cursorrules file for AI instructions');
        }
        break;
    }

    return hints;
  }
}
