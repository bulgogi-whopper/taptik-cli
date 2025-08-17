import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';

import { HealthCommand } from './commands/health.command';
import { AuthModule } from './modules/auth/auth.module';
import { ContextModule } from './modules/context/context.module';
import { DeployModule } from './modules/deploy/deploy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TerminusModule,
    AuthModule,
    ContextModule,
    DeployModule,
  ],
  providers: [HealthCommand],
})
export class AppModule {}
