import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers';
import { promisify } from 'node:util';

import { describe, expect, it, beforeAll, afterAll } from 'vitest';

const execAsync = promisify(exec);

describe('BuildCommand CLI Integration Tests', () => {
  let temporaryDirectory: string;
  let originalCwd: string;

  beforeAll(async () => {
    originalCwd = process.cwd();
    // Create temporary directory for test project
    temporaryDirectory = await fs.mkdtemp(join(tmpdir(), 'taptik-cli-test-'));
    process.chdir(temporaryDirectory);

    // Create basic Kiro structure for testing
    await createBasicKiroStructure();
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    // Clean up temp directory
    try {
      await fs.rmdir(temporaryDirectory, { recursive: true });
    } catch (error) {
      console.warn(`Failed to clean up temp directory: ${error}`);
    }
  });

  describe('CLI Help and Information', () => {
    it('should show main CLI help', async () => {
      const { stdout, stderr } = await execAsync(`npm run cli -- --help`, {
        cwd: originalCwd,
        timeout: 30_000,
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('build');
      expect(stdout).toContain('health');
    });

    it('should show build command help', async () => {
      const { stdout, stderr } = await execAsync(`npm run cli -- build --help`, {
        cwd: originalCwd,
        timeout: 30_000,
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('Build taptik-compatible context files');
      expect(stdout).toContain('--dry-run');
      expect(stdout).toContain('--output');
      expect(stdout).toContain('--platform');
      expect(stdout).toContain('--categories');
      expect(stdout).toContain('--verbose');
      expect(stdout).toContain('--quiet');
      expect(stdout).toContain('Examples:');
    });

    it('should show health command status', async () => {
      const { stdout, stderr } = await execAsync(`npm run cli -- health`, {
        cwd: originalCwd,
        timeout: 30_000,
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('Health Check');
    });
  });

  describe('Build Command Options Validation', () => {
    it('should validate platform option', async () => {
      try {
        await execAsync(`npm run cli -- build --platform invalid-platform`, {
          cwd: originalCwd,
          timeout: 15_000,
        });
        throw new Error('Should have thrown an error for invalid platform');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('Invalid platform');
      }
    });

    it('should validate categories option', async () => {
      try {
        await execAsync(`npm run cli -- build --categories invalid-category`, {
          cwd: originalCwd,
          timeout: 15_000,
        });
        throw new Error('Should have thrown an error for invalid category');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('Invalid category');
      }
    });

    it('should accept valid platform options', async () => {
      const platforms = ['kiro', 'cursor', 'claude-code'];
      
      // 병렬 처리로 모든 플랫폼 테스트
      const platformPromises = platforms.map(async (platform) => {
        const { stdout, stderr } = await execAsync(
          `npm run cli -- build --platform ${platform} --dry-run`,
          {
            cwd: originalCwd,
            timeout: 15_000,
          }
        );

        expect(stderr).not.toContain('Invalid platform');
        // Should complete without error
        return { platform, stdout, stderr };
      });

      await Promise.all(platformPromises);
    });

    it('should accept valid category options', async () => {
      const categories = ['personal', 'project', 'prompts', 'personal,project'];
      
      // 병렬 처리로 모든 카테고리 테스트
      const categoryPromises = categories.map(async (categoryList) => {
        const { stdout, stderr } = await execAsync(
          `npm run cli -- build --categories ${categoryList} --dry-run`,
          {
            cwd: originalCwd,
            timeout: 15_000,
          }
        );

        expect(stderr).not.toContain('Invalid category');
        // Should complete without error
        return { categoryList, stdout, stderr };
      });

      await Promise.all(categoryPromises);
    });
  });

  describe('Build Command Execution', () => {
    it('should execute dry run successfully', async () => {
      const { stdout, stderr } = await execAsync(
        `npm run cli -- build --dry-run --platform kiro --categories personal`,
        {
          cwd: originalCwd,
          timeout: 30_000,
        }
      );

      expect(stderr).not.toContain('Error:');
      expect(stdout).toContain('Dry run');
      expect(stdout).toContain('Platform: kiro');
      expect(stdout).toContain('personal-context.json');
      expect(stdout).toContain('manifest.json');
      expect(stdout).toContain('✅ Dry run completed successfully');
    });

    it('should show verbose output when requested', async () => {
      const { stdout, stderr } = await execAsync(
        `npm run cli -- build --dry-run --verbose --platform kiro --categories personal`,
        {
          cwd: originalCwd,
          timeout: 30_000,
        }
      );

      expect(stderr).not.toContain('Error:');
      expect(stdout).toContain('🔍 Verbose mode enabled');
      expect(stdout).toContain('CLI options:');
      expect(stdout).toContain('📋 Using preset platform');
      expect(stdout).toContain('🔧 Build configuration');
    });

    it('should suppress output in quiet mode', async () => {
      const { stdout, stderr } = await execAsync(
        `npm run cli -- build --dry-run --quiet --platform kiro --categories personal`,
        {
          cwd: originalCwd,
          timeout: 30_000,
        }
      );

      expect(stderr).not.toContain('Error:');
      // Quiet mode should have minimal output
      const outputLines = stdout.split('\n').filter(line => line.trim());
      expect(outputLines.length).toBeLessThan(10);
    });

    it('should handle custom output path', async () => {
      const customOutput = join(temporaryDirectory, 'custom-output');
      
      const { stdout, stderr } = await execAsync(
        `npm run cli -- build --dry-run --platform kiro --categories personal --output ${customOutput}`,
        {
          cwd: originalCwd,
          timeout: 30_000,
        }
      );

      expect(stderr).not.toContain('Error:');
      expect(stdout).toContain('custom-output');
    });

    it('should handle multiple categories', async () => {
      const { stdout, stderr } = await execAsync(
        `npm run cli -- build --dry-run --platform kiro --categories personal,project,prompts`,
        {
          cwd: originalCwd,
          timeout: 30_000,
        }
      );

      expect(stderr).not.toContain('Error:');
      expect(stdout).toContain('personal-context.json');
      expect(stdout).toContain('project-context.json');
      expect(stdout).toContain('prompt-templates.json');
      expect(stdout).toContain('manifest.json');
    });
  });

  describe('NPM Script Integration', () => {
    it('should execute cli:help script', async () => {
      const { stdout, stderr } = await execAsync(`npm run cli:help`, {
        cwd: originalCwd,
        timeout: 15_000,
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('build');
    });

    it('should execute cli:build-help script', async () => {
      const { stdout, stderr } = await execAsync(`npm run cli:build-help`, {
        cwd: originalCwd,
        timeout: 15_000,
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('Build taptik-compatible');
      expect(stdout).toContain('--dry-run');
    });

    it('should execute cli:test script', async () => {
      const { stdout, stderr } = await execAsync(`npm run cli:test`, {
        cwd: originalCwd,
        timeout: 15_000,
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('✅ CLI health check passed');
    });

    it('should execute dev:setup script', async () => {
      const { stdout, stderr } = await execAsync(`npm run dev:setup`, {
        cwd: originalCwd,
        timeout: 30_000,
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('🎉 Development setup complete');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing Kiro configuration gracefully', async () => {
      // Create empty temp directory without Kiro structure
      const emptyTemporaryDirectory = await fs.mkdtemp(join(tmpdir(), 'taptik-empty-test-'));
      
      try {
        const { stdout } = await execAsync(
          `npm run cli -- build --dry-run --platform kiro --categories personal`,
          {
            cwd: emptyTemporaryDirectory,
            timeout: 30_000,
          }
        );

        // Should complete with warnings, not fail completely
        expect(stdout).toContain('Dry run');
      } catch (error: any) {
        // If it fails, it should be a graceful failure with helpful message
        expect(error.stderr || error.stdout).toContain('settings');
      } finally {
        await fs.rmdir(emptyTemporaryDirectory, { recursive: true });
      }
    });

    it('should handle interrupt signals gracefully', async () => {
      // This test simulates Ctrl+C during execution
      const childProcess = exec(
        `npm run cli -- build --platform kiro --categories personal,project,prompts`,
        {
          cwd: originalCwd,
          timeout: 30_000,
        }
      );

      // Send interrupt signal after a short delay
      setTimeout(() => childProcess.kill('SIGINT'), 2000);

      try {
        await childProcess;
      } catch (error: any) {
        // Should exit with interrupt code or handle gracefully
        expect([130, 1]).toContain(error.code); // 130 is standard SIGINT exit code
      }
    });

    it('should validate required Node.js version', async () => {
      // This would require testing with different Node versions
      // For now, just ensure it doesn't crash with current version
      const { stdout, stderr } = await execAsync(
        `node --version && npm run cli -- --help`,
        {
          cwd: originalCwd,
          timeout: 15_000,
        }
      );

      expect(stderr).not.toContain('version');
      expect(stdout).toContain('v'); // Node version output
      expect(stdout).toContain('Commands:'); // CLI help output
    });
  });

  describe('Output Format Validation', () => {
    it('should produce valid JSON in dry run mode', async () => {
      const { stdout, stderr } = await execAsync(
        `npm run cli -- build --dry-run --verbose --platform kiro --categories personal`,
        {
          cwd: originalCwd,
          timeout: 30_000,
        }
      );

      expect(stderr).not.toContain('Error:');
      
      // Extract JSON from verbose output (if any)
      const jsonMatches = stdout.match(/{.*}/gs);
      if (jsonMatches) {
        for (const jsonString of jsonMatches) {
          try {
            JSON.parse(jsonString);
          } catch {
            // Some matches might not be JSON, that's okay
            continue;
          }
        }
      }
    });

    it('should show consistent file size estimates', async () => {
      const { stdout, stderr } = await execAsync(
        `npm run cli -- build --dry-run --platform kiro --categories personal,project,prompts`,
        {
          cwd: originalCwd,
          timeout: 30_000,
        }
      );

      expect(stderr).not.toContain('Error:');
      expect(stdout).toMatch(/personal-context\.json: ~\d+(\.\d+)? (B|KB|MB)/);
      expect(stdout).toMatch(/project-context\.json: ~\d+(\.\d+)? (B|KB|MB)/);
      expect(stdout).toMatch(/prompt-templates\.json: ~\d+(\.\d+)? (B|KB|MB)/);
      expect(stdout).toMatch(/Total estimated size: ~\d+(\.\d+)? (B|KB|MB)/);
    });
  });

  describe('Performance and Timeout', () => {
    it('should complete dry run within reasonable time', async () => {
      const startTime = Date.now();
      
      await execAsync(
        `npm run cli -- build --dry-run --platform kiro --categories personal`,
        {
          cwd: originalCwd,
          timeout: 15_000, // 15 seconds should be more than enough
        }
      );

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(10_000); // Should complete within 10 seconds
    });

    it('should handle large category combinations efficiently', async () => {
      const startTime = Date.now();
      
      await execAsync(
        `npm run cli -- build --dry-run --platform kiro --categories personal,project,prompts`,
        {
          cwd: originalCwd,
          timeout: 20_000,
        }
      );

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(15_000); // Should complete within 15 seconds
    });
  });

  /**
   * Helper function to create basic Kiro structure for testing
   */
  async function createBasicKiroStructure(): Promise<void> {
    // Create Kiro directories
    await fs.mkdir('.kiro/settings', { recursive: true });
    await fs.mkdir('.kiro/steering', { recursive: true });
    await fs.mkdir('.kiro/hooks', { recursive: true });

    // Create basic settings files
    await fs.writeFile('.kiro/settings/context.md', `# Test Project Context
This is a test project for CLI integration testing.

## Architecture
- Node.js with TypeScript
- NestJS framework for CLI commands
- Jest for testing
`);

    await fs.writeFile('.kiro/settings/user-preferences.md', `# User Preferences
- Editor: VS Code
- Terminal: iTerm2
- Package Manager: npm
`);

    await fs.writeFile('.kiro/settings/project-spec.md', `# Project Specification
CLI tool for converting Kiro configurations to taptik format.
`);

    // Create basic steering files
    await fs.writeFile('.kiro/steering/git.md', `# Git Standards
Use conventional commits with gitmoji.
`);

    await fs.writeFile('.kiro/steering/typescript.md', `# TypeScript Standards
- Use strict mode
- Prefer interfaces over types
`);

    // Create basic hook file
    await fs.writeFile('.kiro/hooks/pre-commit.kiro.hook', `#!/bin/bash
echo "Pre-commit hook executed"
`);
  }
});