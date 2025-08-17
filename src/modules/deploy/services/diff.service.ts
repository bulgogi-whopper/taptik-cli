import { Injectable } from '@nestjs/common';

import { TaptikContext } from '../../context/interfaces/taptik-context.interface';
import { ConflictStrategy } from '../interfaces/deploy-options.interface';

type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined
  | JsonObject 
  | JsonArray;

interface JsonObject {
  [key: string]: JsonValue;
}

type JsonArray = JsonValue[];

export interface DiffEntry {
  path: string;
  type: 'addition' | 'modification' | 'deletion';
  oldValue?: JsonValue;
  newValue?: JsonValue;
}

export interface DiffResult {
  hasChanges: boolean;
  additions: DiffEntry[];
  modifications: DiffEntry[];
  deletions: DiffEntry[];
}

export interface Conflict {
  path: string;
  sourceValue: JsonValue;
  targetValue: JsonValue;
  type: 'value_conflict' | 'type_conflict';
}

export interface DiffFormatOptions {
  color?: boolean;
  verbose?: boolean;
}

@Injectable()
export class DiffService {
  generateDiff(
    source: TaptikContext | Record<string, unknown>,
    target: TaptikContext | Record<string, unknown>,
  ): DiffResult {
     
    const additions: DiffEntry[] = [];
    const modifications: DiffEntry[] = [];
    const deletions: DiffEntry[] = [];

    // Compare source to target to find additions and modifications
    this.compareObjects(
      source,
      target,
      '',
      additions,
      modifications,
      deletions,
    );

    return {
      hasChanges:
        additions.length > 0 ||
        modifications.length > 0 ||
        deletions.length > 0,
      additions,
      modifications,
      deletions,
    };
  }

  formatDiffForDisplay(
    diff: DiffResult,
    options: DiffFormatOptions = {},
  ): string {
    if (!diff.hasChanges) {
      return 'No changes detected';
    }

    const lines: string[] = [];
    const { color = false } = options;

    // Format additions
    if (diff.additions.length > 0) {
      lines.push(`Additions (${diff.additions.length}):`);
      diff.additions.forEach((entry) => {
        const line = `+ ${entry.path}`;
        lines.push(color ? `\x1B[32m${line}\x1B[0m` : line);
      });
      lines.push('');
    }

    // Format modifications
    if (diff.modifications.length > 0) {
      lines.push(`Modifications (${diff.modifications.length}):`);
      diff.modifications.forEach((entry) => {
        const line = `~ ${entry.path}`;
        lines.push(color ? `\x1B[33m${line}\x1B[0m` : line);
      });
      lines.push('');
    }

    // Format deletions
    if (diff.deletions.length > 0) {
      lines.push(`Deletions (${diff.deletions.length}):`);
      diff.deletions.forEach((entry) => {
        const line = `- ${entry.path}`;
        lines.push(color ? `\x1B[31m${line}\x1B[0m` : line);
      });
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  mergeConfigurations(
    source: TaptikContext | Record<string, unknown>,
    target: TaptikContext | Record<string, unknown>,
    strategy: ConflictStrategy,
  ): TaptikContext | Record<string, unknown> {
    switch (strategy) {
      case 'skip':
        // Keep target as-is
        return { ...target };

      case 'overwrite':
        // Replace target with source
        return { ...source };

      case 'merge':
        // Deep merge source into target
        return this.deepMerge(target, source) as TaptikContext | Record<string, unknown>;

      case 'backup':
        // Use source but mark that backup was created
        return {
          ...source,
          metadata: {
            ...(source as Record<string, unknown>).metadata as Record<string, unknown>,
            backupCreated: true,
          },
        };

      default:
        throw new Error(`Unknown merge strategy: ${strategy}`);
    }
  }

  getConflicts(source: TaptikContext, target: TaptikContext): Conflict[] {
    const conflicts: Conflict[] = [];
    this.findConflicts(source, target, '', conflicts);
    return conflicts;
  }

  applyPatch(target: TaptikContext, patches: DiffEntry[]): TaptikContext {
    const result = JSON.parse(JSON.stringify(target)); // Deep clone

    for (const patch of patches) {
      const pathParts = patch.path.split('.');

      switch (patch.type) {
        case 'addition':
          this.setNestedValue(result, pathParts, patch.newValue);
          break;

        case 'modification':
          this.setNestedValue(result, pathParts, patch.newValue);
          break;

        case 'deletion':
          this.deleteNestedValue(result, pathParts);
          break;
      }
    }

    return result;
  }

  private compareObjects(
    source: unknown,
    target: unknown,
    path: string,
    additions: DiffEntry[],
    modifications: DiffEntry[],
    deletions: DiffEntry[],
  ): void {
    // Handle null/undefined cases
    if (!source && !target) return;
    if (!source && target) {
      deletions.push({
        path: path || 'root',
        type: 'deletion',
        oldValue: target as JsonValue,
      });
      return;
    }
    if (source && !target) {
      additions.push({
        path: path || 'root',
        type: 'addition',
        newValue: source as JsonValue,
      });
      return;
    }

    // Only compare objects
    if (!this.isJsonObject(source) || !this.isJsonObject(target)) {
      // Compare primitive values
      if (source !== target) {
        modifications.push({
          path: path || 'root',
          type: 'modification',
          oldValue: target as JsonValue,
          newValue: source as JsonValue,
        });
      }
      return;
    }

    const sourceKeys = Object.keys(source);
    const targetKeys = Object.keys(target);
    const allKeys = new Set([...sourceKeys, ...targetKeys]);

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : `content.${key}`;
      const sourceHasKey = key in source;
      const targetHasKey = key in target;
      const sourceValue = source[key];
      const targetValue = target[key];

      if (!targetHasKey && sourceHasKey) {
        // Addition (source has it, target doesn't)
        additions.push({
          path: currentPath,
          type: 'addition',
          newValue: sourceValue,
        });
      } else if (targetHasKey && !sourceHasKey) {
        // Deletion (target has it, source doesn't)
        deletions.push({
          path: currentPath,
          type: 'deletion',
          oldValue: targetValue,
        });
      } else if (sourceHasKey && targetHasKey) {
        // Both have the key, check if modified
        if (this.isObject(sourceValue) && this.isObject(targetValue)) {
          // Recursively compare objects
          this.compareObjects(
            sourceValue,
            targetValue,
            currentPath,
            additions,
            modifications,
            deletions,
          );
        } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
          // Compare arrays
          if (JSON.stringify(sourceValue) !== JSON.stringify(targetValue)) {
            modifications.push({
              path: currentPath,
              type: 'modification',
              oldValue: targetValue,
              newValue: sourceValue,
            });
          }
        } else if (sourceValue !== targetValue) {
          // Primitive value modification
          modifications.push({
            path: currentPath,
            type: 'modification',
            oldValue: targetValue,
            newValue: sourceValue,
          });
        }
      }
    }
  }

