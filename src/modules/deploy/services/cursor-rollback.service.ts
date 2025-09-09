import { promises as fs } from 'fs';
import * as os from 'os';
import { join, dirname } from 'path';

import { Injectable, Logger } from '@nestjs/common';

import { CursorDeploymentError, CursorDeploymentErrorCode } from '../errors/cursor-deploy.error';

import { BackupService, BackupManifest } from './backup.service';


/**
 * Cursor 배포 상태 인터페이스
 */
export interface CursorDeploymentState {
  deploymentId: string;
  timestamp: Date;
  targetPath: string;
  components: string[];
  backupId?: string;
  status: 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  checkpoints: CursorDeploymentCheckpoint[];
}

/**
 * 배포 체크포인트 인터페이스
 */
export interface CursorDeploymentCheckpoint {
  id: string;
  timestamp: Date;
  component: string;
  action: string;
  filePath: string;
  backupPath?: string;
  success: boolean;
  error?: string;
}

/**
 * 롤백 결과 인터페이스
 */
export interface RollbackResult {
  success: boolean;
  message: string;
  restoredFiles: string[];
  failedFiles: string[];
  integrityCheck: boolean;
  warnings: string[];
}

/**
 * 무결성 검증 결과 인터페이스
 */
export interface IntegrityCheckResult {
  valid: boolean;
  issues: IntegrityIssue[];
  summary: {
    totalFiles: number;
    validFiles: number;
    corruptedFiles: number;
    missingFiles: number;
  };
}

/**
 * 무결성 문제 인터페이스
 */
export interface IntegrityIssue {
  type: 'corrupted' | 'missing' | 'permission' | 'format';
  filePath: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fixable: boolean;
}

/**
 * Cursor IDE 배포 롤백 서비스
 * 
 * 이 서비스는 Cursor IDE 배포 실패 시 자동 롤백을 수행하고,
 * 배포 상태를 추적하여 안전한 복구를 보장합니다.
 */
@Injectable()
export class CursorRollbackService {
  private readonly logger = new Logger(CursorRollbackService.name);
  private readonly stateDir = join(os.homedir(), '.taptik', 'cursor-deploy-state');
  private readonly deploymentStates = new Map<string, CursorDeploymentState>();

  constructor(private readonly backupService: BackupService) {}

  /**
   * 새로운 배포 상태 초기화
   */
  async initializeDeployment(
    deploymentId: string,
    targetPath: string,
    components: string[],
  ): Promise<CursorDeploymentState> {
    const state: CursorDeploymentState = {
      deploymentId,
      timestamp: new Date(),
      targetPath,
      components,
      status: 'in_progress',
      checkpoints: [],
    };

    // 백업 생성
    try {
      const backupId = await this.createCursorBackup(targetPath, components);
      state.backupId = backupId;
      this.logger.log(`Created backup for deployment ${deploymentId}: ${backupId}`);
    } catch (error) {
      this.logger.warn(`Failed to create backup for deployment ${deploymentId}:`, error);
      // 백업 실패해도 배포는 계속 진행 (사용자 선택에 따라)
    }

    // 상태 저장
    this.deploymentStates.set(deploymentId, state);
    await this.saveDeploymentState(state);

    return state;
  }

  /**
   * 배포 체크포인트 추가
   */
  async addCheckpoint(
    deploymentId: string,
    component: string,
    action: string,
    filePath: string,
    success: boolean,
    error?: string,
  ): Promise<void> {
    const state = this.deploymentStates.get(deploymentId);
    if (!state) {
      throw new Error(`Deployment state not found: ${deploymentId}`);
    }

    const checkpoint: CursorDeploymentCheckpoint = {
      id: `${deploymentId}-${Date.now()}`,
      timestamp: new Date(),
      component,
      action,
      filePath,
      success,
      error,
    };

    // 파일 백업 (성공한 작업에 대해서만)
    if (success) {
      try {
        const backupPath = await this.backupFile(filePath, deploymentId);
        checkpoint.backupPath = backupPath;
      } catch (backupError) {
        this.logger.warn(`Failed to backup file ${filePath}:`, backupError);
      }
    }

    state.checkpoints.push(checkpoint);
    await this.saveDeploymentState(state);

    this.logger.debug(`Added checkpoint for ${deploymentId}:`, checkpoint);
  }

  /**
   * 배포 완료 처리
   */
  async completeDeployment(deploymentId: string): Promise<void> {
    const state = this.deploymentStates.get(deploymentId);
    if (!state) {
      throw new Error(`Deployment state not found: ${deploymentId}`);
    }

    state.status = 'completed';
    await this.saveDeploymentState(state);

    this.logger.log(`Deployment completed successfully: ${deploymentId}`);
  }

