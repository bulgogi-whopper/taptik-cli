import { Injectable } from '@nestjs/common';

import {
  ConfigBundle,
  ConfigurationListResult,
  ListConfigurationsOptions,
  ListOptions,
  SortField,
  toDisplayConfiguration,
  validateListOptions,
  DEFAULT_LIST_OPTIONS,
} from '../../../models/config-bundle.model';
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
}
