import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { BuildModule } from './commands/build';
import { HealthCommand } from './commands/health.command';

@Module({
  imports: [
    TerminusModule,
    BuildModule,
  ],
  providers: [HealthCommand],
})
export class AppModule {}
