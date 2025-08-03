import { vi } from 'vitest';

// Global mocks for file system operations
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(),
  readdir: vi.fn(),
  copyFile: vi.fn(),
}));

// Global mocks for Node.js modules
vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

// Global test configuration
process.env.NODE_ENV = 'test';

// Increase timeout for NestJS module compilation
vi.setConfig({ testTimeout: 10000 });
