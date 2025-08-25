import { createHash } from 'crypto';

import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import {
  PushError,
  PushErrorCode,
  UPLOAD_CONFIG,
} from '../constants/push.constants';
import { PackageMetadata, UploadProgress } from '../interfaces';

import { SignedUrlService } from './signed-url.service';

interface ChunkedUpload {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  resumeToken?: string;
}

interface DuplicateCheckResult {
  exists: boolean;
  existingUrl?: string;
  existingId?: string;
}

@Injectable()
export class CloudUploadService {
  private readonly BUCKET_CONFIG = UPLOAD_CONFIG;
  private readonly activeUploads = new Map<string, ChunkedUpload>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly signedUrlService: SignedUrlService,
  ) {}

  async checkDuplicate(checksum: string): Promise<DuplicateCheckResult> {
    try {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('taptik_packages')
        .select('id, config_id, storage_url')
        .eq('checksum', checksum)
        .is('archived_at', null)
        .single();

      if (error) {
        // If no data found, that's expected and not an error
        if (error.code === 'PGRST116') {
          return { exists: false };
        }
        throw new PushError(
          PushErrorCode.DATABASE_ERROR,
          `Failed to check for duplicate: ${error.message}`,
          error,
          true,
        );
      }

      return {
        exists: true,
        existingUrl: data.storage_url,
        existingId: data.config_id,
      };
    } catch (error) {
      if (error instanceof PushError) {
        throw error;
      }
      throw new PushError(
        PushErrorCode.DATABASE_ERROR,
        'Failed to check for duplicate package',
        error,
        true,
      );
    }
  }

  async uploadPackage(
    packageBuffer: Buffer,
    metadata: PackageMetadata,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<string> {
    try {
      // 1. Check for duplicate by checksum
      const duplicateCheck = await this.checkDuplicate(metadata.checksum);
      if (duplicateCheck.exists && duplicateCheck.existingUrl) {
        onProgress?.({
          stage: 'complete',
          percentage: 100,
          bytesUploaded: packageBuffer.length,
          totalBytes: packageBuffer.length,
          message: 'Package already exists, using existing upload',
        });
        return duplicateCheck.existingUrl;
      }

      // 2. Generate storage path
      const storagePath = this.generateStoragePath(
        metadata.userId,
        metadata.configId,
        metadata.version,
      );

      // 3. Determine upload strategy based on file size
      const useChunkedUpload =
        packageBuffer.length > this.BUCKET_CONFIG.CHUNKED_UPLOAD_THRESHOLD;

      onProgress?.({
        stage: 'uploading',
        percentage: 0,
        bytesUploaded: 0,
        totalBytes: packageBuffer.length,
        message: `Starting ${useChunkedUpload ? 'chunked' : 'direct'} upload`,
      });

      let storageUrl: string;

      if (useChunkedUpload) {
        storageUrl = await this.performChunkedUpload(
          packageBuffer,
          storagePath,
          metadata.configId,
          onProgress,
        );
      } else {
        storageUrl = await this.performDirectUpload(
          packageBuffer,
          storagePath,
          onProgress,
        );
      }

      onProgress?.({
        stage: 'complete',
        percentage: 100,
        bytesUploaded: packageBuffer.length,
        totalBytes: packageBuffer.length,
        message: 'Upload completed successfully',
      });

      return storageUrl;
    } catch (error) {
      if (error instanceof PushError) {
        throw error;
      }
      throw new PushError(
        PushErrorCode.UPLOAD_FAILED,
        'Failed to upload package',
        error,
        true,
      );
    }
  }

  async resumeUpload(
    uploadId: string,
    packageBuffer: Buffer,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<string> {
    try {
      const uploadInfo = this.activeUploads.get(uploadId);
      if (!uploadInfo) {
        throw new PushError(
          PushErrorCode.UPLOAD_FAILED,
          `Upload session ${uploadId} not found or expired`,
          { uploadId },
          false,
        );
      }

      // Calculate progress from uploaded chunks
      const uploadedBytes =
        uploadInfo.uploadedChunks.length * uploadInfo.chunkSize;
      const totalBytes = packageBuffer.length;

      onProgress?.({
        stage: 'uploading',
        percentage: (uploadedBytes / totalBytes) * 100,
        bytesUploaded: uploadedBytes,
        totalBytes,
        message: `Resuming upload from chunk ${uploadInfo.uploadedChunks.length + 1}/${uploadInfo.totalChunks}`,
      });

      // Continue chunked upload from where we left off
      return await this.continueChunkedUpload(
        packageBuffer,
        uploadInfo,
        onProgress,
      );
    } catch (error) {
      if (error instanceof PushError) {
        throw error;
      }
      throw new PushError(
        PushErrorCode.UPLOAD_FAILED,
        'Failed to resume upload',
        error,
        true,
      );
    }
  }

  async deletePackage(storageUrl: string): Promise<void> {
    try {
      // Extract the storage path from the URL
      const url = new globalThis.URL(storageUrl);
      const pathSegments = url.pathname.split('/');
      const bucketIndex = pathSegments.findIndex(
        (segment) => segment === this.BUCKET_CONFIG.BUCKET_NAME,
      );

      if (bucketIndex === -1) {
        throw new PushError(
          PushErrorCode.UPLOAD_FAILED,
          'Invalid storage URL format',
          { storageUrl },
          false,
        );
      }

      const filePath = pathSegments.slice(bucketIndex + 1).join('/');

      const client = this.supabaseService.getClient();
      const { error } = await client.storage
        .from(this.BUCKET_CONFIG.BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        throw new PushError(
          PushErrorCode.UPLOAD_FAILED,
          `Failed to delete package: ${error.message}`,
          error,
          true,
        );
      }
    } catch (error) {
      if (error instanceof PushError) {
        throw error;
      }
      throw new PushError(
        PushErrorCode.UPLOAD_FAILED,
        'Failed to delete package from storage',
        error,
        true,
      );
    }
  }

  async generateSignedDownloadUrl(
    packageId: string,
    userId?: string,
  ): Promise<{
    url: string;
    expires: Date;
  }> {
    return this.signedUrlService.generateDownloadUrl(packageId, userId);
  }

  private generateStoragePath(
    userId: string,
    configId: string,
    version: string,
  ): string {
    return `${this.BUCKET_CONFIG.STORAGE_PATH_PATTERN.replace(
      '{userId}',
      userId,
    )
      .replace('{configId}', configId)
      .replace('{version}', version)}package.taptik`;
  }

  private async performDirectUpload(
    packageBuffer: Buffer,
    storagePath: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<string> {
    const client = this.supabaseService.getClient();

    onProgress?.({
      stage: 'uploading',
      percentage: 50,
      bytesUploaded: 0,
      totalBytes: packageBuffer.length,
      message: 'Uploading package...',
    });

    const { data, error } = await client.storage
      .from(this.BUCKET_CONFIG.BUCKET_NAME)
      .upload(storagePath, packageBuffer, {
        contentType: 'application/gzip',
        duplex: 'half',
      });

    if (error) {
      throw new PushError(
        PushErrorCode.UPLOAD_FAILED,
        `Upload failed: ${error.message}`,
        error,
        true,
      );
    }

    if (!data?.path) {
      throw new PushError(
        PushErrorCode.UPLOAD_FAILED,
        'Upload succeeded but no path returned',
        { data },
        false,
      );
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = client.storage
      .from(this.BUCKET_CONFIG.BUCKET_NAME)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  private async performChunkedUpload(
    packageBuffer: Buffer,
    storagePath: string,
    configId: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<string> {
    const chunkSize = this.BUCKET_CONFIG.CHUNK_SIZE;
    const totalChunks = Math.ceil(packageBuffer.length / chunkSize);
    const uploadId = this.generateUploadId(configId);

    const uploadInfo: ChunkedUpload = {
      uploadId,
      chunkSize,
      totalChunks,
      uploadedChunks: [],
    };

    this.activeUploads.set(uploadId, uploadInfo);

    try {
      return await this.continueChunkedUpload(
        packageBuffer,
        uploadInfo,
        onProgress,
        storagePath,
      );
    } finally {
      this.activeUploads.delete(uploadId);
    }
  }

  private async continueChunkedUpload(
    packageBuffer: Buffer,
    uploadInfo: ChunkedUpload,
    onProgress?: (progress: UploadProgress) => void,
    storagePath?: string,
  ): Promise<string> {
    const client = this.supabaseService.getClient();
    const chunks: Buffer[] = [];

    // Split buffer into chunks if not already done
    for (let i = 0; i < uploadInfo.totalChunks; i++) {
      const start = i * uploadInfo.chunkSize;
      const end = Math.min(start + uploadInfo.chunkSize, packageBuffer.length);
      chunks.push(packageBuffer.subarray(start, end));
    }

    // Upload missing chunks sequentially (required for progress tracking)
    const missingChunks = [];
    for (let i = 0; i < uploadInfo.totalChunks; i++) {
      if (!uploadInfo.uploadedChunks.includes(i)) {
        missingChunks.push(i);
      }
    }

    for (const chunkIndex of missingChunks) {
      const chunkPath = storagePath
        ? `${storagePath}.chunk.${chunkIndex}`
        : `temp/chunk.${uploadInfo.uploadId}.${chunkIndex}`;

      // eslint-disable-next-line no-await-in-loop
      const { error } = await client.storage
        .from(this.BUCKET_CONFIG.BUCKET_NAME)
        .upload(chunkPath, chunks[chunkIndex], {
          contentType: 'application/octet-stream',
        });

      if (error) {
        throw new PushError(
          PushErrorCode.UPLOAD_FAILED,
          `Failed to upload chunk ${chunkIndex}: ${error.message}`,
          error,
          true,
        );
      }

      uploadInfo.uploadedChunks.push(chunkIndex);

      // Update progress
      const uploadedBytes =
        uploadInfo.uploadedChunks.length * uploadInfo.chunkSize;
      const percentage = Math.min(
        (uploadedBytes / packageBuffer.length) * 100,
        100,
      );

      onProgress?.({
        stage: 'uploading',
        percentage,
        bytesUploaded: uploadedBytes,
        totalBytes: packageBuffer.length,
        message: `Uploaded chunk ${chunkIndex + 1}/${uploadInfo.totalChunks}`,
      });
    }

    // Combine chunks into final file
    const finalPath =
      storagePath || `packages/combined/${uploadInfo.uploadId}/package.taptik`;
    const combinedBuffer = Buffer.concat(chunks);

    const { data, error } = await client.storage
      .from(this.BUCKET_CONFIG.BUCKET_NAME)
      .upload(finalPath, combinedBuffer, {
        contentType: 'application/gzip',
      });

    if (error) {
      throw new PushError(
        PushErrorCode.UPLOAD_FAILED,
        `Failed to create final file: ${error.message}`,
        error,
        true,
      );
    }

    // Clean up chunk files
    await this.cleanupChunks(uploadInfo, storagePath);

    if (!data?.path) {
      throw new PushError(
        PushErrorCode.UPLOAD_FAILED,
        'Upload succeeded but no path returned',
        { data },
        false,
      );
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = client.storage
      .from(this.BUCKET_CONFIG.BUCKET_NAME)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  private async cleanupChunks(
    uploadInfo: ChunkedUpload,
    storagePath?: string,
  ): Promise<void> {
    try {
      const client = this.supabaseService.getClient();
      const chunkPaths: string[] = [];

      for (let i = 0; i < uploadInfo.totalChunks; i++) {
        const chunkPath = storagePath
          ? `${storagePath}.chunk.${i}`
          : `temp/chunk.${uploadInfo.uploadId}.${i}`;
        chunkPaths.push(chunkPath);
      }

      // Clean up chunk files (ignore errors as this is cleanup)
      await client.storage
        .from(this.BUCKET_CONFIG.BUCKET_NAME)
        .remove(chunkPaths);
    } catch (error) {
      // Log error but don't throw - cleanup failure shouldn't fail the upload
      // In production, this would use a proper logger
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('Failed to cleanup chunk files:', error);
      }
    }
  }

  private generateUploadId(configId: string): string {
    const timestamp = Date.now().toString();
    const hash = createHash('sha256')
      .update(`${configId}-${timestamp}-${Math.random()}`)
      .digest('hex')
      .substring(0, 8);
    return `${configId}-${hash}`;
  }
}
