import { randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io-client';
import { BoardsService } from './../src/boards/boards.service';
import type {
  ObjectAddedPayload,
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

const base = () => ({
  id: randomUUID(),
  x: 10,
  y: 20,
  stroke: '#1B2230',
  strokeWidth: 2,
});
const rect = () => ({ ...base(), type: 'rect', width: 100, height: 50 });

const SHAPES: [string, () => Record<string, unknown>][] = [
  ['pen', () => ({ ...base(), type: 'pen', points: [{ x: 1, y: 2 }] })],
  ['rect', rect],
  ['circle', () => ({ ...base(), type: 'circle', width: 40, height: 40 })],
  ['arrow', () => ({ ...base(), type: 'arrow', dx: 30, dy: -10 })],
  [
    'text',
    () => ({
      ...base(),
      type: 'text',
      text: 'Hello',
      fontSize: 20,
      fill: '#CBE7EA',
    }),
  ],
];

describe('BoardsGateway object:add (e2e)', () => {
  let boards: BoardsService;
  let connect: () => Promise<Socket>;
  let close: () => Promise<void>;
  let boardId: string;

  const add = (socket: Socket, object: unknown) =>
    emitAck<VersionAck>(socket, 'object:add', { object });
  const savedShapes = () => boards.getSnapshot(boardId).objects;

  const joined = async (user = ANA, board = boardId) => {
    const socket = await connect();
    await join(socket, board, user);
    return socket;
  };

  beforeEach(async () => {
    ({ boards, connect, close } = await startTestApp());
    boardId = boards.createBoard();
  });

  afterEach(async () => {
    await close();
  });

  it('saves the shape and replies with version 1', async () => {
    const ana = await joined();
    const shape = rect();

    const res = await add(ana, shape);

    expect(res).toEqual({ ok: true, data: { version: 1 } });
    expect(savedShapes().map((o) => o.id)).toEqual([shape.id]);
  });

  it('takes the author from the connection, not from the browser', async () => {
    const ana = await joined(ANA);
    await add(ana, rect());

    expect(savedShapes()[0].authorId).toBe(ANA.id);
  });

  it.each(SHAPES)('accepts a %s', async (_type, make) => {
    const ana = await joined();

    const res = await add(ana, make());

    expect(res.ok).toBe(true);
  });

  it('sends object:added with the saved shape to the others, not the sender', async () => {
    const ana = await joined(ANA);
    const ben = await joined(BEN);
    const seenByAna = record<ObjectAddedPayload>(ana, 'object:added');
    const seenByBen = record<ObjectAddedPayload>(ben, 'object:added');
    const shape = rect();

    await add(ana, shape);
    await sleep(100);

    expect(seenByAna).toHaveLength(0);
    expect(seenByBen).toHaveLength(1);
    expect(seenByBen[0].object).toMatchObject({
      id: shape.id,
      type: 'rect',
      authorId: ANA.id,
      version: 1,
    });
  });

  it('does not send it to people on other boards', async () => {
    const ana = await joined(ANA);
    const cal = await joined(CAL, boards.createBoard());
    const seenByCal = record(cal, 'object:added');

    await add(ana, rect());
    await sleep(100);

    expect(seenByCal).toHaveLength(0);
  });

  it('replies NOT_JOINED when the connection has not joined a board', async () => {
    const stranger = await connect();

    const res = await add(stranger, rect());

    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_JOINED' } });
    expect(savedShapes()).toHaveLength(0);
  });

  it.each<[string, () => unknown]>([
    ['an author chosen by the browser', () => ({ ...rect(), authorId: 'x' })],
    ['a version chosen by the browser', () => ({ ...rect(), version: 9 })],
    ['an unknown shape type', () => ({ ...rect(), type: 'star' })],
    ['a missing field', () => ({ ...base(), type: 'rect', width: 100 })],
    ['an id that is not a UUID', () => ({ ...rect(), id: 'o1' })],
    ['a colour that is not a hex code', () => ({ ...rect(), stroke: 'red' })],
    ['a field the shape type does not have', () => ({ ...rect(), dx: 5 })],
    ['a negative width', () => ({ ...rect(), width: -1 })],
    ['a number that is out of range', () => ({ ...rect(), x: 1e9 })],
    [
      'text that is too long',
      () => ({
        ...base(),
        type: 'text',
        text: 'x'.repeat(LIMITS.textMaxLength + 1),
        fontSize: 20,
      }),
    ],
    ['a pen with no points', () => ({ ...base(), type: 'pen', points: [] })],
    [
      'a pen with too many points',
      () => ({
        ...base(),
        type: 'pen',
        points: Array.from({ length: LIMITS.penMaxPoints + 1 }, () => ({
          x: 0,
          y: 0,
        })),
      }),
    ],
    ['no shape at all', () => undefined],
  ])('replies VALIDATION_FAILED for %s', async (_label, make) => {
    const ana = await joined(ANA);
    const ben = await joined(BEN);
    const seenByBen = record(ben, 'object:added');

    const res = await add(ana, make());
    await sleep(100);

    expect(res).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(savedShapes()).toHaveLength(0);
    expect(seenByBen).toHaveLength(0);
    expect(ana.connected).toBe(true);
  });

  it('replies DUPLICATE_OBJECT for an id already on the board', async () => {
    const ana = await joined(ANA);
    const ben = await joined(BEN);
    const seenByBen = record(ben, 'object:added');
    const shape = rect();
    await add(ana, shape);

    const res = await add(ben, shape);
    await sleep(100);

    expect(res).toMatchObject({
      ok: false,
      error: { code: 'DUPLICATE_OBJECT' },
    });
    expect(savedShapes()).toHaveLength(1);
    expect(seenByBen).toHaveLength(1); // only the first add was announced
  });

  it('replies BOARD_FULL when the board has reached the object limit', async () => {
    for (let i = 0; i < LIMITS.maxObjectsPerBoard; i++) {
      boards.addObject(boardId, ANA.id, {
        id: `o${i}`,
        type: 'rect',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        stroke: '#000000',
        strokeWidth: 1,
      });
    }
    const ana = await joined(ANA);

    const res = await add(ana, rect());

    expect(res).toMatchObject({ ok: false, error: { code: 'BOARD_FULL' } });
    expect(savedShapes()).toHaveLength(LIMITS.maxObjectsPerBoard);
  });

  it('keeps working after an error', async () => {
    const ana = await joined(ANA);
    await add(ana, { ...rect(), type: 'star' });

    const res = await add(ana, rect());

    expect(res.ok).toBe(true);
    expect(savedShapes()).toHaveLength(1);
  });
});
