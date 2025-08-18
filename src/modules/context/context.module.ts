import { Module } from '@nestjs/common';

@Module({
  providers: [
    // Services will be added as they are implemented
  ],
  exports: [
    // Services will be exported as they are implemented
  ],
})
export class ContextModule {}
