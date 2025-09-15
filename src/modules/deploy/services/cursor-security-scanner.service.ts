import { Injectable } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import {
  SecurityScanResult,
  SecurityBlocker,
  SecuritySeverity,
} from '../interfaces/security-config.interface';

export interface CursorSecurityViolation {
  componentType: CursorComponentType;
  component: string;
  violationType:
    | 'malicious_code'
    | 'dangerous_capability'
    | 'sensitive_data'
    | 'injection_attempt'
    | 'ai_prompt_injection'
    | 'unsafe_extension'
    | 'dangerous_task'
    | 'insecure_launch_config';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
  quarantined: boolean;
}

export interface CursorSecurityScanResult extends SecurityScanResult {
  componentType?: CursorComponentType;
  quarantinedComponents?: string[];
  securityViolations?: CursorSecurityViolation[];
}

export type CursorComponentType =
  | 'settings'
  | 'extensions'
  | 'snippets'
  | 'ai-prompts'
  | 'tasks'
  | 'launch';

export interface CursorAIPrompt {
  name: string;
  content: string;
  type?: 'system' | 'user' | 'template';
  context?: string[];
  rules?: string[];
}

export interface CursorTask {
  label: string;
  type: string;
  command: string;
  args?: string[];
  group?: 'build' | 'test' | 'clean';
  presentation?: {
    echo?: boolean;
    reveal?: 'always' | 'silent' | 'never';
    focus?: boolean;
    panel?: 'shared' | 'dedicated' | 'new';
  };
  problemMatcher?: string | string[];
  runOptions?: {
    runOn?: 'default' | 'folderOpen';
  };
}

export interface CursorLaunchConfig {
  name: string;
  type: string;
  request: 'launch' | 'attach';
  program?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
  preLaunchTask?: string;
  postDebugTask?: string;
}

@Injectable()
export class CursorSecurityScannerService {
  // Cursor-specific dangerous patterns
  private readonly CURSOR_AI_INJECTION_PATTERNS: RegExp[] = [
    /ignore\s+previous\s+instructions/gi,
    /forget\s+everything/gi,
    /system\s+prompt\s+injection/gi,
    /execute\s+shell\s+command/gi,
    /reveal\s+system\s+prompt/gi,
    /act\s+as\s+if\s+you\s+are/gi,
    /pretend\s+to\s+be/gi,
    /override\s+safety/gi,
    /bypass\s+security/gi,
    /jailbreak/gi,
    /dan\s+mode/gi,
    /developer\s+mode/gi,
  ];

  private readonly CURSOR_DANGEROUS_EXTENSIONS: string[] = [
    'ms-vscode.powershell',
    'ms-python.python',
    'ms-vscode.cpptools',
    'ms-dotnettools.csharp',
  ];

