import { Module } from '@nestjs/common';

import { SupabaseService } from '../modules/supabase/supabase.service';

@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
