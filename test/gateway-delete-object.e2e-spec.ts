import { randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io-client';
import { BoardsService } from './../src/boards/boards.service';
import type { ObjectDeletedPayload } from './../src/boards/events/boards.events';
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

describe('BoardsGateway object:delete (e2e)', () => {
  let boards: BoardsService;
  let connect: () => Promise<Socket>;
  let close: () => Promise<void>;
  let boardId: string;
  let ids: string[];

  const remove = (socket: Socket, payload: unknown) =>
    emitAck(socket, 'object:delete', payload);
  const remainingIds = () =>
    boards.getSnapshot(boardId).objects.map((o) => o.id);

  const joined = async (user = ANA, board = boardId) => {
    const socket = await connect();
    await join(socket, board, user);
    return socket;
  };

  beforeEach(async () => {
    ({ boards, connect, close } = await startTestApp());
    boardId = boards.createBoard();
    ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const id of ids) {
      boards.addObject(boardId, ANA.id, {
        id,
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        stroke: '#1B2230',
        strokeWidth: 2,
      });
    }
  });

  afterEach(async () => {
    await close();
  });

  it('removes the shape and replies ok', async () => {
    const ana = await joined();

    const res = await remove(ana, { id: ids[1] });

    expect(res).toEqual({ ok: true });
    expect(remainingIds()).toEqual([ids[0], ids[2]]);
  });

  it('sends object:deleted with the id to the others, not the sender', async () => {
    const ana = await joined(ANA);
    const ben = await joined(BEN);
    const seenByAna = record<ObjectDeletedPayload>(ana, 'object:deleted');
    const seenByBen = record<ObjectDeletedPayload>(ben, 'object:deleted');

    await remove(ana, { id: ids[0] });
    await sleep(100);

    expect(seenByAna).toHaveLength(0);
    expect(seenByBen).toEqual([{ id: ids[0] }]);
  });

  it('lets another user delete a shape someone else drew', async () => {
    const ben = await joined(BEN);

    const res = await remove(ben, { id: ids[0] });

    expect(res.ok).toBe(true);
    expect(remainingIds()).toEqual([ids[1], ids[2]]);
  });

  it('does not send it to people on other boards', async () => {
    const ana = await joined(ANA);
    const cal = await joined(CAL, boards.createBoard());
    const seenByCal = record(cal, 'object:deleted');

    await remove(ana, { id: ids[0] });
    await sleep(100);

    expect(seenByCal).toHaveLength(0);
  });

  it('replies NOT_JOINED when the connection has not joined a board', async () => {
    const stranger = await connect();

    const res = await remove(stranger, { id: ids[0] });

    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_JOINED' } });
    expect(remainingIds()).toHaveLength(3);
  });

  it('replies OBJECT_NOT_FOUND for a shape that does not exist, and tells nobody', async () => {
    const ana = await joined(ANA);
    const ben = await joined(BEN);
    const seenByBen = record(ben, 'object:deleted');

    const res = await remove(ana, { id: randomUUID() });
    await sleep(100);

    expect(res).toMatchObject({
      ok: false,
      error: { code: 'OBJECT_NOT_FOUND' },
    });
    expect(seenByBen).toHaveLength(0);
    expect(remainingIds()).toHaveLength(3);
  });

  it('replies OBJECT_NOT_FOUND to the second of two deletes of the same shape', async () => {
    const ana = await joined(ANA);
    const ben = await joined(BEN);
    const cal = await joined(CAL);
    const seenByCal = record(cal, 'object:deleted');

    const first = await remove(ana, { id: ids[0] });
    const second = await remove(ben, { id: ids[0] });
    await sleep(100);

    expect(first.ok).toBe(true);
    expect(second).toMatchObject({
      ok: false,
      error: { code: 'OBJECT_NOT_FOUND' },
    });
    expect(seenByCal).toHaveLength(1); // announced once
  });

  it.each<[string, unknown]>([
    ['an id that is not a UUID', { id: 'o1' }],
    ['no id', {}],
    ['an id of the wrong type', { id: 5 }],
    ['an extra field', { id: randomUUID(), force: true }],
  ])('replies VALIDATION_FAILED for %s', async (_label, payload) => {
    const ana = await joined(ANA);

    const res = await remove(ana, payload);

    expect(res).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(remainingIds()).toHaveLength(3);
    expect(ana.connected).toBe(true);
  });

  it('keeps working after an error', async () => {
    const ana = await joined();
    await remove(ana, { id: 'nope' });

    const res = await remove(ana, { id: ids[0] });

    expect(res.ok).toBe(true);
  });
});