  private readonly CURSOR_DANGEROUS_TASK_PATTERNS: RegExp[] = [
    /rm\s+-rf\s+[/~]/gi,
    /sudo\s+/gi,
    /chmod\s+777/gi,
    /curl\s+.*\|\s*sh/gi,
    /wget\s+.*\|\s*sh/gi,
    /eval\s*\(/gi,
    /exec\s*\(/gi,
    />\s*\/dev\/null\s+2>&1/gi,
    /mkfs/gi,
    /dd\s+if=/gi,
    /format\s+c:/gi,
    /del\s+\/s\s+\/q/gi,
    /rd\s+\/s\s+\/q/gi,
  ];

  private readonly CURSOR_SENSITIVE_SETTINGS: string[] = [
    'cursor.ai.apiKey',
    'cursor.ai.token',
    'cursor.ai.secret',
    'security.workspace.trust.enabled',
    'extensions.autoUpdate',
    'terminal.integrated.allowChords',
    'terminal.integrated.allowMnemonics',
  ];

  async scanCursorContext(context: TaptikContext): Promise<CursorSecurityScanResult> {
    const violations: CursorSecurityViolation[] = [];
    const quarantinedComponents: string[] = [];
    const blockers: SecurityBlocker[] = [];

    // Extract Cursor-specific components from context
    const cursorComponents = this.extractCursorComponents(context);

    // Scan each component type
    const componentEntries = Object.entries(cursorComponents);
    const scanPromises = componentEntries.map(async ([componentType, components]) => ({
      componentType: componentType as CursorComponentType,
      components,
      violations: await this.scanCursorComponentType(
        componentType as CursorComponentType,
        components,
      ),
    }));

    const allComponentResults = await Promise.all(scanPromises);
    for (const { componentType, components, violations: componentViolations } of allComponentResults) {
      violations.push(...componentViolations);

      // Quarantine components with critical or high severity violations
      const highSeverityViolations = componentViolations.filter(
        (v) => v.severity === 'critical' || v.severity === 'high',
      );

      if (highSeverityViolations.length > 0) {
        const componentNames = Array.isArray(components)
          ? components.map((_c, i) => `${componentType}-${i}`)
          : [componentType];

        quarantinedComponents.push(...componentNames);

        for (const violation of highSeverityViolations) {
          blockers.push({
            type:
              violation.violationType === 'injection_attempt' ||
              violation.violationType === 'ai_prompt_injection'
                ? 'injection'
                : violation.violationType === 'malicious_code'
                  ? 'malicious'
                  : 'unauthorized',
            message: `${componentType}/${violation.component}: ${violation.description}`,
            location: violation.component,
            details: { violation },
          });
        }
      }
    }

    const highSeverityCount = violations.filter(
      (v) => v.severity === 'high' || v.severity === 'critical',
    ).length;
    const mediumSeverityCount = violations.filter(
      (v) => v.severity === 'medium',
    ).length;
    const lowSeverityCount = violations.filter(
      (v) => v.severity === 'low',
    ).length;

    return {
      passed: blockers.length === 0,
      isSafe: blockers.length === 0,
      hasApiKeys: violations.some((v) => v.violationType === 'sensitive_data'),
      hasMaliciousCommands: violations.some(
        (v) => v.violationType === 'malicious_code',
      ),
      blockers,
      warnings: violations
        .filter((v) => v.severity === 'medium')
        .map((v) => ({
          type: 'data' as const,
          message: v.description,
          location: v.component,
          severity: SecuritySeverity.MEDIUM,
        })),
      errors: violations
        .filter((v) => v.severity === 'high')
        .map((v) => ({
          type: 'data' as const,
          message: v.description,
          location: v.component,
          severity: SecuritySeverity.HIGH,
          recoverable: false,
        })),
      quarantinedComponents,
      securityViolations: violations,
      summary: {
        totalIssues: violations.length,
        warnings: mediumSeverityCount,
        errors: highSeverityCount,
        blockers: blockers.length,
        highSeverity: highSeverityCount,
        mediumSeverity: mediumSeverityCount,
        lowSeverity: lowSeverityCount,
      },
    };
  }

  private extractCursorComponents(context: TaptikContext): Record<CursorComponentType, unknown> {
    const components: Record<CursorComponentType, unknown> = {
      settings: null,
      extensions: null,
      snippets: null,
      'ai-prompts': null,
      tasks: null,
      launch: null,
    };

    // Extract components from context based on Taptik structure
    const content = context.content as Record<string, unknown>;

    const cursorContent = content.cursor as Record<string, unknown> | undefined;
    if (cursorContent) {
      components.settings = cursorContent.settings;
      components.extensions = cursorContent.extensions;
      components.snippets = cursorContent.snippets;
      components['ai-prompts'] = cursorContent.aiPrompts || cursorContent['ai-prompts'];
      components.tasks = cursorContent.tasks;
      components.launch = cursorContent.launch;
    }

    // Also check for components in the general structure
    const generalComponents = content.components as Record<string, unknown> | undefined;
    if (generalComponents) {
      Object.assign(components, generalComponents);
    }

    return components;
  }

  private async scanCursorComponentType(
    componentType: CursorComponentType,
    components: unknown,
  ): Promise<CursorSecurityViolation[]> {
    if (!components) {
      return [];
    }

    switch (componentType) {
      case 'settings':
        return this.scanCursorSettings(components);
      case 'extensions':
        return this.scanCursorExtensions(components);
      case 'snippets':
        return this.scanCursorSnippets(components);
      case 'ai-prompts':
        return this.scanCursorAIPrompts(components);
      case 'tasks':
        return this.scanCursorTasks(components);
      case 'launch':
        return this.scanCursorLaunchConfigs(components);
      default:
        return [];
    }
  }

  private scanCursorSettings(settings: unknown): CursorSecurityViolation[] {
    const violations: CursorSecurityViolation[] = [];
    const settingsObj = settings as Record<string, unknown>;

    // 1. Check for sensitive data in settings
    const settingsString = JSON.stringify(settings);
    const sensitivePatterns = [
      /api[_-]?key\s*[:=]\s*["'][^"']{10,}["']/gi,
      /secret[_-]?key\s*[:=]\s*["'][^"']{10,}["']/gi,
      /access[_-]?token\s*[:=]\s*["'][^"']{10,}["']/gi,
      /password\s*[:=]\s*["'][^"']{5,}["']/gi,
      /bearer\s+[\w+./~-]+=*/gi,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(settingsString)) {
        violations.push({
          componentType: 'settings',
          component: 'global-settings',
          violationType: 'sensitive_data',
          severity: 'high',
          description: `Settings contain sensitive data: ${pattern.source}`,
          recommendation: 'Remove sensitive data from settings or use environment variables',
          quarantined: true,
        });
      }
    }

    // 2. Check for dangerous security settings
    if (settingsObj['security.workspace.trust.enabled'] === false) {
      violations.push({
        componentType: 'settings',
        component: 'security-settings',
        violationType: 'dangerous_capability',
        severity: 'medium',
        description: 'Workspace trust is disabled, allowing potentially unsafe code execution',
        recommendation: 'Enable workspace trust for security',
        quarantined: false,
      });
    }

    // 3. Check for auto-update disabled
    if (settingsObj['extensions.autoUpdate'] === false) {
      violations.push({
        componentType: 'settings',
        component: 'extension-settings',
        violationType: 'dangerous_capability',
        severity: 'low',
        description: 'Extension auto-update is disabled, may miss security updates',
        recommendation: 'Enable extension auto-updates for security patches',
        quarantined: false,
      });
    }

    // 4. Check for dangerous terminal settings
    if (settingsObj['terminal.integrated.allowChords'] === true) {
      violations.push({
        componentType: 'settings',
        component: 'terminal-settings',
        violationType: 'dangerous_capability',
        severity: 'medium',
        description: 'Terminal chord sequences are enabled, potential security risk',
        recommendation: 'Disable terminal chord sequences unless necessary',
        quarantined: false,
      });
    }

    return violations;
  }

  private scanCursorExtensions(extensions: unknown): CursorSecurityViolation[] {
    const violations: CursorSecurityViolation[] = [];

    if (Array.isArray(extensions)) {
      for (const extension of extensions) {
        const extensionId = typeof extension === 'string' ? extension : extension?.id;
        
        if (typeof extensionId === 'string') {
          // Check for potentially dangerous extensions
          if (this.CURSOR_DANGEROUS_EXTENSIONS.includes(extensionId)) {
            violations.push({
              componentType: 'extensions',
              component: extensionId,
              violationType: 'unsafe_extension',
              severity: 'medium',
              description: `Extension ${extensionId} has elevated privileges and security implications`,
              recommendation: 'Review extension permissions and necessity',
              quarantined: false,
            });
          }

          // Check for suspicious extension patterns
          if (extensionId.includes('shell') || extensionId.includes('exec')) {
            violations.push({
              componentType: 'extensions',
              component: extensionId,
              violationType: 'unsafe_extension',
              severity: 'high',
              description: `Extension ${extensionId} may have shell execution capabilities`,
              recommendation: 'Verify extension safety before installation',
              quarantined: true,
            });
          }
        }
      }
    }

    return violations;
  }

  private scanCursorSnippets(snippets: unknown): CursorSecurityViolation[] {
    const violations: CursorSecurityViolation[] = [];
    const snippetsObj = snippets as Record<string, unknown>;

    for (const [language, languageSnippets] of Object.entries(snippetsObj)) {
      if (typeof languageSnippets === 'object' && languageSnippets !== null) {
        const snippetContent = JSON.stringify(languageSnippets);

        // Check for dangerous code patterns in snippets
        for (const pattern of this.CURSOR_DANGEROUS_TASK_PATTERNS) {
          if (pattern.test(snippetContent)) {
            violations.push({
              componentType: 'snippets',
              component: language,
              violationType: 'malicious_code',
              severity: 'high',
              description: `Snippet for ${language} contains dangerous command pattern: ${pattern.source}`,
              recommendation: 'Remove dangerous commands from snippets',
              quarantined: true,
            });
          }
        }

        // Check for sensitive data in snippets
        const sensitivePatterns = [
          /api[_-]?key/gi,
          /secret/gi,
          /password/gi,
          /token/gi,
        ];

        for (const pattern of sensitivePatterns) {
          if (pattern.test(snippetContent)) {
            violations.push({
              componentType: 'snippets',
              component: language,
              violationType: 'sensitive_data',
              severity: 'medium',
              description: `Snippet for ${language} may contain sensitive data`,
              recommendation: 'Use placeholder values instead of real sensitive data',
              quarantined: false,
            });
          }
        }
      }
    }

    return violations;
  }

  private scanCursorAIPrompts(aiPrompts: unknown): CursorSecurityViolation[] {
    const violations: CursorSecurityViolation[] = [];

    if (Array.isArray(aiPrompts)) {
      for (const prompt of aiPrompts) {
        const promptObj = prompt as CursorAIPrompt;
        violations.push(...this.scanSingleAIPrompt(promptObj));
      }
    } else if (typeof aiPrompts === 'object' && aiPrompts !== null) {
      // Handle object format
      for (const [name, promptData] of Object.entries(aiPrompts as Record<string, unknown>)) {
        const promptObj = { name, ...(promptData as Record<string, unknown>) } as CursorAIPrompt;
        violations.push(...this.scanSingleAIPrompt(promptObj));
      }
    }

    return violations;
  }

  private scanSingleAIPrompt(prompt: CursorAIPrompt): CursorSecurityViolation[] {
    const violations: CursorSecurityViolation[] = [];

    // 1. Check for AI prompt injection patterns
    for (const pattern of this.CURSOR_AI_INJECTION_PATTERNS) {
      if (pattern.test(prompt.content)) {
        violations.push({
          componentType: 'ai-prompts',
          component: prompt.name,
          violationType: 'ai_prompt_injection',
          severity: 'critical',
          description: `AI prompt contains potential injection pattern: ${pattern.source}`,
          recommendation: 'Remove injection attempts and use proper prompt engineering',
          quarantined: true,
        });
      }
    }

    // 2. Check for sensitive data in prompts
    const sensitivePatterns = [
      /api[_-]?key\s*[:=]/gi,
      /secret\s*[:=]/gi,
      /password\s*[:=]/gi,
      /token\s*[:=]/gi,
      /credential\s*[:=]/gi,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(prompt.content)) {
        violations.push({
          componentType: 'ai-prompts',
          component: prompt.name,
          violationType: 'sensitive_data',
          severity: 'high',
          description: `AI prompt may contain sensitive data: ${pattern.source}`,
          recommendation: 'Remove sensitive data from prompts',
          quarantined: true,
        });
      }
    }

    // 3. Check for dangerous system instructions
    const dangerousInstructions = [
      /execute\s+system\s+command/gi,
      /run\s+shell\s+script/gi,
      /access\s+file\s+system/gi,
      /modify\s+system\s+files/gi,
      /install\s+software/gi,
    ];

    for (const pattern of dangerousInstructions) {
      if (pattern.test(prompt.content)) {
        violations.push({
          componentType: 'ai-prompts',
          component: prompt.name,
          violationType: 'dangerous_capability',
          severity: 'high',
          description: `AI prompt requests dangerous system capabilities: ${pattern.source}`,
          recommendation: 'Limit AI prompt to safe operations only',
          quarantined: true,
        });
      }
    }

    return violations;
  }

