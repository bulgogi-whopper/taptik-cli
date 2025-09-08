import { Injectable } from '@nestjs/common';
import { 
  CursorDeploymentError, 
  CursorDeploymentErrorCode, 
  ErrorSeverity 
} from '../errors/cursor-deploy.error';
import { RecoveryResult } from './cursor-error-recovery.service';
import { IntegrityCheckResult } from './cursor-rollback.service';

/**
 * 오류 메시지 템플릿 인터페이스
 */
export interface ErrorMessageTemplate {
  title: string;
  description: string;
  icon: string;
  color: 'red' | 'yellow' | 'blue' | 'green';
  sections: ErrorMessageSection[];
}

/**
 * 오류 메시지 섹션 인터페이스
 */
export interface ErrorMessageSection {
  type: 'info' | 'warning' | 'error' | 'success' | 'steps' | 'code';
  title?: string;
  content: string | string[];
  collapsible?: boolean;
  expanded?: boolean;
}

/**
 * 사용자 친화적 오류 메시지 생성 서비스
 * 
 * 이 서비스는 Cursor IDE 배포 오류를 사용자가 이해하기 쉬운 형태로 변환하고,
 * 구체적인 해결 방법과 다음 단계를 제공합니다.
 */
@Injectable()
export class CursorErrorMessageService {
  
  /**
   * 오류에 대한 사용자 친화적 메시지 생성
   */
  generateUserFriendlyMessage(error: CursorDeploymentError): ErrorMessageTemplate {
    const template = this.getBaseTemplate(error);
    
    // 오류 코드별 맞춤 메시지 생성
    switch (error.code) {
      case CursorDeploymentErrorCode.PERMISSION_DENIED:
        return this.generatePermissionDeniedMessage(error, template);
      
      case CursorDeploymentErrorCode.DISK_FULL:
        return this.generateDiskFullMessage(error, template);
      
      case CursorDeploymentErrorCode.TRANSFORMATION_FAILED:
        return this.generateTransformationFailedMessage(error, template);
      
      case CursorDeploymentErrorCode.SECURITY_THREAT_DETECTED:
        return this.generateSecurityThreatMessage(error, template);
      
      case CursorDeploymentErrorCode.TIMEOUT:
        return this.generateTimeoutMessage(error, template);
      
      case CursorDeploymentErrorCode.ROLLBACK_FAILED:
        return this.generateRollbackFailedMessage(error, template);
      
      case CursorDeploymentErrorCode.NETWORK_ERROR:
        return this.generateNetworkErrorMessage(error, template);
      
      case CursorDeploymentErrorCode.FILE_CORRUPTION:
        return this.generateFileCorruptionMessage(error, template);
      
      default:
        return this.generateGenericErrorMessage(error, template);
    }
  }

  /**
   * 복구 결과에 대한 메시지 생성
   */
  generateRecoveryMessage(recoveryResult: RecoveryResult): ErrorMessageTemplate {
    const template: ErrorMessageTemplate = {
      title: recoveryResult.success ? 'Recovery Completed' : 'Recovery Failed',
      description: recoveryResult.message,
      icon: recoveryResult.success ? '✅' : '❌',
      color: recoveryResult.success ? 'green' : 'red',
      sections: [],
    };

    // 복원된 파일 정보
    if (recoveryResult.restoredFiles.length > 0) {
      template.sections.push({
        type: 'success',
        title: 'Successfully Restored Files',
        content: recoveryResult.restoredFiles,
        collapsible: true,
        expanded: false,
      });
    }

    // 실패한 파일 정보
    if (recoveryResult.failedFiles.length > 0) {
      template.sections.push({
        type: 'error',
        title: 'Failed to Restore Files',
        content: recoveryResult.failedFiles,
        collapsible: true,
        expanded: true,
      });
    }

    // 경고 메시지
    if (recoveryResult.warnings.length > 0) {
      template.sections.push({
        type: 'warning',
        title: 'Warnings',
        content: recoveryResult.warnings,
      });
    }

    // 무결성 검사 결과
    if (!recoveryResult.integrityCheck) {
      template.sections.push({
        type: 'warning',
        title: 'Integrity Check Failed',
        content: [
          'Some configuration files may be corrupted or missing.',
          'Please verify Cursor IDE functionality before proceeding.',
          'Consider running a manual integrity check.',
        ],
      });
    }

    return template;
  }

