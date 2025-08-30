import { CursorSecurityConfig } from '../services/cursor-security-enforcer.service';

// AI-specific security patterns
export const AI_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+previous\s+instructions/gi,
  /forget\s+everything\s+above/gi,
  /system\s+prompt\s+override/gi,
  /jailbreak/gi,
  /prompt\s+injection/gi,
  /role\s*:\s*system/gi,
  /assistant\s+mode\s+off/gi,
  /debug\s+mode\s+on/gi,
  /\[SYSTEM\]/gi,
  /\[ADMIN\]/gi,
  /sudo\s+mode/gi,
  /privilege\s+escalation/gi,
  /bypass\s+safety/gi,
  /override\s+guidelines/gi,
  /act\s+as\s+if/gi,
];

// Malicious AI content patterns
export const MALICIOUS_AI_PATTERNS: RegExp[] = [
  // Data exfiltration patterns
  /extract\s+sensitive\s+data/gi,
  /copy\s+confidential/gi,
  /steal\s+information/gi,
  /exfiltrate/gi,
  
  // Social engineering patterns
  /phishing/gi,
  /social\s+engineering/gi,
  /impersonat/gi,
  /deceive/gi,
  
  // Harmful instruction patterns
  /create\s+malware/gi,
  /generate\s+virus/gi,
  /hack\s+into/gi,
  /ddos\s+attack/gi,
  /vulnerability\s+exploit/gi,
  
  // Privacy violation patterns
  /personal\s+information/gi,
  /private\s+data/gi,
  /confidential\s+content/gi,
];

// Trusted AI providers and models
export const TRUSTED_AI_PROVIDERS: string[] = [
  'openai',
  'anthropic',
  'cursor-ai',
  'github-copilot',
  'microsoft',
  'google',
  'meta',
  'huggingface',
];

// Blocked/suspicious AI providers
export const BLOCKED_AI_PROVIDERS: string[] = [
  'suspicious-ai-provider',
  'untrusted-llm',
  'malicious-ai-service',
];

// Trusted extension publishers for Cursor
export const TRUSTED_CURSOR_EXTENSION_PUBLISHERS: string[] = [
  'ms-vscode',
  'github',
  'microsoft',
  'cursor',
  'anthropic',
  'openai',
  'vercel',
  'stripe',
  'mongodb',
  'prisma',
  'tailwindlabs',
  'bradlc',
  'esbenp',
  'formulahendry',
  'ms-python',
  'ms-toolsai',
  'redhat',
  'hashicorp',
  'docker',
];

// Known malicious or problematic extensions
export const BLOCKED_CURSOR_EXTENSIONS: string[] = [
  'malicious-publisher.suspicious-extension',
  'untrusted.data-collector',
  'spyware.keylogger',
  'backdoor.remote-access',
];

// High-risk extension patterns
export const RISKY_EXTENSION_PATTERNS: RegExp[] = [
  /keylog/gi,
  /backdoor/gi,
  /malware/gi,
  /spyware/gi,
  /trojan/gi,
  /virus/gi,
  /remote[\s-]access/gi,
  /data[\s-]collector/gi,
  /password[\s-]steal/gi,
  /credential[\s-]harvest/gi,
];

// Debug command whitelist for Cursor
export const ALLOWED_CURSOR_DEBUG_COMMANDS: string[] = [
  'node',
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'deno',
  'python',
  'python3',
  'pip',
  'pip3',
  'java',
  'javac',
  'maven',
  'gradle',
  'cargo',
  'rustc',
  'go',
  'dotnet',
  'php',
  'composer',
  'ruby',
  'gem',
  'bundle',
  'rails',
  'docker',
  'kubectl',
  'helm',
  'terraform',
  'git',
  'gh',
  'code',
  'cursor',
];

// Blocked task types that could be dangerous
export const BLOCKED_CURSOR_TASK_TYPES: string[] = [
  'shell-dangerous',
  'system-modification',
  'network-scan',
  'privilege-escalation',
  'data-exfiltration',
];

// Dangerous debug/task patterns
export const DANGEROUS_DEBUG_PATTERNS: RegExp[] = [
  // System modification
  /rm\s+-rf\s+\//gi,
  /format\s+c:/gi,
  /del\s+\/s\s+\/q/gi,
  /mkfs/gi,
  
  // Network scanning
  /nmap\s+/gi,
  /netstat\s+-an/gi,
  /port\s+scan/gi,
  
  // Credential access
  /cat\s+\/etc\/passwd/gi,
  /cat\s+\/etc\/shadow/gi,
  /registry\s+export/gi,
  
  // Process manipulation
  /kill\s+-9\s+/gi,
  /killall\s+/gi,
  /taskkill\s+\/f/gi,
  
  // File system access
  /find\s+\/\s+-name\s+\*\.key/gi,
  /grep\s+-r\s+password/gi,
  /locate\s+\*\.ssh/gi,
];