  /**
   * 배포 실패 시 자동 롤백 수행
   */
  async performRollback(
    deploymentId: string,
    error?: CursorDeploymentError,
  ): Promise<RollbackResult> {
    this.logger.warn(`Performing rollback for deployment: ${deploymentId}`);

    const state = this.deploymentStates.get(deploymentId);
    if (!state) {
      throw new CursorDeploymentError(
        CursorDeploymentErrorCode.ROLLBACK_FAILED,
        `Deployment state not found: ${deploymentId}`,
        { deploymentId },
      );
    }

    const result: RollbackResult = {
      success: true,
      message: 'Rollback completed successfully',
      restoredFiles: [],
      failedFiles: [],
      integrityCheck: false,
      warnings: [],
    };

    try {
      // 1. 체크포인트 역순으로 롤백
      await this.rollbackCheckpoints(state, result);

      // 2. 전체 백업에서 복원 (체크포인트 롤백이 실패한 경우)
      if (result.failedFiles.length > 0 && state.backupId) {
        await this.rollbackFromFullBackup(state, result);
      }

      // 3. 무결성 검증
      const integrityResult = await this.verifyIntegrity(state.targetPath, state.components);
      result.integrityCheck = integrityResult.valid;

      if (!integrityResult.valid) {
        result.warnings.push(`Integrity check failed: ${integrityResult.issues.length} issues found`);
        result.success = false;
      }

      // 4. 상태 업데이트
      state.status = result.success ? 'rolled_back' : 'failed';
      await this.saveDeploymentState(state);

      this.logger.log(`Rollback ${result.success ? 'completed' : 'failed'} for deployment: ${deploymentId}`);

    } catch (rollbackError) {
      result.success = false;
      result.message = `Rollback failed: ${rollbackError.message}`;
      
      state.status = 'failed';
      await this.saveDeploymentState(state);

      this.logger.error(`Rollback failed for deployment ${deploymentId}:`, rollbackError);

      throw new CursorDeploymentError(
        CursorDeploymentErrorCode.ROLLBACK_FAILED,
        result.message,
        { deploymentId, originalError: error?.toJSON() },
      );
    }

    return result;
  }

  /**
   * 체크포인트 기반 롤백
   */
  private async rollbackCheckpoints(
    state: CursorDeploymentState,
    result: RollbackResult,
  ): Promise<void> {
    // 성공한 체크포인트들을 역순으로 처리
    const successfulCheckpoints = state.checkpoints
      .filter(cp => cp.success && cp.backupPath)
      .reverse();

    // Sequential processing required to maintain rollback order
     
    for (const checkpoint of successfulCheckpoints) {
      try {
        if (checkpoint.backupPath) {
          // 백업에서 파일 복원
          // eslint-disable-next-line no-await-in-loop
          const backupContent = await fs.readFile(checkpoint.backupPath);
          // eslint-disable-next-line no-await-in-loop
          await fs.writeFile(checkpoint.filePath, backupContent);
          
          result.restoredFiles.push(checkpoint.filePath);
          this.logger.debug(`Restored file from checkpoint: ${checkpoint.filePath}`);
        }
      } catch (restoreError) {
        result.failedFiles.push(checkpoint.filePath);
        result.warnings.push(`Failed to restore ${checkpoint.filePath}: ${restoreError.message}`);
        this.logger.error(`Failed to restore file ${checkpoint.filePath}:`, restoreError);
      }
    }
  }

  /**
   * 전체 백업에서 롤백
   */
  private async rollbackFromFullBackup(
    state: CursorDeploymentState,
    result: RollbackResult,
  ): Promise<void> {
    if (!state.backupId) {
      result.warnings.push('No full backup available for rollback');
      return;
    }

    try {
      await this.backupService.restore(state.backupId, 'cursor-ide');
      
      // 실패한 파일들을 복원된 것으로 표시
      result.restoredFiles.push(...result.failedFiles);
      result.failedFiles = [];
      
      this.logger.log(`Restored from full backup: ${state.backupId}`);
    } catch (restoreError) {
      result.warnings.push(`Full backup restore failed: ${restoreError.message}`);
      this.logger.error(`Full backup restore failed:`, restoreError);
    }
  }

