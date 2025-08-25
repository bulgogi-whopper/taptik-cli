import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { ErrorHandlerService } from '../../deploy/services/error-handler.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { PushError, PushErrorCode } from '../constants/push.constants';
import { PackageMetadata, ComponentInfo } from '../interfaces';

export interface PackageFilters {
  platform?: string;
  isPublic?: boolean;
  tags?: string[];
  teamId?: string;
}

export interface PackageStats {
  downloadCount: number;
  likeCount: number;
  viewCount: number;
  lastDownloaded?: Date;
}

interface DatabasePackage {
  id: string;
  config_id: string;
  name: string;
  title: string;
  description?: string;
  version: string;
  platform: string;
  is_public: boolean;
  sanitization_level: 'safe' | 'warning' | 'blocked';
  checksum: string;
  storage_url: string;
  package_size: number;
  user_id: string;
  team_id?: string;
  components: unknown;
  auto_tags: string[];
  user_tags: string[];
  download_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  archived_at?: string;
}

@Injectable()
export class PackageRegistryService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly errorHandler: ErrorHandlerService,
  ) {}

  async registerPackage(metadata: PackageMetadata): Promise<PackageMetadata> {
    try {
      const client = this.supabaseService.getClient();

      // Check for duplicate package (same user, name, version)
      const { data: existingPackage } = await client
        .from('taptik_packages')
        .select('id')
        .eq('user_id', metadata.userId)
        .eq('name', metadata.name)
        .eq('version', metadata.version)
        .is('archived_at', null)
        .single();

      if (existingPackage) {
        throw new ConflictException(
          `Package ${metadata.name} version ${metadata.version} already exists`,
        );
      }

      // Prepare data for insertion
      const packageData = {
        config_id: metadata.configId,
        name: metadata.name,
        title: metadata.title,
        description: metadata.description,
        version: metadata.version,
        platform: metadata.platform,
        is_public: metadata.isPublic,
        sanitization_level: metadata.sanitizationLevel,
        checksum: metadata.checksum,
        storage_url: metadata.storageUrl,
        package_size: metadata.packageSize,
        user_id: metadata.userId,
        team_id: metadata.teamId,
        components: metadata.components,
        auto_tags: metadata.autoTags,
        user_tags: metadata.userTags,
      };

      // Insert package metadata
      const { data, error } = await client
        .from('taptik_packages')
        .insert(packageData)
        .select()
        .single();

      if (error) {
        throw new PushError(
          PushErrorCode.DATABASE_ERROR,
          `Failed to register package: ${error.message}`,
          error,
        );
      }

      // Add to version history
      await this.addVersionHistory(data.id, metadata);

      return this.mapDatabaseToMetadata(data);
    } catch (error) {
      if (error instanceof PushError || error instanceof ConflictException) {
        throw error;
      }
      const deployError = await this.errorHandler.handleError(error as Error, {
        operation: 'registerPackage',
        details: 'Error registering package',
      });
      throw new PushError(
        PushErrorCode.INTERNAL_ERROR,
        deployError.message,
        deployError,
      );
    }
  }

  async updatePackage(
    configId: string,
    updates: Partial<PackageMetadata>,
  ): Promise<PackageMetadata> {
    try {
      const client = this.supabaseService.getClient();

      // Get current user
      const { data: userData } = await client.auth.getUser();
      if (!userData?.user) {
        throw new PushError(
          PushErrorCode.AUTH_REQUIRED,
          'Authentication required to update package',
        );
      }

      // Prepare update data (only allowed fields)
      const updateData: Record<string, unknown> = {};
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined)
        updateData.description = updates.description;
      if (updates.userTags !== undefined)
        updateData.user_tags = updates.userTags;
      if (updates.isPublic !== undefined)
        updateData.is_public = updates.isPublic;

      updateData.updated_at = new Date().toISOString();

      // Update package (RLS will ensure user owns the package)
      const { data, error } = await client
        .from('taptik_packages')
        .update(updateData)
        .eq('config_id', configId)
        .eq('user_id', userData.user.id)
        .is('archived_at', null)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundException(`Package ${configId} not found`);
        }
        throw new PushError(
          PushErrorCode.DATABASE_ERROR,
          `Failed to update package: ${error.message}`,
          error,
        );
      }

      if (!data) {
        throw new NotFoundException(
          `Package ${configId} not found or not owned by user`,
        );
      }

      return this.mapDatabaseToMetadata(data);
    } catch (error) {
      if (error instanceof PushError || error instanceof NotFoundException) {
        throw error;
      }
      const deployError = await this.errorHandler.handleError(error as Error, {
        operation: 'updatePackage',
        details: 'Error updating package',
      });
      throw new PushError(
        PushErrorCode.INTERNAL_ERROR,
        deployError.message,
        deployError,
      );
    }
  }

  async deletePackage(configId: string): Promise<void> {
    try {
      const client = this.supabaseService.getClient();

      // Get current user
      const { data: userData } = await client.auth.getUser();
      if (!userData?.user) {
        throw new PushError(
          PushErrorCode.AUTH_REQUIRED,
          'Authentication required to delete package',
        );
      }

      // Soft delete by setting archived_at
      const { data, error } = await client
        .from('taptik_packages')
        .update({ archived_at: new Date().toISOString() })
        .eq('config_id', configId)
        .eq('user_id', userData.user.id)
        .is('archived_at', null)
        .select('id')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundException(`Package ${configId} not found`);
        }
        throw new PushError(
          PushErrorCode.DATABASE_ERROR,
          `Failed to delete package: ${error.message}`,
          error,
        );
      }

      if (!data) {
        throw new NotFoundException(
          `Package ${configId} not found or not owned by user`,
        );
      }
    } catch (error) {
      if (error instanceof PushError || error instanceof NotFoundException) {
        throw error;
      }
      const deployError = await this.errorHandler.handleError(error as Error, {
        operation: 'deletePackage',
        details: 'Error deleting package',
      });
      throw new PushError(
        PushErrorCode.INTERNAL_ERROR,
        deployError.message,
        deployError,
      );
    }
  }

  async listUserPackages(
    userId: string,
    filters?: PackageFilters,
  ): Promise<PackageMetadata[]> {
    try {
      const client = this.supabaseService.getClient();

      let query = client
        .from('taptik_packages')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.platform) {
        query = query.eq('platform', filters.platform);
      }

      if (filters?.isPublic !== undefined) {
        query = query.eq('is_public', filters.isPublic);
      }

      if (filters?.teamId) {
        query = query.eq('team_id', filters.teamId);
      }

      if (filters?.tags && filters.tags.length > 0) {
        // Filter by tags (check if any of the filter tags are in user_tags or auto_tags)
        query = query.or(
          `user_tags.cs.{${filters.tags.join(',')}},auto_tags.cs.{${filters.tags.join(',')}}`,
        );
      }

      const { data, error } = await query;

      if (error) {
        throw new PushError(
          PushErrorCode.DATABASE_ERROR,
          `Failed to list packages: ${error.message}`,
          error,
        );
      }

      return (data || []).map(this.mapDatabaseToMetadata);
    } catch (error) {
      if (error instanceof PushError) {
        throw error;
      }
      const deployError = await this.errorHandler.handleError(error as Error, {
        operation: 'listUserPackages',
        details: 'Error listing packages',
      });
      throw new PushError(
        PushErrorCode.INTERNAL_ERROR,
        deployError.message,
        deployError,
      );
    }
  }

  async getPackageStats(configId: string): Promise<PackageStats> {
    try {
      const client = this.supabaseService.getClient();

      // Get package stats
      const { data: packageData, error: packageError } = await client
        .from('taptik_packages')
        .select('download_count, like_count')
        .eq('config_id', configId)
        .is('archived_at', null)
        .single();

      if (packageError) {
        if (packageError.code === 'PGRST116') {
          throw new NotFoundException(`Package ${configId} not found`);
        }
        throw new PushError(
          PushErrorCode.DATABASE_ERROR,
          `Failed to get package stats: ${packageError.message}`,
          packageError,
        );
      }

      // Get view count from analytics table
      const { count: viewCount, error: viewError } = await client
        .from('package_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('package_id', configId)
        .eq('event_type', 'view');

      if (viewError) {
        // View count error is non-critical, continue without it
      }

      // Get last download time
      const { data: lastDownload, error: downloadError } = await client
        .from('package_downloads')
        .select('created_at')
        .eq('package_id', configId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (downloadError && downloadError.code !== 'PGRST116') {
        // Last download error is non-critical, continue without it
      }

      return {
        downloadCount: packageData?.download_count || 0,
        likeCount: packageData?.like_count || 0,
        viewCount: viewCount || 0,
        lastDownloaded: lastDownload?.created_at
          ? new Date(lastDownload.created_at)
          : undefined,
      };
    } catch (error) {
      if (error instanceof PushError || error instanceof NotFoundException) {
        throw error;
      }
      const deployError = await this.errorHandler.handleError(error as Error, {
        operation: 'getPackageStats',
        details: 'Error getting package stats',
      });
      throw new PushError(
        PushErrorCode.INTERNAL_ERROR,
        deployError.message,
        deployError,
      );
    }
  }

  async getPackageByConfigId(
    configId: string,
  ): Promise<PackageMetadata | null> {
    try {
      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from('taptik_packages')
        .select('*')
        .eq('config_id', configId)
        .is('archived_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new PushError(
          PushErrorCode.DATABASE_ERROR,
          `Failed to get package: ${error.message}`,
          error,
        );
      }

      return data ? this.mapDatabaseToMetadata(data) : null;
    } catch (error) {
      if (error instanceof PushError) {
        throw error;
      }
      const deployError = await this.errorHandler.handleError(error as Error, {
        operation: 'getPackageByConfigId',
        details: 'Error getting package',
      });
      throw new PushError(
        PushErrorCode.INTERNAL_ERROR,
        deployError.message,
        deployError,
      );
    }
  }

  async updatePackageVisibility(
    configId: string,
    isPublic: boolean,
  ): Promise<PackageMetadata> {
    return this.updatePackage(configId, { isPublic });
  }

  private async addVersionHistory(
    packageId: string,
    metadata: PackageMetadata,
  ): Promise<void> {
    try {
      const client = this.supabaseService.getClient();

      const versionData = {
        package_id: packageId,
        version: metadata.version,
        storage_url: metadata.storageUrl,
        checksum: metadata.checksum,
        package_size: metadata.packageSize,
        created_by: metadata.userId,
        changelog: metadata.description,
      };

      const { error } = await client
        .from('package_versions')
        .insert(versionData);

      if (error) {
        // Version history error is non-critical, continue without it
      }
    } catch (_error) {
      // Version history error is non-critical, continue without it
    }
  }

  private mapDatabaseToMetadata(data: DatabasePackage): PackageMetadata {
    return {
      id: data.id,
      configId: data.config_id,
      name: data.name,
      title: data.title,
      description: data.description,
      version: data.version,
      platform: data.platform,
      isPublic: data.is_public,
      sanitizationLevel: data.sanitization_level,
      checksum: data.checksum,
      storageUrl: data.storage_url,
      packageSize: data.package_size,
      userId: data.user_id,
      teamId: data.team_id,
      components: (data.components as ComponentInfo[]) || [],
      autoTags: data.auto_tags || [],
      userTags: data.user_tags || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
