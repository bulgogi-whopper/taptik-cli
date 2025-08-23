import * as fs from 'node:fs/promises';

import { Test, TestingModule } from '@nestjs/testing';

import { vi } from 'vitest';


import {
  KiroGlobalSettings,
  KiroProjectSettings,
  KiroSteeringDocument,
  KiroSpecDocument,
  KiroHookConfiguration,
  KiroAgentConfiguration,
  KiroTemplateConfiguration,
  KiroDeploymentContext,
  KiroDeploymentOptions
} from '../interfaces/kiro-deployment.interface';

import { KiroComponentHandlerService } from './kiro-component-handler.service';

// Mock fs promises
vi.mock('node:fs/promises');
const mockFs = fs as any;

describe('KiroComponentHandlerService', () => {
  let service: KiroComponentHandlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KiroComponentHandlerService],
    }).compile();

    service = module.get<KiroComponentHandlerService>(KiroComponentHandlerService);

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('deploySettings', () => {
    const mockGlobalSettings: KiroGlobalSettings = {
      version: '1.0.0',
      user: {
        profile: { name: 'Test User' },
        preferences: {},
        communication: {},
        tech_stack: {}
      },
      ide: {}
    };

    const mockProjectSettings: KiroProjectSettings = {
      version: '1.0.0',
      project: {
        info: { name: 'Test Project' },
        architecture: {},
        tech_stack: {},
        conventions: {},
        constraints: {}
      }
    };

    const mockContext: KiroDeploymentContext = {
      homeDirectory: '/home/user',
      projectDirectory: '/home/user/project',
      paths: {
        globalSettings: '/home/user/.kiro/settings.json',
        projectSettings: '/home/user/project/.kiro/settings.json',
        steeringDirectory: '/home/user/project/.kiro/steering',
        specsDirectory: '/home/user/project/.kiro/specs',
        hooksDirectory: '/home/user/project/.kiro/hooks',
        agentsDirectory: '/home/user/.kiro/agents',
        templatesDirectory: '/home/user/.kiro/templates'
      }
    };

    const mockOptions: KiroDeploymentOptions = {
      platform: 'kiro-ide',
      conflictStrategy: 'overwrite',
      dryRun: false,
      validateOnly: false,
      globalSettings: true,
      projectSettings: true
    };

    it('should deploy both global and project settings successfully', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue();

      const result = await service.deploySettings(
        mockGlobalSettings,
        mockProjectSettings,
        mockContext,
        mockOptions
      );

      expect(result.globalDeployed).toBe(true);
      expect(result.projectDeployed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockFs.mkdir).toHaveBeenCalledTimes(2);
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should skip global settings when disabled', async () => {
      const optionsWithoutGlobal = { ...mockOptions, globalSettings: false };
      
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue();

      const result = await service.deploySettings(
        mockGlobalSettings,
        mockProjectSettings,
        mockContext,
        optionsWithoutGlobal
      );

      expect(result.globalDeployed).toBe(false);
      expect(result.projectDeployed).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
    });

    it('should handle merge with existing settings', async () => {
      const existingSettings = {
        version: '0.9.0',
        user: { profile: { email: 'existing@example.com' } }
      };

      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingSettings));
      mockFs.writeFile.mockResolvedValue();

      const result = await service.deploySettings(
        mockGlobalSettings,
        mockProjectSettings,
        mockContext,
        { ...mockOptions, mergeStrategy: 'deep-merge' }
      );

      expect(result.globalDeployed).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Check that writeFile was called with merged data
      const writeCall = mockFs.writeFile.mock.calls.find(call => 
        call[0] === mockContext.paths.globalSettings
      );
      expect(writeCall).toBeDefined();
      
      const writtenData = JSON.parse(writeCall![1] as string);
      expect(writtenData.version).toBe('1.0.0'); // Should be overwritten
      expect(writtenData.user.profile.name).toBe('Test User'); // Should be merged
    });

    it('should handle deployment errors gracefully', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await service.deploySettings(
        mockGlobalSettings,
        mockProjectSettings,
        mockContext,
        mockOptions
      );

      expect(result.globalDeployed).toBe(false);
      expect(result.projectDeployed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('KIRO_SETTINGS_DEPLOY_ERROR');
    });
  });

  describe('deploySteering', () => {
    const mockDocuments: KiroSteeringDocument[] = [
      {
        name: 'project-overview',
        category: 'overview',
        content: 'This is a project overview document.',
        tags: ['project', 'overview'],
        priority: 'high',
        created_at: '2024-01-01T00:00:00Z'
      },
      {
        name: 'coding-standards',
        category: 'standards',
        content: 'Follow these coding standards.',
        priority: 'medium',
        created_at: '2024-01-01T00:00:00Z'
      }
    ];

    const mockContext: KiroDeploymentContext = {
      homeDirectory: '/home/user',
      projectDirectory: '/home/user/project',
      paths: {
        globalSettings: '/home/user/.kiro/settings.json',
        projectSettings: '/home/user/project/.kiro/settings.json',
        steeringDirectory: '/home/user/project/.kiro/steering',
        specsDirectory: '/home/user/project/.kiro/specs',
        hooksDirectory: '/home/user/project/.kiro/hooks',
        agentsDirectory: '/home/user/.kiro/agents',
        templatesDirectory: '/home/user/.kiro/templates'
      }
    };

    const mockOptions: KiroDeploymentOptions = {
      platform: 'kiro-ide',
      conflictStrategy: 'overwrite',
      dryRun: false,
      validateOnly: false
    };

    it('should deploy steering documents successfully', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue();

      const result = await service.deploySteering(mockDocuments, mockContext, mockOptions);

      expect(result.deployedFiles).toHaveLength(2);
      expect(result.deployedFiles).toContain('project-overview.md');
      expect(result.deployedFiles).toContain('coding-standards.md');
      expect(result.errors).toHaveLength(0);
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should skip existing files when conflict strategy is skip', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('Existing content');
      mockFs.writeFile.mockResolvedValue();

      const result = await service.deploySteering(
        mockDocuments,
        mockContext,
        { ...mockOptions, conflictStrategy: 'skip' }
      );

      expect(result.deployedFiles).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].code).toBe('KIRO_STEERING_SKIPPED');
    });

    it('should merge existing content when conflict strategy is merge-intelligent', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('Existing content');
      mockFs.writeFile.mockResolvedValue();

      const result = await service.deploySteering(
        mockDocuments,
        mockContext,
        { ...mockOptions, conflictStrategy: 'merge-intelligent' }
      );

      expect(result.deployedFiles).toHaveLength(2);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].code).toBe('KIRO_STEERING_MERGED');
    });
  });

  describe('deploySpecs', () => {
    const mockSpecs: KiroSpecDocument[] = [
      {
        name: 'user-authentication',
        type: 'feature',
        status: 'active',
        content: '# User Authentication\n\n- [ ] Implement login\n- [x] Implement logout',
        created_at: '2024-01-01T00:00:00Z'
      }
    ];

    const mockContext: KiroDeploymentContext = {
      homeDirectory: '/home/user',
      projectDirectory: '/home/user/project',
      paths: {
        globalSettings: '/home/user/.kiro/settings.json',
        projectSettings: '/home/user/project/.kiro/settings.json',
        steeringDirectory: '/home/user/project/.kiro/steering',
        specsDirectory: '/home/user/project/.kiro/specs',
        hooksDirectory: '/home/user/project/.kiro/hooks',
        agentsDirectory: '/home/user/.kiro/agents',
        templatesDirectory: '/home/user/.kiro/templates'
      }
    };

    const mockOptions: KiroDeploymentOptions = {
      platform: 'kiro-ide',
      conflictStrategy: 'overwrite',
      dryRun: false,
      validateOnly: false,
      preserveTaskStatus: true
    };

    it('should deploy spec documents successfully', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue();

      const result = await service.deploySpecs(mockSpecs, mockContext, mockOptions);

      expect(result.deployedFiles).toHaveLength(1);
      expect(result.deployedFiles).toContain('user-authentication.md');
      expect(result.errors).toHaveLength(0);
    });

    it('should preserve task status from existing files', async () => {
      const existingContent = '# User Authentication\n\n- [x] Implement login\n- [x] Implement logout';
      
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(existingContent);
      mockFs.writeFile.mockResolvedValue();

      const result = await service.deploySpecs(mockSpecs, mockContext, mockOptions);

      expect(result.deployedFiles).toHaveLength(1);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].code).toBe('KIRO_SPEC_TASK_STATUS_PRESERVED');
    });
  });

  describe('deployHooks', () => {
    const mockHooks: KiroHookConfiguration[] = [
      {
        name: 'pre-commit-linter',
        type: 'pre-commit',
        trigger: 'git-commit',
        command: 'npm run lint',
        enabled: true,
        description: 'Run linter before commit'
      }
    ];

    const mockContext: KiroDeploymentContext = {
      homeDirectory: '/home/user',
      projectDirectory: '/home/user/project',
      paths: {
        globalSettings: '/home/user/.kiro/settings.json',
        projectSettings: '/home/user/project/.kiro/settings.json',
        steeringDirectory: '/home/user/project/.kiro/steering',
        specsDirectory: '/home/user/project/.kiro/specs',
        hooksDirectory: '/home/user/project/.kiro/hooks',
        agentsDirectory: '/home/user/.kiro/agents',
        templatesDirectory: '/home/user/.kiro/templates'
      }
    };

    const mockOptions: KiroDeploymentOptions = {
      platform: 'kiro-ide',
      conflictStrategy: 'overwrite',
      dryRun: false,
      validateOnly: false
    };

    it('should deploy hooks successfully', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue();

      const result = await service.deployHooks(mockHooks, mockContext, mockOptions);

      expect(result.deployedFiles).toHaveLength(1);
      expect(result.deployedFiles).toContain('pre-commit-linter.json');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('deployAgents', () => {
    const mockAgents: KiroAgentConfiguration[] = [
      {
        name: 'code-reviewer',
        description: 'Reviews code for best practices',
        category: 'development',
        prompt: 'You are a code reviewer...',
        capabilities: ['code-review', 'best-practices'],
        metadata: {
          version: '1.0.0',
          created_at: '2024-01-01T00:00:00Z'
        }
      }
    ];

    const mockContext: KiroDeploymentContext = {
      homeDirectory: '/home/user',
      projectDirectory: '/home/user/project',
      paths: {
        globalSettings: '/home/user/.kiro/settings.json',
        projectSettings: '/home/user/project/.kiro/settings.json',
        steeringDirectory: '/home/user/project/.kiro/steering',
        specsDirectory: '/home/user/project/.kiro/specs',
        hooksDirectory: '/home/user/project/.kiro/hooks',
        agentsDirectory: '/home/user/.kiro/agents',
        templatesDirectory: '/home/user/.kiro/templates'
      }
    };

    const mockOptions: KiroDeploymentOptions = {
      platform: 'kiro-ide',
      conflictStrategy: 'overwrite',
      dryRun: false,
      validateOnly: false
    };

    it('should deploy agents successfully', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue();

      const result = await service.deployAgents(mockAgents, mockContext, mockOptions);

      expect(result.deployedFiles).toHaveLength(1);
      expect(result.deployedFiles).toContain('code-reviewer.json');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('deployTemplates', () => {
    const mockTemplates: KiroTemplateConfiguration[] = [
      {
        id: 'api-endpoint',
        name: 'API Endpoint Template',
        description: 'Template for creating API endpoints',
        category: 'development',
        content: 'Create an API endpoint for {{resource}}',
        variables: [
          {
            name: 'resource',
            type: 'string',
            description: 'The resource name',
            required: true
          }
        ],
        tags: ['api', 'template'],
        metadata: {
          version: '1.0.0',
          created_at: '2024-01-01T00:00:00Z'
        }
      }
    ];

    const mockContext: KiroDeploymentContext = {
      homeDirectory: '/home/user',
      projectDirectory: '/home/user/project',
      paths: {
        globalSettings: '/home/user/.kiro/settings.json',
        projectSettings: '/home/user/project/.kiro/settings.json',
        steeringDirectory: '/home/user/project/.kiro/steering',
        specsDirectory: '/home/user/project/.kiro/specs',
        hooksDirectory: '/home/user/project/.kiro/hooks',
        agentsDirectory: '/home/user/.kiro/agents',
        templatesDirectory: '/home/user/.kiro/templates'
      }
    };

    const mockOptions: KiroDeploymentOptions = {
      platform: 'kiro-ide',
      conflictStrategy: 'overwrite',
      dryRun: false,
      validateOnly: false
    };

    it('should deploy templates successfully', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue();

      const result = await service.deployTemplates(mockTemplates, mockContext, mockOptions);

      expect(result.deployedFiles).toHaveLength(1);
      expect(result.deployedFiles).toContain('api-endpoint-template.json');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('helper methods', () => {
    it('should sanitize file names correctly', async () => {
      const testCases = [
        { input: 'My File Name', expected: 'my-file-name' },
        { input: 'file:with/special\\chars', expected: 'file-with-special-chars' },
        { input: 'File<With>|Invalid?*Chars', expected: 'file-with--invalid--chars' }
      ];

      // We can't test private methods directly, but we can test through public methods
      const mockDoc: KiroSteeringDocument = {
        name: 'My File Name',
        category: 'test',
        content: 'test content',
        created_at: '2024-01-01T00:00:00Z'
      };

      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue();

      const mockContext: KiroDeploymentContext = {
        homeDirectory: '/home/user',
        projectDirectory: '/home/user/project',
        paths: {
          globalSettings: '/home/user/.kiro/settings.json',
          projectSettings: '/home/user/project/.kiro/settings.json',
          steeringDirectory: '/home/user/project/.kiro/steering',
          specsDirectory: '/home/user/project/.kiro/specs',
          hooksDirectory: '/home/user/project/.kiro/hooks',
          agentsDirectory: '/home/user/.kiro/agents',
          templatesDirectory: '/home/user/.kiro/templates'
        }
      };

      const mockOptions: KiroDeploymentOptions = {
        platform: 'kiro-ide',
        conflictStrategy: 'overwrite',
        dryRun: false,
        validateOnly: false
      };

      const result = await service.deploySteering([mockDoc], mockContext, mockOptions);

      expect(result.deployedFiles).toContain('my-file-name.md');
    });
  });
});