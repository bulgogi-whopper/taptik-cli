import { Injectable } from '@nestjs/common';

import {
  ConfigBundle,
  ConfigurationListResult,
  ListConfigurationsOptions,
  ListOptions,
  SortField,
  ValidationResult,
  toDisplayConfiguration,
  validateListOptions,
  DEFAULT_LIST_OPTIONS,
  MAX_LIST_LIMIT,
} from '../../../models/config-bundle.model';
import { User } from '../../../models/user.model';
import { getSupabaseClient } from '../../../supabase/supabase-client';
import { AuthService } from '../../auth/auth.service';

/**
 * Service for configuration listing and discovery
 * Handles business logic for listing public and liked configurations
 */
@Injectable()
export class ListService {
  private supabase = getSupabaseClient();

  constructor(private readonly authService: AuthService) {}

  /**
   * List public configurations with filtering, sorting, and pagination
   * Implements Requirements: 1.1, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2
   */
  async listConfigurations(
    options: ListConfigurationsOptions = {},
  ): Promise<ConfigurationListResult> {
    // Validate input options
    const validation = validateListOptions(options);
    if (!validation.isValid) {
      throw new Error(`Invalid options: ${validation.errors.join(', ')}`);
    }

    // Apply defaults
    const finalOptions = {
      ...DEFAULT_LIST_OPTIONS,
      ...options,
    };

    try {
      // Build base query for public configurations
      let query = this.supabase
        .from('config_bundles')
        .select('*', { count: 'exact' });

      // Apply privacy filter - only show public configs unless includePrivate is true
      if (!finalOptions.includePrivate) {
        query = query.eq('is_public', true);
      } else if (finalOptions.userId) {
        // If includePrivate is true and userId provided, show public + user's private
        query = query.or(`is_public.eq.true,user_id.eq.${finalOptions.userId}`);
      }

      // Apply title filter if provided
      if (finalOptions.filter && finalOptions.filter.trim()) {
        query = query.ilike('title', `%${finalOptions.filter.trim()}%`);
      }

      // Apply sorting
      const sortMapping = this.getSortMapping(finalOptions.sort);
      query = query.order(sortMapping.field, {
        ascending: sortMapping.ascending,
      });

      // Apply pagination
      const offset = 0; // For now, we don't support offset-based pagination
      query = query.range(offset, offset + finalOptions.limit - 1);

      // Execute query
      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      if (!data) {
        return {
          configurations: [],
          totalCount: 0,
          hasMore: false,
        };
      }

      // Transform to display format
      const configurations = data.map((bundle: ConfigBundle) =>
        toDisplayConfiguration(bundle),
      );

      return {
        configurations,
        totalCount: count || 0,
        hasMore: (count || 0) > finalOptions.limit,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to list configurations: Unknown error occurred');
    }
  }

  /**
   * List configurations liked by the authenticated user
   * Implements Requirements: 5.1
   */
  async listLikedConfigurations(
    userId: string,
    options: ListOptions = {},
  ): Promise<ConfigurationListResult> {
    // Validate input options
    const validation = validateListOptions(options);
    if (!validation.isValid) {
      throw new Error(`Invalid options: ${validation.errors.join(', ')}`);
    }

    // Apply defaults
    const finalOptions = {
      ...DEFAULT_LIST_OPTIONS,
      ...options,
    };

    try {
      // Query liked configurations through user_likes join
      let query = this.supabase
        .from('config_bundles')
        .select(
          `
          *,
          user_likes!inner(created_at)
        `,
          { count: 'exact' },
        )
        .eq('user_likes.user_id', userId);

      // Apply title filter if provided
      if (finalOptions.filter && finalOptions.filter.trim()) {
        query = query.ilike('title', `%${finalOptions.filter.trim()}%`);
      }

      // Apply sorting - for liked configs, we can sort by like date or config name/date
      if (finalOptions.sort === 'date') {
        // Sort by when the user liked it (most recent likes first)
        query = query.order('user_likes.created_at', { ascending: false });
      } else {
        // Sort by configuration name
        query = query.order('title', { ascending: true });
      }

      // Apply pagination
      const offset = 0; // For now, we don't support offset-based pagination
      query = query.range(offset, offset + finalOptions.limit - 1);

      // Execute query
      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      if (!data) {
        return {
          configurations: [],
          totalCount: 0,
          hasMore: false,
        };
      }

      // Transform to display format and mark as liked
      const configurations = data.map((bundle: ConfigBundle) => ({
        ...toDisplayConfiguration(bundle),
        isLiked: true, // All results are liked by definition
      }));

      return {
        configurations,
        totalCount: count || 0,
        hasMore: (count || 0) > finalOptions.limit,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        'Failed to list liked configurations: Unknown error occurred',
      );
    }
  }

  /**
   * Validate list options with enhanced validation
   * Private helper method for input validation
   */
  private validateListOptions(options: ListOptions): ValidationResult {
    const errors: string[] = [];

    // Validate sort option
    if (options.sort && !['date', 'name'].includes(options.sort)) {
      errors.push(
        `Invalid sort option '${options.sort}'. Valid options: date, name`,
      );
    }

    // Validate limit option
    if (options.limit !== undefined) {
      if (!Number.isInteger(options.limit) || options.limit <= 0) {
        errors.push('Limit must be a positive integer');
      }
      if (options.limit > MAX_LIST_LIMIT) {
        errors.push(`Limit cannot exceed ${MAX_LIST_LIMIT}`);
      }
    }

    // Validate filter (basic sanitization)
    if (options.filter !== undefined) {
      if (typeof options.filter !== 'string') {
        errors.push('Filter must be a string');
      } else if (options.filter.length > 100) {
        errors.push('Filter cannot exceed 100 characters');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Apply title-based filtering to configurations
   * Private helper method for filtering logic
   */
  private applyFilters(
    configs: ConfigBundle[],
    filter: string,
  ): ConfigBundle[] {
    if (!filter || !filter.trim()) {
      return configs;
    }

    const searchTerm = filter.trim().toLowerCase();
    return configs.filter((config) =>
      config.title.toLowerCase().includes(searchTerm),
    );
  }

  /**
   * Apply sorting to configurations
   * Private helper method for sorting logic
   */
  private applySorting(
    configs: ConfigBundle[],
    sort: SortField,
  ): ConfigBundle[] {
    return [...configs].sort((a, b) => {
      switch (sort) {
        case 'date':
          // Sort by creation date (newest first)
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case 'name':
          // Sort alphabetically by title
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }

  /**
   * Get database sort mapping for Supabase queries
   * Private helper method for database sorting
   */
  private getSortMapping(sort: SortField): {
    field: string;
    ascending: boolean;
  } {
    switch (sort) {
      case 'date':
        return { field: 'created_at', ascending: false }; // Newest first
      case 'name':
        return { field: 'title', ascending: true }; // Alphabetical
      default:
        return { field: 'created_at', ascending: false };
    }
  }

  /**
   * Format configurations for display
   * Private helper method for data transformation
   */
  private formatForDisplay(configs: ConfigBundle[]): DisplayConfiguration[] {
    return configs.map((config) => toDisplayConfiguration(config));
  }

  /**
   * Sanitize filter input to prevent injection attacks
   * Private helper method for security
   */
  private sanitizeFilter(filter: string): string {
    if (!filter) return '';

    // Remove potentially dangerous characters and trim
    return filter
      .replace(/["';\\]/g, '')
      .trim()
      .substring(0, 100); // Limit length
  }

  /**
   * Check if user is authenticated and get user info
   * Private helper method for authentication validation
   */
  private async requireAuthentication(): Promise<User> {
    const user = await this.authService.getCurrentUser();
    if (!user) {
      throw new Error(
        'Authentication required. Please run "taptik login" first.',
      );
    }
    return user;
  }

  /**
   * Get current user ID if authenticated, null otherwise
   * Private helper method for optional authentication
   */
  private async getCurrentUserId(): Promise<string | null> {
    try {
      const user = await this.authService.getCurrentUser();
      return user?.id || null;
    } catch {
      return null;
    }
  }
}
