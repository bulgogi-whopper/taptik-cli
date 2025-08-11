import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { InfoCommand } from './commands/info.command';
import { InfoService } from './services/info.service';

@Module({
  imports: [AuthModule],
  providers: [InfoCommand, InfoService],
  exports: [InfoCommand, InfoService],
})
export class InfoModule {}