import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { UPLOAD_CONFIG } from '../constants/push.constants';

@Injectable()
export class SignedUrlService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async generateUploadUrl(
    _userId: string,
    _packageId: string,
  ): Promise<{
    url: string;
    expires: Date;
    fields: Record<string, string>;
  }> {
    // TODO: Generate signed upload URL
    const expires = new Date(
      Date.now() + UPLOAD_CONFIG.SIGNED_URL_EXPIRATION * 1000,
    );

    return {
      url: '',
      expires,
      fields: {},
    };
  }

  async generateDownloadUrl(
    _packageId: string,
    _userId?: string,
  ): Promise<{
    url: string;
    expires: Date;
  }> {
    // TODO: Generate signed download URL
    const expires = new Date(
      Date.now() + UPLOAD_CONFIG.SIGNED_URL_EXPIRATION * 1000,
    );

    return {
      url: '',
      expires,
    };
  }

  async validateUrl(_url: string): Promise<boolean> {
    // TODO: Validate signed URL
    return false;
  }
}