  /**
   * 무결성 검사 결과 메시지 생성
   */
  generateIntegrityCheckMessage(result: IntegrityCheckResult): ErrorMessageTemplate {
    const template: ErrorMessageTemplate = {
      title: result.valid ? 'Integrity Check Passed' : 'Integrity Issues Found',
      description: `Checked ${result.summary.totalFiles} files, found ${result.issues.length} issues`,
      icon: result.valid ? '✅' : '⚠️',
      color: result.valid ? 'green' : 'yellow',
      sections: [],
    };

    // 요약 정보
    template.sections.push({
      type: 'info',
      title: 'Summary',
      content: [
        `Total files: ${result.summary.totalFiles}`,
        `Valid files: ${result.summary.validFiles}`,
        `Corrupted files: ${result.summary.corruptedFiles}`,
        `Missing files: ${result.summary.missingFiles}`,
      ],
    });

    // 문제별 분류
    if (result.issues.length > 0) {
      const criticalIssues = result.issues.filter(i => i.severity === 'critical');
      const highIssues = result.issues.filter(i => i.severity === 'high');
      const mediumIssues = result.issues.filter(i => i.severity === 'medium');
      const lowIssues = result.issues.filter(i => i.severity === 'low');

      if (criticalIssues.length > 0) {
        template.sections.push({
          type: 'error',
          title: `Critical Issues (${criticalIssues.length})`,
          content: criticalIssues.map(issue => `${issue.filePath}: ${issue.description}`),
          expanded: true,
        });
      }

      if (highIssues.length > 0) {
        template.sections.push({
          type: 'warning',
          title: `High Priority Issues (${highIssues.length})`,
          content: highIssues.map(issue => `${issue.filePath}: ${issue.description}`),
          collapsible: true,
          expanded: true,
        });
      }

      if (mediumIssues.length > 0) {
        template.sections.push({
          type: 'warning',
          title: `Medium Priority Issues (${mediumIssues.length})`,
          content: mediumIssues.map(issue => `${issue.filePath}: ${issue.description}`),
          collapsible: true,
          expanded: false,
        });
      }

      if (lowIssues.length > 0) {
        template.sections.push({
          type: 'info',
          title: `Low Priority Issues (${lowIssues.length})`,
          content: lowIssues.map(issue => `${issue.filePath}: ${issue.description}`),
          collapsible: true,
          expanded: false,
        });
      }
    }

    return template;
  }

  /**
   * 기본 템플릿 생성
   */
  private getBaseTemplate(error: CursorDeploymentError): ErrorMessageTemplate {
    const severityConfig = {
      [ErrorSeverity.LOW]: { icon: 'ℹ️', color: 'blue' as const },
      [ErrorSeverity.MEDIUM]: { icon: '⚠️', color: 'yellow' as const },
      [ErrorSeverity.HIGH]: { icon: '❌', color: 'red' as const },
      [ErrorSeverity.CRITICAL]: { icon: '🚨', color: 'red' as const },
    };

    const config = severityConfig[error.severity];

    return {
      title: this.getErrorTitle(error.code),
      description: error.message,
      icon: config.icon,
      color: config.color,
      sections: [],
    };
  }

