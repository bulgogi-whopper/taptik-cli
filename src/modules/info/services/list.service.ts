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
import { EXIT_CODES, CLIError } from '../constants/exit-codes.constants';

/**
 * Custom error classes for better error handling
 * Based on Requirements 6.1, 6.2, 6.3, 6.5
 */
export class NetworkError extends CLIError {
  constructor(
    message: string = 'Unable to connect to Taptik cloud. Please check your internet connection.',
  ) {
    super(message, EXIT_CODES.NETWORK_ERROR);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends CLIError {
  constructor(
    message: string = "Authentication failed. Please run 'taptik login' first.",
  ) {
    super(message, EXIT_CODES.AUTH_ERROR);
    this.name = 'AuthenticationError';
  }
}

export class ServerError extends CLIError {
  constructor(
    message: string = 'Taptik cloud is temporarily unavailable. Please try again later.',
  ) {
    super(message, EXIT_CODES.SERVER_ERROR);
    this.name = 'ServerError';
  }
}

export class ValidationError extends CLIError {
  constructor(message: string) {
    super(message, EXIT_CODES.INVALID_ARGUMENT);
    this.name = 'ValidationError';
  }
}

/**
 * Service for configuration listing and discovery
 * Handles business logic for listing public and liked configurations
 */
@Injectable()
export class ListService {
  private supabase = getSupabaseClient();

  constructor(private readonly authService: AuthService) {}

  /**
   * Check if user is authenticated for liked configurations
   * Implements Requirement 5.2: Authentication check for liked configurations
   */
  async requireAuthentication(): Promise<string> {
    const user = await this.authService.getCurrentUser();
    if (!user) {
      throw new AuthenticationError();
    }
    return user.id;
  }

  /**
   * Handle database errors with appropriate error types
   * Implements Requirements 6.1, 6.2, 6.3: Specific error handling
   */
  private handleDatabaseError(error: unknown): never {
    const errorObj = error as { code?: string | number; message?: string };

    // Network connectivity errors
    if (
      errorObj.code === 'PGRST301' ||
      errorObj.message?.includes('connection') ||
      errorObj.message?.includes('network')
    ) {
      throw new NetworkError();
    }

    // Authentication errors
    if (
      errorObj.code === '401' ||
      errorObj.message?.includes('unauthorized') ||
      errorObj.message?.includes('authentication')
    ) {
      throw new AuthenticationError();
    }

    // Server errors (5xx status codes)
    if (
      (typeof errorObj.code === 'number' && errorObj.code >= 500) ||
      errorObj.message?.includes('server error') ||
      errorObj.message?.includes('internal error')
    ) {
      throw new ServerError();
    }

    // Rate limiting or other client errors
    if (errorObj.code === '429') {
      throw new ServerError(
        'Taptik cloud is experiencing high traffic. Please try again in a moment.',
      );
    }

    // Generic database error
    throw new Error(
      `Database operation failed: ${errorObj.message || 'Unknown error'}`,
    );
  }

  /**
   * Sanitize filter input to prevent injection attacks
   * Implements security considerations from design document
   */
  private sanitizeFilter(filter: string): string {
    if (!filter || typeof filter !== 'string') {
      return '';
    }
    // Remove potentially dangerous characters and trim whitespace
    return filter.replace(/["';\\]/g, '').trim();
  }

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
      throw new ValidationError(
        `Invalid options: ${validation.errors.join(', ')}`,
      );
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

      // Apply title filter if provided (with sanitization)
      if (finalOptions.filter && finalOptions.filter.trim()) {
        const sanitizedFilter = this.sanitizeFilter(finalOptions.filter);
        if (sanitizedFilter) {
          query = query.ilike('title', `%${sanitizedFilter}%`);
        }
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
        this.handleDatabaseError(error);
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
      // Re-throw custom errors as-is
      if (
        error instanceof NetworkError ||
        error instanceof AuthenticationError ||
        error instanceof ServerError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to list configurations: Unknown error occurred');
    }
  }

  /**
   * List configurations liked by the authenticated user
   * Implements Requirements: 5.1, 5.2
   */
  async listLikedConfigurations(
    options: ListOptions = {},
  ): Promise<ConfigurationListResult> {
    // Require authentication first (Requirement 5.2)
    const userId = await this.requireAuthentication();

    // Validate input options
    const validation = validateListOptions(options);
    if (!validation.isValid) {
      throw new ValidationError(
        `Invalid options: ${validation.errors.join(', ')}`,
      );
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

      // Apply title filter if provided (with sanitization)
      if (finalOptions.filter && finalOptions.filter.trim()) {
        const sanitizedFilter = this.sanitizeFilter(finalOptions.filter);
        if (sanitizedFilter) {
          query = query.ilike('title', `%${sanitizedFilter}%`);
        }
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
        this.handleDatabaseError(error);
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
      // Re-throw custom errors as-is
      if (
        error instanceof NetworkError ||
        error instanceof AuthenticationError ||
        error instanceof ServerError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

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