  /**
   * Cursor 설정 백업 생성
   */
  private async createCursorBackup(targetPath: string, _components: string[]): Promise<string> {
    const backupId = `cursor-${Date.now()}`;
    const backupDir = join(os.homedir(), '.taptik', 'backups', 'cursor-ide', backupId);
    
    await fs.mkdir(backupDir, { recursive: true });

    const manifest: BackupManifest = {
      originalPath: targetPath,
      backupPath: backupDir,
      timestamp: Date.now(),
      files: [],
      components: {},
    };

    // Cursor 설정 파일들 백업
    const cursorPaths = [
      join(os.homedir(), '.cursor'),
      join(targetPath, '.cursor'),
    ];

    for (const cursorPath of cursorPaths) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.backupDirectory(cursorPath, backupDir, manifest);
      } catch (error) {
        // 디렉토리가 존재하지 않는 경우는 무시
        if (error.code !== 'ENOENT') {
          this.logger.warn(`Failed to backup ${cursorPath}:`, error);
        }
      }
    }

    // 매니페스트 저장
    const manifestPath = join(backupDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    return backupId;
  }

  /**
   * 디렉토리 재귀적 백업
   */
  private async backupDirectory(
    sourcePath: string,
    backupDir: string,
    manifest: BackupManifest,
  ): Promise<void> {
    const stats = await fs.stat(sourcePath);
    
    if (stats.isDirectory()) {
      const entries = await fs.readdir(sourcePath);
      
      for (const entry of entries) {
        const entryPath = join(sourcePath, entry);
        // eslint-disable-next-line no-await-in-loop
        await this.backupDirectory(entryPath, backupDir, manifest);
      }
    } else if (stats.isFile()) {
      // 파일 백업
      const relativePath = sourcePath.replace(os.homedir(), '');
      const backupPath = join(backupDir, relativePath);
      
      await fs.mkdir(dirname(backupPath), { recursive: true });
      await fs.copyFile(sourcePath, backupPath);
      
      manifest.files?.push({
        originalPath: sourcePath,
        backupPath: relativePath,
      });
    }
  }

  /**
   * 개별 파일 백업
   */
  private async backupFile(filePath: string, deploymentId: string): Promise<string> {
    const backupDir = join(this.stateDir, deploymentId, 'checkpoints');
    await fs.mkdir(backupDir, { recursive: true });
    
    const filename = `${Date.now()}-${filePath.replace(/[/\\]/g, '_')}`;
    const backupPath = join(backupDir, filename);
    
    try {
      await fs.copyFile(filePath, backupPath);
      return backupPath;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 원본 파일이 없는 경우 빈 파일로 백업
        await fs.writeFile(backupPath, '');
        return backupPath;
      }
      throw error;
    }
  }

  /**
   * 무결성 검증
   */
  async verifyIntegrity(targetPath: string, _components: string[]): Promise<IntegrityCheckResult> {
    const result: IntegrityCheckResult = {
      valid: true,
      issues: [],
      summary: {
        totalFiles: 0,
        validFiles: 0,
        corruptedFiles: 0,
        missingFiles: 0,
      },
    };

    // Cursor 설정 파일들 검증
    const filesToCheck = [
      join(os.homedir(), '.cursor', 'settings.json'),
      join(targetPath, '.cursor', 'settings.json'),
      join(targetPath, '.cursor', 'tasks.json'),
      join(targetPath, '.cursor', 'launch.json'),
      join(targetPath, '.cursor', 'extensions.json'),
    ];

    for (const filePath of filesToCheck) {
      result.summary.totalFiles++;
      
      try {
        // eslint-disable-next-line no-await-in-loop
        const exists = await this.fileExists(filePath);
        if (!exists) {
          // 파일이 없는 것은 정상일 수 있음 (선택적 파일)
          result.summary.validFiles++;
          continue;
        }

        // JSON 파일 형식 검증
        if (filePath.endsWith('.json')) {
          // eslint-disable-next-line no-await-in-loop
          const content = await fs.readFile(filePath, 'utf8');
          JSON.parse(content); // JSON 파싱 테스트
        }

        // 권한 검증
        // eslint-disable-next-line no-await-in-loop
        await fs.access(filePath, fs.constants.R_OK | fs.constants.W_OK);
        
        result.summary.validFiles++;
      } catch (error) {
        result.valid = false;
        
        let issueType: IntegrityIssue['type'] = 'corrupted';
        let severity: IntegrityIssue['severity'] = 'medium';
        
        if (error.code === 'ENOENT') {
          issueType = 'missing';
          result.summary.missingFiles++;
        } else if (error.code === 'EACCES') {
          issueType = 'permission';
          severity = 'high';
        } else if (error instanceof SyntaxError) {
          issueType = 'format';
          result.summary.corruptedFiles++;
          severity = 'high';
        } else {
          result.summary.corruptedFiles++;
        }

        result.issues.push({
          type: issueType,
          filePath,
          description: error.message,
          severity,
          fixable: issueType !== 'missing',
        });
      }
    }

    return result;
  }

  /**
   * 배포 상태 저장
   */
  private async saveDeploymentState(state: CursorDeploymentState): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    
    const statePath = join(this.stateDir, `${state.deploymentId}.json`);
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * 배포 상태 로드
   */
  async loadDeploymentState(deploymentId: string): Promise<CursorDeploymentState | null> {
    try {
      const statePath = join(this.stateDir, `${deploymentId}.json`);
      const content = await fs.readFile(statePath, 'utf8');
      const state = JSON.parse(content) as CursorDeploymentState;
      
      // Date 객체 복원
      state.timestamp = new Date(state.timestamp);
      state.checkpoints = state.checkpoints.map(cp => ({
        ...cp,
        timestamp: new Date(cp.timestamp),
      }));
      
      this.deploymentStates.set(deploymentId, state);
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 진행 중인 배포 목록 조회
   */
  async getActiveDeployments(): Promise<CursorDeploymentState[]> {
    try {
      await fs.mkdir(this.stateDir, { recursive: true });
      const files = await fs.readdir(this.stateDir);
      const stateFiles = files.filter(f => f.endsWith('.json'));
      
      const states: CursorDeploymentState[] = [];
      
      for (const file of stateFiles) {
        try {
          const deploymentId = file.replace('.json', '');
          // eslint-disable-next-line no-await-in-loop
          const state = await this.loadDeploymentState(deploymentId);
          if (state && state.status === 'in_progress') {
            states.push(state);
          }
        } catch (error) {
          this.logger.warn(`Failed to load deployment state from ${file}:`, error);
        }
      }
      
      return states;
    } catch (error) {
      this.logger.error('Failed to get active deployments:', error);
      return [];
    }
  }

  /**
   * 오래된 배포 상태 정리
   */
  async cleanupOldStates(retentionDays: number = 7): Promise<void> {
    try {
      const files = await fs.readdir(this.stateDir);
      const now = Date.now();
      const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = join(this.stateDir, file);
        // eslint-disable-next-line no-await-in-loop
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > retentionMs) {
          // eslint-disable-next-line no-await-in-loop
          await fs.rm(filePath, { force: true });
          this.logger.debug(`Cleaned up old deployment state: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old deployment states:', error);
    }
  }

  /**
   * 파일 존재 여부 확인
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 수동 복구 지침 생성
   */
  generateManualRecoveryInstructions(
    deploymentId: string,
    integrityResult: IntegrityCheckResult,
  ): string[] {
    const instructions: string[] = [
      '🔧 Manual Recovery Instructions',
      '================================',
      '',
      `Deployment ID: ${deploymentId}`,
      `Issues found: ${integrityResult.issues.length}`,
      '',
    ];

    // 심각도별 문제 분류
    const criticalIssues = integrityResult.issues.filter(i => i.severity === 'critical');
    const highIssues = integrityResult.issues.filter(i => i.severity === 'high');
    const mediumIssues = integrityResult.issues.filter(i => i.severity === 'medium');

    if (criticalIssues.length > 0) {
      instructions.push('🚨 CRITICAL ISSUES (Fix immediately):');
      criticalIssues.forEach((issue, index) => {
        instructions.push(`${index + 1}. ${issue.filePath}`);
        instructions.push(`   Problem: ${issue.description}`);
        instructions.push(`   Type: ${issue.type}`);
        if (issue.fixable) {
          instructions.push(`   Action: ${this.getFixAction(issue)}`);
        } else {
          instructions.push(`   Action: Manual intervention required`);
        }
        instructions.push('');
      });
    }

    if (highIssues.length > 0) {
      instructions.push('⚠️  HIGH PRIORITY ISSUES:');
      highIssues.forEach((issue, index) => {
        instructions.push(`${index + 1}. ${issue.filePath}: ${issue.description}`);
        if (issue.fixable) {
          instructions.push(`   Fix: ${this.getFixAction(issue)}`);
        }
      });
      instructions.push('');
    }

    if (mediumIssues.length > 0) {
      instructions.push('ℹ️  MEDIUM PRIORITY ISSUES:');
      mediumIssues.forEach((issue, index) => {
        instructions.push(`${index + 1}. ${issue.filePath}: ${issue.description}`);
      });
      instructions.push('');
    }

    instructions.push('📋 General Recovery Steps:');
    instructions.push('1. Close Cursor IDE completely');
    instructions.push('2. Fix critical and high priority issues first');
    instructions.push('3. Restart Cursor IDE to verify functionality');
    instructions.push('4. Re-run deployment if needed');
    instructions.push('');
    instructions.push(`💡 Need help? Contact support with deployment ID: ${  deploymentId}`);

    return instructions;
  }

  /**
   * 문제 유형별 수정 액션 생성
   */
  private getFixAction(issue: IntegrityIssue): string {
    switch (issue.type) {
      case 'missing':
        return `Create missing file: touch "${issue.filePath}"`;
      case 'permission':
        return `Fix permissions: chmod 644 "${issue.filePath}"`;
      case 'format':
        return `Fix JSON format or restore from backup`;
      case 'corrupted':
        return `Restore from backup or recreate file`;
      default:
        return 'Manual inspection required';
    }
  }
}