  /**
   * 권한 거부 오류 메시지
   */
  private generatePermissionDeniedMessage(
    error: CursorDeploymentError,
    template: ErrorMessageTemplate,
  ): ErrorMessageTemplate {
    template.sections.push(
      {
        type: 'error',
        title: 'What happened?',
        content: [
          'The deployment process was denied access to write files in the Cursor IDE directory.',
          'This usually happens when the current user doesn\'t have sufficient permissions.',
        ],
      },
      {
        type: 'steps',
        title: 'How to fix this:',
        content: [
          '1. Close Cursor IDE completely',
          '2. Run one of these commands in your terminal:',
          '',
          '   Option A - Fix permissions:',
          `   chmod 755 "${error.context.targetPath || '~/.cursor'}"`,
          '',
          '   Option B - Change ownership:',
          `   chown $USER "${error.context.targetPath || '~/.cursor'}"`,
          '',
          '   Option C - Run with elevated privileges:',
          '   sudo taptik deploy --platform cursor-ide',
          '',
          '3. Try the deployment again',
        ],
      },
      {
        type: 'warning',
        title: 'Important Notes',
        content: [
          '• Make sure Cursor IDE is completely closed before fixing permissions',
          '• Option C (sudo) should be used as a last resort',
          '• Contact your system administrator if you\'re on a managed system',
        ],
      },
    );

    return template;
  }

  /**
   * 디스크 공간 부족 오류 메시지
   */
  private generateDiskFullMessage(
    error: CursorDeploymentError,
    template: ErrorMessageTemplate,
  ): ErrorMessageTemplate {
    const requiredSpace = error.details.requiredSpace || 'unknown';
    const availableSpace = error.details.availableSpace || 'unknown';

    template.sections.push(
      {
        type: 'error',
        title: 'What happened?',
        content: [
          'There isn\'t enough disk space to complete the deployment.',
          `Required: ${requiredSpace}MB, Available: ${availableSpace}MB`,
        ],
      },
      {
        type: 'steps',
        title: 'How to fix this:',
        content: [
          '1. Free up disk space by:',
          '   • Emptying trash/recycle bin',
          '   • Removing large unused files',
          '   • Cleaning up downloads folder',
          '   • Running disk cleanup utilities',
          '',
          '2. Alternative solutions:',
          '   • Deploy to a different location with more space',
          '   • Use external storage for large files',
          '   • Deploy only essential components with --components flag',
          '',
          '3. Try the deployment again',
        ],
      },
      {
        type: 'code',
        title: 'Quick disk cleanup commands:',
        content: [
          '# Check disk usage',
          'df -h',
          '',
          '# Find large files',
          'du -h ~ | sort -hr | head -20',
          '',
          '# Clean package caches (if applicable)',
          'npm cache clean --force',
          'yarn cache clean',
        ],
      },
    );

    return template;
  }

  /**
   * 변환 실패 오류 메시지
   */
  private generateTransformationFailedMessage(
    error: CursorDeploymentError,
    template: ErrorMessageTemplate,
  ): ErrorMessageTemplate {
    const component = error.details.component || 'unknown component';
    const reason = error.details.reason || 'unknown reason';

    template.sections.push(
      {
        type: 'error',
        title: 'What happened?',
        content: [
          `Failed to convert ${component} to Cursor IDE format.`,
          `Reason: ${reason}`,
          'This usually means the source configuration has incompatible or corrupted data.',
        ],
      },
      {
        type: 'steps',
        title: 'How to fix this:',
        content: [
          '1. Verify source configuration:',
          '   • Check if the original configuration file is valid',
          '   • Ensure all required fields are present',
          '   • Look for any corrupted or malformed data',
          '',
          '2. Try partial deployment:',
          '   taptik deploy --platform cursor-ide --components settings,extensions',
          '',
          '3. Use validation mode first:',
          '   taptik deploy --platform cursor-ide --validate-only',
          '',
          '4. Check compatibility:',
          '   • Some features may not be supported in Cursor IDE',
          '   • Review the compatibility documentation',
        ],
      },
      {
        type: 'info',
        title: 'Need more details?',
        content: [
          'Run with verbose output to see detailed transformation logs:',
          'taptik deploy --platform cursor-ide --verbose',
        ],
      },
    );

    return template;
  }

