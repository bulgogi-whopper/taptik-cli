import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import { CursorComprehensiveMonitor, CursorPerformanceMetrics, CursorDeploymentReport, CursorTrendAnalysis } from './cursor-comprehensive-monitor.service';
import { CursorAuditLoggerService, CursorAuditEntry } from './cursor-audit-logger.service';
import { PerformanceMonitorService, DeploymentMetrics } from './performance-monitor.service';
import { CursorDeploymentError, CursorErrorContext } from '../errors/cursor-deployment.error';
import { CursorAISecurityScanResult } from './cursor-security-enforcer.service';
import { DeploymentResult } from '../interfaces/deployment-result.interface';

describe('CursorComprehensiveMonitor', () => {
  let service: CursorComprehensiveMonitor;
  let auditLogger: jest.Mocked<CursorAuditLoggerService>;
  let performanceMonitor: jest.Mocked<PerformanceMonitorService>;

  const mockDeploymentId = 'test-deployment-123';
  const mockContext: CursorErrorContext = {
    deploymentId: mockDeploymentId,
    userId: 'user-123',
    configId: 'config-123',
    workspacePath: '/test/workspace',
    cursorVersion: '1.0.0',
    operation: 'deploy',
    timestamp: new Date().toISOString(),
  };

  beforeEach(async () => {
    // Mock dependencies
    const mockAuditLogger = {
      logDeploymentStart: jest.fn(),
      logDeploymentEnd: jest.fn(),
      logSecurityViolation: jest.fn(),
      logComponentProcessing: jest.fn(),
      getAuditStats: jest.fn(),
    };

    const mockPerformanceMonitor = {
      startDeploymentMetrics: jest.fn(),
      recordComponentMetrics: jest.fn(),
      endDeploymentMetrics: jest.fn(),
      getMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CursorComprehensiveMonitor,
        {
          provide: CursorAuditLoggerService,
          useValue: mockAuditLogger,
        },
        {
          provide: PerformanceMonitorService,
          useValue: mockPerformanceMonitor,
        },
      ],
    }).compile();

    service = module.get<CursorComprehensiveMonitor>(CursorComprehensiveMonitor);
    auditLogger = module.get(CursorAuditLoggerService);
    performanceMonitor = module.get(PerformanceMonitorService);

    // Mock filesystem operations
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs, 'readFile').mockResolvedValue('{}');
    jest.spyOn(fs, 'readdir').mockResolvedValue([]);
    jest.spyOn(fs, 'stat').mockResolvedValue({
      isFile: () => true,
      mtime: new Date(),
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startDeploymentMonitoring', () => {
    it('should start deployment monitoring successfully', async () => {
      const components = ['ai-config', 'extensions', 'workspace-settings'];

      await service.startDeploymentMonitoring(mockDeploymentId, mockContext, components);

      expect(performanceMonitor.startDeploymentMetrics).toHaveBeenCalledWith(mockDeploymentId);
      expect(auditLogger.logDeploymentStart).toHaveBeenCalledWith(
        mockContext.configId,
        mockContext.workspacePath,
        components,
        mockContext.userId,
      );
    });

    it('should handle missing context properties gracefully', async () => {
      const minimalContext: CursorErrorContext = {
        operation: 'deploy',
        timestamp: new Date().toISOString(),
      };
      const components = ['ai-config'];

      await service.startDeploymentMonitoring(mockDeploymentId, minimalContext, components);

      expect(auditLogger.logDeploymentStart).toHaveBeenCalledWith(
        mockDeploymentId,
        'unknown',
        components,
        undefined,
      );
    });

    it('should initialize metrics with correct initial values', async () => {
      const components = ['ai-config', 'extensions'];
      const writeFileSpy = jest.spyOn(fs, 'writeFile');

      await service.startDeploymentMonitoring(mockDeploymentId, mockContext, components);

      expect(writeFileSpy).toHaveBeenCalled();
      const metricsCall = writeFileSpy.mock.calls.find(call => 
        call[0].toString().includes('metrics') && call[0].toString().includes(mockDeploymentId)
      );
      expect(metricsCall).toBeDefined();

      const metrics = JSON.parse(metricsCall![1] as string) as CursorPerformanceMetrics;
      expect(metrics.deploymentId).toBe(mockDeploymentId);
      expect(metrics.platform).toBe('cursor');
      expect(metrics.deploymentStatus).toBe('in_progress');
      expect(metrics.successMetrics.totalComponents).toBe(components.length);
      expect(metrics.securityScore).toBe(100);
    });
  });

  describe('recordComponentMetrics', () => {
    beforeEach(async () => {
      await service.startDeploymentMonitoring(mockDeploymentId, mockContext, ['ai-config']);
    });

    it('should record successful component metrics', async () => {
      const componentMetrics = {
        size: 1024,
        processingTime: 500,
        status: 'success' as const,
      };

      await service.recordComponentMetrics(
        mockDeploymentId,
        'ai-config',
        'cursor-rules',
        componentMetrics,
      );

      // Verify performance monitor is called
      expect(performanceMonitor.recordComponentMetrics).toHaveBeenCalledWith(
        mockDeploymentId,
        expect.objectContaining({
          componentType: 'ai-config',
          componentName: 'cursor-rules',
          ...componentMetrics,
        }),
      );
    });

    it('should record failed component metrics with error details', async () => {
      const componentMetrics = {
        size: 512,
        processingTime: 200,
        status: 'failed' as const,
        errorCode: 'VALIDATION_ERROR',
        retryCount: 2,
        issues: ['Invalid AI rule format', 'Content too large'],
      };

      await service.recordComponentMetrics(
        mockDeploymentId,
        'ai-config',
        'ai-context',
        componentMetrics,
      );

      expect(performanceMonitor.recordComponentMetrics).toHaveBeenCalledWith(
        mockDeploymentId,
        expect.objectContaining(componentMetrics),
      );
    });

    it('should update deployment metrics file', async () => {
      const writeFileSpy = jest.spyOn(fs, 'writeFile');
      const componentMetrics = {
        size: 256,
        processingTime: 100,
        status: 'success' as const,
      };

      await service.recordComponentMetrics(
        mockDeploymentId,
        'extensions',
        'extension-config',
        componentMetrics,
      );

      // Should write updated metrics
      expect(writeFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('metrics'),
        expect.any(String),
      );
    });
  });

  describe('recordSecurityViolation', () => {
    beforeEach(async () => {
      await service.startDeploymentMonitoring(mockDeploymentId, mockContext, ['ai-config']);
    });

    it('should record security violation and update metrics', async () => {
      const violationType = 'ai_injection';
      const severity = 'high';
      const description = 'Potential prompt injection detected';
      const evidence = [
        {
          type: 'pattern_match' as const,
          location: 'ai-rules.txt',
          pattern: 'ignore all previous instructions',
        },
      ];

      await service.recordSecurityViolation(
        mockDeploymentId,
        violationType,
        severity,
        description,
        evidence,
      );

      expect(auditLogger.logSecurityViolation).toHaveBeenCalledWith(
        mockDeploymentId,
        violationType,
        severity,
        description,
        evidence,
      );
    });

    it('should update security scores based on violation severity', async () => {
      const writeFileSpy = jest.spyOn(fs, 'writeFile');
      
      await service.recordSecurityViolation(
        mockDeploymentId,
        'malicious_content',
        'critical',
        'Malicious code detected',
        [],
      );

      const metricsCall = writeFileSpy.mock.calls.find(call => 
        call[0].toString().includes('metrics')
      );
      expect(metricsCall).toBeDefined();

      const metrics = JSON.parse(metricsCall![1] as string) as CursorPerformanceMetrics;
      expect(metrics.securityViolations).toBeGreaterThan(0);
      expect(metrics.securityScore).toBeLessThan(100);
    });
  });

  describe('endDeploymentMonitoring', () => {
    beforeEach(async () => {
      await service.startDeploymentMonitoring(mockDeploymentId, mockContext, ['ai-config', 'extensions']);
    });

    it('should end deployment monitoring with success result', async () => {
      const deploymentResult: DeploymentResult = {
        success: true,
        platform: 'cursor',
        deployedComponents: ['ai-config', 'extensions'],
        skippedComponents: [],
        errors: [],
        warnings: [],
        summary: 'Deployment completed successfully',
        duration: 5000,
      };

      const report = await service.endDeploymentMonitoring(mockDeploymentId, deploymentResult);

      expect(performanceMonitor.endDeploymentMetrics).toHaveBeenCalledWith(mockDeploymentId);
      expect(auditLogger.logDeploymentEnd).toHaveBeenCalledWith(
        mockDeploymentId,
        true,
        deploymentResult.deployedComponents,
        deploymentResult.errors,
      );
      expect(report.success).toBe(true);
      expect(report.summary.totalComponents).toBe(2);
      expect(report.summary.successfulComponents).toBe(2);
    });

    it('should end deployment monitoring with failure result', async () => {
      const deploymentResult: DeploymentResult = {
        success: false,
        platform: 'cursor',
        deployedComponents: ['ai-config'],
        skippedComponents: ['extensions'],
        errors: [
          {
            code: 'VALIDATION_ERROR',
            message: 'Extension validation failed',
            component: 'extensions',
            recoverable: true,
          },
        ],
        warnings: [],
        summary: 'Deployment failed with errors',
        duration: 3000,
      };

      const report = await service.endDeploymentMonitoring(mockDeploymentId, deploymentResult);

      expect(report.success).toBe(false);
      expect(report.summary.failedComponents).toBe(1);
      expect(report.summary.successfulComponents).toBe(1);
      expect(report.components).toHaveLength(2);
    });

    it('should generate performance analysis in report', async () => {
      const deploymentResult: DeploymentResult = {
        success: true,
        platform: 'cursor',
        deployedComponents: ['ai-config'],
        skippedComponents: [],
        errors: [],
        warnings: [],
        summary: 'Deployment completed',
        duration: 10000, // Slow deployment
      };

      const report = await service.endDeploymentMonitoring(mockDeploymentId, deploymentResult);

      expect(report.performance).toBeDefined();
      expect(report.performance.score).toBeGreaterThanOrEqual(0);
      expect(report.performance.score).toBeLessThanOrEqual(100);
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('generateTrendAnalysis', () => {
    it('should generate daily trend analysis', async () => {
      // Mock existing metrics files
      const mockMetrics = [
        {
          deploymentId: 'deploy-1',
          timestamp: new Date().toISOString(),
          deploymentStatus: 'success',
          totalDuration: 3000,
          securityScore: 95,
        },
        {
          deploymentId: 'deploy-2',
          timestamp: new Date().toISOString(),
          deploymentStatus: 'failed',
          totalDuration: 1500,
          securityScore: 85,
        },
      ];

      jest.spyOn(fs, 'readdir').mockResolvedValue(['deploy-1.json', 'deploy-2.json'] as any);
      jest.spyOn(fs, 'readFile')
        .mockResolvedValueOnce(JSON.stringify(mockMetrics[0]))
        .mockResolvedValueOnce(JSON.stringify(mockMetrics[1]));

      const analysis = await service.generateTrendAnalysis('daily');

      expect(analysis.period).toBe('daily');
      expect(analysis.deploymentCount).toBe(2);
      expect(analysis.successRate).toBe(50); // 1 success out of 2
      expect(analysis.avgDuration).toBe(2250); // (3000 + 1500) / 2
      expect(analysis.avgSecurityScore).toBe(90); // (95 + 85) / 2
    });

    it('should handle empty metrics gracefully', async () => {
      jest.spyOn(fs, 'readdir').mockResolvedValue([]);

      const analysis = await service.generateTrendAnalysis('weekly');

      expect(analysis.deploymentCount).toBe(0);
      expect(analysis.successRate).toBe(0);
      expect(analysis.avgDuration).toBe(0);
      expect(analysis.trends).toEqual([]);
    });
  });

  describe('alert management', () => {
    it('should add alert rule successfully', async () => {
      const alertRule = {
        id: 'high-failure-rate',
        name: 'High Failure Rate Alert',
        description: 'Alert when failure rate exceeds threshold',
        enabled: true,
        conditions: {
          metricType: 'failure_rate' as const,
          operator: 'greater_than' as const,
          threshold: 25,
          timeWindow: '1h',
        },
        actions: {
          notifications: ['email'],
          escalation: {
            enabled: true,
            delay: '15m',
            targets: ['admin@example.com'],
          },
        },
      };

      await service.addAlertRule(alertRule);

      // Verify rule is stored
      const writeFileSpy = jest.spyOn(fs, 'writeFile');
      expect(writeFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('alert-rules.json'),
        expect.any(String),
      );
    });

    it('should check alert conditions and trigger when threshold exceeded', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      
      // Add alert rule
      await service.addAlertRule({
        id: 'security-violations',
        name: 'Security Violations Alert',
        description: 'Alert on security violations',
        enabled: true,
        conditions: {
          metricType: 'security_violations',
          operator: 'greater_than',
          threshold: 0,
          timeWindow: '1h',
        },
        actions: {
          notifications: ['log'],
          escalation: {
            enabled: false,
            delay: '5m',
            targets: [],
          },
        },
      });

      // Simulate metrics that should trigger alert
      const metrics: CursorPerformanceMetrics = {
        deploymentId: mockDeploymentId,
        timestamp: new Date().toISOString(),
        platform: 'cursor',
        deploymentStatus: 'success',
        deploymentErrors: [],
        totalDuration: 1000,
        transformationTime: 200,
        validationTime: 100,
        securityScanTime: 50,
        fileWriteTime: 150,
        peakMemoryUsage: 1024,
        averageMemoryUsage: 512,
        diskSpaceUsed: 256,
        componentMetrics: [],
        securityViolations: 2, // Should trigger alert
        securityWarnings: 1,
        securityScore: 85,
        configurationScore: 90,
        complexityScore: 20,
        trustScore: 95,
        successMetrics: {
          totalComponents: 1,
          successfulComponents: 1,
          failedComponents: 0,
          skippedComponents: 0,
          rolledBackComponents: 0,
          successRate: 100,
          recoveryAttempts: 0,
          successfulRecoveries: 0,
        },
      };

      await service.checkAlertConditions(metrics);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Alert triggered: Security Violations Alert'),
      );
    });
  });

  describe('error handling', () => {
    it('should handle filesystem errors gracefully', async () => {
      jest.spyOn(fs, 'writeFile').mockRejectedValue(new Error('Filesystem error'));
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.startDeploymentMonitoring(mockDeploymentId, mockContext, ['ai-config']);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record deployment metrics'),
        expect.any(Error),
      );
    });

    it('should handle missing metrics file gracefully', async () => {
      jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('File not found'));

      const analysis = await service.generateTrendAnalysis('daily');

      expect(analysis.deploymentCount).toBe(0);
      expect(analysis.trends).toEqual([]);
    });
  });
});
