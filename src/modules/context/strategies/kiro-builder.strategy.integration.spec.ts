/* eslint-disable unicorn/no-thenable */
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AIPlatform } from '../interfaces';
import { FileSystemUtility } from '../utils/file-system.utility';

import { KiroBuilderStrategy } from './kiro-builder.strategy';

describe('KiroBuilderStrategy Integration Tests', () => {
  let strategy: KiroBuilderStrategy;
  let testDir: string;
  let fileSystem: FileSystemUtility;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `kiro-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Initialize real FileSystemUtil
    fileSystem = new FileSystemUtility();
    strategy = new KiroBuilderStrategy(fileSystem);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Real Kiro Project Structure', () => {
    it('should extract complete Kiro project with specs, steering, and hooks', async () => {
      // Create a complete Kiro project structure
      const kiroPath = join(testDir, '.kiro');

      // Create directories
      await fs.mkdir(join(kiroPath, 'specs', 'feature1'), { recursive: true });
      await fs.mkdir(join(kiroPath, 'steering'), { recursive: true });
      await fs.mkdir(join(kiroPath, 'hooks'), { recursive: true });
      await fs.mkdir(join(kiroPath, 'settings'), { recursive: true });
      await fs.mkdir(join(kiroPath, 'templates'), { recursive: true });

      // Create spec files
      await fs.writeFile(
        join(kiroPath, 'specs', 'feature1', 'design.md'),
        '# Design\n\nFeature design with {{file:../../../README.md}} reference.',
      );
      await fs.writeFile(
        join(kiroPath, 'specs', 'feature1', 'requirements.md'),
        '# Requirements\n\n- Requirement 1\n- Requirement 2',
      );
      await fs.writeFile(
        join(kiroPath, 'specs', 'feature1', 'tasks.md'),
        '# Tasks\n\n- [ ] Task 1\n- [ ] Task 2',
      );

      // Create a README for file reference
      await fs.writeFile(join(testDir, 'README.md'), '# Test Project');

      // Create steering rules
      await fs.writeFile(
        join(kiroPath, 'steering', 'principle.md'),
        '# Principles\n\nCore principles\n- Clean code\n- Test driven',
      );
      await fs.writeFile(
        join(kiroPath, 'steering', 'persona.md'),
        '# Persona\n\nAgent behavior\n- Professional\n- Helpful',
      );

      // Create hooks
      await fs.writeFile(
        join(kiroPath, 'hooks', 'pre-commit.json'),
        JSON.stringify({
          name: 'pre-commit',
          version: '1.0.0',
          enabled: true,
          description: 'Run tests before commit',
          when: { type: 'pre-commit' },
          then: { type: 'command', command: 'npm test' },
        }),
      );

      // Create MCP settings
      await fs.writeFile(
        join(kiroPath, 'settings', 'mcp.json'),
        JSON.stringify({
          servers: [
            {
              name: 'test-server',
              version: '1.0.0',
              config: { port: 3000 },
              enabled: true,
            },
          ],
        }),
      );

      // Create task template
      await fs.writeFile(
        join(kiroPath, 'templates', 'feature-template.json'),
        JSON.stringify({
          name: 'feature-template',
          description: 'Template for new features',
          tasks: ['Design', 'Implementation', 'Testing'],
        }),
      );

      // Test detection
      const detected = await strategy.detect(testDir);
      expect(detected).toBe(true);

      // Test extraction
      const extracted = await strategy.extract(testDir);
      expect(extracted).toBeDefined();
      expect(extracted.specs).toHaveLength(1);
      expect(extracted.specs[0].name).toBe('feature1');
      expect(extracted.specs[0].design).toContain('# Test Project'); // File reference resolved
      expect(extracted.steeringRules).toHaveLength(2);
      expect(extracted.hooks).toHaveLength(1);
      expect(extracted.mcpSettings).toBeDefined();
      expect(extracted.mcpSettings.servers).toHaveLength(1);
      expect(extracted.taskTemplates).toHaveLength(1);

      // Test normalization
      const context = await strategy.normalize(extracted);
      expect(context.version).toBe('1.0.0');
      expect(context.metadata.platforms).toContain(AIPlatform.KIRO);
      expect(context.ide?.data?.kiro).toBeDefined();
      expect(context.project?.data?.kiro_specs).toHaveLength(1);
      expect(context.tools?.data?.mcp_servers).toHaveLength(1);
    });

    it('should handle hooks with file references', async () => {
      const kiroPath = join(testDir, '.kiro');
      await fs.mkdir(join(kiroPath, 'hooks'), { recursive: true });
      await fs.mkdir(join(kiroPath, 'scripts'), { recursive: true });
      await fs.mkdir(join(kiroPath, 'specs'), { recursive: true }); // Required for detection

      // Create a script file
      await fs.writeFile(
        join(kiroPath, 'scripts', 'test.sh'),
        '#!/bin/bash\necho "Running tests"',
      );

      // Create hook with file reference
      await fs.writeFile(
        join(kiroPath, 'hooks', 'test-hook.json'),
        JSON.stringify({
          name: 'test-hook',
          version: '1.0.0',
          enabled: true,
          when: { type: 'pre-commit' },
          then: {
            type: 'command',
            command: '{{file:scripts/test.sh}}',
          },
        }),
      );

      const extracted = await strategy.extract(testDir);
      expect(extracted.hooks).toHaveLength(1);
      expect(extracted.hooks[0].then.command).toContain('#!/bin/bash');
    });

    it('should handle missing optional directories gracefully', async () => {
      const kiroPath = join(testDir, '.kiro');

      // Create only specs directory
      await fs.mkdir(join(kiroPath, 'specs'), { recursive: true });

      const detected = await strategy.detect(testDir);
      expect(detected).toBe(true);

      const extracted = await strategy.extract(testDir);
      expect(extracted).toBeDefined();
      expect(extracted.specs).toEqual([]);
      expect(extracted.steeringRules).toEqual([]);
      expect(extracted.hooks).toEqual([]);
      expect(extracted.mcpSettings).toBeNull();
      expect(extracted.taskTemplates).toEqual([]);
    });

    it('should validate and filter invalid hooks', async () => {
      const kiroPath = join(testDir, '.kiro');
      await fs.mkdir(join(kiroPath, 'hooks'), { recursive: true });
      await fs.mkdir(join(kiroPath, 'specs'), { recursive: true }); // Required for detection

      // Create valid hook
      await fs.writeFile(
        join(kiroPath, 'hooks', 'valid.json'),
        JSON.stringify({
          name: 'valid-hook',
          version: '1.0.0',
          enabled: true,
          when: { type: 'test' },
          then: { type: 'command', command: 'test' },
        }),
      );

      // Create invalid hook (missing required fields)
      await fs.writeFile(
        join(kiroPath, 'hooks', 'invalid.json'),
        JSON.stringify({
          enabled: true,
          when: { type: 'test' },
        }),
      );

      // Create malformed JSON
      await fs.writeFile(
        join(kiroPath, 'hooks', 'malformed.json'),
        '{ invalid json }',
      );

      const extracted = await strategy.extract(testDir);
      // Only valid hook should be extracted
      expect(extracted.hooks).toHaveLength(1);
      expect(extracted.hooks[0].name).toBe('valid-hook');
    });

    it('should sort hooks and MCP servers by priority', async () => {
      const kiroPath = join(testDir, '.kiro');
      await fs.mkdir(join(kiroPath, 'hooks'), { recursive: true });
      await fs.mkdir(join(kiroPath, 'settings'), { recursive: true });
      await fs.mkdir(join(kiroPath, 'specs'), { recursive: true }); // Required for detection

      // Create hooks with different enabled states
      await fs.writeFile(
        join(kiroPath, 'hooks', 'disabled.json'),
        JSON.stringify({
          name: 'z-disabled',
          version: '1.0.0',
          enabled: false,
          when: { type: 'test' },
          then: { type: 'command', command: 'test' },
        }),
      );

      await fs.writeFile(
        join(kiroPath, 'hooks', 'enabled.json'),
        JSON.stringify({
          name: 'a-enabled',
          version: '1.0.0',
          enabled: true,
          when: { type: 'test' },
          then: { type: 'command', command: 'test' },
        }),
      );

      // Create MCP servers with different enabled states
      await fs.writeFile(
        join(kiroPath, 'settings', 'mcp.json'),
        JSON.stringify({
          servers: [
            { name: 'z-server', enabled: false },
            { name: 'a-server', enabled: true },
            { name: 'b-server', enabled: true },
          ],
        }),
      );

      const extracted = await strategy.extract(testDir);

      // Enabled hooks should come first
      expect(extracted.hooks[0].name).toBe('a-enabled');
      expect(extracted.hooks[1].name).toBe('z-disabled');

      // Enabled servers should come first, then sorted by name
      expect(extracted.mcpSettings.servers[0].name).toBe('a-server');
      expect(extracted.mcpSettings.servers[1].name).toBe('b-server');
      expect(extracted.mcpSettings.servers[2].name).toBe('z-server');
    });

    it('should build complete context from real Kiro project', async () => {
      const kiroPath = join(testDir, '.kiro');
      await fs.mkdir(join(kiroPath, 'specs'), { recursive: true });
      await fs.mkdir(join(kiroPath, 'steering'), { recursive: true });

      await fs.writeFile(
        join(kiroPath, 'steering', 'test.md'),
        '# Test\n- Rule 1',
      );

      const context = await strategy.build(testDir);
      expect(context).toBeDefined();
      expect(context.version).toBe('1.0.0');
      expect(context.metadata.platforms).toContain(AIPlatform.KIRO);
      expect(context.ide?.data?.kiro?.steering_rules).toHaveLength(1);
    });
  });
});