  /**
   * 보안 위협 감지 오류 메시지
   */
  private generateSecurityThreatMessage(
    error: CursorDeploymentError,
    template: ErrorMessageTemplate,
  ): ErrorMessageTemplate {
    const threatType = error.details.threatType || 'unknown threat';

    template.sections.push(
      {
        type: 'error',
        title: 'Security Alert',
        content: [
          `A potential security threat was detected: ${threatType}`,
          'The deployment was stopped to protect your system.',
          'Please review the configuration carefully before proceeding.',
        ],
      },
      {
        type: 'steps',
        title: 'What to do next:',
        content: [
          '1. Review the flagged content:',
          '   • Check for suspicious scripts or commands',
          '   • Look for unexpected file paths or URLs',
          '   • Verify the source of the configuration',
          '',
          '2. If you trust the source:',
          '   • Remove or sanitize suspicious entries',
          '   • Use --force flag to bypass security checks (not recommended)',
          '',
          '3. If this seems like a false positive:',
          '   • Contact support with the deployment details',
          '   • Provide context about the configuration source',
        ],
      },
      {
        type: 'warning',
        title: 'Security Best Practices',
        content: [
          '• Only deploy configurations from trusted sources',
          '• Review all settings before deployment',
          '• Keep your system and Cursor IDE updated',
          '• Report false positives to help improve detection',
        ],
      },
    );

    return template;
  }

  /**
   * 타임아웃 오류 메시지
   */
  private generateTimeoutMessage(
    error: CursorDeploymentError,
    template: ErrorMessageTemplate,
  ): ErrorMessageTemplate {
    const operation = error.details.operation || 'deployment operation';
    const timeoutMs = error.details.timeoutMs || 'unknown';

    template.sections.push(
      {
        type: 'warning',
        title: 'What happened?',
        content: [
          `The ${operation} took too long and was cancelled.`,
          `Timeout: ${timeoutMs}ms`,
          'This can happen due to slow network, large files, or system performance issues.',
        ],
      },
      {
        type: 'steps',
        title: 'How to fix this:',
        content: [
          '1. Check your connection:',
          '   • Ensure stable internet connection',
          '   • Try again when network is less congested',
          '',
          '2. Optimize the deployment:',
          '   • Deploy smaller components separately',
          '   • Use --components flag to deploy specific parts',
          '   • Close unnecessary applications to free up resources',
          '',
          '3. System optimization:',
          '   • Restart your computer if performance is poor',
          '   • Check for system updates',
          '   • Ensure sufficient RAM and CPU resources',
        ],
      },
      {
        type: 'info',
        title: 'Alternative approaches:',
        content: [
          'Deploy components individually:',
          'taptik deploy --platform cursor-ide --components settings',
          'taptik deploy --platform cursor-ide --components extensions',
          'taptik deploy --platform cursor-ide --components ai-prompts',
        ],
      },
    );

    return template;
  }

