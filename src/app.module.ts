import { Module } from '@nestjs/common';
import { BoardsModule } from './boards/boards.module';
import { HealthController } from './health.controller';
import { PresenceModule } from './presence/presence.module';

@Module({
  imports: [BoardsModule, PresenceModule],
  controllers: [HealthController],
})
export class AppModule {}
