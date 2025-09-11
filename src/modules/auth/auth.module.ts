import { Module } from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginCommand } from './commands/login.command';
import { LogoutCommand } from './commands/logout.command';
import { SessionStorage } from './session-storage';

@Module({
  providers: [
    AuthService,
    SessionStorage,
    LoginCommand,
    LogoutCommand,
  ],
  exports: [AuthService],
})
export class AuthModule {}
