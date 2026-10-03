import { randomBytes } from 'node:crypto';
import { AppError } from '../common/errors/errors';
import { LIMITS } from '../common/limits/limits';
import { BoardsService } from './boards.service';
import type { DrawingObject } from './types/boards.types';

// Lets a test replace the random ID so we can force a collision.
jest.mock('node:crypto', () => {
  const actual =
    jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return { ...actual, randomBytes: jest.fn(actual.randomBytes) };
});
const randomBytesMock = randomBytes as unknown as jest.Mock;
const realRandomBytes =
  jest.requireActual<typeof import('node:crypto')>('node:crypto').randomBytes;

// `boards` is protected, so the test reads it through a subclass.
class TestBoardsService extends BoardsService {
  get store() {
    return this.boards;
  }
}

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as AppError).code;
  }
  return undefined;
};

describe('BoardsService.createBoard', () => {
  let service: TestBoardsService;

  beforeEach(() => {
    service = new TestBoardsService();
  });

  afterEach(() => {
    randomBytesMock.mockReset();
    randomBytesMock.mockImplementation(realRandomBytes);
  });

  it('returns an 8 character id and stores a new board', () => {
    const id = service.createBoard();

    expect(id).toHaveLength(8);
    const board = service.store.get(id);
    expect(board?.id).toBe(id);
    expect(board?.createdAt).toBeLessThanOrEqual(Date.now());
    expect(board?.emptySince).toEqual(expect.any(Number)); // nobody has joined yet
    expect(board?.objects.size).toBe(0);
  });

  it('gives different ids to different boards', () => {
    expect(service.createBoard()).not.toBe(service.createBoard());
  });

  it('tries again when the random id is already taken', () => {
    const taken = Buffer.from('aaaaaa'); // base64url: YWFhYWFh
    const free = Buffer.from('bbbbbb'); // base64url: YmJiYmJi
    randomBytesMock
      .mockReturnValueOnce(taken)
      .mockReturnValueOnce(taken)
      .mockReturnValueOnce(free);

    const first = service.createBoard();
    const second = service.createBoard();

    expect(first).toBe('YWFhYWFh');
    expect(second).toBe('YmJiYmJi'); // the retry skipped the taken id
    expect(service.store.size).toBe(2);
  });

  it('throws INTERNAL when every retry collides', () => {
    randomBytesMock.mockReturnValue(Buffer.from('aaaaaa'));
    service.createBoard(); // takes the id

    expect(codeOf(() => service.createBoard())).toBe('INTERNAL');
    expect(service.store.size).toBe(1);
  });

  it('throws BOARD_LIMIT when the board limit is reached', () => {
    for (let i = 0; i < LIMITS.maxBoards; i++) service.createBoard();

    expect(codeOf(() => service.createBoard())).toBe('BOARD_LIMIT');
    expect(service.store.size).toBe(LIMITS.maxBoards);
  });
});

describe('BoardsService.getBoard', () => {
  let service: TestBoardsService;

  beforeEach(() => {
    service = new TestBoardsService();
  });

  afterEach(() => {
    randomBytesMock.mockReset();
    randomBytesMock.mockImplementation(realRandomBytes);
  });

  it('returns the board when it exists', () => {
    const id = service.createBoard();

    const board = service.getBoard(id);

    expect(board).toBe(service.store.get(id));
    expect(board.id).toBe(id);
  });

  it('throws BOARD_NOT_FOUND when the board does not exist', () => {
    expect(codeOf(() => service.getBoard('doesnotexist'))).toBe(
      'BOARD_NOT_FOUND',
    );
  });

  it('treats ids as case sensitive', () => {
    randomBytesMock.mockReturnValueOnce(Buffer.from('aaaaaa')); // id: YWFhYWFh
    const id = service.createBoard();

    expect(id).toBe('YWFhYWFh');
    expect(codeOf(() => service.getBoard(id.toLowerCase()))).toBe(
      'BOARD_NOT_FOUND',
    );
  });
});

const rect = (id: string): DrawingObject => ({
  id,
  type: 'rect',
  authorId: 'u1',
  x: 0,
  y: 0,
  stroke: '#000000',
  strokeWidth: 2,
  version: 1,
  width: 10,
  height: 10,
});

describe('BoardsService.getSnapshot', () => {
  let service: TestBoardsService;

  beforeEach(() => {
    service = new TestBoardsService();
  });

  it('returns the board id and its objects as a list in drawing order', () => {
    const id = service.createBoard();
    const objects = service.getBoard(id).objects;
    objects.set('first', rect('first'));
    objects.set('second', rect('second'));

    const snapshot = service.getSnapshot(id);

    expect(snapshot.id).toBe(id);
    expect(snapshot.objects.map((o) => o.id)).toEqual(['first', 'second']);
  });

  it('returns an empty list for a board with no objects', () => {
    const id = service.createBoard();

    expect(service.getSnapshot(id).objects).toEqual([]);
  });

  it('returns a copy, so changing it does not change the board', () => {
    const id = service.createBoard();
    service.getBoard(id).objects.set('first', rect('first'));

    service.getSnapshot(id).objects.pop();

    expect(service.getBoard(id).objects.size).toBe(1);
  });

  it('throws BOARD_NOT_FOUND when the board does not exist', () => {
    expect(codeOf(() => service.getSnapshot('doesnotexist'))).toBe(
      'BOARD_NOT_FOUND',
    );
  });
});
