import { Injectable, Logger } from '@nestjs/common';

import {
  TaptikPackage,
  ValidationResult,
  CloudMetadata,
  ClaudeAgent,
  ClaudeCommand,
  McpServerConfig,
  SteeringRule,
} from '../interfaces/cloud.interface';

interface ValidationCache {
  result: ValidationResult;
  timestamp: number;
}

interface ValidationContext {
  package: TaptikPackage;
  isPremiumUser: boolean;
  result: ValidationResult;
}

interface ComponentThresholds {
  agents: number;
  commands: number;
  mcpServers: number;
  steeringRules: number;
  instructions: number;
}


@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  // Size limits
  private readonly SIZE_LIMITS = {
    DEFAULT: 10485760, // 10MB
    PREMIUM: 104857600, // 100MB
    WARNING_THRESHOLD: 0.9, // 90% of limit
  } as const;

  // Format and platform constants
  private readonly SUPPORTED_FORMAT = 'taptik-v1';
  private readonly SUPPORTED_IDES = ['claude-code', 'kiro-ide', 'cursor-ide'] as const;
  private readonly KNOWN_FEATURES = [
    'gitIntegration',
    'dockerSupport',
    'kubernetesIntegration',
    'autocomplete',
    'aiAssistance',
    'collaborativeEditing',
    'remoteDebugging',
    'containerization',
  ] as const;

  // Component thresholds for warnings
  private readonly COMPONENT_THRESHOLDS: ComponentThresholds = {
    agents: 1000,
    commands: 1000,
    mcpServers: 100,
    steeringRules: 1000,
    instructions: 100,
  };

  // Cache settings
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private validationCache = new Map<string, ValidationCache>();

  // Validation patterns
  private readonly UNSAFE_PATTERNS = {
    XSS: /<|>|<script|<\/script|javascript:|on\w+=/i,
    PATH_TRAVERSAL: /\.\.\//g,
    SQL_INJECTION: /(\bdrop\b|\bdelete\b|\binsert\b|\bupdate\b)/i,
    COMMAND_INJECTION: /[$&;`|]/,
  };

  // Complexity level definitions
  private readonly COMPLEXITY_LEVELS = ['minimal', 'basic', 'intermediate', 'advanced', 'expert'] as const;

  // Error messages
  private readonly ERROR_MESSAGES = {
    NULL_PACKAGE: 'Invalid package: package is null or undefined',
    CIRCULAR_REFERENCE: 'Invalid package structure: circular reference detected',
    INVALID_FORMAT: (format: string) => `Unsupported package format: ${format}. Expected: ${this.SUPPORTED_FORMAT}`,
    CHECKSUM_MISMATCH: 'Checksum mismatch: package integrity compromised',
    SIZE_EXCEEDED: (limit: string) => `Package size exceeds maximum limit of ${limit}`,
    MISSING_FIELD: (field: string) => `Missing required field: ${field}`,
    INVALID_SCHEMA: (component: string, field: string) => `Invalid ${component} schema: missing required field "${field}"`,
    NEGATIVE_VALUE: (field: string) => `${field} cannot be negative`,
    EMPTY_VALUE: (field: string) => `${field} cannot be empty`,
    INVALID_COMPLEXITY: (level: string) => `Invalid complexity level: ${level}`,
    INVALID_DATE: (field: string) => `Invalid date format for ${field}`,
  };

  // Warning messages
  private readonly WARNING_MESSAGES = {
    SIZE_APPROACHING: 'Package size is approaching the maximum limit (90% used)',
    UNSAFE_CHARACTERS: (field: string) => `${field} contains potentially unsafe characters`,
    HIGH_COMPONENT_COUNT: (component: string, count: number) => `Unusually high number of ${component} (${count})`,
    UNSUPPORTED_IDE: (ide: string) => `${ide === 'Source' ? 'Source' : 'Target'} IDE "${ide}" may have limited support`,
    UNSUPPORTED_FEATURE: (feature: string, ide: string) => `Feature "${feature}" may not be supported in ${ide}`,
  };

  // Recommendation messages
  private readonly RECOMMENDATIONS = {
    READY: 'Package is ready for cloud upload',
    ALL_CHECKS_PASSED: 'All validation checks passed successfully',
    ADD_TITLE: 'Add a descriptive title to your package',
    PROVIDE_TITLE: 'Provide a descriptive title (minimum 3 characters)',
    ADD_TAGS: 'Add at least one tag for discoverability',
    USE_SEMVER: 'Use semantic versioning (e.g., 1.0.0)',
    SPECIFY_IDE: 'Specify at least one target IDE',
    GENERATE_CHECKSUM: 'Generate a valid checksum for package integrity',
    REGENERATE_CHECKSUM: 'Regenerate package checksum to ensure integrity',
    REDUCE_SIZE: 'Reduce package size or consider splitting into multiple packages',
    SPLIT_PACKAGES: 'Consider splitting into multiple smaller packages for better manageability',
    OPTIMIZE_COMPONENTS: 'Consider optimizing the number of components for better performance',
    VALIDATE_SECURITY: 'Review and sanitize potentially unsafe content',
    UPDATE_METADATA: 'Ensure all metadata fields are properly filled',
  };

  /**
   * Main validation method for cloud upload readiness
   */
  async validateForCloudUpload(
    taptikPackage: TaptikPackage,
    isPremiumUser = false,
  ): Promise<ValidationResult> {
    try {
      // Initialize validation context
      const context = this.initializeValidationContext(taptikPackage, isPremiumUser);

      // Quick validation for null/undefined
      if (!taptikPackage) {
        context.result.isValid = false;
        context.result.errors.push(this.ERROR_MESSAGES.NULL_PACKAGE);
        return context.result;
      }

      // Check cache
      const cachedResult = this.getCachedResult(taptikPackage.checksum);
      if (cachedResult) {
        this.logger.debug(`Returning cached validation result for checksum: ${taptikPackage.checksum}`);
        return cachedResult;
      }

      // Perform validation steps
      await this.performValidation(context);

      // Cache the result
      if (taptikPackage.checksum) {
        this.cacheResult(taptikPackage.checksum, context.result);
      }

      return context.result;
    } catch (error) {
      this.logger.error('Validation error:', error);
      throw error;
    }
  }

  /**
   * Initialize validation context with default values
   */
  private initializeValidationContext(
    taptikPackage: TaptikPackage | null | undefined,
    isPremiumUser: boolean,
  ): ValidationContext {
    const maxSize = isPremiumUser ? this.SIZE_LIMITS.PREMIUM : this.SIZE_LIMITS.DEFAULT;
    
    return {
      package: taptikPackage as TaptikPackage,
      isPremiumUser,
      result: {
        isValid: true,
        errors: [],
        warnings: [],
        cloudCompatible: true,
        schemaCompliant: true,
        sizeLimit: {
          current: taptikPackage?.size || 0,
          maximum: maxSize,
          withinLimit: true,
        },
        featureSupport: {
          ide: taptikPackage?.metadata?.sourceIde || '',
          supported: [],
          unsupported: [],
        },
        recommendations: [],
      },
    };
  }

  /**
   * Perform all validation steps
   */
  private async performValidation(context: ValidationContext): Promise<void> {
    // Check for circular references
    if (!this.validateCircularReferences(context)) {
      return;
    }

    // Validate package structure and metadata
    this.validatePackageStructure(context);
    this.validateMetadata(context);

    // Validate format and integrity
    this.validateFormat(context);
    this.validateChecksum(context);

    // Validate size constraints
    this.validateSizeConstraints(context);

    // Validate schemas
    this.validateSchemas(context);

    // Check cloud compatibility
    this.validateCloudCompatibility(context);

    // Security validations
    this.performSecurityValidations(context);

    // Component count validations
    this.validateComponentCounts(context);

    // Generate final recommendations
    this.generateFinalRecommendations(context);
  }

  /**
   * Validate circular references in package
   */
  private validateCircularReferences(context: ValidationContext): boolean {
    try {
      JSON.stringify(context.package);
      return true;
    } catch (_error) {
      context.result.isValid = false;
      context.result.errors.push(this.ERROR_MESSAGES.CIRCULAR_REFERENCE);
      return false;
    }
  }

  /**
   * Validate package structure
   */
  private validatePackageStructure(context: ValidationContext): void {
    const { package: pkg, result } = context;

    if (!pkg.sanitizedConfig) {
      result.isValid = false;
      result.schemaCompliant = false;
      result.errors.push(this.ERROR_MESSAGES.MISSING_FIELD('sanitizedConfig'));
    }

    if (!pkg.metadata) {
      result.isValid = false;
      result.schemaCompliant = false;
      result.errors.push(this.ERROR_MESSAGES.MISSING_FIELD('metadata'));
    }

    if (!pkg.manifest) {
      result.isValid = false;
      result.errors.push(this.ERROR_MESSAGES.MISSING_FIELD('manifest'));
    }
  }

  /**
   * Validate metadata fields
   */
  private validateMetadata(context: ValidationContext): void {
    const { package: pkg, result } = context;
    
    if (!pkg.metadata) return;

    const { metadata } = pkg;
    const requiredFields = [
      'title', 'tags', 'version', 'createdAt', 'sourceIde',
      'targetIdes', 'complexityLevel', 'componentCount',
      'features', 'compatibility', 'searchKeywords',
      'fileSize', 'checksum'
    ];

    // Check required fields
    for (const field of requiredFields) {
      if (!(field in metadata)) {
        result.isValid = false;
        result.schemaCompliant = false;
        result.errors.push(this.ERROR_MESSAGES.MISSING_FIELD(`metadata.${field}`));
      }
    }

    // Validate specific field values
    this.validateMetadataValues(metadata, result);
  }

  /**
   * Validate metadata field values
   */
  private validateMetadataValues(metadata: CloudMetadata, result: ValidationResult): void {
    // Title validation
    if (metadata.title) {
      if (metadata.title.length < 3) {
        result.isValid = false;
        result.errors.push('Title must be at least 3 characters long');
      } else if (metadata.title.length === 1) {
        result.isValid = false;
        result.errors.push('Title must be at least 3 characters long');
      }
    }

    // Tags validation
    if (metadata.tags && metadata.tags.length === 0) {
      result.isValid = false;
      result.errors.push('At least one tag is required');
    }

    // Version validation
    if (metadata.version === '0.0.0') {
      result.isValid = false;
      result.errors.push('Invalid version: 0.0.0');
    }

    // Target IDEs validation
    if (metadata.targetIdes && metadata.targetIdes.length === 0) {
      result.isValid = false;
      result.errors.push('At least one target IDE must be specified');
    }

    // Checksum validation
    if (!metadata.checksum || metadata.checksum === '' || metadata.checksum === 'pending') {
      result.isValid = false;
      result.errors.push(this.ERROR_MESSAGES.EMPTY_VALUE('Checksum'));
    }

    // File size validation
    if (metadata.fileSize < 0) {
      result.isValid = false;
      result.errors.push(this.ERROR_MESSAGES.NEGATIVE_VALUE('File size'));
    }

    // Complexity level validation
    if (metadata.complexityLevel && !this.COMPLEXITY_LEVELS.includes(metadata.complexityLevel)) {
      result.isValid = false;
      result.errors.push(this.ERROR_MESSAGES.INVALID_COMPLEXITY(metadata.complexityLevel));
    }

    // Component count validation
    if (metadata.componentCount) {
      const counts = metadata.componentCount;
      const components = ['agents', 'commands', 'mcpServers', 'steeringRules', 'instructions'] as const;
      
      for (const component of components) {
        if (counts[component] < 0) {
          result.isValid = false;
          result.errors.push('Component counts cannot be negative');
          break;
        }
      }
    }

    // Date validation
    if (metadata.createdAt) {
      const date = new Date(metadata.createdAt);
      if (isNaN(date.getTime())) {
        result.isValid = false;
        result.errors.push(this.ERROR_MESSAGES.INVALID_DATE('createdAt'));
      }
    }
  }

  /**
   * Validate package format
   */
  private validateFormat(context: ValidationContext): void {
    const { package: pkg, result } = context;

    if (pkg.format && pkg.format !== this.SUPPORTED_FORMAT) {
      result.isValid = false;
      result.errors.push(`Unsupported package format: ${pkg.format}`);
    }
  }

  /**
   * Validate checksum integrity
   */
  private validateChecksum(context: ValidationContext): void {
    const { package: pkg, result } = context;

    if (pkg.metadata?.checksum && pkg.checksum && 
        pkg.metadata.checksum !== pkg.checksum) {
      result.isValid = false;
      result.errors.push(this.ERROR_MESSAGES.CHECKSUM_MISMATCH);
    }
  }

  /**
   * Validate size constraints
   */
  private validateSizeConstraints(context: ValidationContext): void {
    const { package: pkg, result, isPremiumUser } = context;
    
    const sizeValidation = this.validateSizeLimit(pkg.size || 0, isPremiumUser);
    result.sizeLimit = sizeValidation;

    if (!sizeValidation.withinLimit) {
      result.isValid = false;
      result.cloudCompatible = false;
      const limitStr = isPremiumUser ? '100MB' : '10MB';
      result.errors.push(this.ERROR_MESSAGES.SIZE_EXCEEDED(limitStr));
    } else if (sizeValidation.percentage >= this.SIZE_LIMITS.WARNING_THRESHOLD * 100) {
      result.warnings.push(this.WARNING_MESSAGES.SIZE_APPROACHING);
    }
  }

  /**
   * Validate schemas
   */
  private validateSchemas(context: ValidationContext): void {
    const { package: pkg, result } = context;

    // Validate TaptikContext schema
    const schemaValidation = this.validateSchemaCompliance(pkg.sanitizedConfig);
    if (!schemaValidation.isCompliant) {
      result.isValid = false;
      result.schemaCompliant = false;
      result.errors.push(...schemaValidation.errors);
    }

    // Validate Claude Code specific schemas
    this.validateClaudeCodeSchemas(context);
  }

  /**
   * Validate cloud compatibility
   */
  private validateCloudCompatibility(context: ValidationContext): void {
    const { package: pkg, result } = context;

    const compatibilityCheck = this.checkCloudCompatibility(pkg.metadata);
    result.featureSupport.ide = pkg.metadata?.sourceIde || '';
    result.featureSupport.supported = compatibilityCheck.supportedFeatures;
    result.featureSupport.unsupported = compatibilityCheck.unsupportedFeatures;

    if (compatibilityCheck.warnings.length > 0) {
      result.warnings.push(...compatibilityCheck.warnings);
    }
  }

  /**
   * Perform security validations
   */
  private performSecurityValidations(context: ValidationContext): void {
    const { package: pkg, result } = context;
    const { metadata } = pkg;
    
    if (!metadata) return;

    // Check title for unsafe patterns
    if (metadata.title) {
      if (this.UNSAFE_PATTERNS.XSS.test(metadata.title)) {
        result.warnings.push(this.WARNING_MESSAGES.UNSAFE_CHARACTERS('Title'));
      }
    }

    // Check tags for unsafe patterns
    if (metadata.tags && Array.isArray(metadata.tags)) {
      for (const tag of metadata.tags) {
        if (this.UNSAFE_PATTERNS.XSS.test(tag) || this.UNSAFE_PATTERNS.PATH_TRAVERSAL.test(tag)) {
          result.warnings.push(`Tag "${tag}" contains potentially unsafe characters`);
        }
      }
    }

    // Check description for unsafe patterns
    if (metadata.description) {
      if (this.UNSAFE_PATTERNS.XSS.test(metadata.description) || 
          this.UNSAFE_PATTERNS.SQL_INJECTION.test(metadata.description)) {
        result.warnings.push(this.WARNING_MESSAGES.UNSAFE_CHARACTERS('Description'));
      }
    }
  }

  /**
   * Validate component counts
   */
  private validateComponentCounts(context: ValidationContext): void {
    const { package: pkg, result } = context;
    const counts = pkg.metadata?.componentCount;
    
    if (!counts) return;

    let totalComponents = 0;

    for (const [component, threshold] of Object.entries(this.COMPONENT_THRESHOLDS)) {
      const count = counts[component as keyof typeof counts];
      if (count > threshold) {
        result.warnings.push(this.WARNING_MESSAGES.HIGH_COMPONENT_COUNT(component, count));
      }
      totalComponents += count;
    }

    // Check total component count
    if (totalComponents > 10000) {
      if (!result.recommendations) {
        result.recommendations = [];
      }
      result.recommendations.push(this.RECOMMENDATIONS.SPLIT_PACKAGES);
    } else if (totalComponents > 5000) {
      result.recommendations.push(this.RECOMMENDATIONS.OPTIMIZE_COMPONENTS);
    }
  }

  /**
   * Generate final recommendations
   */
  private generateFinalRecommendations(context: ValidationContext): void {
    const { result } = context;
    const recommendations: string[] = [];

    // Process errors to generate recommendations
    for (const error of result.errors) {
      if (error.includes('Missing required field: title')) {
        recommendations.push(this.RECOMMENDATIONS.ADD_TITLE);
      }
      if (error.includes('Title must be')) {
        recommendations.push(this.RECOMMENDATIONS.PROVIDE_TITLE);
      }
      if (error.includes('tag')) {
        recommendations.push(this.RECOMMENDATIONS.ADD_TAGS);
      }
      if (error.includes('version')) {
        recommendations.push(this.RECOMMENDATIONS.USE_SEMVER);
      }
      if (error.includes('target IDE')) {
        recommendations.push(this.RECOMMENDATIONS.SPECIFY_IDE);
      }
      if (error.includes('Checksum cannot be empty')) {
        recommendations.push(this.RECOMMENDATIONS.GENERATE_CHECKSUM);
      }
      if (error.includes('Checksum mismatch')) {
        recommendations.push(this.RECOMMENDATIONS.REGENERATE_CHECKSUM);
      }
      if (error.includes('size exceeds')) {
        recommendations.push(this.RECOMMENDATIONS.REDUCE_SIZE);
      }
    }

    // Add existing recommendations
    if (result.recommendations && result.recommendations.length > 0) {
      recommendations.push(...result.recommendations);
    }

    // Add security recommendations if needed
    if (result.warnings.some(w => w.includes('unsafe'))) {
      recommendations.push(this.RECOMMENDATIONS.VALIDATE_SECURITY);
    }

    // Add metadata recommendations if needed
    if (result.errors.some(e => e.includes('metadata'))) {
      recommendations.push(this.RECOMMENDATIONS.UPDATE_METADATA);
    }

    // Success recommendations
    if (result.isValid && result.cloudCompatible && result.schemaCompliant) {
      recommendations.push(this.RECOMMENDATIONS.READY);
      recommendations.push(this.RECOMMENDATIONS.ALL_CHECKS_PASSED);
    }

    // Remove duplicates and set recommendations
    result.recommendations = [...new Set(recommendations)];
  }

  /**
   * Validate TaptikContext schema compliance
   */
  private validateSchemaCompliance(sanitizedConfig: unknown): { isCompliant: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!sanitizedConfig || typeof sanitizedConfig !== 'object') {
      return { isCompliant: false, errors: ['Missing sanitizedConfig'] };
    }

    const config = sanitizedConfig as Record<string, unknown>;

    // Check required TaptikContext fields
    const requiredFields = ['version', 'sourceIde', 'targetIdes', 'data', 'metadata'];
    for (const field of requiredFields) {
      if (!(field in config)) {
        errors.push(this.ERROR_MESSAGES.MISSING_FIELD(field));
      }
    }

    // Validate metadata.timestamp
    const metadata = config.metadata as Record<string, unknown> | undefined;
    if (metadata && !metadata.timestamp) {
      errors.push(this.ERROR_MESSAGES.MISSING_FIELD('metadata.timestamp'));
    }

    return {
      isCompliant: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate Claude Code specific schemas
   */
  private validateClaudeCodeSchemas(context: ValidationContext): void {
    const { package: pkg, result } = context;
    const claudeCode = pkg.sanitizedConfig?.data?.claudeCode;
    
    if (!claudeCode) return;

    const { local } = claudeCode;
    if (!local) return;

    // Validate agents
    this.validateAgents(local.agents, result);

    // Validate commands
    this.validateCommands(local.commands, result);

    // Validate MCP servers
    this.validateMcpServers(local.mcpServers?.servers, result);

    // Validate steering rules
    this.validateSteeringRules(local.steeringRules, result);
  }

  /**
   * Validate agents configuration
   */
  private validateAgents(agents: ClaudeAgent[] | undefined, result: ValidationResult): void {
    if (!agents || !Array.isArray(agents)) return;

    for (const agent of agents) {
      if (!agent.id) {
        result.isValid = false;
        result.schemaCompliant = false;
        result.errors.push(this.ERROR_MESSAGES.INVALID_SCHEMA('agent', 'id'));
      }
      if (!agent.name) {
        result.isValid = false;
        result.schemaCompliant = false;
        result.errors.push(this.ERROR_MESSAGES.INVALID_SCHEMA('agent', 'name'));
      }
      if (!agent.prompt) {
        result.isValid = false;
        result.schemaCompliant = false;
        result.errors.push(this.ERROR_MESSAGES.INVALID_SCHEMA('agent', 'prompt'));
      }
    }
  }

  /**
   * Validate commands configuration
   */
  private validateCommands(commands: ClaudeCommand[] | undefined, result: ValidationResult): void {
    if (!commands || !Array.isArray(commands)) return;

    for (const command of commands) {
      if (!command.name) {
        result.isValid = false;
        result.schemaCompliant = false;
        result.errors.push(this.ERROR_MESSAGES.INVALID_SCHEMA('command', 'name'));
      }
      if (!command.command) {
        result.isValid = false;
        result.schemaCompliant = false;
        result.errors.push(this.ERROR_MESSAGES.INVALID_SCHEMA('command', 'command'));
      }
    }
  }

  /**
   * Validate MCP servers configuration
   */
  private validateMcpServers(servers: McpServerConfig[] | undefined, result: ValidationResult): void {
    if (!servers || !Array.isArray(servers)) return;

    for (const server of servers) {
      if (!server.name) {
        result.isValid = false;
        result.schemaCompliant = false;
        result.errors.push(this.ERROR_MESSAGES.INVALID_SCHEMA('MCP server', 'name'));
      }
      if (!server.protocol) {
        result.isValid = false;
        result.schemaCompliant = false;
        result.errors.push(this.ERROR_MESSAGES.INVALID_SCHEMA('MCP server', 'protocol'));
      }
    }
  }

  /**
   * Validate steering rules configuration
   */
  private validateSteeringRules(rules: SteeringRule[] | undefined, result: ValidationResult): void {
    if (!rules || !Array.isArray(rules)) return;

    for (const rule of rules) {
      if (!rule.pattern) {
        result.isValid = false;
        result.schemaCompliant = false;
        result.errors.push(this.ERROR_MESSAGES.INVALID_SCHEMA('steering rule', 'pattern'));
      }
      if (!rule.rule) {
        result.isValid = false;
        result.schemaCompliant = false;
        result.errors.push(this.ERROR_MESSAGES.INVALID_SCHEMA('steering rule', 'rule'));
      }
    }
  }

  /**
   * Check cloud compatibility
   */
  private checkCloudCompatibility(metadata: CloudMetadata | undefined): {
    compatible: boolean;
    supportedFeatures: string[];
    unsupportedFeatures: string[];
    warnings: string[];
  } {
    const result = {
      compatible: true,
      supportedFeatures: [] as string[],
      unsupportedFeatures: [] as string[],
      warnings: [] as string[],
    };

    if (!metadata) return result;

    // Check IDE compatibility
    const { sourceIde } = metadata;
    const targetIdes = metadata.targetIdes || [];

    if (sourceIde && !this.SUPPORTED_IDES.includes(sourceIde as typeof this.SUPPORTED_IDES[number])) {
      result.warnings.push(this.WARNING_MESSAGES.UNSUPPORTED_IDE(`Source IDE "${sourceIde}"`));
    }

    for (const targetIde of targetIdes) {
      if (!this.SUPPORTED_IDES.includes(targetIde as typeof this.SUPPORTED_IDES[number])) {
        result.warnings.push(this.WARNING_MESSAGES.UNSUPPORTED_IDE(`Target IDE "${targetIde}"`));
      }
    }

    // Auto-detect supported features based on sourceIde and componentCount
    if (sourceIde === 'claude-code' && metadata.componentCount) {
      const { agents, commands, mcpServers, steeringRules, instructions } = metadata.componentCount;
      
      // Add base features for Claude Code
      if (agents > 0) result.supportedFeatures.push('agents');
      if (commands > 0) result.supportedFeatures.push('commands');
      if (mcpServers > 0) result.supportedFeatures.push('mcpServers');
      if (steeringRules > 0) result.supportedFeatures.push('steeringRules');
      if (instructions > 0) result.supportedFeatures.push('instructions');
      
      // Add general supported features
      result.supportedFeatures.push('settings', 'themes', 'preferences');
    }

    // Check explicitly declared features
    const features = metadata.features || [];
    for (const feature of features) {
      if (this.KNOWN_FEATURES.includes(feature as typeof this.KNOWN_FEATURES[number])) {
        if (!result.supportedFeatures.includes(feature)) {
          result.supportedFeatures.push(feature);
        }
      } else {
        result.unsupportedFeatures.push(feature);
        // Check if targeting unsupported IDE
        for (const targetIde of targetIdes) {
          if (targetIde !== sourceIde) {
            result.warnings.push(this.WARNING_MESSAGES.UNSUPPORTED_FEATURE(feature, targetIde));
          }
        }
      }
    }

    return result;
  }

  /**
   * Validate size limit
   */
  private validateSizeLimit(
    size: number,
    isPremiumUser = false,
  ): { current: number; maximum: number; withinLimit: boolean; percentage: number } {
    const maximum = isPremiumUser ? this.SIZE_LIMITS.PREMIUM : this.SIZE_LIMITS.DEFAULT;
    const percentage = Math.round((size / maximum) * 100);

    return {
      current: size,
      maximum,
      withinLimit: size <= maximum,
      percentage,
    };
  }

  /**
   * Get cached validation result
   */
  private getCachedResult(checksum: string | undefined): ValidationResult | null {
    if (!checksum) return null;

    const cached = this.validationCache.get(checksum);
    if (!cached) return null;

    // Check if cache is still valid
    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.validationCache.delete(checksum);
      return null;
    }

    return cached.result;
  }

  /**
   * Cache validation result
   */
  private cacheResult(checksum: string, result: ValidationResult): void {
    this.validationCache.set(checksum, {
      result,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, value] of this.validationCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.validationCache.delete(key);
    }
  }

  /**
   * Generate recommendations based on validation result
   * This method is kept for backward compatibility with tests
   */
  private generateRecommendations(
    result: ValidationResult,
    _taptikPackage?: TaptikPackage,
  ): string[] {
    const recommendations: string[] = [];

    // Process errors to generate recommendations
    for (const error of result.errors) {
      if (error.includes('Missing required field: title')) {
        recommendations.push(this.RECOMMENDATIONS.ADD_TITLE);
      }
      if (error.includes('Title must be')) {
        recommendations.push(this.RECOMMENDATIONS.PROVIDE_TITLE);
      }
      if (error.includes('tag')) {
        recommendations.push(this.RECOMMENDATIONS.ADD_TAGS);
      }
      if (error.includes('version')) {
        recommendations.push(this.RECOMMENDATIONS.USE_SEMVER);
      }
      if (error.includes('target IDE')) {
        recommendations.push(this.RECOMMENDATIONS.SPECIFY_IDE);
      }
      if (error.includes('Checksum cannot be empty')) {
        recommendations.push(this.RECOMMENDATIONS.GENERATE_CHECKSUM);
      }
      if (error.includes('Checksum mismatch')) {
        recommendations.push(this.RECOMMENDATIONS.REGENERATE_CHECKSUM);
      }
      if (error.includes('size exceeds')) {
        recommendations.push(this.RECOMMENDATIONS.REDUCE_SIZE);
      }
    }

    // Add existing recommendations
    if (result.recommendations && result.recommendations.length > 0) {
      recommendations.push(...result.recommendations);
    }

    // Success recommendations
    if (result.isValid && result.cloudCompatible && result.schemaCompliant) {
      recommendations.push(this.RECOMMENDATIONS.READY);
      recommendations.push(this.RECOMMENDATIONS.ALL_CHECKS_PASSED);
    }

    // Remove duplicates
    return [...new Set(recommendations)];
  }
}