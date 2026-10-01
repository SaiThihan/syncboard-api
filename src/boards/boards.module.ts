import { Module } from '@nestjs/common';
import { PresenceModule } from '../presence/presence.module';
import { BoardsController } from './boards.controller';
import { BoardsGateway } from './boards.gateway';
import { BoardsService } from './boards.service';

@Module({
  imports: [PresenceModule],
  controllers: [BoardsController],
  providers: [BoardsService, BoardsGateway],
  exports: [BoardsService],
})
export class BoardsModule {}
