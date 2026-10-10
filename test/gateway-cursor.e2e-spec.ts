import { BoardsService } from './../src/boards/boards.service';
import type { CursorMovedPayload } from './../src/boards/events/boards.events';
import { LIMITS } from './../src/common/limits/limits';
import {
  ANA,
  BEN,
  CAL,
  join,
  record,
  sleep,
  startTestApp,
} from './helpers/socket-app';

describe('BoardsGateway cursor:move (e2e)', () => {
  let boards: BoardsService;
  let connect: Awaited<ReturnType<typeof startTestApp>>['connect'];
  let close: () => Promise<void>;
  let boardId: string;

  beforeEach(async () => {
    ({ boards, connect, close } = await startTestApp());
    boardId = boards.createBoard();
  });

  afterEach(async () => {
    await close();
  });

  it('sends cursor:moved with the user id and position to the others, not the sender', async () => {
    const ana = await connect();
    const ben = await connect();
    await join(ana, boardId, ANA);
    await join(ben, boardId, BEN);
    const seenByAna = record<CursorMovedPayload>(ana, 'cursor:moved');
    const seenByBen = record<CursorMovedPayload>(ben, 'cursor:moved');

    ana.emit('cursor:move', { x: 120, y: 80 });
    await sleep(100);

    expect(seenByAna).toHaveLength(0);
    expect(seenByBen).toEqual([{ userId: ANA.id, x: 120, y: 80 }]);
  });

  it('does not send it to people on other boards', async () => {
    const ana = await connect();
    const cal = await connect();
    await join(ana, boardId, ANA);
    await join(cal, boards.createBoard(), CAL);
    const seenByCal = record(cal, 'cursor:moved');

    ana.emit('cursor:move', { x: 1, y: 2 });
    await sleep(100);

    expect(seenByCal).toHaveLength(0);
  });

  it('does not store the cursor on the board', async () => {
    const ana = await connect();
    await join(ana, boardId, ANA);

    ana.emit('cursor:move', { x: 120, y: 80 });
    await sleep(100);

    expect(boards.getSnapshot(boardId).objects).toEqual([]);
  });

  it('ignores a cursor from a connection that has not joined a board', async () => {
    const ben = await connect();
    await join(ben, boardId, BEN);
    const seenByBen = record(ben, 'cursor:moved');
    const stranger = await connect();

    stranger.emit('cursor:move', { x: 1, y: 2 });
    await sleep(100);

    expect(seenByBen).toHaveLength(0);
  });

  it.each([
    ['a text value', { x: 'abc', y: 5 }],
    ['a missing value', { x: 5 }],
    ['a value outside the board', { x: 5, y: LIMITS.coordinateMax + 1 }],
    ['an unknown field', { x: 5, y: 5, userId: 'someone-else' }],
  ])('does not forward %s', async (_name, payload) => {
    const ana = await connect();
    const ben = await connect();
    await join(ana, boardId, ANA);
    await join(ben, boardId, BEN);
    const seenByBen = record(ben, 'cursor:moved');

    ana.emit('cursor:move', payload);
    await sleep(100);

    expect(seenByBen).toHaveLength(0);
  });

  it('keeps working after a bad cursor message', async () => {
    const ana = await connect();
    const ben = await connect();
    await join(ana, boardId, ANA);
    await join(ben, boardId, BEN);
    const seenByBen = record<CursorMovedPayload>(ben, 'cursor:moved');

    ana.emit('cursor:move', { x: 'abc', y: 5 });
    ana.emit('cursor:move', { x: 7, y: 8 });
    await sleep(100);

    expect(seenByBen).toEqual([{ userId: ANA.id, x: 7, y: 8 }]);
  });
});