  /**
   * 롤백 실패 오류 메시지
   */
  private generateRollbackFailedMessage(
    error: CursorDeploymentError,
    template: ErrorMessageTemplate,
  ): ErrorMessageTemplate {
    const deploymentId = error.details.deploymentId || 'unknown';

    template.sections.push(
      {
        type: 'error',
        title: 'Critical: Rollback Failed',
        content: [
          'The automatic rollback process failed after a deployment error.',
          'Your Cursor IDE configuration may be in an inconsistent state.',
          'Manual recovery is required to restore functionality.',
        ],
      },
      {
        type: 'steps',
        title: 'Immediate Actions Required:',
        content: [
          '1. Do NOT use Cursor IDE until recovery is complete',
          '',
          '2. Locate backup files:',
          '   ~/.taptik/backups/cursor-ide/',
          '',
          '3. Manual recovery options:',
          '',
          '   Option A - Restore from backup:',
          '   • Find the most recent backup folder',
          '   • Copy files back to their original locations',
          '   • Verify Cursor IDE starts correctly',
          '',
          '   Option B - Fresh installation:',
          '   • Uninstall Cursor IDE completely',
          '   • Remove ~/.cursor directory',
          '   • Reinstall Cursor IDE',
          '   • Reconfigure manually',
          '',
          '4. Test Cursor IDE functionality',
        ],
      },
      {
        type: 'warning',
        title: 'Important Information',
        content: [
          `Deployment ID: ${deploymentId}`,
          'Save this ID for support requests',
          '',
          'Backup locations to check:',
          '• ~/.taptik/backups/cursor-ide/',
          '• ~/.taptik/cursor-deploy-state/',
        ],
      },
      {
        type: 'info',
        title: 'Need Help?',
        content: [
          'Contact support immediately with:',
          `• Deployment ID: ${deploymentId}`,
          '• Error details from this message',
          '• Your operating system and Cursor IDE version',
          '',
          'Emergency recovery documentation:',
          'https://docs.taptik.dev/recovery/cursor-ide',
        ],
      },
    );

    return template;
  }

  /**
   * 네트워크 오류 메시지
   */
  private generateNetworkErrorMessage(
    error: CursorDeploymentError,
    template: ErrorMessageTemplate,
  ): ErrorMessageTemplate {
    template.sections.push(
      {
        type: 'warning',
        title: 'Network Connection Issue',
        content: [
          'Unable to connect to required services during deployment.',
          'This could be due to internet connectivity or service availability.',
        ],
      },
      {
        type: 'steps',
        title: 'Troubleshooting Steps:',
        content: [
          '1. Check your internet connection:',
          '   • Try accessing other websites',
          '   • Test with: ping google.com',
          '',
          '2. Check service status:',
          '   • Visit status.taptik.dev for service updates',
          '   • Check if maintenance is scheduled',
          '',
          '3. Network troubleshooting:',
          '   • Restart your router/modem',
          '   • Try a different network (mobile hotspot)',
          '   • Check firewall/proxy settings',
          '',
          '4. Retry the deployment:',
          '   • Wait a few minutes and try again',
          '   • Use offline mode if available',
        ],
      },
      {
        type: 'info',
        title: 'Offline Options',
        content: [
          'If network issues persist, you can:',
          '• Use previously cached configurations',
          '• Deploy from local backup files',
          '• Work offline and sync later when connection is restored',
        ],
      },
    );

    return template;
  }

  /**
   * 파일 손상 오류 메시지
   */
  private generateFileCorruptionMessage(
    error: CursorDeploymentError,
    template: ErrorMessageTemplate,
  ): ErrorMessageTemplate {
    const filePath = error.details.path || 'unknown file';

    template.sections.push(
      {
        type: 'error',
        title: 'File Corruption Detected',
        content: [
          `A configuration file appears to be corrupted: ${filePath}`,
          'This can happen due to incomplete writes, disk errors, or system crashes.',
          'The file needs to be restored or recreated.',
        ],
      },
      {
        type: 'steps',
        title: 'Recovery Options:',
        content: [
          '1. Automatic recovery (if backup exists):',
          '   • The system will attempt to restore from backup',
          '   • Check if Cursor IDE works after restoration',
          '',
          '2. Manual recovery:',
          '   • Delete the corrupted file',
          '   • Restart Cursor IDE (it will recreate defaults)',
          '   • Reconfigure your preferences',
          '',
          '3. From backup:',
          '   • Check ~/.taptik/backups/ for recent backups',
          '   • Copy the backup file to replace the corrupted one',
          '',
          '4. Complete reset:',
          '   • Remove ~/.cursor directory entirely',
          '   • Restart Cursor IDE for fresh configuration',
        ],
      },
      {
        type: 'warning',
        title: 'Prevention Tips',
        content: [
          '• Regularly backup your Cursor IDE settings',
          '• Don\'t force-quit Cursor IDE during configuration changes',
          '• Check disk health if corruption happens frequently',
          '• Keep your system updated and stable',
        ],
      },
    );

    return template;
  }

