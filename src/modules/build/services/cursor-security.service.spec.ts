import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CursorSecurityService } from './cursor-security.service';

describe('CursorSecurityService', () => {
  let service: CursorSecurityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CursorSecurityService,
        {
          provide: Logger,
          useValue: {
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CursorSecurityService>(CursorSecurityService);
  });

  describe('filterSensitiveData', () => {
    it('should detect and remove API keys', async () => {
      const data = {
        settings: {
          'openai.apiKey': 'sk-proj-abcd1234567890abcdef',
          'anthropic.key': 'sk-ant-api03-xyz123',
          'github.token': 'ghp_1234567890abcdef1234567890abcdef1234',
        },
      };

      const result = await service.filterSensitiveData(data);
      
      expect(result.settings['openai.apiKey']).toBe('[FILTERED]');
      expect(result.settings['anthropic.key']).toBe('[FILTERED]');
      expect(result.settings['github.token']).toBe('[FILTERED]');
    });

    it('should detect AWS credentials', async () => {
      const data = {
        config: {
          awsAccessKey: 'AKIAIOSFODNN7EXAMPLE',
          awsSecretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
      };

      const result = await service.filterSensitiveData(data);
      
      const config = result.config as any;
      expect(config.awsAccessKey).toBe('[FILTERED]');
      expect(config.awsSecretKey).toBe('[FILTERED]');
    });

    it('should detect database connection strings', async () => {
      const data = {
        database: {
          mongoUri: 'mongodb://user:password@localhost:27017/db',
          postgresUrl: 'postgresql://user:pass@localhost:5432/mydb',
          mysqlConnection: 'mysql://root:password@localhost:3306/database',
        },
      };

      const result = await service.filterSensitiveData(data);
      
      const database = result.database as any;
      expect(database.mongoUri).toBe('[FILTERED]');
      expect(database.postgresUrl).toBe('[FILTERED]');
      expect(database.mysqlConnection).toBe('[FILTERED]');
    });

    it('should detect JWT tokens', async () => {
      const data = {
        auth: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
          bearer: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        },
      };

      const result = await service.filterSensitiveData(data);
      
      const auth = result.auth as any;
      expect(auth.token).toBe('[FILTERED]');
      expect(auth.bearer).toBe('[FILTERED]');
    });

    it('should detect private keys', async () => {
      const data = {
        keys: {
          ssh: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...',
          pem: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...',
        },
      };

      const result = await service.filterSensitiveData(data);
      
      const keys = result.keys as any;
      expect(keys.ssh).toBe('[FILTERED]');
      expect(keys.pem).toBe('[FILTERED]');
    });

    it('should detect credit card numbers', async () => {
      const data = {
        payment: {
          card1: '4532015112830366',
          card2: '5425-2334-3010-9903',
          card3: '3782 822463 10005',
        },
      };

      const result = await service.filterSensitiveData(data);
      
      const payment = result.payment as any;
      expect(payment.card1).toBe('[FILTERED]');
      expect(payment.card2).toBe('[FILTERED]');
      expect(payment.card3).toBe('[FILTERED]');
    });

    it('should preserve safe data', async () => {
      const data = {
        settings: {
          'editor.fontSize': 14,
          'editor.theme': 'dark',
          'workspace.name': 'My Project',
        },
      };

      const result = await service.filterSensitiveData(data);
      
      expect(result.settings['editor.fontSize']).toBe(14);
      expect(result.settings['editor.theme']).toBe('dark');
      expect(result.settings['workspace.name']).toBe('My Project');
    });

    it('should handle nested objects', async () => {
      const data = {
        level1: {
          safe: 'data',
          level2: {
            apiKey: 'sk-test-1234567890',
            level3: {
              password: 'secretPassword123',
              normal: 'value',
            },
          },
        },
      };

      const result = await service.filterSensitiveData(data);
      
      const level1 = result.level1 as any;
      expect(level1.safe).toBe('data');
      expect(level1.level2.apiKey).toBe('[FILTERED]');
      expect(level1.level2.level3.password).toBe('[FILTERED]');
      expect(level1.level2.level3.normal).toBe('value');
    });

    it('should handle arrays', async () => {
      const data = {
        tokens: [
          'sk-proj-abc123',
          'normal-value',
          'ghp_xyz789',
        ],
        configs: [
          { key: 'sk-test-123', value: 'test' },
          { key: 'normal', value: 'data' },
        ],
      };

      const result = await service.filterSensitiveData(data);
      
      expect(result.tokens[0]).toBe('[FILTERED]');
      expect(result.tokens[1]).toBe('normal-value');
      expect(result.tokens[2]).toBe('[FILTERED]');
      expect(result.configs[0].key).toBe('[FILTERED]');
      expect(result.configs[1].key).toBe('normal');
    });
  });

  describe('generateSecurityReport', () => {
    it('should generate comprehensive security report', async () => {
      const data = {
        settings: {
          apiKey: 'sk-1234567890',
          normalSetting: 'value',
        },
      };

      const report = await service.generateSecurityReport(data);

      expect(report.level).toBeDefined();
      expect(report.filteredItems).toBeGreaterThan(0);
      expect(report.categories).toContain('api_keys');
      expect(report.details).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should classify security levels correctly', async () => {
      const criticalData = {
        privateKey: '-----BEGIN RSA PRIVATE KEY-----',
        apiKey: 'sk-prod-critical',
      };

      const highData = {
        dbConnection: 'mongodb://user:pass@host',
      };

      const mediumData = {
        webhook: 'https://hooks.slack.com/services/T00/B00/XXX',
      };

      const criticalReport = await service.generateSecurityReport(criticalData);
      const highReport = await service.generateSecurityReport(highData);
      const mediumReport = await service.generateSecurityReport(mediumData);

      expect(criticalReport.level).toBe('critical');
      expect(highReport.level).toBe('high');
      expect(mediumReport.level).toBe('medium');
    });

    it('should include audit trail', async () => {
      const data = {
        sensitive: 'sk-1234567890',
      };

      await service.filterSensitiveData(data);
      const report = await service.generateSecurityReport(data);

      expect(report.auditTrail).toBeDefined();
      expect(report.auditTrail.length).toBeGreaterThan(0);
      expect(report.auditTrail[0]).toHaveProperty('timestamp');
      expect(report.auditTrail[0]).toHaveProperty('action');
      expect(report.auditTrail[0]).toHaveProperty('path');
    });
  });

  describe('classifySecurityLevel', () => {
    it('should classify security patterns correctly', () => {
      expect(service.classifySecurityLevel('privateKey')).toBe('critical');
      expect(service.classifySecurityLevel('sshKey')).toBe('critical');
      expect(service.classifySecurityLevel('apiKey')).toBe('high');
      expect(service.classifySecurityLevel('githubToken')).toBe('high');
      expect(service.classifySecurityLevel('databaseUrl')).toBe('high');
      expect(service.classifySecurityLevel('webhook')).toBe('medium');
      expect(service.classifySecurityLevel('email')).toBe('low');
      expect(service.classifySecurityLevel('unknown')).toBe('low');
    });
  });

  describe('isTeamSharingCompatible', () => {
    it('should validate team sharing compatibility', async () => {
      const safeData = {
        settings: {
          fontSize: 14,
          theme: 'dark',
        },
      };

      const unsafeData = {
        settings: {
          apiKey: 'sk-123',
          fontSize: 14,
        },
      };

      const safeResult = await service.isTeamSharingCompatible(safeData);
      const unsafeResult = await service.isTeamSharingCompatible(unsafeData);

      expect(safeResult.compatible).toBe(true);
      expect(safeResult.issues).toHaveLength(0);
      
      expect(unsafeResult.compatible).toBe(false);
      expect(unsafeResult.issues.length).toBeGreaterThan(0);
      expect(unsafeResult.requiredActions.length).toBeGreaterThan(0);
    });

    it('should provide remediation actions', async () => {
      const data = {
        apiKey: 'sk-123',
        dbUrl: 'mongodb://user:pass@host',
      };

      const result = await service.isTeamSharingCompatible(data);

      expect(result.compatible).toBe(false);
      expect(result.requiredActions).toContain('Remove or replace API keys with environment variables');
      expect(result.requiredActions).toContain('Remove or replace database connection strings');
    });
  });

  describe('context-aware filtering', () => {
    it('should apply AI configuration context rules', async () => {
      const aiConfig = {
        modelConfig: {
          openai: {
            apiKey: 'sk-openai-123',
            model: 'gpt-4',
          },
        },
        globalPrompts: [
          {
            name: 'test',
            content: 'API_KEY=sk-test-123',
          },
        ],
      };

      const result = await service.filterSensitiveData(aiConfig);

      const modelConfig = result.modelConfig as any;
      expect(modelConfig.openai.apiKey).toBe('[FILTERED]');
      expect(modelConfig.openai.model).toBe('gpt-4');
      const globalPrompts = result.globalPrompts as any;
      expect(globalPrompts[0].content).toBe('[FILTERED]');
    });

    it('should apply settings context rules', async () => {
      const settings = {
        'http.proxy': 'http://user:password@proxy.com:8080',
        'terminal.integrated.env.linux': {
          API_KEY: 'sk-123',
          PATH: '/usr/bin',
        },
      };

      const result = await service.filterSensitiveData(settings);

      expect(result['http.proxy']).toBe('[FILTERED]');
      const envLinux = result['terminal.integrated.env.linux'] as any;
      expect(envLinux.API_KEY).toBe('[FILTERED]');
      expect(envLinux.PATH).toBe('/usr/bin');
    });

    it('should apply extension context rules', async () => {
      const extensions = {
        'github.copilot': {
          apiKey: 'cop_123456',
          enabled: true,
        },
        'prettier.config': {
          semi: false,
        },
      };

      const result = await service.filterSensitiveData(extensions);

      const copilot = result['github.copilot'] as any;
      expect(copilot.apiKey).toBe('[FILTERED]');
      expect(copilot.enabled).toBe(true);
      const prettier = result['prettier.config'] as any;
      expect(prettier.semi).toBe(false);
    });
  });

  describe('validateComplianceRequirements', () => {
    it('should validate compliance requirements', async () => {
      const data = {
        settings: {
          fontSize: 14,
        },
      };

      const result = await service.validateComplianceRequirements(data);

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect compliance violations', async () => {
      const data = {
        personalInfo: {
          ssn: '123-45-6789',
          creditCard: '4532015112830366',
        },
      };

      const result = await service.validateComplianceRequirements(data);

      expect(result.compliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations).toContain('PII detected: SSN pattern found');
      expect(result.violations).toContain('PCI DSS: Credit card number detected');
    });
  });

  describe('audit logging', () => {
    it('should create audit log entries', async () => {
      const data = {
        secret: 'sk-123',
      };

      await service.filterSensitiveData(data);
      const report = await service.generateSecurityReport(data);

      const auditLog = report.auditTrail;
      expect(auditLog).toBeDefined();
      expect(auditLog.length).toBeGreaterThan(0);
      
      const entry = auditLog[0];
      expect(entry.timestamp).toBeDefined();
      expect(entry.action).toBe('filtered');
      expect(entry.path).toBe('secret');
      expect(entry.pattern).toBe('apiKey');
    });

    it('should track multiple filtering actions', async () => {
      const data = {
        level1: {
          apiKey: 'sk-123',
          level2: {
            password: 'secret',
          },
        },
      };

      await service.filterSensitiveData(data);
      const report = await service.generateSecurityReport(data);

      const auditLog = report.auditTrail;
      expect(auditLog.length).toBe(2);
      expect(auditLog.map(e => e.path)).toContain('level1.apiKey');
      expect(auditLog.map(e => e.path)).toContain('level1.level2.password');
    });
  });
});