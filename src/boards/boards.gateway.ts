import { UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { type Ack, ok } from '../common/acknowledgements/ack';
import { CORS_ORIGIN } from '../common/config';
import { AppError } from '../common/errors/errors';
import { LIMITS } from '../common/limits/limits';
import { WsExceptionFilter } from '../common/websocket/ws-exception.filter';
import { PresenceService } from '../presence/presence.service';
import { BoardsService } from './boards.service';
import { AddObjectDto } from './dto/add-object.dto';
import { DeleteObjectDto } from './dto/delete-object.dto';
import { JoinBoardDto } from './dto/join-board.dto';
import { toObjectPatch, UpdateObjectDto } from './dto/update-object.dto';
import {
  ClientEvent,
  JoinBoardAck,
  ObjectUpdatedPayload,
  ServerEvent,
  VersionAck,
} from './events/boards.events';

@UseFilters(WsExceptionFilter)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: () => new AppError('VALIDATION_FAILED'),
  }),
)
@WebSocketGateway({
  cors: { origin: CORS_ORIGIN },
  maxHttpBufferSize: LIMITS.maxHttpBufferSize,
})
export class BoardsGateway {
  constructor(
    private readonly boards: BoardsService,
    private readonly presence: PresenceService,
  ) {}

  @SubscribeMessage(ClientEvent.BoardJoin)
  async joinBoard(
    @MessageBody() dto: JoinBoardDto,
    @ConnectedSocket() socket: Socket,
  ): Promise<Ack<JoinBoardAck>> {
    if (this.presence.getBySocket(socket.id)) {
      throw new AppError('ALREADY_JOINED');
    }
    this.boards.getBoard(dto.boardId); // throws BOARD_NOT_FOUND before anything is registered

    const { user, isFirstSocket } = this.presence.join(
      socket.id,
      dto.boardId,
      dto.user,
    );
    await socket.join(dto.boardId); // the room is named after the board
    this.boards.markOccupied(dto.boardId);

    if (isFirstSocket) {
      socket.to(dto.boardId).emit(ServerEvent.PresenceJoined, { user });
    }
    return ok({
      board: {
        ...this.boards.getSnapshot(dto.boardId),
        users: this.presence.getRoster(dto.boardId),
      },
      me: user,
    });
  }

  @SubscribeMessage(ClientEvent.ObjectAdd)
  addObject(
    @MessageBody() dto: AddObjectDto,
    @ConnectedSocket() socket: Socket,
  ): Ack<VersionAck> {
    const { boardId, user } = this.requireJoined(socket);
    const saved = this.boards.addObject(boardId, user.id, dto.object);

    socket.to(boardId).emit(ServerEvent.ObjectAdded, { object: saved });
    return ok({ version: saved.version });
  }

  @SubscribeMessage(ClientEvent.ObjectUpdate)
  updateObject(
    @MessageBody() dto: UpdateObjectDto,
    @ConnectedSocket() socket: Socket,
  ): Ack<VersionAck> {
    const { boardId } = this.requireJoined(socket);
    const patch = toObjectPatch(dto.patch);
    const updated = this.boards.updateObject(boardId, dto.id, patch);

    const payload: ObjectUpdatedPayload = {
      id: updated.id,
      patch,
      version: updated.version,
    };
    socket.to(boardId).emit(ServerEvent.ObjectUpdated, payload);
    return ok({ version: updated.version });
  }

  @SubscribeMessage(ClientEvent.ObjectDelete)
  deleteObject(
    @MessageBody() dto: DeleteObjectDto,
    @ConnectedSocket() socket: Socket,
  ): Ack {
    const { boardId } = this.requireJoined(socket);
    this.boards.deleteObject(boardId, dto.id);

    socket.to(boardId).emit(ServerEvent.ObjectDeleted, { id: dto.id });
    return ok(undefined);
  }

  // The board and user come from what the server recorded at join, never from the browser.
  private requireJoined(socket: Socket) {
    const joined = this.presence.getBySocket(socket.id);
    if (!joined) throw new AppError('NOT_JOINED');
    return joined;
  }
}