  /**
   * 일반 오류 메시지
   */
  private generateGenericErrorMessage(
    error: CursorDeploymentError,
    template: ErrorMessageTemplate,
  ): ErrorMessageTemplate {
    template.sections.push(
      {
        type: 'error',
        title: 'Deployment Error',
        content: [
          'An unexpected error occurred during Cursor IDE deployment.',
          'Please review the details below and try the suggested solutions.',
        ],
      },
      {
        type: 'info',
        title: 'Error Details',
        content: [
          `Error Code: ${error.code}`,
          `Category: ${error.category}`,
          `Severity: ${error.severity}`,
          `Timestamp: ${error.timestamp.toISOString()}`,
        ],
      },
      {
        type: 'steps',
        title: 'General Troubleshooting:',
        content: [
          '1. Try the deployment again:',
          '   • Some errors are temporary and may resolve on retry',
          '',
          '2. Check system requirements:',
          '   • Ensure Cursor IDE is properly installed',
          '   • Verify sufficient disk space and permissions',
          '',
          '3. Use diagnostic mode:',
          '   taptik deploy --platform cursor-ide --verbose --validate-only',
          '',
          '4. Get help:',
          '   • Check documentation at docs.taptik.dev',
          '   • Contact support with error details',
        ],
      },
    );

    // 사용자 제안사항 추가
    if (error.suggestions.length > 0) {
      template.sections.push({
        type: 'info',
        title: 'Specific Suggestions',
        content: error.suggestions,
      });
    }

    return template;
  }