// Workspace trust indicators (positive)
export const WORKSPACE_TRUST_INDICATORS: {
  pattern: RegExp;
  score: number;
  description: string;
}[] = [
  {
    pattern: /\/projects?\//gi,
    score: 0.3,
    description: 'Located in projects directory',
  },
  {
    pattern: /\/src\//gi,
    score: 0.2,
    description: 'Contains source code directory',
  },
  {
    pattern: /\.git$/gi,
    score: 0.3,
    description: 'Git repository',
  },
  {
    pattern: /package\.json$/gi,
    score: 0.2,
    description: 'Node.js project',
  },
  {
    pattern: /Cargo\.toml$/gi,
    score: 0.2,
    description: 'Rust project',
  },
  {
    pattern: /pyproject\.toml|requirements\.txt$/gi,
    score: 0.2,
    description: 'Python project',
  },
  {
    pattern: /\.sln|\.csproj$/gi,
    score: 0.2,
    description: '.NET project',
  },
];

// Workspace security risk indicators (negative)
export const WORKSPACE_RISK_INDICATORS: {
  pattern: RegExp;
  severity: 'high' | 'medium' | 'low';
  description: string;
}[] = [
  {
    pattern: /\/tmp\//gi,
    severity: 'high',
    description: 'Located in temporary directory',
  },
  {
    pattern: /\/Downloads\//gi,
    severity: 'medium',
    description: 'Located in downloads directory',
  },
  {
    pattern: /\.exe$|\.bat$|\.cmd$/gi,
    severity: 'high',
    description: 'Contains executable files',
  },
  {
    pattern: /malware|virus|trojan|backdoor/gi,
    severity: 'high',
    description: 'Contains suspicious keywords',
  },
  {
    pattern: /\/root\//gi,
    severity: 'high',
    description: 'Located in root directory',
  },
  {
    pattern: /\/System32\//gi,
    severity: 'high',
    description: 'Located in system directory',
  },
];

// AI content size limits
export const AI_CONTENT_LIMITS = {
  MAX_AI_RULES_SIZE: 1024 * 1024, // 1MB
  MAX_PROMPT_LENGTH: 50000, // 50k characters
  MAX_TEMPLATE_SIZE: 100 * 1024, // 100KB
  MAX_CONTEXT_SIZE: 2 * 1024 * 1024, // 2MB
  WARNING_THRESHOLD: 500 * 1024, // 500KB
};

// Extension security thresholds
export const EXTENSION_SECURITY_THRESHOLDS = {
  MAX_UNTRUSTED_EXTENSIONS: 5,
  MAX_UNSIGNED_EXTENSIONS: 3,
  MIN_PUBLISHER_TRUST_SCORE: 0.7,
  SIGNATURE_VALIDATION_TIMEOUT: 5000, // 5 seconds
};

// Workspace trust thresholds
export const WORKSPACE_TRUST_THRESHOLDS = {
  TRUSTED_THRESHOLD: 0.8,
  RESTRICTED_THRESHOLD: 0.5,
  AUTO_TRUST_THRESHOLD: 0.7,
  MAX_RISK_SCORE: 0.3,
};

// Task complexity limits
export const TASK_COMPLEXITY_LIMITS = {
  MAX_COMPLEXITY_SCORE: 15,
  MAX_COMMAND_CHAIN_LENGTH: 5,
  MAX_DEPENDENCY_DEPTH: 3,
  MAX_CONCURRENT_TASKS: 10,
};

// Default Cursor security configuration
export const DEFAULT_CURSOR_SECURITY_CONFIG: CursorSecurityConfig = {
  maxAIContentSize: AI_CONTENT_LIMITS.MAX_AI_RULES_SIZE,
  maxPromptLength: AI_CONTENT_LIMITS.MAX_PROMPT_LENGTH,
  allowedAIProviders: TRUSTED_AI_PROVIDERS,
  blockedAIPatterns: [...AI_INJECTION_PATTERNS, ...MALICIOUS_AI_PATTERNS],
  trustedExtensionPublishers: TRUSTED_CURSOR_EXTENSION_PUBLISHERS,
  blockedExtensions: BLOCKED_CURSOR_EXTENSIONS,
  requireSignedExtensions: false,
  trustedWorkspacePaths: [
    '/home/*/projects',
    '/Users/*/Documents/projects',
    '/Users/*/Developer',
    '/workspace',
    '/src',
    '/code',
  ],
  requireExplicitTrust: true,
  autoTrustThreshold: WORKSPACE_TRUST_THRESHOLDS.AUTO_TRUST_THRESHOLD,
  allowedDebugCommands: ALLOWED_CURSOR_DEBUG_COMMANDS,
  blockedTaskTypes: BLOCKED_CURSOR_TASK_TYPES,
  maxTaskComplexity: TASK_COMPLEXITY_LIMITS.MAX_COMPLEXITY_SCORE,
};

// Security scan timeouts
export const CURSOR_SECURITY_TIMEOUTS = {
  AI_CONTENT_SCAN: 30000, // 30 seconds
  EXTENSION_VALIDATION: 15000, // 15 seconds
  WORKSPACE_TRUST_CALC: 10000, // 10 seconds
  DEBUG_TASK_SCAN: 20000, // 20 seconds
  TOTAL_SECURITY_SCAN: 60000, // 1 minute
};