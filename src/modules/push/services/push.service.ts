import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';

import { AuthService } from '../../auth/auth.service';
import { PushError, PushErrorCode } from '../constants/push.constants';
import { 
  PackageMetadata, 
  PushOptions, 
  UploadProgress,
  AnalyticsEventType 
} from '../interfaces';

import { AnalyticsService } from './analytics.service';
import { CloudUploadService } from './cloud-upload.service';
import { LocalQueueService } from './local-queue.service';
import { PackageRegistryService } from './package-registry.service';
import { PackageValidatorService } from './package-validator.service';
import { RateLimiterService } from './rate-limiter.service';
import { SanitizationService } from './sanitization.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly cloudUploadService: CloudUploadService,
    private readonly packageRegistryService: PackageRegistryService,
    private readonly sanitizationService: SanitizationService,
    private readonly analyticsService: AnalyticsService,
    private readonly authService: AuthService,
    private readonly packageValidatorService: PackageValidatorService,
    private readonly localQueueService: LocalQueueService,
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  async push(
    options: PushOptions,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<PackageMetadata> {
    // Delegate to upload with the file path from options
    return this.upload(options.file.path, options, onProgress);
  }

  async upload(
    packagePath: string,
    options: PushOptions,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<PackageMetadata> {
    try {
      // Phase 1: Validation
      await this.reportProgress(onProgress, {
        stage: 'validating',
        percentage: 0,
        bytesUploaded: 0,
        totalBytes: 0,
        message: 'Validating package and authentication...',
      });

      // 1. Check authentication
      const user = await this.validateAuthentication();

      // 2. Validate package file exists and is readable
      const packageBuffer = await this.readPackageFile(packagePath);
      const packageSize = packageBuffer.length;

      // 3. Validate package structure
      const isValid = await this.packageValidatorService.validateStructure(packageBuffer);
      if (!isValid) {
        throw new PushError(
          PushErrorCode.INVALID_PACKAGE,
          'Invalid package structure',
          { packagePath },
        );
      }

      // 4. Check file size limits
      const userTier = await this.getUserTier(user.id);
      const isSizeValid = await this.packageValidatorService.validateSize(
        packageSize,
        userTier,
      );
      if (!isSizeValid) {
        throw new PushError(
          PushErrorCode.PACKAGE_TOO_LARGE,
          `Package size exceeds ${userTier} tier limit`,
          { size: packageSize, tier: userTier },
        );
      }

      // 5. Check rate limits
      const rateLimitCheck = await this.rateLimiterService.checkLimit(
        user.id,
        packageSize,
      );
      if (!rateLimitCheck.allowed) {
        throw new PushError(
          PushErrorCode.RATE_LIMIT_EXCEEDED,
          'Upload rate limit exceeded',
          { 
            remaining: rateLimitCheck.remaining, 
            resetAt: rateLimitCheck.resetAt 
          },
        );
      }

      await this.reportProgress(onProgress, {
        stage: 'validating',
        percentage: 20,
        bytesUploaded: 0,
        totalBytes: packageSize,
        message: 'Validation complete',
      });

      // Phase 2: Sanitization
      await this.reportProgress(onProgress, {
        stage: 'sanitizing',
        percentage: 25,
        bytesUploaded: 0,
        totalBytes: packageSize,
        message: 'Sanitizing package content...',
      });

      const sanitizationResult = await this.sanitizationService.sanitizePackage(
        packageBuffer,
      );

      // Check if sanitization blocked the upload
      if (sanitizationResult.level === 'blocked' && !options.force) {
        throw new PushError(
          PushErrorCode.SENSITIVE_DATA_DETECTED,
          'Critical sensitive data detected. Use --force to override',
          { report: sanitizationResult.report },
        );
      }

      // Generate auto-tags from content
      const autoTags = await this.sanitizationService.generateAutoTags(
        sanitizationResult.sanitizedBuffer,
      );

      await this.reportProgress(onProgress, {
        stage: 'sanitizing',
        percentage: 40,
        bytesUploaded: 0,
        totalBytes: packageSize,
        message: 'Sanitization complete',
      });

      // Phase 3: Generate metadata
      const metadata = await this.generateMetadata({
        packagePath,
        packageBuffer: sanitizationResult.sanitizedBuffer,
        options,
        user,
        autoTags,
        sanitizationLevel: sanitizationResult.level,
      });

      // Phase 4: Upload to Supabase Storage
      await this.reportProgress(onProgress, {
        stage: 'uploading',
        percentage: 45,
        bytesUploaded: 0,
        totalBytes: packageSize,
        message: 'Uploading to cloud storage...',
      });

      const storageUrl = await this.cloudUploadService.uploadPackage(
        sanitizationResult.sanitizedBuffer,
        metadata,
        (uploadProgress) => {
          const percentage = 45 + (uploadProgress.percentage * 0.4); // 45-85%
          onProgress?.({
            ...uploadProgress,
            percentage,
          });
        },
      );

      metadata.storageUrl = storageUrl;

      await this.reportProgress(onProgress, {
        stage: 'uploading',
        percentage: 85,
        bytesUploaded: packageSize,
        totalBytes: packageSize,
        message: 'Upload complete',
      });

      // Phase 5: Register in database
      await this.reportProgress(onProgress, {
        stage: 'registering',
        percentage: 90,
        bytesUploaded: packageSize,
        totalBytes: packageSize,
        message: 'Registering package metadata...',
      });

      const registeredMetadata = await this.packageRegistryService.registerPackage(
        metadata,
      );

      // Phase 6: Track analytics
      await this.analyticsService.trackUpload({
        packageId: registeredMetadata.id,
        userId: user.id,
        packageSize,
        platform: metadata.platform,
        isPublic: metadata.isPublic,
      });

      // Phase 7: Complete
      await this.reportProgress(onProgress, {
        stage: 'complete',
        percentage: 100,
        bytesUploaded: packageSize,
        totalBytes: packageSize,
        message: 'Package uploaded successfully',
      });

      // Generate shareable URL
      const shareableUrl = await this.generateShareableUrl(registeredMetadata);
      registeredMetadata.shareableUrl = shareableUrl;

      this.logger.log(
        `Package uploaded successfully: ${registeredMetadata.configId}`,
      );

      return registeredMetadata;
    } catch (error) {
      this.logger.error('Upload failed:', error);

      // Convert to PushError if not already
      if (error instanceof PushError) {
        throw error;
      }

      throw new PushError(
        PushErrorCode.UPLOAD_FAILED,
        'Failed to upload package',
        { originalError: error },
        true, // retryable
      );
    }
  }

  private async validateAuthentication(): Promise<{ id: string; email: string }> {
    const session = await this.authService.getSession();
    
    if (!session?.user) {
      throw new PushError(
        PushErrorCode.AUTH_REQUIRED,
        'Authentication required. Please run "taptik auth login" first',
      );
    }

    return session.user;
  }

  private async readPackageFile(packagePath: string): Promise<Buffer> {
    try {
      const absolutePath = path.resolve(packagePath);
      const stats = await fs.stat(absolutePath);
      
      if (!stats.isFile()) {
        throw new PushError(
          PushErrorCode.INVALID_PACKAGE,
          'Path is not a file',
          { packagePath },
        );
      }

      return await fs.readFile(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new PushError(
          PushErrorCode.INVALID_PACKAGE,
          'Package file not found',
          { packagePath },
        );
      }
      throw error;
    }
  }

  private async generateMetadata(params: {
    packagePath: string;
    packageBuffer: Buffer;
    options: PushOptions;
    user: { id: string; email: string };
    autoTags: string[];
    sanitizationLevel: 'safe' | 'warning' | 'blocked';
  }): Promise<PackageMetadata> {
    const { packagePath, packageBuffer, options, user, autoTags, sanitizationLevel } = params;

    // Generate unique config ID
    const configId = this.generateConfigId();

    // Calculate checksum
    const checksum = crypto
      .createHash('sha256')
      .update(packageBuffer)
      .digest('hex');

    // Extract platform from package or use default
    const platform = await this.extractPlatform(packageBuffer);

    // Parse filename for default title
    const fileName = path.basename(packagePath, '.taptik');
    const defaultTitle = fileName
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());

    // Determine visibility
    const isPublic = options.visibility === 'public';

    // Extract components info
    const components = await this.extractComponents(packageBuffer);

    const metadata: PackageMetadata = {
      id: '', // Will be set by registry
      configId,
      name: fileName,
      title: options.title || defaultTitle,
      description: options.description,
      version: options.version || '1.0.0',
      platform,
      isPublic,
      sanitizationLevel,
      checksum,
      storageUrl: '', // Will be set after upload
      packageSize: packageBuffer.length,
      userId: user.id,
      teamId: options.teamId,
      components,
      autoTags,
      userTags: options.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return metadata;
  }

  private generateConfigId(): string {
    // Generate a unique, user-friendly config ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  private async extractPlatform(packageBuffer: Buffer): Promise<string> {
    try {
      // Attempt to extract platform from package metadata
      // This is a simplified version - real implementation would parse the package
      const content = packageBuffer.toString('utf-8', 0, 1000); // Check first 1KB
      
      if (content.includes('claude-code')) {
        return 'claude-code';
      } else if (content.includes('kiro-ide')) {
        return 'kiro-ide';
      } else if (content.includes('cursor-ide')) {
        return 'cursor-ide';
      }
      
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async extractComponents(
    packageBuffer: Buffer,
  ): Promise<Array<{ name: string; type: string; count: number }>> {
    try {
      // Extract component information from package
      // This is a simplified version - real implementation would parse the package structure
      const components: Array<{ name: string; type: string; count: number }> = [];
      
      // Mock implementation - should parse actual package structure
      const content = packageBuffer.toString('utf-8', 0, 5000); // Check first 5KB
      
      if (content.includes('commands')) {
        components.push({ name: 'commands', type: 'command', count: 1 });
      }
      if (content.includes('keybindings')) {
        components.push({ name: 'keybindings', type: 'keybinding', count: 1 });
      }
      if (content.includes('snippets')) {
        components.push({ name: 'snippets', type: 'snippet', count: 1 });
      }
      
      return components;
    } catch {
      return [];
    }
  }

  private async getUserTier(_userId: string): Promise<'free' | 'pro'> {
    // Check user subscription status
    // For now, return 'free' as default
    // Real implementation would check Supabase for subscription status
    return 'free';
  }

  private async generateShareableUrl(
    metadata: PackageMetadata,
  ): Promise<string> {
    // Generate a shareable URL for the package
    // This could be a web URL or a deep link to the CLI
    return `https://taptik.dev/config/${metadata.configId}`;
  }

  private async reportProgress(
    onProgress: ((progress: UploadProgress) => void) | undefined,
    progress: UploadProgress,
  ): Promise<void> {
    if (onProgress) {
      onProgress(progress);
    }
    this.logger.debug(`Upload progress: ${progress.stage} - ${progress.percentage}%`);
  }

  async queueUpload(
    packagePath: string,
    options: PushOptions,
  ): Promise<string> {
    try {
      // Validate the file exists before queuing
      await this.readPackageFile(packagePath);
      
      // Add to queue for offline processing
      const queueId = await this.localQueueService.addToQueue(packagePath, options);
      
      this.logger.log(`Upload queued for offline processing: ${queueId}`);
      
      return queueId;
    } catch (error) {
      this.logger.error('Failed to queue upload:', error);
      
      if (error instanceof PushError) {
        throw error;
      }
      
      throw new PushError(
        PushErrorCode.QUEUE_FULL,
        'Failed to queue upload',
        { originalError: error },
      );
    }
  }

  async processQueue(): Promise<void> {
    try {
      this.logger.log('Processing upload queue...');
      
      // Get pending uploads from queue
      const queueStatus = await this.localQueueService.getQueueStatus();
      const pendingUploads = queueStatus.filter(
        (item) => item.status === 'pending' || item.status === 'failed',
      );
      
      if (pendingUploads.length === 0) {
        this.logger.log('No pending uploads in queue');
        return;
      }
      
      this.logger.log(`Processing ${pendingUploads.length} pending uploads`);
      
      // Process each upload with retry logic
      const uploadPromises = pendingUploads.map(async (queuedUpload) => {
        try {
          await this.localQueueService.updateStatus(queuedUpload.id, 'uploading');
          
          // Attempt upload
          const metadata = await this.upload(
            queuedUpload.packagePath,
            queuedUpload.options,
          );
          
          // Mark as completed
          await this.localQueueService.updateStatus(queuedUpload.id, 'completed');
          
          this.logger.log(
            `Successfully processed queued upload: ${metadata.configId}`,
          );
        } catch (error) {
          const pushError = error instanceof PushError
            ? error
            : new PushError(
                PushErrorCode.UPLOAD_FAILED,
                'Failed to process queued upload',
                { originalError: error },
                true,
              );
          
          // Check if retryable and under max attempts
          if (
            pushError.retryable &&
            queuedUpload.attempts < 5
          ) {
            await this.localQueueService.incrementAttempts(queuedUpload.id);
            this.logger.warn(
              `Upload failed, will retry: ${queuedUpload.id} (attempt ${queuedUpload.attempts + 1}/5)`,
            );
          } else {
            await this.localQueueService.updateStatus(queuedUpload.id, 'failed');
            this.logger.error(
              `Upload permanently failed: ${queuedUpload.id}`,
              pushError,
            );
          }
        }
      });
      
      // Wait for all uploads to complete
      await Promise.all(uploadPromises);
      
      this.logger.log('Queue processing complete');
    } catch (error) {
      this.logger.error('Failed to process queue:', error);
      throw error;
    }
  }

  /**
   * Check if user has team permissions
   */
  async validateTeamPermissions(
    _userId: string,
    _teamId: string,
  ): Promise<boolean> {
    // TODO: Implement team permission checking
    // For now, return true to allow team uploads
    return true;
  }

  /**
   * Update package metadata
   */
  async updatePackage(
    configId: string,
    updates: Partial<PackageMetadata>,
  ): Promise<PackageMetadata> {
    try {
      // Validate user owns the package
      const user = await this.validateAuthentication();
      
      // Update in registry
      const updated = await this.packageRegistryService.updatePackage(
        configId,
        updates,
      );
      
      // Track analytics
      await this.analyticsService.trackEvent({
        eventType: AnalyticsEventType.UPDATE,
        packageId: updated.id,
        userId: user.id,
        metadata: { updates },
      });
      
      return updated;
    } catch (error) {
      this.logger.error(`Failed to update package ${configId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a package
   */
  async deletePackage(configId: string): Promise<void> {
    try {
      // Validate user owns the package
      const user = await this.validateAuthentication();
      
      // Get package metadata
      const packages = await this.packageRegistryService.listUserPackages(
        user.id,
        { configId },
      );
      
      if (packages.length === 0) {
        throw new PushError(
          PushErrorCode.INSUFFICIENT_PERMISSIONS,
          'Package not found or you do not have permission to delete it',
          { configId },
        );
      }
      
      const packageMetadata = packages[0];
      
      // Delete from storage
      await this.cloudUploadService.deletePackage(packageMetadata.storageUrl);
      
      // Delete from registry
      await this.packageRegistryService.deletePackage(configId);
      
      // Track analytics
      await this.analyticsService.trackEvent({
        eventType: AnalyticsEventType.DELETE,
        packageId: packageMetadata.id,
        userId: user.id,
      });
      
      this.logger.log(`Package deleted: ${configId}`);
    } catch (error) {
      this.logger.error(`Failed to delete package ${configId}:`, error);
      throw error;
    }
  }
}
