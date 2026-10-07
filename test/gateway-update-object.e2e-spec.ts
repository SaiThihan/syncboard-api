import { randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io-client';
import { BoardsService } from './../src/boards/boards.service';
import type {
  ObjectUpdatedPayload,
  VersionAck,
} from './../src/boards/events/boards.events';
import { LIMITS } from './../src/common/limits/limits';
import {
  ANA,
  BEN,
  CAL,
  emitAck,
  join,
  record,
  sleep,
  startTestApp,
} from './helpers/socket-app';

describe('BoardsGateway object:update (e2e)', () => {
  let boards: BoardsService;
  let connect: () => Promise<Socket>;
  let close: () => Promise<void>;
  let boardId: string;
  let shapeId: string;
  let arrowId: string;

  const update = (socket: Socket, id: unknown, patch: unknown) =>
    emitAck<VersionAck>(socket, 'object:update', { id, patch });
  const shape = (id = shapeId) => boards.getBoard(boardId).objects.get(id);

  const joined = async (user = ANA, board = boardId) => {
    const socket = await connect();
    await join(socket, board, user);
    return socket;
  };

  beforeEach(async () => {
    ({ boards, connect, close } = await startTestApp());
    boardId = boards.createBoard();
    shapeId = randomUUID();
    arrowId = randomUUID();
    boards.addObject(boardId, ANA.id, {
      id: shapeId,
      type: 'rect',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      stroke: '#1B2230',
      strokeWidth: 2,
    });
    boards.addObject(boardId, ANA.id, {
      id: arrowId,
      type: 'arrow',
      x: 0,
      y: 0,
      dx: 40,
      dy: 40,
      stroke: '#1B2230',
      strokeWidth: 2,
    });
  });

  afterEach(async () => {
    await close();
  });

  it('applies the patch and replies with the next version', async () => {
    const ana = await joined();

    const res = await update(ana, shapeId, { x: 150, y: 90 });

    expect(res).toEqual({ ok: true, data: { version: 2 } });
    expect(shape()).toMatchObject({ x: 150, y: 90, width: 100, version: 2 });
  });

  it('raises the version on every update', async () => {
    const ana = await joined();
    await update(ana, shapeId, { x: 1 });

    const res = await update(ana, shapeId, { x: 2 });

    expect(res).toEqual({ ok: true, data: { version: 3 } });
  });

  it('sends object:updated with only the patch and the version to the others', async () => {
    const ana = await joined(ANA);
    const ben = await joined(BEN);
    const seenByAna = record<ObjectUpdatedPayload>(ana, 'object:updated');
    const seenByBen = record<ObjectUpdatedPayload>(ben, 'object:updated');

    await update(ana, shapeId, { x: 150 });
    await sleep(100);

    expect(seenByAna).toHaveLength(0);
    expect(seenByBen).toEqual([{ id: shapeId, patch: { x: 150 }, version: 2 }]);
  });

  it('lets another user change a shape without changing its author', async () => {
    const ben = await joined(BEN);

    const res = await update(ben, shapeId, { x: 190 });

    expect(res.ok).toBe(true);
    expect(shape()?.authorId).toBe(ANA.id);
  });

  it('keeps the last of two updates to the same shape and tells each user about the other', async () => {
    const ana = await joined(ANA);
    const ben = await joined(BEN);
    const seenByAna = record<ObjectUpdatedPayload>(ana, 'object:updated');
    const seenByBen = record<ObjectUpdatedPayload>(ben, 'object:updated');

    const first = await update(ben, shapeId, { x: 300 });
    const second = await update(ana, shapeId, { x: 500 });
    await sleep(100);

    expect(first).toEqual({ ok: true, data: { version: 2 } });
    expect(second).toEqual({ ok: true, data: { version: 3 } });
    expect(shape()).toMatchObject({ x: 500, version: 3 });
    expect(seenByAna).toEqual([{ id: shapeId, patch: { x: 300 }, version: 2 }]);
    expect(seenByBen).toEqual([{ id: shapeId, patch: { x: 500 }, version: 3 }]);
  });

  it('does not send it to people on other boards', async () => {
    const ana = await joined(ANA);
    const cal = await joined(CAL, boards.createBoard());
    const seenByCal = record(cal, 'object:updated');

    await update(ana, shapeId, { x: 150 });
    await sleep(100);

    expect(seenByCal).toHaveLength(0);
  });

  it('keeps the drawing order', async () => {
    const ana = await joined();

    await update(ana, shapeId, { x: 5 });

    const ids = boards.getSnapshot(boardId).objects.map((o) => o.id);
    expect(ids).toEqual([shapeId, arrowId]);
  });

  it('replies NOT_JOINED when the connection has not joined a board', async () => {
    const stranger = await connect();

    const res = await update(stranger, shapeId, { x: 150 });

    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_JOINED' } });
    expect(shape()?.version).toBe(1);
  });

  it('replies OBJECT_NOT_FOUND for a shape that does not exist, and tells nobody', async () => {
    const ana = await joined(ANA);
    const ben = await joined(BEN);
    const seenByBen = record(ben, 'object:updated');

    const res = await update(ana, randomUUID(), { x: 1 });
    await sleep(100);

    expect(res).toMatchObject({
      ok: false,
      error: { code: 'OBJECT_NOT_FOUND' },
    });
    expect(seenByBen).toHaveLength(0);
  });

  it('replies VALIDATION_FAILED for a field the shape type does not have', async () => {
    const ana = await joined();

    const res = await update(ana, arrowId, { width: 9 });

    expect(res).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
  });

  it.each<[string, unknown, unknown]>([
    ['an id that is not a UUID', 'o1', { x: 1 }],
    ['no patch', 'valid', undefined],
    ['an empty patch', 'valid', {}],
    ['a changed id', 'valid', { id: randomUUID() }],
    ['a changed type', 'valid', { type: 'circle' }],
    ['a changed author', 'valid', { authorId: 'x' }],
    ['a chosen version', 'valid', { version: 9 }],
    ['changed pen points', 'valid', { points: [] }],
    ['an unknown field', 'valid', { admin: true }],
    ['a colour that is not a hex code', 'valid', { stroke: 'red' }],
    ['a negative width', 'valid', { width: -1 }],
    ['a number that is out of range', 'valid', { x: 1e9 }],
    [
      'text that is too long',
      'valid',
      { text: 'x'.repeat(LIMITS.textMaxLength + 1) },
    ],
    ['a value of the wrong type', 'valid', { x: '10' }],
  ])('replies VALIDATION_FAILED for %s', async (_label, id, patch) => {
    const ana = await joined(ANA);
    const ben = await joined(BEN);
    const seenByBen = record(ben, 'object:updated');

    const res = await update(ana, id === 'valid' ? shapeId : id, patch);
    await sleep(100);

    expect(res).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(shape()?.version).toBe(1);
    expect(seenByBen).toHaveLength(0);
    expect(ana.connected).toBe(true);
  });

  it('keeps working after an error', async () => {
    const ana = await joined();
    await update(ana, shapeId, { admin: true });

    const res = await update(ana, shapeId, { x: 150 });

    expect(res).toEqual({ ok: true, data: { version: 2 } });
  });
});
