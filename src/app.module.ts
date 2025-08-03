import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthCommand } from "./commands/health.command";

@Module({
  imports: [TerminusModule],
  providers: [HealthCommand],
})
export class AppModule {}
