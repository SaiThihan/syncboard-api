import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io-client';
import { BoardsService } from './../src/boards/boards.service';
import type { Ack } from './../src/common/acknowledgements/ack';
import { ANA, emitAck, join, sleep, startTestApp } from './helpers/socket-app';

const EVENTS = ['board:join', 'object:add', 'object:update', 'object:delete'];
const ODD_PAYLOADS: [string, unknown][] = [
  ['a string', 'hello'],
  ['null', null],
  ['a number', 42],
  ['a list', [1, 2]],
  ['an empty object', {}],
];

describe('BoardsGateway odd input (e2e)', () => {
  let boards: BoardsService;
  let connect: () => Promise<Socket>;
  let close: () => Promise<void>;
  let ana: Socket;

  beforeEach(async () => {
    ({ boards, connect, close } = await startTestApp());
    ana = await connect();
    await join(ana, boards.createBoard(), ANA);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await close();
  });

  describe.each(EVENTS)('%s', (event) => {
    it.each(ODD_PAYLOADS)(
      'replies VALIDATION_FAILED when the payload is %s',
      async (_name, payload) => {
        // a joined connection joining again would be ALREADY_JOINED, so use a fresh one
        const socket = event === 'board:join' ? await connect() : ana;

        const res = await emitAck<unknown>(socket, event, payload);

        expect(res).toMatchObject({
          ok: false,
          error: { code: 'VALIDATION_FAILED' },
        });
      },
    );

    it('replies VALIDATION_FAILED when there is no payload, only the ack', async () => {
      const socket = event === 'board:join' ? await connect() : ana;

      const res = await new Promise<Ack<unknown>>((resolve) =>
        socket.emit(event, resolve),
      );

      expect(res).toMatchObject({
        ok: false,
        error: { code: 'VALIDATION_FAILED' },
      });
    });
  });

  it('keeps working after a run of bad messages', async () => {
    for (const [, payload] of ODD_PAYLOADS) {
      await emitAck<unknown>(ana, 'object:add', payload);
    }

    const res = await emitAck<unknown>(ana, 'object:add', {
      object: {
        id: randomUUID(),
        type: 'rect',
        x: 1,
        y: 2,
        width: 10,
        height: 10,
        stroke: '#1B2230',
        strokeWidth: 2,
      },
    });

    expect(res).toEqual({ ok: true, data: { version: 1 } });
  });

  it('replies INTERNAL without details when something unexpected breaks, and keeps working', async () => {
    const logged = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(boards, 'addObject').mockImplementationOnce(() => {
      throw new Error('secret connection string');
    });
    const object = {
      id: randomUUID(),
      type: 'rect',
      x: 1,
      y: 2,
      width: 10,
      height: 10,
      stroke: '#1B2230',
      strokeWidth: 2,
    };

    const broken = await emitAck<unknown>(ana, 'object:add', { object });
    const next = await emitAck<unknown>(ana, 'object:add', { object });

    expect(broken).toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: 'INTERNAL' },
    });
    expect(logged).toHaveBeenCalledTimes(1);
    expect(next).toEqual({ ok: true, data: { version: 1 } });
  });

  it('ignores an event name it does not know and keeps working', async () => {
    ana.emit('object:nope', { a: 1 });
    await sleep(100);

    const res = await emitAck<unknown>(ana, 'object:delete', { id: 'x' });

    expect(res).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
  });
});
