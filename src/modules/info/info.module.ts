import { Module } from '@nestjs/common';

import { InfoCommand } from './commands/info.command';
import { InfoService } from './services/info.service';

@Module({
  providers: [InfoCommand, InfoService],
  exports: [InfoCommand, InfoService],
})
export class InfoModule {}