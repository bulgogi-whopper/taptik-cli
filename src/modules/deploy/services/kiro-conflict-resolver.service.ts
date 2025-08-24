import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { Injectable } from '@nestjs/common';

import {
  KiroConflictStrategy,
  KiroMergeStrategy,
  KiroComponentType,
  KiroGlobalSettings,
  KiroProjectSettings,
  KiroSteeringDocument,
  KiroSpecDocument,
  KiroHookConfiguration,
  KiroAgentConfiguration,
  KiroTemplateConfiguration,
  KiroTask,
  KiroMergedConfiguration,
} from '../interfaces/kiro-deployment.interface';
import { DeploymentError, DeploymentWarning } from '../interfaces/deployment-result.interface';
import { BackupService } from './backup.service';

export interface ConflictResolutionResult {
  resolved: boolean;
  strategy: KiroConflictStrategy;
  mergedContent?: string;
  backupPath?: string;
  conflicts: ConflictDetail[];
  errors: DeploymentError[];
  warnings: DeploymentWarning[];
  mergeInfo?: KiroMergedConfiguration;
}

export interface ConflictDetail {
  filePath: string;
  componentType: KiroComponentType;
  conflictType: 'file_exists' | 'content_differs' | 'structure_mismatch' | 'version_conflict';
  description: string;
  resolution?: string;
}

@Injectable()
export class KiroConflictResolverService {
  constructor(private readonly backupService: BackupService) {}

