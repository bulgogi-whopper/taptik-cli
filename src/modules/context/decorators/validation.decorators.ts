import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import { AIPlatform } from '../interfaces';

/**
 * Validates that a string is a valid semantic version
 */
@ValidatorConstraint({ name: 'isSemver', async: false })
export class IsSemverConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
    return semverRegex.test(value);
  }

  defaultMessage(arguments_: ValidationArguments): string {
    return `${arguments_.property} must be a valid semantic version (e.g., 1.0.0)`;
  }
}

export function IsSemver(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSemverConstraint,
    });
  };
}

/**
 * Validates that a string is a valid ISO 8601 date
 */
@ValidatorConstraint({ name: 'isISO8601', async: false })
export class IsISO8601Constraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString() === value;
  }

  defaultMessage(arguments_: ValidationArguments): string {
    return `${arguments_.property} must be a valid ISO 8601 date`;
  }
}

export function IsISO8601(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsISO8601Constraint,
    });
  };
}

/**
 * Validates that an array contains only valid AI platforms
 */
@ValidatorConstraint({ name: 'isValidPlatforms', async: false })
export class IsValidPlatformsConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (!Array.isArray(value)) return false;
    const validPlatforms = Object.values(AIPlatform);
    return value.every((platform) => validPlatforms.includes(platform));
  }

  defaultMessage(arguments_: ValidationArguments): string {
    return `${arguments_.property} must contain only valid AI platforms`;
  }
}

export function IsValidPlatforms(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPlatformsConstraint,
    });
  };
}

/**
 * Validates that a context has at least one category
 */
@ValidatorConstraint({ name: 'hasCategory', async: false })
export class HasCategoryConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, arguments_: ValidationArguments): boolean {
    const object = arguments_.object as Record<string, unknown>;
    const categories = ['personal', 'project', 'prompts', 'tools', 'ide'];
    return categories.some((cat) => object[cat] !== undefined);
  }

  defaultMessage(): string {
    return 'Context must have at least one category (personal, project, prompts, tools, or ide)';
  }
}

export function HasCategory(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: HasCategoryConstraint,
    });
  };
}

/**
 * Validates that a string matches a specific pattern
 */
export function MatchesPattern(
  pattern: RegExp,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'matchesPattern',
      target: object.constructor,
      propertyName,
      constraints: [pattern],
      options: validationOptions,
      validator: {
        validate(value: unknown, arguments_: ValidationArguments) {
          const [pattern] = arguments_.constraints;
          if (typeof value !== 'string') return false;
          return pattern.test(value);
        },
        defaultMessage(arguments_: ValidationArguments) {
          return `${arguments_.property} must match the required pattern`;
        },
      },
    });
  };
}

/**
 * Validates that an object has no sensitive data patterns
 */
@ValidatorConstraint({ name: 'noSensitiveData', async: false })
export class NoSensitiveDataConstraint implements ValidatorConstraintInterface {
  private sensitivePatterns = [
    /api[_-]?key/gi,
    /password/gi,
    /token/gi,
    /secret/gi,
    /credential/gi,
    /private[_-]?key/gi,
  ];

  validate(value: unknown): boolean {
    const jsonString = JSON.stringify(value);
    return !this.sensitivePatterns.some((pattern) => pattern.test(jsonString));
  }

  defaultMessage(): string {
    return 'Context contains potentially sensitive data. Consider removing or encrypting it.';
  }
}

export function NoSensitiveData(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoSensitiveDataConstraint,
    });
  };
}

/**
 * Validates file size constraints
 */
export function MaxFileSize(
  maxSize: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'maxFileSize',
      target: object.constructor,
      propertyName,
      constraints: [maxSize],
      options: validationOptions,
      validator: {
        validate(value: unknown, arguments_: ValidationArguments) {
          const [maxSize] = arguments_.constraints;
          if (typeof value !== 'string') return false;
          const sizeInBytes = Buffer.byteLength(JSON.stringify(value));
          return sizeInBytes <= maxSize;
        },
        defaultMessage(arguments_: ValidationArguments) {
          const [maxSize] = arguments_.constraints;
          return `${arguments_.property} size exceeds maximum allowed size of ${maxSize} bytes`;
        },
      },
    });
  };
}

/**
 * Validates that required fields exist based on platform
 */
export function RequiredForPlatform(
  platform: AIPlatform,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'requiredForPlatform',
      target: object.constructor,
      propertyName,
      constraints: [platform],
      options: validationOptions,
      validator: {
        validate(value: unknown, arguments_: ValidationArguments) {
          const object = arguments_.object as Record<string, unknown>;
          const [requiredPlatform] = arguments_.constraints;

          // Check if this platform is in the context
          const metadata = object.metadata as Record<string, unknown> | undefined;
          const platforms = metadata?.platforms as string[] | undefined;
          if (!platforms?.includes(requiredPlatform)) {
            return true; // Not required if platform not present
          }

          // Value must exist for this platform
          return value !== undefined && value !== null;
        },
        defaultMessage(arguments_: ValidationArguments) {
          const [platform] = arguments_.constraints;
          return `${arguments_.property} is required for ${platform} platform`;
        },
      },
    });
  };
}
