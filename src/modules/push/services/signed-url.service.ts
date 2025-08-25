import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../../supabase/supabase.service';
import { PushError, PushErrorCode } from '../constants/push.constants';

export interface SignedUrlUploadResponse {
  url: string;
  expires: Date;
  fields: Record<string, string>;
}

export interface SignedUrlDownloadResponse {
  url: string;
  expires: Date;
}

@Injectable()
export class SignedUrlService {
  private readonly bucketName: string;
  private readonly defaultUploadExpiry: number;
  private readonly defaultDownloadExpiry: number;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.bucketName =
      this.configService?.get<string>('push.storage.bucketName') ??
      'taptik-packages';
    this.defaultUploadExpiry =
      this.configService?.get<number>('push.signedUrl.uploadExpiry') ?? 3600;
    this.defaultDownloadExpiry =
      this.configService?.get<number>('push.signedUrl.downloadExpiry') ?? 7200;
  }

  /**
   * Generate a signed upload URL with expiration and required fields
   */
  async generateUploadUrl(
    userId: string,
    packageId: string,
    expiresIn?: number,
  ): Promise<SignedUrlUploadResponse> {
    const path = this.generateStoragePath(userId, packageId);
    const expiry = expiresIn ?? this.defaultUploadExpiry;

    const client = this.supabaseService.getClient();
    const { data, error } = await client.storage
      .from(this.bucketName)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      throw new PushError(
        PushErrorCode.UPLOAD_FAILED,
        `Failed to generate upload URL: ${error?.message ?? 'Unknown error'}`,
        { path, error },
        true,
      );
    }

    return {
      url: data.signedUrl,
      expires: new Date(Date.now() + expiry * 1000),
      fields: {
        path: data.path,
        token: data.token,
      },
    };
  }

  /**
   * Generate a signed download URL with user-specific permissions
   */
  async generateDownloadUrl(
    packageId: string,
    userId?: string,
    expiresIn?: number,
  ): Promise<SignedUrlDownloadResponse> {
    const path = userId
      ? this.generateStoragePath(userId, packageId)
      : this.generatePublicPath(packageId);
    const expiry = expiresIn ?? this.defaultDownloadExpiry;

    const client = this.supabaseService.getClient();
    const { data, error } = await client.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiry, { download: true });

    if (error || !data) {
      throw new PushError(
        PushErrorCode.UPLOAD_FAILED,
        `Failed to generate download URL: ${error?.message ?? 'Unknown error'}`,
        { path, error },
        true,
      );
    }

    return {
      url: data.signedUrl,
      expires: new Date(Date.now() + expiry * 1000),
    };
  }

  /**
   * Validate if a signed URL is still valid
   */
  async validateUrl(url: string, expires: Date): Promise<boolean> {
    // Check if URL is valid format
    try {
      const urlObj = new globalThis.URL(url);
      if (!urlObj.protocol || !urlObj.host) {
        return false;
      }
    } catch {
      return false;
    }

    // Check if URL has expired
    if (expires.getTime() < Date.now()) {
      return false;
    }

    return true;
  }

  /**
   * Revoke a signed URL (placeholder for future implementation)
   */
  async revokeUrl(_url: string, _packageId: string): Promise<void> {
    // In a real implementation, this would:
    // 1. Store revoked URLs in a blacklist table
    // 2. Check against the blacklist during download attempts
    // 3. Implement cleanup for expired blacklist entries

    // For now, this is a placeholder that can be extended
    // when Supabase adds native URL revocation support
    return Promise.resolve();
  }

  /**
   * Generate storage path for a package
   */
  private generateStoragePath(userId: string, packageId: string): string {
    return `packages/${userId}/${packageId}/package.taptik`;
  }

  /**
   * Generate public storage path for a package
   */
  private generatePublicPath(packageId: string): string {
    return `packages/public/${packageId}/package.taptik`;
  }
}