  async detectConflicts(
    filePath: string,
    newContent: string,
    componentType: KiroComponentType,
  ): Promise<ConflictDetail[]> {
    const conflicts: ConflictDetail[] = [];

    try {
      // 파일 존재 여부 확인
      const exists = await this.fileExists(filePath);
      if (!exists) {
        return []; // 새 파일이므로 충돌 없음
      }

      const existingContent = await fs.readFile(filePath, 'utf-8');
      
      // 내용이 동일한지 확인
      if (existingContent === newContent) {
        return []; // 동일한 내용이므로 충돌 없음
      }

      // 기본 충돌 감지
      conflicts.push({
        filePath,
        componentType,
        conflictType: 'content_differs',
        description: `Existing file content differs from new content`,
      });

      // JSON 파일의 구조적 충돌 감지
      if (filePath.endsWith('.json')) {
        const structureConflicts = await this.detectJsonStructureConflicts(
          existingContent,
          newContent,
          filePath,
          componentType,
        );
        conflicts.push(...structureConflicts);
      }

      // 마크다운 파일의 섹션 충돌 감지
      if (filePath.endsWith('.md')) {
        const sectionConflicts = await this.detectMarkdownSectionConflicts(
          existingContent,
          newContent,
          filePath,
          componentType,
        );
        conflicts.push(...sectionConflicts);
      }

    } catch (error) {
      conflicts.push({
        filePath,
        componentType,
        conflictType: 'file_exists',
        description: `Error accessing file: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return conflicts;
  }

  async resolveConflict(
    filePath: string,
    newContent: string,
    componentType: KiroComponentType,
    strategy: KiroConflictStrategy,
    mergeStrategy?: KiroMergeStrategy,
  ): Promise<ConflictResolutionResult> {
    const result: ConflictResolutionResult = {
      resolved: false,
      strategy,
      conflicts: [],
      errors: [],
      warnings: [],
    };

    try {
      // 충돌 감지
      result.conflicts = await this.detectConflicts(filePath, newContent, componentType);

      if (result.conflicts.length === 0) {
        // 충돌이 없으므로 파일을 그대로 작성
        await fs.writeFile(filePath, newContent, 'utf-8');
        result.resolved = true;
        return result;
      }

      // 충돌 해결 전략에 따라 처리
      switch (strategy) {
        case 'skip':
          result.resolved = true;
          result.warnings.push({
            message: `Skipped conflicting file: ${filePath}`,
            code: 'CONFLICT_SKIPPED',
          });
          break;

        case 'overwrite':
          await this.overwriteFile(filePath, newContent, result);
          break;

        case 'backup':
          await this.backupAndOverwrite(filePath, newContent, result);
          break;

        case 'merge':
        case 'merge-intelligent':
          await this.mergeFiles(filePath, newContent, componentType, mergeStrategy, result);
          break;

        case 'preserve-tasks':
          await this.preserveTasksAndMerge(filePath, newContent, componentType, result);
          break;

        case 'prompt':
          // 프롬프트 전략은 상위 레벨에서 처리되어야 함
          result.warnings.push({
            message: `Conflict detected at ${filePath}, user prompt required`,
            code: 'CONFLICT_PROMPT_NEEDED',
          });
          break;

        default:
          result.errors.push({
            message: `Unknown conflict strategy: ${strategy}`,
            code: 'INVALID_STRATEGY',
            severity: 'error',
          });
      }

    } catch (error) {
      result.errors.push({
        message: `Conflict resolution failed: ${error instanceof Error ? error.message : String(error)}`,
        code: 'RESOLUTION_ERROR',
        severity: 'error',
      });
    }

    return result;
  }

  private async overwriteFile(
    filePath: string,
    newContent: string,
    result: ConflictResolutionResult,
  ): Promise<void> {
    await fs.writeFile(filePath, newContent, 'utf-8');
    result.resolved = true;
    result.warnings.push({
      message: `Overwrote existing file: ${filePath}`,
      code: 'FILE_OVERWRITTEN',
    });
  }

  private async backupAndOverwrite(
    filePath: string,
    newContent: string,
    result: ConflictResolutionResult,
  ): Promise<void> {
    try {
      // 백업 생성
      const backupPath = await this.createBackup(filePath);
      result.backupPath = backupPath;

      // 새 내용으로 덮어쓰기
      await fs.writeFile(filePath, newContent, 'utf-8');
      result.resolved = true;
      result.warnings.push({
        message: `Backed up existing file to ${backupPath} and overwrote with new content`,
        code: 'FILE_BACKED_UP_AND_OVERWRITTEN',
      });

    } catch (error) {
      result.errors.push({
        message: `Backup creation failed: ${error instanceof Error ? error.message : String(error)}`,
        code: 'BACKUP_ERROR',
        severity: 'error',
      });
    }
  }

  private async mergeFiles(
    filePath: string,
    newContent: string,
    componentType: KiroComponentType,
    mergeStrategy: KiroMergeStrategy = 'deep-merge',
    result: ConflictResolutionResult,
  ): Promise<void> {
    try {
      const existingContent = await fs.readFile(filePath, 'utf-8');
      let mergedContent: string;

      if (filePath.endsWith('.json')) {
        mergedContent = await this.mergeJsonContent(
          existingContent,
          newContent,
          mergeStrategy,
          componentType,
        );
      } else if (filePath.endsWith('.md')) {
        mergedContent = await this.mergeMarkdownContent(
          existingContent,
          newContent,
          mergeStrategy,
          componentType,
        );
      } else {
        // 일반 텍스트 파일 병합
        mergedContent = await this.mergeTextContent(
          existingContent,
          newContent,
          mergeStrategy,
        );
      }

      // 병합된 내용 저장
      await fs.writeFile(filePath, mergedContent, 'utf-8');
      result.resolved = true;
      result.mergedContent = mergedContent;

      // 병합 정보 생성
      result.mergeInfo = {
        filePath,
        componentType,
        mergeStrategy,
        conflictsResolved: result.conflicts.length,
        originalSize: Buffer.byteLength(existingContent, 'utf-8'),
        finalSize: Buffer.byteLength(mergedContent, 'utf-8'),
      };

      result.warnings.push({
        message: `Merged content using ${mergeStrategy} strategy`,
        code: 'CONTENT_MERGED',
      });

    } catch (error) {
      result.errors.push({
        message: `Merge failed: ${error instanceof Error ? error.message : String(error)}`,
        code: 'MERGE_ERROR',
        severity: 'error',
      });
    }
  }

  private async preserveTasksAndMerge(
    filePath: string,
    newContent: string,
    componentType: KiroComponentType,
    result: ConflictResolutionResult,
  ): Promise<void> {
    if (componentType !== 'specs' || !filePath.endsWith('.md')) {
      // 작업 보존은 스펙 마크다운 파일에서만 지원
      await this.mergeFiles(filePath, newContent, componentType, 'markdown-section-merge', result);
      return;
    }

    try {
      const existingContent = await fs.readFile(filePath, 'utf-8');
      const preservedTasks = this.extractCompletedTasks(existingContent);
      const mergedContent = this.preserveTaskStatusInContent(newContent, preservedTasks);

      await fs.writeFile(filePath, mergedContent, 'utf-8');
      result.resolved = true;
      result.mergedContent = mergedContent;

      if (result.mergeInfo) {
        result.mergeInfo.conflictsResolved += preservedTasks.length;
      }

      result.warnings.push({
        message: `Preserved ${preservedTasks.length} completed task statuses`,
        code: 'TASKS_PRESERVED',
      });

    } catch (error) {
      result.errors.push({
        message: `Task preservation failed: ${error instanceof Error ? error.message : String(error)}`,
        code: 'TASK_PRESERVATION_ERROR',
        severity: 'error',
      });
    }
  }

  private async mergeJsonContent(
    existingContent: string,
    newContent: string,
    mergeStrategy: KiroMergeStrategy,
    componentType: KiroComponentType,
  ): Promise<string> {
    try {
      const existing = JSON.parse(existingContent);
      const newData = JSON.parse(newContent);

      let merged: any; // eslint-disable-line @typescript-eslint/no-explicit-any

      switch (mergeStrategy) {
        case 'deep-merge':
          merged = this.deepMergeObjects(existing, newData);
          break;

        case 'array-append':
          merged = this.mergeWithArrayAppend(existing, newData);
          break;

        default:
          merged = this.deepMergeObjects(existing, newData);
      }

      return JSON.stringify(merged, null, 2);

    } catch (error) {
      throw new Error(`JSON merge failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async mergeMarkdownContent(
    existingContent: string,
    newContent: string,
    mergeStrategy: KiroMergeStrategy,
    componentType: KiroComponentType,
  ): Promise<string> {
    switch (mergeStrategy) {
      case 'markdown-section-merge':
        return this.mergeBySections(existingContent, newContent);

      case 'task-status-preserve':
        if (componentType === 'specs') {
          const preservedTasks = this.extractCompletedTasks(existingContent);
          return this.preserveTaskStatusInContent(newContent, preservedTasks);
        }
        return newContent;

      default:
        // 기본적으로는 새 내용으로 교체하되 기존 섹션을 보존
        return this.mergeBySections(existingContent, newContent);
    }
  }

  private async mergeTextContent(
    existingContent: string,
    newContent: string,
    mergeStrategy: KiroMergeStrategy,
  ): Promise<string> {
    // 일반 텍스트 파일의 경우 라인 기반 병합
    const existingLines = existingContent.split('\n');
    const newLines = newContent.split('\n');

    // 간단한 라인 기반 병합 (중복 제거)
    const mergedLines = [...new Set([...existingLines, ...newLines])];
    return mergedLines.join('\n');
  }

  private deepMergeObjects(existing: any, newData: any): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (typeof existing !== 'object' || existing === null) {
      return newData;
    }

    if (typeof newData !== 'object' || newData === null) {
      return newData;
    }

    const result = { ...existing };

    for (const key in newData) {
      if (Object.prototype.hasOwnProperty.call(newData, key)) {
        if (typeof newData[key] === 'object' && newData[key] !== null && !Array.isArray(newData[key])) {
          result[key] = this.deepMergeObjects(existing[key], newData[key]);
        } else {
          result[key] = newData[key];
        }
      }
    }

    return result;
  }

  private mergeWithArrayAppend(existing: any, newData: any): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = this.deepMergeObjects(existing, newData);

    // 배열 필드들을 찾아서 병합
    const mergeArrays = (obj1: any, obj2: any, target: any): void => { // eslint-disable-line @typescript-eslint/no-explicit-any
      for (const key in obj2) {
        if (Object.prototype.hasOwnProperty.call(obj2, key)) {
          if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
            // 중복 제거하여 배열 병합
            target[key] = [...new Set([...obj1[key], ...obj2[key]])];
          } else if (typeof obj2[key] === 'object' && obj2[key] !== null) {
            mergeArrays(obj1[key] || {}, obj2[key], target[key] || {});
          }
        }
      }
    };

    mergeArrays(existing, newData, result);
    return result;
  }

  private mergeBySections(existingContent: string, newContent: string): string {
    const existingSections = this.parseMarkdownSections(existingContent);
    const newSections = this.parseMarkdownSections(newContent);

    const mergedSections = new Map(existingSections);

    // 새 섹션들을 병합
    for (const [sectionName, sectionContent] of newSections) {
      if (mergedSections.has(sectionName)) {
        // 기존 섹션이 있는 경우 내용을 스마트 병합
        const existingSectionContent = mergedSections.get(sectionName) || '';
        const mergedSectionContent = this.mergeSectionContent(existingSectionContent, sectionContent);
        mergedSections.set(sectionName, mergedSectionContent);
      } else {
        // 새 섹션 추가
        mergedSections.set(sectionName, sectionContent);
      }
    }

    return this.reconstructMarkdownFromSections(mergedSections);
  }

  private parseMarkdownSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    const lines = content.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('#')) {
        // 이전 섹션 저장
        if (currentSection) {
          sections.set(currentSection, currentContent.join('\n'));
        }
        
        // 새 섹션 시작
        currentSection = line.replace(/^#+\s*/, '').trim();
        currentContent = [line];
      } else {
        currentContent.push(line);
      }
    }

