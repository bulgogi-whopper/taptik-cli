import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';

import { HealthCommand } from './commands/health.command';
import { AuthModule } from './modules/auth/auth.module';
import { BuildModule } from './modules/build/build.module';
import { ContextModule } from './modules/context/context.module';
import { DeployModule } from './modules/deploy/deploy.module';
import { InfoModule } from './modules/info/info.module';
import { PushModule } from './modules/push/push.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TerminusModule,
    AuthModule,
    InfoModule,
    ContextModule,
    DeployModule,
    BuildModule,
    PushModule,
  ],
  providers: [HealthCommand],
})
export class AppModule {}