  private scanCursorTasks(tasks: unknown): CursorSecurityViolation[] {
    const violations: CursorSecurityViolation[] = [];

    if (Array.isArray(tasks)) {
      for (const task of tasks) {
        const taskObj = task as CursorTask;
        violations.push(...this.scanSingleTask(taskObj));
      }
    } else if (typeof tasks === 'object' && tasks !== null) {
      const tasksObj = tasks as { tasks?: CursorTask[] };
      if (Array.isArray(tasksObj.tasks)) {
        for (const task of tasksObj.tasks) {
          violations.push(...this.scanSingleTask(task));
        }
      }
    }

    return violations;
  }

  private scanSingleTask(task: CursorTask): CursorSecurityViolation[] {
    const violations: CursorSecurityViolation[] = [];

    // 1. Check for dangerous command patterns
    const fullCommand = [task.command, ...(task.args || [])].join(' ');
    
    for (const pattern of this.CURSOR_DANGEROUS_TASK_PATTERNS) {
      if (pattern.test(fullCommand)) {
        violations.push({
          componentType: 'tasks',
          component: task.label,
          violationType: 'dangerous_task',
          severity: 'critical',
          description: `Task contains dangerous command pattern: ${pattern.source}`,
          recommendation: 'Remove dangerous commands or use safer alternatives',
          quarantined: true,
        });
      }
    }

    // 2. Check for network access in tasks
    const networkPatterns = [
      /curl\s+/gi,
      /wget\s+/gi,
      /https?:\/\//gi,
      /ftp:\/\//gi,
    ];

    for (const pattern of networkPatterns) {
      if (pattern.test(fullCommand)) {
        violations.push({
          componentType: 'tasks',
          component: task.label,
          violationType: 'dangerous_capability',
          severity: 'medium',
          description: `Task makes network requests: ${pattern.source}`,
          recommendation: 'Review network access and ensure it\'s necessary',
          quarantined: false,
        });
        break;
      }
    }

    // 3. Check for auto-run tasks
    if (task.runOptions?.runOn === 'folderOpen') {
      violations.push({
        componentType: 'tasks',
        component: task.label,
        violationType: 'dangerous_capability',
        severity: 'medium',
        description: 'Task is configured to run automatically on folder open',
        recommendation: 'Review auto-run tasks for security implications',
        quarantined: false,
      });
    }

    return violations;
  }

