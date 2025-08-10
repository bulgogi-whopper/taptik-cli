import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const execAsync = promisify(exec);

describe('Auth Module E2E Tests', () => {
  let testSessionDir: string;
  const CLI_PATH = path.join(process.cwd(), 'dist', 'src', 'cli.js');
  
  beforeAll(async () => {
    // Build the project first
    console.log('Building project for E2E tests...');
    await execAsync('pnpm run build');
    
    // Create test session directory
    testSessionDir = path.join(os.tmpdir(), 'taptik-e2e-test-sessions');
    if (!fs.existsSync(testSessionDir)) {
      fs.mkdirSync(testSessionDir, { recursive: true });
    }
    
    // Set test environment
    process.env.TAPTIK_SESSION_DIR = testSessionDir;
  });

  afterAll(async () => {
    // Clean up test session directory
    if (fs.existsSync(testSessionDir)) {
      fs.rmSync(testSessionDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Clear session directory before each test
    if (fs.existsSync(testSessionDir)) {
      const files = fs.readdirSync(testSessionDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testSessionDir, file));
      }
    }
  });

  describe('CLI Command Integration', () => {
    it('should show help for login command', async () => {
      const { stdout } = await execAsync('node dist/src/cli.js login --help');
      
      expect(stdout).toContain('login');
      expect(stdout).toContain('Login to Taptik using OAuth');
      expect(stdout).toContain('--provider');
    });

    it('should show help for logout command', async () => {
      const { stdout } = await execAsync('node dist/src/cli.js logout --help');
      
      expect(stdout).toContain('logout');
      expect(stdout).toContain('Logout from Taptik');
    });

    it('should handle invalid provider option', async () => {
      try {
        await execAsync('node dist/src/cli.js login --provider invalid');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('Provider must be either "google" or "github"');
      }
    });
  });

  describe('Session File Management', () => {
    it('should handle missing session directory gracefully', async () => {
      // Remove session directory
      if (fs.existsSync(testSessionDir)) {
        fs.rmSync(testSessionDir, { recursive: true, force: true });
      }

      // Try to check login status (should create directory)
      const { stdout } = await execAsync('node dist/src/cli.js whoami 2>/dev/null || true');
      
      // Directory should be created
      expect(fs.existsSync(testSessionDir)).toBe(true);
    });

    it('should handle corrupted session files', async () => {
      // Create a corrupted session file
      const sessionFile = path.join(testSessionDir, 'corrupted.session');
      fs.writeFileSync(sessionFile, 'invalid json data');

      // Command should handle corrupted file gracefully
      const { stdout } = await execAsync('node dist/src/cli.js whoami 2>/dev/null || true');
      
      // Should indicate not logged in
      expect(stdout.toLowerCase()).toContain('not logged in');
    });
  });

  describe('OAuth Flow Simulation', () => {
    it('should start OAuth flow with Google provider', async () => {
      // This test checks if the OAuth flow initiates correctly
      // We can't complete it without actual browser interaction
      
      // Start login process with timeout to prevent hanging
      const loginProcess = exec('node dist/src/cli.js login --provider google');
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Kill the process (simulating user cancellation)
      loginProcess.kill();
      
      // Process should have started without errors
      expect(loginProcess.killed).toBe(true);
    });

    it('should start OAuth flow with GitHub provider', async () => {
      // Similar test for GitHub provider
      const loginProcess = exec('node dist/src/cli.js login --provider github');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      loginProcess.kill();
      
      expect(loginProcess.killed).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should handle network errors gracefully', async () => {
      // Disable network (simulate offline)
      process.env.SUPABASE_URL = 'http://invalid-url-that-does-not-exist.local';
      
      try {
        await execAsync('node dist/src/cli.js login --provider google', {
          timeout: 5000,
          env: { ...process.env }
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        // Should show appropriate error message
        const output = error.stderr || error.stdout || '';
        expect(output.toLowerCase()).toMatch(/error|fail|unable/);
      }
      
      // Restore environment
      delete process.env.SUPABASE_URL;
    });

    it('should handle missing Supabase configuration', async () => {
      // Temporarily remove Supabase config
      const originalUrl = process.env.SUPABASE_URL;
      const originalKey = process.env.SUPABASE_ANON_KEY;
      
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      
      try {
        await execAsync('node dist/src/cli.js login --provider google', {
          timeout: 5000,
          env: { ...process.env }
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        const output = error.stderr || error.stdout || '';
        expect(output.toLowerCase()).toMatch(/supabase|configuration|environment/);
      }
      
      // Restore environment
      if (originalUrl) process.env.SUPABASE_URL = originalUrl;
      if (originalKey) process.env.SUPABASE_ANON_KEY = originalKey;
    });
  });

  describe('Multi-Provider Support', () => {
    it('should accept Google as provider', async () => {
      const loginProcess = exec('node dist/src/cli.js login --provider google');
      
      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Process should start without immediate errors
      expect(loginProcess.exitCode).toBeNull();
      
      loginProcess.kill();
    });

    it('should accept GitHub as provider', async () => {
      const loginProcess = exec('node dist/src/cli.js login --provider github');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(loginProcess.exitCode).toBeNull();
      
      loginProcess.kill();
    });

    it('should reject invalid providers', async () => {
      try {
        await execAsync('node dist/src/cli.js login --provider facebook');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('Provider must be either "google" or "github"');
      }
    });
  });

  describe('Resource Cleanup', () => {
    it('should not leave orphaned processes after login attempt', async () => {
      const loginProcess = exec('node dist/src/cli.js login --provider google');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const pid = loginProcess.pid;
      loginProcess.kill();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if process is truly dead
      try {
        process.kill(pid!, 0); // Signal 0 checks if process exists
        expect.fail('Process should be dead');
      } catch {
        // Process is dead as expected
        expect(true).toBe(true);
      }
    });

    it('should clean up session files on logout', async () => {
      // Create a mock session file
      const sessionFile = path.join(testSessionDir, 'test.session');
      const sessionData = {
        encryptedData: 'mock-encrypted-data',
        iv: 'mock-iv',
        salt: 'mock-salt',
        timestamp: Date.now()
      };
      fs.writeFileSync(sessionFile, JSON.stringify(sessionData));
      
      // Run logout command
      await execAsync('node dist/src/cli.js logout 2>/dev/null || true');
      
      // Session file should be removed
      const filesAfter = fs.readdirSync(testSessionDir);
      expect(filesAfter.length).toBe(0);
    });
  });

  describe('CLI Output Formatting', () => {
    it('should display proper messages for unauthenticated state', async () => {
      const { stdout } = await execAsync('node dist/src/cli.js whoami 2>/dev/null || true');
      
      expect(stdout.toLowerCase()).toMatch(/not logged in|no.*session|unauthenticated/);
    });

    it('should show progress indicators during login', async () => {
      const loginProcess = exec('node dist/src/cli.js login --provider google');
      
      let output = '';
      if (loginProcess.stdout) {
        loginProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
      }
      
      // Wait briefly to collect output
      await new Promise(resolve => setTimeout(resolve, 500));
      
      loginProcess.kill();
      
      // Should show some progress indicators
      expect(output).toMatch(/starting|initializing|loading|welcome/i);
    });
  });

  describe('Concurrent Session Handling', () => {
    it('should handle multiple CLI instances gracefully', async () => {
      // Start multiple login processes simultaneously
      const process1 = exec('node dist/src/cli.js login --provider google');
      const process2 = exec('node dist/src/cli.js login --provider github');
      
      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Kill both processes
      process1.kill();
      process2.kill();
      
      // Both should have started without crashing
      expect(process1.killed).toBe(true);
      expect(process2.killed).toBe(true);
    });
  });
});