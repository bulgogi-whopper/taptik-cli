import { Injectable } from '@nestjs/common';

import { AuthService } from '../../auth/auth.service';

/**
 * Service for handling information queries and system status
 */
@Injectable()
export class InfoService {
  constructor(private readonly authService: AuthService) {}

  /**
   * Get current authenticated user account information
   */
  async getAccountInfo() {
    const currentUser = await this.authService.getCurrentUser();
    const currentSession = await this.authService.getSession();

    if (!currentUser) {
      throw new Error(
        'User not authenticated. Please run "taptik login" first.',
      );
    }

    return {
      user: currentUser,
      session: currentSession,
    };
  }

  /**
   * Get CLI tool and system information
   */
  async getToolInfo() {
    const packageVersion = process.env.npm_package_version || '0.0.1';
    const nodeVersion = process.version;
    const platform = process.platform;

    return {
      cliVersion: packageVersion,
      nodeVersion,
      platform,
    };
  }

  /**
   * Get session status information
   */
  async getSessionInfo() {
    const session = await this.authService.getSession();

    if (!session) {
      return null;
    }

    const now = new Date();
    const isExpired = session.expiresAt < now;
    const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();

    return {
      isExpired,
      expiresAt: session.expiresAt,
      timeUntilExpiry: Math.max(0, timeUntilExpiry),
    };
  }

  /**
   * Get synchronization information (placeholder for future implementation)
   */
  async getSyncInfo() {
    // TODO: Implement actual sync information when sync feature is available
    return {
      lastSyncTime: null,
      configCount: 0,
    };
  }
}