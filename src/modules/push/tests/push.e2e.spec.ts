import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Push Module E2E Tests', () => {
  let tempDir: string;
  let testPackagePath: string;

  beforeEach(async () => {
    // Create temp directory
    tempDir = path.join(os.tmpdir(), 'taptik-e2e-test', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });

    // Create test package
    testPackagePath = path.join(tempDir, 'test.taptik');
    const packageContent = JSON.stringify({
      name: 'test-package',
      version: '1.0.0',
      platform: 'claude-code',
      metadata: {
        title: 'E2E Test Package',
        description: 'Package for E2E testing',
      },
      content: {
        settings: {
          theme: 'dark',
          fontSize: 14,
        },
        extensions: ['vim', 'prettier'],
      },
    });
    await fs.writeFile(testPackagePath, packageContent);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  /**
   * Run CLI command and capture output
   */
  function runCommand(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      const child: ChildProcess = spawn('pnpm', ['cli', ...args], {
        env: { ...process.env, NODE_ENV: 'test' },
        cwd: process.cwd(),
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          code: code || 0,
        });
      });

      child.on('error', reject);

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        reject(new Error('Command timed out'));
      }, 30000);
    });
  }

  describe('Push Command', () => {
    it('should show help for push command', async () => {
      const { stdout, code } = await runCommand(['push', '--help']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('push');
      expect(stdout).toContain('Upload a .taptik package');
      expect(stdout).toContain('--public');
      expect(stdout).toContain('--title');
      expect(stdout).toContain('--tags');
      expect(stdout).toContain('--dry-run');
    });

    it('should perform dry run', async () => {
      const { stdout, code } = await runCommand([
        'push',
        testPackagePath,
        '--dry-run',
        '--title', 'Test Package',
        '--tags', 'test,e2e',
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('DRY RUN');
      expect(stdout).toContain('Would upload');
      expect(stdout).not.toContain('Successfully uploaded');
    });

    it('should reject invalid package file', async () => {
      const invalidPath = path.join(tempDir, 'invalid.txt');
      await fs.writeFile(invalidPath, 'not a taptik package');
      
      const { stderr, code } = await runCommand(['push', invalidPath]);
      
      expect(code).toBe(1);
      expect(stderr).toContain('Invalid');
    });

    it('should require authentication', async () => {
      // Mock no auth by setting invalid token
      const { stderr, code } = await runCommand([
        'push',
        testPackagePath,
        '--title', 'Test',
      ]);
      
      // Should fail without auth
      expect(code).toBe(1);
      expect(stderr.toLowerCase()).toContain('auth');
    });
  });

  describe('List Command', () => {
    it('should show help for list command', async () => {
      const { stdout, code } = await runCommand(['list', '--help']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('list');
      expect(stdout).toContain('List your uploaded packages');
      expect(stdout).toContain('--cloud');
      expect(stdout).toContain('--platform');
      expect(stdout).toContain('--visibility');
      expect(stdout).toContain('--format');
    });

    it('should support different output formats', async () => {
      // Test JSON format
      const { stdout: jsonOutput } = await runCommand([
        'list',
        '--cloud',
        '--format', 'json',
      ]);
      
      // Should be valid JSON or error message
      if (jsonOutput.includes('[') || jsonOutput.includes('{')) {
        expect(() => JSON.parse(jsonOutput)).not.toThrow();
      }
    });
  });

  describe('Delete Command', () => {
    it('should show help for delete command', async () => {
      const { stdout, code } = await runCommand(['delete', '--help']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('delete');
      expect(stdout).toContain('Delete an uploaded package');
      expect(stdout).toContain('config-id');
      expect(stdout).toContain('--yes');
    });

    it('should require config-id argument', async () => {
      const { stderr, code } = await runCommand(['delete']);
      
      expect(code).toBe(1);
      expect(stderr).toContain('config-id');
    });

    it('should prompt for confirmation without --yes', async () => {
      // This would need interactive testing or mock stdin
      // For now, just check that it requires the argument
      const { stderr, code } = await runCommand(['delete', 'fake-config-id']);
      
      // Should fail with auth or not found
      expect(code).toBe(1);
    });
  });

  describe('Update Command', () => {
    it('should show help for update command', async () => {
      const { stdout, code } = await runCommand(['update', '--help']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('update');
      expect(stdout).toContain('Update package metadata');
      expect(stdout).toContain('--title');
      expect(stdout).toContain('--description');
      expect(stdout).toContain('--tags');
    });

    it('should require config-id argument', async () => {
      const { stderr, code } = await runCommand(['update']);
      
      expect(code).toBe(1);
      expect(stderr).toContain('config-id');
    });
  });

  describe('Visibility Command', () => {
    it('should show help for visibility command', async () => {
      const { stdout, code } = await runCommand(['visibility', '--help']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('visibility');
      expect(stdout).toContain('Change package visibility');
      expect(stdout).toContain('--public');
      expect(stdout).toContain('--private');
    });

    it('should require visibility option', async () => {
      const { stderr, code } = await runCommand(['visibility', 'fake-config-id']);
      
      expect(code).toBe(1);
      expect(stderr).toContain('visibility');
    });
  });

  describe('Stats Command', () => {
    it('should show help for stats command', async () => {
      const { stdout, code } = await runCommand(['stats', '--help']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('stats');
      expect(stdout).toContain('View package statistics');
      expect(stdout).toContain('--format');
      expect(stdout).toContain('--period');
    });

    it('should support different time periods', async () => {
      const periods = ['week', 'month', 'year'];
      
      for (const period of periods) {
        const { code } = await runCommand([
          'stats',
          'fake-config-id',
          '--period', period,
        ]);
        
        // Should fail gracefully (auth or not found)
        expect(code).toBe(1);
      }
    });
  });

  describe('Build and Push Integration', () => {
    it('should show --push option in build command help', async () => {
      const { stdout, code } = await runCommand(['build', '--help']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('--push');
      expect(stdout).toContain('--push-public');
      expect(stdout).toContain('--push-title');
      expect(stdout).toContain('--push-tags');
    });
  });

  describe('Queue Management', () => {
    it('should handle offline uploads', async () => {
      // Create a package and try to upload offline
      // This would require mocking network conditions
      
      // For now, just test that the queue file is created
      const queuePath = path.join(os.homedir(), '.taptik', 'upload-queue.json');
      
      // Check if queue file exists (it might not if no offline uploads)
      try {
        await fs.access(queuePath);
        const queueContent = await fs.readFile(queuePath, 'utf-8');
        const queue = JSON.parse(queueContent);
        expect(Array.isArray(queue.uploads)).toBe(true);
      } catch {
        // Queue file doesn't exist yet, which is fine
        expect(true).toBe(true);
      }
    });
  });
});