    // 마지막 섹션 저장
    if (currentSection) {
      sections.set(currentSection, currentContent.join('\n'));
    }

    return sections;
  }

  private mergeSectionContent(existingContent: string, newContent: string): string {
    // 작업 목록이 포함된 섹션의 경우 특별 처리
    if (this.containsTaskList(existingContent) && this.containsTaskList(newContent)) {
      return this.mergeTaskLists(existingContent, newContent);
    }

    // 일반 섹션은 새 내용으로 교체하되 중요한 정보는 보존
    return newContent;
  }

  private containsTaskList(content: string): boolean {
    return /^\s*-\s*\[[ x]\]/m.test(content);
  }

  private mergeTaskLists(existingContent: string, newContent: string): string {
    const existingTasks = this.extractTasksFromContent(existingContent);
    const newTasks = this.extractTasksFromContent(newContent);

    // 기존 작업의 완료 상태를 보존
    const mergedTasks = new Map();

    // 새 작업들을 기본으로 추가
    for (const task of newTasks) {
      mergedTasks.set(task.id, task);
    }

    // 기존 완료된 작업들의 상태를 보존
    for (const existingTask of existingTasks) {
      if (existingTask.completed && mergedTasks.has(existingTask.id)) {
        const mergedTask = mergedTasks.get(existingTask.id);
        mergedTask.completed = true;
        mergedTasks.set(existingTask.id, mergedTask);
      }
    }

    return this.reconstructContentWithTasks(newContent, Array.from(mergedTasks.values()));
  }

  private extractCompletedTasks(content: string): Array<{ id: string; completed: boolean }> {
    const tasks: Array<{ id: string; completed: boolean }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^\s*-\s*\[([x ])\]\s*(.+)/);
      if (match) {
        const completed = match[1] === 'x';
        const taskText = match[2].trim();
        const id = this.generateTaskId(taskText);
        tasks.push({ id, completed });
      }
    }

    return tasks;
  }

  private extractTasksFromContent(content: string): Array<{ id: string; text: string; completed: boolean }> {
    const tasks: Array<{ id: string; text: string; completed: boolean }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^\s*-\s*\[([x ])\]\s*(.+)/);
      if (match) {
        const completed = match[1] === 'x';
        const text = match[2].trim();
        const id = this.generateTaskId(text);
        tasks.push({ id, text, completed });
      }
    }

    return tasks;
  }

  private generateTaskId(taskText: string): string {
    // 작업 텍스트에서 고유 ID 생성 (숫자나 제목 기반)
    const match = taskText.match(/^(\d+\.?\d*)\s+(.+)/);
    if (match) {
      return match[1]; // 작업 번호 사용
    }
    
    // 작업 번호가 없으면 텍스트의 첫 단어들 사용
    return taskText.split(' ').slice(0, 3).join('-').toLowerCase();
  }

  private preserveTaskStatusInContent(
    newContent: string,
    preservedTasks: Array<{ id: string; completed: boolean }>,
  ): string {
    let result = newContent;
    const lines = result.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^\s*-\s*\[([x ])\]\s*(.+)/);
      
      if (match) {
        const taskText = match[2].trim();
        const taskId = this.generateTaskId(taskText);
        const preservedTask = preservedTasks.find(t => t.id === taskId);
        
        if (preservedTask && preservedTask.completed) {
          // 완료된 작업으로 마크
          lines[i] = line.replace(/\[[ ]\]/, '[x]');
        }
      }
    }

    return lines.join('\n');
  }

  private reconstructContentWithTasks(
    baseContent: string,
    tasks: Array<{ id: string; text: string; completed: boolean }>,
  ): string {
    let result = baseContent;
    const lines = result.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^\s*-\s*\[([x ])\]\s*(.+)/);
      
      if (match) {
        const taskText = match[2].trim();
        const taskId = this.generateTaskId(taskText);
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
          const checkbox = task.completed ? '[x]' : '[ ]';
          lines[i] = line.replace(/\[([x ])\]/, checkbox);
        }
      }
    }

    return lines.join('\n');
  }

  private reconstructMarkdownFromSections(sections: Map<string, string>): string {
    const sortedSections = Array.from(sections.values());
    return sortedSections.join('\n\n');
  }

  private async detectJsonStructureConflicts(
    existingContent: string,
    newContent: string,
    filePath: string,
    componentType: KiroComponentType,
  ): Promise<ConflictDetail[]> {
    const conflicts: ConflictDetail[] = [];

    try {
      const existing = JSON.parse(existingContent);
      const newData = JSON.parse(newContent);

      // 버전 충돌 감지
      if (existing.version && newData.version && existing.version !== newData.version) {
        conflicts.push({
          filePath,
          componentType,
          conflictType: 'version_conflict',
          description: `Version conflict: existing ${existing.version} vs new ${newData.version}`,
        });
      }

      // 구조적 차이 감지
      const existingKeys = new Set(Object.keys(existing));
      const newKeys = new Set(Object.keys(newData));
      
      const removedKeys = Array.from(existingKeys).filter(key => !newKeys.has(key));
      const addedKeys = Array.from(newKeys).filter(key => !existingKeys.has(key));

      if (removedKeys.length > 0 || addedKeys.length > 0) {
        conflicts.push({
          filePath,
          componentType,
          conflictType: 'structure_mismatch',
          description: `Structure changes: removed [${removedKeys.join(', ')}], added [${addedKeys.join(', ')}]`,
        });
      }

    } catch (error) {
      conflicts.push({
        filePath,
        componentType,
        conflictType: 'structure_mismatch',
        description: `JSON parsing error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return conflicts;
  }

  private async detectMarkdownSectionConflicts(
    existingContent: string,
    newContent: string,
    filePath: string,
    componentType: KiroComponentType,
  ): Promise<ConflictDetail[]> {
    const conflicts: ConflictDetail[] = [];

    const existingSections = this.parseMarkdownSections(existingContent);
    const newSections = this.parseMarkdownSections(newContent);

    // 섹션 변경 사항 감지
    for (const [sectionName, newSectionContent] of newSections) {
      if (existingSections.has(sectionName)) {
        const existingSectionContent = existingSections.get(sectionName);
        if (existingSectionContent !== newSectionContent) {
          conflicts.push({
            filePath,
            componentType,
            conflictType: 'content_differs',
            description: `Section "${sectionName}" has different content`,
          });
        }
      }
    }

    return conflicts;
  }

  private async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const backupFileName = `${fileName}.backup-${timestamp}`;
    const backupPath = path.join(backupDir, backupFileName);

    await fs.copyFile(filePath, backupPath);
    return backupPath;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async resolveMultipleConflicts(
    conflicts: Array<{
      filePath: string;
      newContent: string;
      componentType: KiroComponentType;
    }>,
    strategy: KiroConflictStrategy,
    mergeStrategy?: KiroMergeStrategy,
  ): Promise<ConflictResolutionResult[]> {
    const results: ConflictResolutionResult[] = [];

    for (const conflict of conflicts) {
      const result = await this.resolveConflict(
        conflict.filePath,
        conflict.newContent,
        conflict.componentType,
        strategy,
        mergeStrategy,
      );
      results.push(result);
    }

    return results;
  }

  async validateMergeCompatibility(
    filePath: string,
    componentType: KiroComponentType,
    mergeStrategy: KiroMergeStrategy,
  ): Promise<{ compatible: boolean; reason?: string }> {
    // JSON 파일에 대한 병합 호환성 검사
    if (filePath.endsWith('.json')) {
      if (['deep-merge', 'array-append'].includes(mergeStrategy)) {
        return { compatible: true };
      }
      return { 
        compatible: false, 
        reason: `Merge strategy ${mergeStrategy} not compatible with JSON files` 
      };
    }

    // 마크다운 파일에 대한 병합 호환성 검사
    if (filePath.endsWith('.md')) {
      if (['markdown-section-merge', 'task-status-preserve'].includes(mergeStrategy)) {
        return { compatible: true };
      }
      return { 
        compatible: false, 
        reason: `Merge strategy ${mergeStrategy} not compatible with Markdown files` 
      };
    }

    // 기타 파일 타입
    return { compatible: true };
  }

  async generateConflictReport(conflicts: ConflictDetail[]): Promise<string> {
    if (conflicts.length === 0) {
      return 'No conflicts detected.';
    }

    const report = [
      '# Kiro Deployment Conflict Report',
      '',
      `Total conflicts detected: ${conflicts.length}`,
      '',
    ];

    const groupedConflicts = new Map<KiroComponentType, ConflictDetail[]>();
    
    // 컴포넌트 타입별로 충돌 그룹화
    for (const conflict of conflicts) {
      if (!groupedConflicts.has(conflict.componentType)) {
        groupedConflicts.set(conflict.componentType, []);
      }
      groupedConflicts.get(conflict.componentType)!.push(conflict);
    }

    for (const [componentType, componentConflicts] of groupedConflicts) {
      report.push(`## ${componentType.charAt(0).toUpperCase() + componentType.slice(1)} Conflicts`);
      report.push('');

      for (const conflict of componentConflicts) {
        report.push(`- **File**: \`${conflict.filePath}\``);
        report.push(`  - **Type**: ${conflict.conflictType}`);
        report.push(`  - **Description**: ${conflict.description}`);
        if (conflict.resolution) {
          report.push(`  - **Resolution**: ${conflict.resolution}`);
        }
        report.push('');
      }
    }

    report.push('## Recommended Actions');
    report.push('');
    report.push('1. Review conflicts carefully before proceeding');
    report.push('2. Choose appropriate resolution strategy for each component type');
    report.push('3. Consider backing up important configurations');
    report.push('4. Test deployment in dry-run mode first');

    return report.join('\n');
  }

  async suggestOptimalStrategy(
    conflicts: ConflictDetail[],
    componentType: KiroComponentType,
  ): Promise<{
    strategy: KiroConflictStrategy;
    mergeStrategy?: KiroMergeStrategy;
    reasoning: string;
  }> {
    if (conflicts.length === 0) {
      return {
        strategy: 'overwrite',
        reasoning: 'No conflicts detected, safe to overwrite',
      };
    }

    // 컴포넌트 타입별 최적 전략 제안
    switch (componentType) {
      case 'settings':
        return {
          strategy: 'merge-intelligent',
          mergeStrategy: 'deep-merge',
          reasoning: 'Settings files benefit from intelligent merging to preserve user customizations',
        };

      case 'steering':
        return {
          strategy: 'merge-intelligent',
          mergeStrategy: 'markdown-section-merge',
          reasoning: 'Steering documents should merge by sections to preserve existing guidance',
        };

      case 'specs':
        return {
          strategy: 'preserve-tasks',
          mergeStrategy: 'task-status-preserve',
          reasoning: 'Spec files should preserve task completion status to maintain progress',
        };

      case 'hooks':
        return {
          strategy: 'prompt',
          reasoning: 'Hook configurations should be reviewed manually due to security implications',
        };

      case 'agents':
        return {
          strategy: 'backup',
          reasoning: 'Agent configurations should be backed up before replacement due to complexity',
        };

      case 'templates':
        return {
          strategy: 'merge-intelligent',
          mergeStrategy: 'array-append',
          reasoning: 'Template collections benefit from merging to combine existing and new templates',
        };

      default:
        return {
          strategy: 'prompt',
          reasoning: 'Unknown component type requires manual review',
        };
    }
  }
}