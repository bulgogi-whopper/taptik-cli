# Platform Extension Guide

## Adding Support for New IDE Platforms

This guide explains how to extend the Taptik Deploy module to support additional IDE platforms beyond Claude Code.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Adding Kiro IDE Support](#adding-kiro-ide-support)
- [Adding Cursor IDE Support](#adding-cursor-ide-support)
- [Platform Integration Checklist](#platform-integration-checklist)
- [Testing New Platforms](#testing-new-platforms)
- [Platform-Specific Features](#platform-specific-features)

## Architecture Overview

The deploy module uses a strategy pattern for platform-specific implementations:

```
Platform Support Structure:
├── interfaces/
│   └── platform-config.interface.ts    # Platform definitions
├── constants/
│   └── platform-paths.constants.ts     # Platform file paths
├── services/
│   ├── platform-validator.service.ts   # Validation logic
│   └── deployment.service.ts           # Deployment logic
└── strategies/
    ├── claude-code.strategy.ts         # Claude Code implementation
    ├── kiro-ide.strategy.ts           # Kiro IDE implementation
    └── cursor-ide.strategy.ts         # Cursor IDE implementation
```

## Adding Kiro IDE Support

### Step 1: Define Platform Constants

Create platform-specific path definitions:

```typescript
// src/modules/deploy/constants/platform-paths.constants.ts

export const KIRO_PATHS = {
  // Global configuration
  GLOBAL_SETTINGS: '~/.kiro/settings.json',
  GLOBAL_PROFILES: '~/.kiro/profiles/',
  
  // Project configuration
  PROJECT_ROOT: '.kiro',
  PROJECT_SETTINGS: '.kiro/settings.json',
  
  // Kiro-specific directories
  SPECS: '.kiro/specs',
  STEERING: '.kiro/steering',
  HOOKS: '.kiro/hooks',
  AGENTS: '.kiro/agents',
  TEMPLATES: '.kiro/templates',
  
  // Configuration files
  PERSONA_CONFIG: '.kiro/steering/persona.md',
  PRINCIPLE_CONFIG: '.kiro/steering/principle.md',
  ARCHITECTURE_CONFIG: '.kiro/steering/architecture.md',
  
  // Metadata
  LOCK_FILE: '.kiro/.lock',
  CACHE_DIR: '.kiro/.cache',
};

export const KIRO_FILE_EXTENSIONS = {
  MARKDOWN: '.md',
  JSON: '.json',
  YAML: '.yaml',
  TYPESCRIPT: '.ts',
  SHELL: '.sh',
};
```

### Step 2: Create Platform Strategy

Implement the platform-specific strategy:

```typescript
// src/modules/deploy/strategies/kiro-ide.strategy.ts

import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { DeployOptions } from '../interfaces/deploy-options.interface';
import { DeploymentResult } from '../interfaces/deployment-result.interface';
import { ValidationResult } from '../interfaces/validation-result.interface';
import { KIRO_PATHS } from '../constants/platform-paths.constants';
import { PathResolver } from '../utils/path-resolver.utility';

@Injectable()
export class KiroIdeStrategy {
  async validate(context: TaptikContext): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate Kiro-specific requirements
    if (!context.content.ide?.['kiro-ide']) {
      warnings.push('No Kiro IDE specific configuration found');
    }
    
    // Check for required Kiro structures
    if (context.content.ide?.['kiro-ide']?.specs) {
      const specs = context.content.ide['kiro-ide'].specs;
      if (!specs.design || !specs.requirements || !specs.tasks) {
        errors.push('Kiro specs must include design, requirements, and tasks');
      }
    }
    
    // Validate steering documents
    if (context.content.ide?.['kiro-ide']?.steering) {
      const steering = context.content.ide['kiro-ide'].steering;
      if (!steering.persona || !steering.principle) {
        warnings.push('Kiro steering should include persona and principle documents');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      platform: 'kiro-ide',
    };
  }
  
  async deploy(
    context: TaptikContext,
    options: DeployOptions
  ): Promise<DeploymentResult> {
    const deployedComponents: string[] = [];
    const errors: any[] = [];
    const warnings: any[] = [];
    
    try {
      // Deploy global settings
      if (this.shouldDeployComponent('settings', options)) {
        await this.deployGlobalSettings(context);
        deployedComponents.push('settings');
      }
      
      // Deploy specs
      if (this.shouldDeployComponent('specs', options)) {
        await this.deploySpecs(context);
        deployedComponents.push('specs');
      }
      
      // Deploy steering documents
      if (this.shouldDeployComponent('steering', options)) {
        await this.deploySteeringDocs(context);
        deployedComponents.push('steering');
      }
      
      // Deploy hooks
      if (this.shouldDeployComponent('hooks', options)) {
        await this.deployHooks(context);
        deployedComponents.push('hooks');
      }
      
      // Deploy agents
      if (this.shouldDeployComponent('agents', options)) {
        await this.deployAgents(context);
        deployedComponents.push('agents');
      }
      
      return {
        success: true,
        platform: 'kiro-ide',
        deployedComponents,
        conflicts: [],
        summary: {
          filesDeployed: deployedComponents.length,
          filesSkipped: 0,
          conflictsResolved: 0,
        },
        errors,
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        platform: 'kiro-ide',
        deployedComponents,
        conflicts: [],
        summary: {
          filesDeployed: 0,
          filesSkipped: 0,
          conflictsResolved: 0,
        },
        errors: [...errors, { message: error.message }],
        warnings,
      };
    }
  }
  
  private async deployGlobalSettings(context: TaptikContext): Promise<void> {
    const settingsPath = PathResolver.resolvePath(KIRO_PATHS.GLOBAL_SETTINGS);
    const settings = context.content.ide?.['kiro-ide']?.settings || {};
    
    await this.ensureDirectory(path.dirname(settingsPath));
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
  }
  
  private async deploySpecs(context: TaptikContext): Promise<void> {
    const specs = context.content.ide?.['kiro-ide']?.specs;
    if (!specs) return;
    
    const specsPath = PathResolver.resolvePath(KIRO_PATHS.SPECS);
    await this.ensureDirectory(specsPath);
    
    // Deploy each spec
    for (const [specName, specContent] of Object.entries(specs)) {
      const specDir = path.join(specsPath, specName);
      await this.ensureDirectory(specDir);
      
      // Write design.md, requirements.md, tasks.md
      if (specContent.design) {
        await fs.writeFile(
          path.join(specDir, 'design.md'),
          specContent.design
        );
      }
      if (specContent.requirements) {
        await fs.writeFile(
          path.join(specDir, 'requirements.md'),
          specContent.requirements
        );
      }
      if (specContent.tasks) {
        await fs.writeFile(
          path.join(specDir, 'tasks.md'),
          specContent.tasks
        );
      }
    }
  }
  
  private async deploySteeringDocs(context: TaptikContext): Promise<void> {
    const steering = context.content.ide?.['kiro-ide']?.steering;
    if (!steering) return;
    
    const steeringPath = PathResolver.resolvePath(KIRO_PATHS.STEERING);
    await this.ensureDirectory(steeringPath);
    
    // Deploy steering documents
    const documents = [
      'persona', 'principle', 'architecture', 'TDD', 'TEST',
      'git', 'PRD', 'project-context', 'flags', 'mcp'
    ];
    
    for (const doc of documents) {
      if (steering[doc]) {
        await fs.writeFile(
          path.join(steeringPath, `${doc}.md`),
          steering[doc]
        );
      }
    }
  }
  
  private async deployHooks(context: TaptikContext): Promise<void> {
    const hooks = context.content.ide?.['kiro-ide']?.hooks;
    if (!hooks) return;
    
    const hooksPath = PathResolver.resolvePath(KIRO_PATHS.HOOKS);
    await this.ensureDirectory(hooksPath);
    
    // Deploy hook scripts
    for (const [hookName, hookContent] of Object.entries(hooks)) {
      const hookFile = path.join(hooksPath, `${hookName}.json`);
      await fs.writeFile(hookFile, JSON.stringify(hookContent, null, 2));
    }
  }
  
  private async deployAgents(context: TaptikContext): Promise<void> {
    const agents = context.content.tools?.agents;
    if (!agents) return;
    
    const agentsPath = PathResolver.resolvePath(KIRO_PATHS.AGENTS);
    await this.ensureDirectory(agentsPath);
    
    // Deploy agent files
    for (const agent of agents) {
      const agentFile = path.join(agentsPath, `${agent.name}.md`);
      await fs.writeFile(agentFile, agent.content);
    }
  }
  
  private shouldDeployComponent(
    component: string,
    options: DeployOptions
  ): boolean {
    if (options.skipComponents?.includes(component as any)) {
      return false;
    }
    if (options.components && !options.components.includes(component as any)) {
      return false;
    }
    return true;
  }
  
  private async ensureDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }
}
```

### Step 3: Register Platform in Service

Add Kiro IDE to the deployment service:

```typescript
// src/modules/deploy/services/deployment.service.ts

async deploy(
  context: TaptikContext,
  options: DeployOptions
): Promise<DeploymentResult> {
  switch (options.platform) {
    case 'claude-code':
      return this.deployToClaudeCode(context, options);
    case 'kiro-ide':
      return this.deployToKiroIde(context, options);
    case 'cursor-ide':
      return this.deployToCursorIde(context, options);
    default:
      throw new Error(`Unsupported platform: ${options.platform}`);
  }
}

async deployToKiroIde(
  context: TaptikContext,
  options: DeployOptions
): Promise<DeploymentResult> {
  // Use Kiro IDE strategy
  const strategy = new KiroIdeStrategy();
  
  // Validate
  const validation = await strategy.validate(context);
  if (!validation.isValid) {
    return {
      success: false,
      platform: 'kiro-ide',
      errors: validation.errors.map(e => ({ message: e })),
      // ... other fields
    };
  }
  
  // Deploy
  return strategy.deploy(context, options);
}
```

## Adding Cursor IDE Support

### Step 1: Define Cursor Constants

```typescript
// src/modules/deploy/constants/platform-paths.constants.ts

export const CURSOR_PATHS = {
  // Global configuration
  GLOBAL_SETTINGS: '~/.cursor/settings.json',
  GLOBAL_KEYBINDINGS: '~/.cursor/keybindings.json',
  
  // Project configuration
  PROJECT_ROOT: '.cursor',
  PROJECT_SETTINGS: '.cursor/settings.json',
  
  // AI configurations
  AI_PROMPTS: '.cursor/prompts/',
  AI_MODELS: '.cursor/models.json',
  AI_RULES: '.cursor/rules.md',
  
  // Extensions
  EXTENSIONS: '~/.cursor/extensions/',
  EXTENSION_SETTINGS: '~/.cursor/extensions.json',
  
  // Workspace
  WORKSPACE_SETTINGS: '.cursor/workspace.json',
  TASKS: '.cursor/tasks.json',
  LAUNCH: '.cursor/launch.json',
};
```

### Step 2: Create Cursor Strategy

```typescript
// src/modules/deploy/strategies/cursor-ide.strategy.ts

import { Injectable } from '@nestjs/common';

@Injectable()
export class CursorIdeStrategy {
  async validate(context: TaptikContext): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate Cursor-specific configuration
    if (!context.content.ide?.['cursor-ide']) {
      warnings.push('No Cursor IDE specific configuration found');
    }
    
    // Check AI configuration
    if (context.content.prompts) {
      // Cursor uses prompts differently
      const prompts = context.content.prompts;
      if (!prompts.system_prompts) {
        warnings.push('Cursor works best with system prompts defined');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      platform: 'cursor-ide',
    };
  }
  
  async deploy(
    context: TaptikContext,
    options: DeployOptions
  ): Promise<DeploymentResult> {
    const deployedComponents: string[] = [];
    
    try {
      // Deploy settings
      if (this.shouldDeployComponent('settings', options)) {
        await this.deploySettings(context);
        deployedComponents.push('settings');
      }
      
      // Deploy AI prompts
      if (this.shouldDeployComponent('prompts', options)) {
        await this.deployAIPrompts(context);
        deployedComponents.push('prompts');
      }
      
      // Deploy AI rules
      if (this.shouldDeployComponent('rules', options)) {
        await this.deployAIRules(context);
        deployedComponents.push('rules');
      }
      
      // Deploy extensions
      if (this.shouldDeployComponent('extensions', options)) {
        await this.deployExtensions(context);
        deployedComponents.push('extensions');
      }
      
      return {
        success: true,
        platform: 'cursor-ide',
        deployedComponents,
        // ... other fields
      };
    } catch (error) {
      // Error handling
    }
  }
  
  private async deploySettings(context: TaptikContext): Promise<void> {
    const settingsPath = PathResolver.resolvePath(CURSOR_PATHS.GLOBAL_SETTINGS);
    const settings = {
      ...context.content.ide?.['cursor-ide']?.settings,
      // Map common settings
      'editor.fontSize': context.content.personal?.preferences?.fontSize,
      'workbench.colorTheme': context.content.personal?.preferences?.theme,
    };
    
    await this.ensureDirectory(path.dirname(settingsPath));
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
  }
  
  private async deployAIPrompts(context: TaptikContext): Promise<void> {
    const promptsPath = PathResolver.resolvePath(CURSOR_PATHS.AI_PROMPTS);
    await this.ensureDirectory(promptsPath);
    
    // Deploy system prompts
    if (context.content.prompts?.system_prompts) {
      for (const prompt of context.content.prompts.system_prompts) {
        const promptFile = path.join(promptsPath, `${prompt.name}.md`);
        await fs.writeFile(promptFile, prompt.content);
      }
    }
  }
  
  private async deployAIRules(context: TaptikContext): Promise<void> {
    const rulesPath = PathResolver.resolvePath(CURSOR_PATHS.AI_RULES);
    
    // Combine all rules into a single markdown file
    const rules = [];
    
    if (context.content.project?.conventions) {
      rules.push('## Coding Conventions\n');
      rules.push(JSON.stringify(context.content.project.conventions, null, 2));
    }
    
    if (context.content.personal?.preferences?.style) {
      rules.push('\n## Coding Style\n');
      rules.push(context.content.personal.preferences.style);
    }
    
    if (rules.length > 0) {
      await fs.writeFile(rulesPath, rules.join('\n'));
    }
  }
  
  private async deployExtensions(context: TaptikContext): Promise<void> {
    const extensions = context.content.ide?.['cursor-ide']?.extensions;
    if (!extensions) return;
    
    const extensionsPath = PathResolver.resolvePath(CURSOR_PATHS.EXTENSION_SETTINGS);
    await fs.writeFile(extensionsPath, JSON.stringify(extensions, null, 2));
  }
  
  // ... helper methods
}
```

## Platform Integration Checklist

### Required Components

- [ ] Platform constants definition
- [ ] Platform strategy implementation
- [ ] Validation logic
- [ ] Deployment logic
- [ ] Component mapping
- [ ] Error handling
- [ ] Rollback support
- [ ] Test coverage

### Integration Steps

1. **Define Platform Interface**
```typescript
interface PlatformStrategy {
  validate(context: TaptikContext): Promise<ValidationResult>;
  deploy(context: TaptikContext, options: DeployOptions): Promise<DeploymentResult>;
  rollback(backupId: string): Promise<void>;
  getComponentTypes(): ComponentType[];
}
```

2. **Register Platform**
```typescript
// src/modules/deploy/constants/platforms.constants.ts
export const SUPPORTED_PLATFORMS = {
  'claude-code': ClaudeCodeStrategy,
  'kiro-ide': KiroIdeStrategy,
  'cursor-ide': CursorIdeStrategy,
} as const;
```

3. **Update CLI Options**
```typescript
// src/modules/deploy/commands/deploy.command.ts
@Option({
  flags: '-p, --platform <platform>',
  description: 'Target platform (claudeCode, kiroIde, cursorIde)',
})
parsePlatform(value: string): SupportedPlatform {
  const valid = ['claudeCode', 'kiroIde', 'cursorIde'];
  if (!valid.includes(value)) {
    throw new Error(`Unsupported platform: ${value}`);
  }
  return value as SupportedPlatform;
}
```

## Testing New Platforms

### Unit Tests

```typescript
// src/modules/deploy/strategies/kiro-ide.strategy.spec.ts

describe('KiroIdeStrategy', () => {
  let strategy: KiroIdeStrategy;
  
  beforeEach(() => {
    strategy = new KiroIdeStrategy();
  });
  
  describe('validate', () => {
    it('should validate Kiro-specific configuration', async () => {
      const context = createMockContext({
        ide: {
          'kiro-ide': {
            specs: { design: '...', requirements: '...', tasks: '...' },
            steering: { persona: '...', principle: '...' },
          },
        },
      });
      
      const result = await strategy.validate(context);
      expect(result.isValid).toBe(true);
    });
    
    it('should detect missing specs', async () => {
      const context = createMockContext({
        ide: { 'kiro-ide': { specs: { design: '...' } } },
      });
      
      const result = await strategy.validate(context);
      expect(result.errors).toContain('Kiro specs must include design, requirements, and tasks');
    });
  });
  
  describe('deploy', () => {
    it('should deploy all Kiro components', async () => {
      const context = createMockContext({ /* ... */ });
      const options = { platform: 'kiro-ide', dryRun: false };
      
      const result = await strategy.deploy(context, options);
      
      expect(result.success).toBe(true);
      expect(result.deployedComponents).toContain('specs');
      expect(result.deployedComponents).toContain('steering');
    });
  });
});
```

### Integration Tests

```typescript
// src/modules/deploy/deploy-kiro.integration.spec.ts

describe('Kiro IDE Deployment Integration', () => {
  it('should deploy complete Kiro configuration', async () => {
    const context = await importService.importFromSupabase('kiro-config');
    
    const result = await deploymentService.deploy(context, {
      platform: 'kiro-ide',
      dryRun: false,
    });
    
    expect(result.success).toBe(true);
    
    // Verify files were created
    expect(fs.existsSync('.kiro/specs')).toBe(true);
    expect(fs.existsSync('.kiro/steering')).toBe(true);
    expect(fs.existsSync('.kiro/hooks')).toBe(true);
  });
});
```

## Platform-Specific Features

### Claude Code Features

- MCP server configurations
- CLAUDE.md documentation
- Global/project settings separation
- Agent and command support

### Kiro IDE Features

- Spec-driven development
- Steering documents (persona, principles)
- Hook system
- Multi-file specs structure
- Task tracking integration

### Cursor IDE Features

- AI prompt management
- Model configuration
- VSCode compatibility
- Extension ecosystem
- Workspace settings

## Migration Guide

### Migrating from Claude Code to Kiro IDE

```bash
# Export from Claude Code
taptik export --platform claude-code --output claude-config.json

# Convert to Kiro format
taptik convert --from claude-code --to kiro-ide --input claude-config.json

# Deploy to Kiro IDE
taptik deploy --platform kiro-ide --context-file kiro-config.json
```

### Platform Compatibility Matrix

| Feature | Claude Code | Kiro IDE | Cursor IDE |
|---------|------------|----------|------------|
| Settings | ✅ | ✅ | ✅ |
| Agents | ✅ | ✅ | ❌ |
| Commands | ✅ | ✅ | ❌ |
| Prompts | ✅ | ❌ | ✅ |
| Specs | ❌ | ✅ | ❌ |
| Steering | ❌ | ✅ | ❌ |
| Extensions | ❌ | ❌ | ✅ |
| AI Rules | ❌ | ❌ | ✅ |

## Troubleshooting Platform Issues

### Common Platform-Specific Issues

#### Kiro IDE
- **Issue**: Specs not loading
- **Solution**: Ensure `.kiro/specs/*/` follows the correct structure

#### Cursor IDE
- **Issue**: AI prompts not recognized
- **Solution**: Check `.cursor/rules.md` format

### Debug Platform Deployment

```bash
# Enable platform-specific debug
export DEBUG=taptik:platform:kiro
taptik deploy --platform kiro-ide --verbose

# Test platform detection
taptik platform detect

# Validate platform configuration
taptik platform validate --platform kiro-ide
```