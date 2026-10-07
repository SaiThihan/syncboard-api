import { BoardsService } from './../src/boards/boards.service';
import type { PresenceLeftPayload } from './../src/boards/events/boards.events';
import {
  ANA,
  BEN,
  join,
  record,
  sleep,
  startTestApp,
} from './helpers/socket-app';

describe('BoardsGateway disconnect (e2e)', () => {
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

  it('tells the others when a user closes their only connection', async () => {
    const ana = await connect();
    await join(ana, boardId, ANA);
    const seenByAna = record<PresenceLeftPayload>(ana, 'presence:left');
    const ben = await connect();
    await join(ben, boardId, BEN);

    ben.close();
    await sleep(100);

    expect(seenByAna).toEqual([{ userId: BEN.id }]);
  });

  it('says nothing while the user still has another connection open', async () => {
    const ana = await connect();
    await join(ana, boardId, ANA);
    const seenByAna = record<PresenceLeftPayload>(ana, 'presence:left');
    const ben1 = await connect();
    const ben2 = await connect();
    await join(ben1, boardId, BEN);
    await join(ben2, boardId, BEN);

    ben1.close();
    await sleep(100);
    expect(seenByAna).toHaveLength(0);

    ben2.close();
    await sleep(100);
    expect(seenByAna).toEqual([{ userId: BEN.id }]);
  });

  it('removes the user from the list a new joiner receives', async () => {
    const ana = await connect();
    await join(ana, boardId, ANA);
    const ben = await connect();
    await join(ben, boardId, BEN);
    ben.close();
    await sleep(100);

    const cal = await connect();
    const res = await join(cal, boardId);

    if (!res.ok) throw new Error('join failed');
    expect(res.data.board.users.map((u) => u.name)).toEqual(['Ana']);
  });

  it('starts the empty timer when the last user leaves, and cancels it on rejoin', async () => {
    const ana = await connect();
    await join(ana, boardId, ANA);
    expect(boards.getBoard(boardId).emptySince).toBeNull();

    ana.close();
    await sleep(100);
    expect(boards.getBoard(boardId).emptySince).not.toBeNull();

    const again = await connect();
    await join(again, boardId, ANA);
    expect(boards.getBoard(boardId).emptySince).toBeNull();
  });

  it('keeps the board occupied while someone is still on it', async () => {
    const ana = await connect();
    await join(ana, boardId, ANA);
    const ben = await connect();
    await join(ben, boardId, BEN);

    ben.close();
    await sleep(100);

    expect(boards.getBoard(boardId).emptySince).toBeNull();
  });

  it('ignores a connection that never joined a board', async () => {
    const ana = await connect();
    await join(ana, boardId, ANA);
    const seenByAna = record<PresenceLeftPayload>(ana, 'presence:left');
    const stranger = await connect();

    stranger.close();
    await sleep(100);

    expect(seenByAna).toHaveLength(0);
    expect(boards.getBoard(boardId).emptySince).toBeNull();
  });
});