  private scanCursorLaunchConfigs(launchConfigs: unknown): CursorSecurityViolation[] {
    const violations: CursorSecurityViolation[] = [];

    if (Array.isArray(launchConfigs)) {
      for (const config of launchConfigs) {
        const configObj = config as CursorLaunchConfig;
        violations.push(...this.scanSingleLaunchConfig(configObj));
      }
    } else if (typeof launchConfigs === 'object' && launchConfigs !== null) {
      const configsObj = launchConfigs as { configurations?: CursorLaunchConfig[] };
      if (Array.isArray(configsObj.configurations)) {
        for (const config of configsObj.configurations) {
          violations.push(...this.scanSingleLaunchConfig(config));
        }
      }
    }

    return violations;
  }

  private scanSingleLaunchConfig(config: CursorLaunchConfig): CursorSecurityViolation[] {
    const violations: CursorSecurityViolation[] = [];

    // 1. Check for dangerous program paths
    if (config.program) {
      const dangerousPaths = [
        /\/bin\/sh/gi,
        /\/bin\/bash/gi,
        /cmd\.exe/gi,
        /powershell\.exe/gi,
        /python\.exe/gi,
      ];

      for (const pattern of dangerousPaths) {
        if (pattern.test(config.program)) {
          violations.push({
            componentType: 'launch',
            component: config.name,
            violationType: 'insecure_launch_config',
            severity: 'high',
            description: `Launch configuration uses potentially dangerous program: ${config.program}`,
            recommendation: 'Use specific application paths instead of shell interpreters',
            quarantined: true,
          });
          break;
        }
      }
    }

    // 2. Check for dangerous arguments
    if (config.args) {
      const argsString = config.args.join(' ');
      
      for (const pattern of this.CURSOR_DANGEROUS_TASK_PATTERNS) {
        if (pattern.test(argsString)) {
          violations.push({
            componentType: 'launch',
            component: config.name,
            violationType: 'insecure_launch_config',
            severity: 'critical',
            description: `Launch configuration contains dangerous arguments: ${pattern.source}`,
            recommendation: 'Remove dangerous arguments from launch configuration',
            quarantined: true,
          });
        }
      }
    }

    // 3. Check for sensitive environment variables
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        const sensitivePatterns = [
          /password/i,
          /secret/i,
          /token/i,
          /api[_-]?key/i,
          /credential/i,
        ];

        for (const pattern of sensitivePatterns) {
          if (pattern.test(key) || pattern.test(value)) {
            violations.push({
              componentType: 'launch',
              component: config.name,
              violationType: 'sensitive_data',
              severity: 'medium',
              description: `Launch configuration environment variable may contain sensitive data: ${key}`,
              recommendation: 'Use environment variable references instead of hardcoded values',
              quarantined: false,
            });
            break;
          }
        }
      }
    }

    return violations;
  }
}