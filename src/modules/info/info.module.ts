import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

import { InfoCommand } from './commands/info.command';
import { ListCommand } from './commands/list.command';
import { InfoService } from './services/info.service';
import { ListService } from './services/list.service';

@Module({
  imports: [AuthModule, SupabaseModule],
  providers: [InfoCommand, ListCommand, InfoService, ListService],
  exports: [InfoService, ListService],
})
export class InfoModule {}