  /**
   * 오류 코드별 제목 생성
   */
  private getErrorTitle(code: CursorDeploymentErrorCode): string {
    const titles: Record<CursorDeploymentErrorCode, string> = {
      [CursorDeploymentErrorCode.PERMISSION_DENIED]: 'Permission Denied',
      [CursorDeploymentErrorCode.DISK_FULL]: 'Insufficient Disk Space',
      [CursorDeploymentErrorCode.TRANSFORMATION_FAILED]: 'Configuration Conversion Failed',
      [CursorDeploymentErrorCode.SECURITY_THREAT_DETECTED]: 'Security Threat Detected',
      [CursorDeploymentErrorCode.TIMEOUT]: 'Operation Timed Out',
      [CursorDeploymentErrorCode.ROLLBACK_FAILED]: 'Rollback Failed - Manual Recovery Required',
      [CursorDeploymentErrorCode.NETWORK_ERROR]: 'Network Connection Error',
      [CursorDeploymentErrorCode.FILE_CORRUPTION]: 'Configuration File Corrupted',
      [CursorDeploymentErrorCode.INVALID_CONTEXT]: 'Invalid Configuration Data',
      [CursorDeploymentErrorCode.MISSING_REQUIRED_FIELD]: 'Missing Required Configuration',
      [CursorDeploymentErrorCode.INCOMPATIBLE_VERSION]: 'Version Compatibility Issue',
      [CursorDeploymentErrorCode.INVALID_CONFIGURATION]: 'Invalid Configuration Format',
      [CursorDeploymentErrorCode.SCHEMA_VALIDATION_FAILED]: 'Configuration Schema Error',
      [CursorDeploymentErrorCode.PATH_NOT_FOUND]: 'Target Path Not Found',
      [CursorDeploymentErrorCode.FILE_LOCKED]: 'File Access Blocked',
      [CursorDeploymentErrorCode.DIRECTORY_NOT_WRITABLE]: 'Directory Write Permission Denied',
      [CursorDeploymentErrorCode.DATA_LOSS_DETECTED]: 'Potential Data Loss Detected',
      [CursorDeploymentErrorCode.UNSUPPORTED_FEATURE]: 'Unsupported Feature',
      [CursorDeploymentErrorCode.MAPPING_ERROR]: 'Configuration Mapping Error',
      [CursorDeploymentErrorCode.MALICIOUS_CONTENT]: 'Malicious Content Detected',
      [CursorDeploymentErrorCode.UNAUTHORIZED_ACCESS]: 'Unauthorized Access Attempt',
      [CursorDeploymentErrorCode.SENSITIVE_DATA_DETECTED]: 'Sensitive Data Found',
      [CursorDeploymentErrorCode.MEMORY_LIMIT_EXCEEDED]: 'Memory Limit Exceeded',
      [CursorDeploymentErrorCode.FILE_TOO_LARGE]: 'File Size Limit Exceeded',
      [CursorDeploymentErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate Limit Exceeded',
      [CursorDeploymentErrorCode.SUPABASE_CONNECTION_FAILED]: 'Cloud Service Connection Failed',
      [CursorDeploymentErrorCode.DOWNLOAD_FAILED]: 'Download Failed',
      [CursorDeploymentErrorCode.CONFLICT_RESOLUTION_FAILED]: 'Conflict Resolution Failed',
      [CursorDeploymentErrorCode.MERGE_CONFLICT]: 'Configuration Merge Conflict',
      [CursorDeploymentErrorCode.BACKUP_FAILED]: 'Backup Creation Failed',
      [CursorDeploymentErrorCode.UNKNOWN_ERROR]: 'Unknown Error',
      [CursorDeploymentErrorCode.INTERNAL_ERROR]: 'Internal System Error',
      [CursorDeploymentErrorCode.CONFIGURATION_ERROR]: 'System Configuration Error',
    };

    return titles[code] || 'Deployment Error';
  }

  /**
   * 콘솔용 간단한 텍스트 메시지 생성
   */
  generateConsoleMessage(template: ErrorMessageTemplate): string {
    let message = `\n${template.icon} ${template.title}\n`;
    message += '='.repeat(template.title.length + 3) + '\n\n';
    message += `${template.description}\n\n`;

    for (const section of template.sections) {
      if (section.title) {
        message += `${this.getSectionIcon(section.type)} ${section.title}\n`;
      }

      if (Array.isArray(section.content)) {
        section.content.forEach(line => {
          message += `${line}\n`;
        });
      } else {
        message += `${section.content}\n`;
      }
      message += '\n';
    }

    return message;
  }

  /**
   * 섹션 타입별 아이콘 반환
   */
  private getSectionIcon(type: string): string {
    const icons = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅',
      steps: '📋',
      code: '💻',
    };
    return icons[type] || '•';
  }

  /**
   * HTML 형태의 메시지 생성 (웹 인터페이스용)
   */
  generateHtmlMessage(template: ErrorMessageTemplate): string {
    let html = `<div class="error-message error-${template.color}">`;
    html += `<div class="error-header">`;
    html += `<span class="error-icon">${template.icon}</span>`;
    html += `<h2 class="error-title">${template.title}</h2>`;
    html += `</div>`;
    html += `<p class="error-description">${template.description}</p>`;

    for (const section of template.sections) {
      html += `<div class="error-section error-section-${section.type}">`;
      
      if (section.title) {
        html += `<h3 class="section-title">${section.title}</h3>`;
      }

      if (Array.isArray(section.content)) {
        if (section.type === 'steps') {
          html += '<ol class="section-steps">';
          section.content.forEach(step => {
            if (step.trim()) {
              html += `<li>${this.escapeHtml(step)}</li>`;
            }
          });
          html += '</ol>';
        } else {
          html += '<ul class="section-list">';
          section.content.forEach(item => {
            if (item.trim()) {
              html += `<li>${this.escapeHtml(item)}</li>`;
            }
          });
          html += '</ul>';
        }
      } else {
        html += `<p class="section-content">${this.escapeHtml(section.content)}</p>`;
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * HTML 이스케이프 처리
   */
  private escapeHtml(text: string): string {
    const div = { innerHTML: '' } as any;
    div.textContent = text;
    return div.innerHTML;
  }
}