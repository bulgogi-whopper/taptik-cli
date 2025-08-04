import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';

import { HealthCommand } from './commands/health.command';
import { BuildModule } from './modules/build/build.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TerminusModule,
    BuildModule,
  ],
  providers: [HealthCommand],
})
export class AppModule {}