  private deepMerge(target: unknown, source: unknown): unknown {
    // Handle non-object types
    if (!this.isJsonObject(target) || !this.isJsonObject(source)) {
      return source; // Replace with source value
    }

    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (this.isObject(source[key]) && this.isObject(target[key])) {
          result[key] = this.deepMerge(target[key], source[key]) as JsonValue;
        } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
          // Merge arrays by id if objects have id field, otherwise concatenate unique
          result[key] = this.mergeArrays(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  private mergeArrays(target: JsonArray, source: JsonArray): JsonArray {
     
    if (target.length === 0) return source;
    if (source.length === 0) return target;

    // Check if arrays contain objects with id field
    const firstSource = source[0] as JsonObject;
    const firstTarget = target[0] as JsonObject;
    const hasIds = (firstSource && typeof firstSource === 'object' && 'id' in firstSource) || 
                   (firstTarget && typeof firstTarget === 'object' && 'id' in firstTarget);

    if (hasIds) {
      // Merge by id
      const result = [...target];
      
      for (const sourceItem of source) {
        if (sourceItem && typeof sourceItem === 'object' && 'id' in sourceItem && sourceItem.id) {
          const targetIndex = result.findIndex(
            (item) => item && typeof item === 'object' && 'id' in item && item.id === sourceItem.id,
          );
          if (targetIndex >= 0) {
            // Replace existing item
            result[targetIndex] = sourceItem;
          } else {
            // Add new item
            result.push(sourceItem);
          }
        } else {
          // No id, just add it
          result.push(sourceItem);
        }
      }

      return result;
    } else {
      // Simple concatenation with deduplication
      return [...new Set([...target, ...source])];
    }
  }

  private findConflicts(
    source: unknown,
    target: unknown,
    path: string,
    conflicts: Conflict[],
  ): void {
    // Only compare object types
    if (!this.isJsonObject(source) || !this.isJsonObject(target)) {
      return;
    }

    const sourceKeys = Object.keys(source);
    const targetKeys = Object.keys(target);
    const commonKeys = sourceKeys.filter((key) => targetKeys.includes(key));

    for (const key of commonKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const sourceValue = source[key];
      const targetValue = target[key];

      if (typeof sourceValue !== typeof targetValue) {
        // Type conflict
        conflicts.push({
          path: currentPath,
          sourceValue,
          targetValue,
          type: 'type_conflict',
        });
      } else if (this.isObject(sourceValue) && this.isObject(targetValue)) {
        // Recursively check nested objects
        this.findConflicts(sourceValue, targetValue, currentPath, conflicts);
      } else if (!Array.isArray(sourceValue) && sourceValue !== targetValue) {
        // Value conflict (non-array primitives)
        conflicts.push({
          path: currentPath,
          sourceValue,
          targetValue,
          type: 'value_conflict',
        });
      }
    }
  }

  private setNestedValue(object: JsonObject, pathParts: string[], value: JsonValue): void {
    let current: JsonObject = object;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!current[part] || !this.isJsonObject(current[part])) {
        current[part] = {};
      }
      current = current[part] as JsonObject;
    }

    const lastPart = pathParts.at(-1);
    if (lastPart) {
      current[lastPart] = value;
    }
  }

  private deleteNestedValue(object: JsonObject, pathParts: string[]): void {
    if (pathParts.length === 0) return;

    let current: JsonObject = object;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!current[part] || !this.isJsonObject(current[part])) {
        return; // Path doesn't exist
      }
      current = current[part] as JsonObject;
    }

    const lastPart = pathParts.at(-1);
    if (lastPart) {
      delete current[lastPart];
    }
  }

  private isObject(value: unknown): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private isJsonObject(value: unknown): value is JsonObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private isJsonArray(value: unknown): value is JsonArray {
    return Array.isArray(value);
  }
}
