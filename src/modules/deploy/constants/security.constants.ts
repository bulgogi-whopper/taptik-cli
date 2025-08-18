import { SecurityConfig } from '../interfaces/security-config.interface';

export const DANGEROUS_COMMAND_PATTERNS: RegExp[] = [
  /rm\s+-rf\s+\//gi,
  /rm\s+-rf\s+~/gi,
  /rm\s+-rf\s+\*/gi,
  /eval\s*\(/gi,
  /exec\s*\(/gi,
  /require\s*\(["']child_process["']\)/gi,
  /process\.exit/gi,
  />\s*\/dev\/null\s+2>&1/gi,
  /curl\s+.*\|\s*sh/gi,
  /wget\s+.*\|\s*sh/gi,
  /chmod\s+777/gi,
  /sudo\s+/gi,
  /mkfs/gi,
  /dd\s+if=/gi,
  /format\s+c:/gi,
];

export const WHITELISTED_COMMANDS: string[] = [
  'ls',
  'cd',
  'pwd',
  'echo',
  'cat',
  'grep',
  'find',
  'npm',
  'pnpm',
  'yarn',
  'git',
  'node',
  'npx',
  'mkdir',
  'touch',
  'cp',
  'mv',
];

export const PATH_TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.\//g,
  /\.\.\\/g,
  /%2e%2e%2f/gi,
  /%2e%2e\//gi,
  /\.\.%2f/gi,
  /\.\.%252f/gi,
];

export const BLOCKED_PATHS: string[] = [
  '/etc/passwd',
  '/etc/shadow',
  '/etc/sudoers',
  '/System',
  '/Windows/System32',
  '~/.ssh/id_rsa',
  '~/.ssh/id_ed25519',
  '~/.aws/credentials',
  '~/.config/gcloud',
];

export const ALLOWED_BASE_PATHS: string[] = [
  '~/.claude',
  '~/.kiro',
  '~/.cursor',
  '.claude',
  '.kiro',
  '.cursor',
  '.mcp.json',
  'CLAUDE.md',
  '.cursorrules',
];

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  dangerousPatterns: DANGEROUS_COMMAND_PATTERNS,
  whitelistedCommands: WHITELISTED_COMMANDS,
  sensitiveDataPatterns: [
    /api[_-]?key/gi,
    /secret[_-]?key/gi,
    /access[_-]?token/gi,
    /private[_-]?key/gi,
    /client[_-]?secret/gi,
    /auth[_-]?token/gi,
    /bearer\s+[\w+./~-]+=*/gi,
  ],
  pathValidation: {
    allowedPaths: ALLOWED_BASE_PATHS,
    blockedPaths: BLOCKED_PATHS,
  },
};

export const SECURITY_SCAN_TIMEOUT = 30000; // 30 seconds
export const MAX_FILE_SIZE_FOR_SCAN = 10 * 1024 * 1024; // 10MB
