import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';

import { UserSession } from '../../models/user.model';

export interface StoredSession {
  userSession: UserSession;
  storedAt: string;
}

@Injectable()
export class SessionStorage {
  private readonly sessionDir: string;
  private readonly sessionFile: string;

  constructor() {
    // Store session in user's home directory under .taptik
    this.sessionDir = join(homedir(), '.taptik');
    this.sessionFile = join(this.sessionDir, 'session.json');
  }

  /**
   * Save user session to file system
   */
  async saveSession(session: UserSession): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.sessionDir, { recursive: true });

      const storedSession: StoredSession = {
        userSession: session,
        storedAt: new Date().toISOString(),
      };

      // Write session to file
      await fs.writeFile(
        this.sessionFile,
        JSON.stringify(storedSession, null, 2),
        'utf8',
      );

      console.log('💾 Session saved successfully');
    } catch (error) {
      console.error('Failed to save session:', error);
      throw new Error(
        `Failed to save session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Load user session from file system
   */
  async loadSession(): Promise<UserSession | null> {
    try {
      // Check if session file exists
      const sessionData = await fs.readFile(this.sessionFile, 'utf8');
      const storedSession: StoredSession = JSON.parse(sessionData);

      // Check if session has expired
      const expiresAt = new Date(storedSession.userSession.expiresAt);
      const now = new Date();

      if (now >= expiresAt) {
        console.log('⏰ Session has expired, removing...');
        await this.clearSession();
        return null;
      }

      // Convert date strings back to Date objects
      const session: UserSession = {
        ...storedSession.userSession,
        expiresAt: new Date(storedSession.userSession.expiresAt),
      };

      console.log('📂 Session loaded successfully');
      return session;
    } catch (error) {
      // If file doesn't exist or can't be read, return null
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return null; // No session file exists
      }

      console.error('Failed to load session:', error);
      return null;
    }
  }

  /**
   * Clear stored session
   */
  async clearSession(): Promise<void> {
    try {
      await fs.unlink(this.sessionFile);
      console.log('🗑️ Session cleared successfully');
    } catch (error) {
      // If file doesn't exist, that's fine
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }
      console.error('Failed to clear session:', error);
    }
  }

  /**
   * Check if session exists and is valid
   */
  async hasValidSession(): Promise<boolean> {
    const session = await this.loadSession();
    return session !== null;
  }

  /**
   * Get session file path for debugging
   */
  getSessionPath(): string {
    return this.sessionFile;
  }
}
