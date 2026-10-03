import { UseFilters } from '@nestjs/common';
import { WebSocketGateway } from '@nestjs/websockets';
import { CORS_ORIGIN } from '../common/config';
import { LIMITS } from '../common/limits/limits';
import { WsExceptionFilter } from '../common/websocket/ws-exception.filter';
import { PresenceService } from '../presence/presence.service';
import { BoardsService } from './boards.service';

// No event handlers yet; see boards.events.ts for the planned contract.
@UseFilters(WsExceptionFilter)
@WebSocketGateway({
  cors: { origin: CORS_ORIGIN },
  maxHttpBufferSize: LIMITS.maxHttpBufferSize,
})
export class BoardsGateway {
  constructor(
    private readonly boards: BoardsService,
    private readonly presence: PresenceService,
  ) {}
}
