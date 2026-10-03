import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { AppModule } from './../../src/app.module';
import { configureApp } from './../../src/app.setup';
import { BoardsService } from './../../src/boards/boards.service';
import type { JoinBoardAck } from './../../src/boards/events/boards.events';
import type { Ack } from './../../src/common/acknowledgements/ack';

export const ANA = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana' };
export const BEN = { id: '22222222-2222-4222-8222-222222222222', name: 'Ben' };
export const CAL = { id: '33333333-3333-4333-8333-333333333333', name: 'Cal' };

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const emitAck = <T>(socket: Socket, event: string, payload: unknown) =>
  new Promise<Ack<T>>((resolve) => socket.emit(event, payload, resolve));

export const join = (socket: Socket, boardId: string, user = ANA) =>
  emitAck<JoinBoardAck>(socket, 'board:join', { boardId, user });

// Collects what a socket receives for an event, so a test can look at it later.
export const record = <T>(socket: Socket, event: string) => {
  const received: T[] = [];
  socket.on(event, (payload: T) => received.push(payload));
  return received;
};

// Starts the whole app on a free port, with helpers to connect socket clients to it.
export async function startTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0);
  const server = app.getHttpServer() as Server;
  const url = `http://localhost:${(server.address() as AddressInfo).port}`;

  const sockets: Socket[] = [];
  const connect = async (): Promise<Socket> => {
    const socket = io(url, { transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    return socket;
  };
  const close = async () => {
    sockets.forEach((s) => s.close());
    await app.close();
  };

  return { boards: app.get(BoardsService), connect, close };
}
