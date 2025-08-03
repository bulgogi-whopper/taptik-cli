import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health/health.controller";
import { HealthCommand } from "./commands/health.command";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [HealthCommand],
})
export class AppModule {}
