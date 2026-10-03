import { BoardsService } from './../src/boards/boards.service';
import type { User } from './../src/boards/types/boards.types';
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

describe('BoardsGateway board:join (e2e)', () => {
  let boards: BoardsService;
  let connect: Awaited<ReturnType<typeof startTestApp>>['connect'];
  let close: () => Promise<void>;

  beforeEach(async () => {
    ({ boards, connect, close } = await startTestApp());
  });

  afterEach(async () => {
    await close();
  });

  it('replies with the snapshot, the people on the board and who you are', async () => {
    const boardId = boards.createBoard();
    const socket = await connect();

    const res = await join(socket, boardId);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.board.id).toBe(boardId);
    expect(res.data.board.objects).toEqual([]);
    expect(res.data.board.users.map((u) => u.id)).toEqual([ANA.id]);
    expect(res.data.me).toMatchObject({ id: ANA.id, name: 'Ana' });
    expect(res.data.me.color).toMatch(/^#/);
  });

  it('includes the shapes already on the board, in drawing order', async () => {
    const boardId = boards.createBoard();
    for (const id of ['first', 'second']) {
      boards.addObject(boardId, ANA.id, {
        id,
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        stroke: '#000000',
        strokeWidth: 2,
      });
    }
    const socket = await connect();

    const res = await join(socket, boardId);

    if (!res.ok) throw new Error('join failed');
    expect(res.data.board.objects.map((o) => o.id)).toEqual([
      'first',
      'second',
    ]);
  });

  it('tells the people already on the board that someone joined', async () => {
    const boardId = boards.createBoard();
    const ana = await connect();
    await join(ana, boardId, ANA);
    const seenByAna = record<{ user: User }>(ana, 'presence:joined');

    const ben = await connect();
    await join(ben, boardId, BEN);
    await sleep(100);

    expect(seenByAna).toHaveLength(1);
    expect(seenByAna[0].user).toMatchObject({ id: BEN.id, name: 'Ben' });
  });

  it('does not tell the joiner about their own join', async () => {
    const boardId = boards.createBoard();
    const ana = await connect();
    const seenByAna = record(ana, 'presence:joined');

    await join(ana, boardId, ANA);
    await sleep(100);

    expect(seenByAna).toHaveLength(0);
  });

  it('does not tell people on other boards', async () => {
    const boardA = boards.createBoard();
    const boardB = boards.createBoard();
    const ana = await connect();
    await join(ana, boardA, ANA);
    const seenByAna = record(ana, 'presence:joined');

    const cal = await connect();
    await join(cal, boardB, CAL);
    await sleep(100);

    expect(seenByAna).toHaveLength(0);
  });

  it('does not announce a second connection of the same user', async () => {
    const boardId = boards.createBoard();
    const ana = await connect();
    await join(ana, boardId, ANA);
    const ben1 = await connect();
    await join(ben1, boardId, BEN);
    const seenByAna = record(ana, 'presence:joined');

    const ben2 = await connect();
    const res = await join(ben2, boardId, BEN);
    await sleep(100);

    expect(seenByAna).toHaveLength(0);
    if (!res.ok) throw new Error('join failed');
    expect(res.data.board.users).toHaveLength(2);
  });

  it('marks the board as occupied', async () => {
    const boardId = boards.createBoard();
    expect(boards.getBoard(boardId).emptySince).not.toBeNull();

    await join(await connect(), boardId);

    expect(boards.getBoard(boardId).emptySince).toBeNull();
  });

  it('replies BOARD_NOT_FOUND for a board that does not exist and stays connected', async () => {
    const socket = await connect();

    const res = await join(socket, 'AAAAAAAA');

    expect(res).toMatchObject({
      ok: false,
      error: { code: 'BOARD_NOT_FOUND' },
    });
    expect(socket.connected).toBe(true);
  });

  it('can still join a real board after a failed join', async () => {
    const boardId = boards.createBoard();
    const socket = await connect();
    await join(socket, 'AAAAAAAA');

    const res = await join(socket, boardId);

    expect(res.ok).toBe(true);
  });

  it('replies ALREADY_JOINED when the same connection joins twice', async () => {
    const boardId = boards.createBoard();
    const socket = await connect();
    await join(socket, boardId);

    const res = await join(socket, boardId);

    expect(res).toMatchObject({ ok: false, error: { code: 'ALREADY_JOINED' } });
  });

  it.each([
    ['a badly formed board id', { boardId: 'abc', user: ANA }],
    [
      'a user id that is not a UUID',
      { boardId: 'AAAAAAAA', user: { id: 'x', name: 'Ana' } },
    ],
    [
      'an empty name',
      { boardId: 'AAAAAAAA', user: { id: ANA.id, name: '   ' } },
    ],
    [
      'a name that is too long',
      { boardId: 'AAAAAAAA', user: { id: ANA.id, name: 'x'.repeat(31) } },
    ],
    ['a missing user', { boardId: 'AAAAAAAA' }],
    ['an unknown extra field', { boardId: 'AAAAAAAA', user: ANA, admin: true }],
  ])('replies VALIDATION_FAILED for %s', async (_label, payload) => {
    const socket = await connect();

    const res = await emitAck(socket, 'board:join', payload);

    expect(res).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(socket.connected).toBe(true);
  });
});
