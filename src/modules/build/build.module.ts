import { Module } from '@nestjs/common';

import { BuildCommand } from './commands/build.command';

@Module({
  providers: [BuildCommand],
  exports: [BuildCommand],
})
export class BuildModule {}