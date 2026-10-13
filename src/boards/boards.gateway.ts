import { UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
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
import { MoveCursorDto } from './dto/move-cursor.dto';
import { toObjectPatch, UpdateObjectDto } from './dto/update-object.dto';
import {
  ClientEvent,
  CursorMovedPayload,
  JoinBoardAck,
  ObjectUpdatedPayload,
  PresenceLeftPayload,
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
export class BoardsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly boards: BoardsService,
    private readonly presence: PresenceService,
  ) {}

  @SubscribeMessage(ClientEvent.BoardJoin)
  async joinBoard(
    @MessageBody() dto: JoinBoardDto,
    @ConnectedSocket() socket: Socket,
  ): Promise<Ack<JoinBoardAck>> {
    const { user, isFirstSocket, board } = this.boards.join(
      socket.id,
      dto.boardId,
      dto.user,
    );
    await socket.join(dto.boardId); // the room is named after the board

    if (isFirstSocket) {
      socket.to(dto.boardId).emit(ServerEvent.PresenceJoined, { user });
    }
    return ok({ board, me: user });
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

  // Cursors are not stored and have no ack. `volatile` drops the message for a
  // slow client instead of queueing it; the next move replaces it anyway.
  @SubscribeMessage(ClientEvent.CursorMove)
  moveCursor(
    @MessageBody() dto: MoveCursorDto,
    @ConnectedSocket() socket: Socket,
  ): void {
    const { boardId, user } = this.requireJoined(socket);
    const payload: CursorMovedPayload = { userId: user.id, x: dto.x, y: dto.y };
    socket.volatile.to(boardId).emit(ServerEvent.CursorMoved, payload);
  }

  // Runs for every closed connection, including ones that never joined a board.
  handleDisconnect(socket: Socket): void {
    const left = this.boards.leave(socket.id);
    if (left?.isLastSocket) {
      const payload: PresenceLeftPayload = { userId: left.user.id };
      this.server.to(left.boardId).emit(ServerEvent.PresenceLeft, payload);
    }
  }

  // The board and user come from what the server recorded at join, never from the browser.
  private requireJoined(socket: Socket) {
    const joined = this.presence.getBySocket(socket.id);
    if (!joined) throw new AppError('NOT_JOINED');
    return joined;
  }
}
