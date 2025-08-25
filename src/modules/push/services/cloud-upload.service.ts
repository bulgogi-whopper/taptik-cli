import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { UPLOAD_CONFIG } from '../constants/push.constants';
import { PackageMetadata, UploadProgress } from '../interfaces';

import { SignedUrlService } from './signed-url.service';


@Injectable()
export class CloudUploadService {
  private readonly BUCKET_CONFIG = UPLOAD_CONFIG;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly signedUrlService: SignedUrlService,
  ) {}

  async checkDuplicate(_checksum: string): Promise<{
    exists: boolean;
    existingUrl?: string;
    existingId?: string;
  }> {
    // TODO: Query existing packages by checksum to avoid duplicate uploads
    return { exists: false };
  }

  async uploadPackage(
    _packageBuffer: Buffer,
    _metadata: PackageMetadata,
    _onProgress?: (progress: UploadProgress) => void,
  ): Promise<string> {
    // TODO: Implement upload logic
    // 1. Check for duplicate by checksum
    // 2. Generate storage path
    // 3. Use chunked upload for files > 10MB
    // 4. Upload with progress tracking
    // 5. Generate signed URL for access
    // 6. Return storage URL
    throw new Error('Method not implemented.');
  }

  async resumeUpload(
    _uploadId: string,
    _packageBuffer: Buffer,
    _onProgress?: (progress: UploadProgress) => void,
  ): Promise<string> {
    // TODO: Resume interrupted chunked upload
    throw new Error('Method not implemented.');
  }

  async deletePackage(_storageUrl: string): Promise<void> {
    // TODO: Remove package from storage
    throw new Error('Method not implemented.');
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
}