import { Module } from '@nestjs/common';

import { DeployCommand } from './commands/deploy.command';
import { DeployCoreModule } from './core/deploy-core.module';
import { DeployKiroModule } from './kiro/deploy-kiro.module';
import { DeployUtilsModule } from './utils/deploy-utils.module';

@Module({
  imports: [
    DeployCoreModule,
    DeployKiroModule,
    DeployUtilsModule,
  ],
  providers: [
    DeployCommand,
  ],
  exports: [
    DeployCoreModule,
    DeployKiroModule,
    DeployUtilsModule,
  ],
})
export class DeployModule {}
