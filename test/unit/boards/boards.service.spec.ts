import { randomBytes } from 'node:crypto';
import { AppError } from '../../../src/common/errors/errors';
import { LIMITS } from '../../../src/common/limits/limits';
import { BoardsService } from '../../../src/boards/boards.service';
import type {
  DrawingObject,
  NewObject,
  ObjectPatch,
} from '../../../src/boards/types/boards.types';

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

const newRect = (id: string): NewObject => ({
  id,
  type: 'rect',
  x: 10,
  y: 20,
  stroke: '#000000',
  strokeWidth: 2,
  width: 100,
  height: 50,
});

describe('BoardsService.addObject', () => {
  let service: TestBoardsService;
  let boardId: string;

  beforeEach(() => {
    service = new TestBoardsService();
    boardId = service.createBoard();
  });

  it('saves the object with the author and version 1, and returns it', () => {
    const saved = service.addObject(boardId, 'user-a', newRect('o1'));

    expect(saved).toMatchObject({ id: 'o1', authorId: 'user-a', version: 1 });
    expect(service.getBoard(boardId).objects.get('o1')).toBe(saved);
  });

  it('ignores an author or version sent by the client', () => {
    const cheating = {
      ...newRect('o1'),
      authorId: 'someone-else',
      version: 99,
    } as NewObject;

    const saved = service.addObject(boardId, 'user-a', cheating);

    expect(saved.authorId).toBe('user-a');
    expect(saved.version).toBe(1);
  });

  it('keeps objects in the order they were added', () => {
    service.addObject(boardId, 'user-a', newRect('first'));
    service.addObject(boardId, 'user-a', newRect('second'));

    const ids = service.getSnapshot(boardId).objects.map((o) => o.id);

    expect(ids).toEqual(['first', 'second']);
  });

  it('throws DUPLICATE_OBJECT and keeps the original when the id exists', () => {
    const original = service.addObject(boardId, 'user-a', newRect('o1'));

    expect(
      codeOf(() => service.addObject(boardId, 'user-b', newRect('o1'))),
    ).toBe('DUPLICATE_OBJECT');
    expect(service.getBoard(boardId).objects.get('o1')).toBe(original);
  });

  it('throws BOARD_FULL when the board has reached the object limit', () => {
    for (let i = 0; i < LIMITS.maxObjectsPerBoard; i++) {
      service.addObject(boardId, 'user-a', newRect(`o${i}`));
    }

    expect(
      codeOf(() => service.addObject(boardId, 'user-a', newRect('extra'))),
    ).toBe('BOARD_FULL');
    expect(service.getBoard(boardId).objects.size).toBe(
      LIMITS.maxObjectsPerBoard,
    );
  });

  it('throws BOARD_NOT_FOUND when the board does not exist', () => {
    expect(
      codeOf(() => service.addObject('doesnotexist', 'user-a', newRect('o1'))),
    ).toBe('BOARD_NOT_FOUND');
  });
});

describe('BoardsService.updateObject', () => {
  let service: TestBoardsService;
  let boardId: string;

  beforeEach(() => {
    service = new TestBoardsService();
    boardId = service.createBoard();
    service.addObject(boardId, 'user-a', newRect('o1'));
  });

  it('applies the patch, raises the version and returns the shape', () => {
    const updated = service.updateObject(boardId, 'o1', { x: 150, y: 90 });

    expect(updated).toMatchObject({ id: 'o1', x: 150, y: 90, version: 2 });
    expect(service.getBoard(boardId).objects.get('o1')).toBe(updated);
  });

  it('keeps the fields that were not in the patch', () => {
    const updated = service.updateObject(boardId, 'o1', { x: 150 });

    expect(updated).toMatchObject({ y: 20, width: 100, authorId: 'user-a' });
  });

  it('raises the version on every update', () => {
    service.updateObject(boardId, 'o1', { x: 1 });
    const updated = service.updateObject(boardId, 'o1', { x: 2 });

    expect(updated.version).toBe(3);
  });

  it('lets another user change the shape without changing its author', () => {
    const updated = service.updateObject(boardId, 'o1', { x: 190 });

    expect(updated.authorId).toBe('user-a');
  });

  it('keeps the drawing order', () => {
    service.addObject(boardId, 'user-a', newRect('o2'));

    service.updateObject(boardId, 'o1', { x: 5 });

    const ids = service.getSnapshot(boardId).objects.map((o) => o.id);
    expect(ids).toEqual(['o1', 'o2']);
  });

  it.each(['id', 'type', 'authorId', 'version'])(
    'rejects a patch that changes %s',
    (field) => {
      const patch = { [field]: 'x' } as ObjectPatch;

      expect(codeOf(() => service.updateObject(boardId, 'o1', patch))).toBe(
        'VALIDATION_FAILED',
      );
      expect(service.getBoard(boardId).objects.get('o1')?.version).toBe(1);
    },
  );

  it('rejects a field the shape type does not have', () => {
    service.addObject(boardId, 'user-a', {
      id: 'a1',
      type: 'arrow',
      x: 0,
      y: 0,
      dx: 50,
      dy: 50,
      stroke: '#000000',
      strokeWidth: 2,
    });

    expect(
      codeOf(() => service.updateObject(boardId, 'a1', { width: 9 })),
    ).toBe('VALIDATION_FAILED');
  });

  it('rejects an empty patch', () => {
    expect(codeOf(() => service.updateObject(boardId, 'o1', {}))).toBe(
      'VALIDATION_FAILED',
    );
  });

  it('throws OBJECT_NOT_FOUND when the shape does not exist', () => {
    expect(codeOf(() => service.updateObject(boardId, 'nope', { x: 1 }))).toBe(
      'OBJECT_NOT_FOUND',
    );
  });

  it('throws BOARD_NOT_FOUND when the board does not exist', () => {
    expect(codeOf(() => service.updateObject('nope', 'o1', { x: 1 }))).toBe(
      'BOARD_NOT_FOUND',
    );
  });
});

describe('BoardsService.deleteObject', () => {
  let service: TestBoardsService;
  let boardId: string;

  beforeEach(() => {
    service = new TestBoardsService();
    boardId = service.createBoard();
    service.addObject(boardId, 'user-a', newRect('o1'));
    service.addObject(boardId, 'user-a', newRect('o2'));
    service.addObject(boardId, 'user-a', newRect('o3'));
  });

  it('removes the shape from the board', () => {
    service.deleteObject(boardId, 'o2');

    expect(service.getBoard(boardId).objects.has('o2')).toBe(false);
    expect(service.getBoard(boardId).objects.size).toBe(2);
  });

  it('keeps the other shapes in their drawing order', () => {
    service.deleteObject(boardId, 'o2');

    const ids = service.getSnapshot(boardId).objects.map((o) => o.id);
    expect(ids).toEqual(['o1', 'o3']);
  });

  it('throws OBJECT_NOT_FOUND when the shape does not exist', () => {
    expect(codeOf(() => service.deleteObject(boardId, 'nope'))).toBe(
      'OBJECT_NOT_FOUND',
    );
    expect(service.getBoard(boardId).objects.size).toBe(3);
  });

  it('throws OBJECT_NOT_FOUND when deleting the same shape twice', () => {
    service.deleteObject(boardId, 'o1');

    expect(codeOf(() => service.deleteObject(boardId, 'o1'))).toBe(
      'OBJECT_NOT_FOUND',
    );
  });

  it('throws BOARD_NOT_FOUND when the board does not exist', () => {
    expect(codeOf(() => service.deleteObject('nope', 'o1'))).toBe(
      'BOARD_NOT_FOUND',
    );
  });
});

describe('BoardsService empty board tracking', () => {
  let service: TestBoardsService;
  let boardId: string;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000);
    service = new TestBoardsService();
    boardId = service.createBoard();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts as empty since the board was created', () => {
    expect(service.getBoard(boardId).emptySince).toBe(1_000);
  });

  it('markOccupied clears emptySince', () => {
    service.markOccupied(boardId);

    expect(service.getBoard(boardId).emptySince).toBeNull();
  });

  it('markEmpty sets emptySince to now', () => {
    service.markOccupied(boardId);
    jest.setSystemTime(5_000);

    service.markEmpty(boardId);

    expect(service.getBoard(boardId).emptySince).toBe(5_000);
  });

  it('markEmpty keeps the first time when the board is already empty', () => {
    jest.setSystemTime(9_000);

    service.markEmpty(boardId);

    expect(service.getBoard(boardId).emptySince).toBe(1_000);
  });

  it('starts a new empty period after someone joined and left', () => {
    service.markOccupied(boardId);
    jest.setSystemTime(7_000);
    service.markEmpty(boardId);

    expect(service.getBoard(boardId).emptySince).toBe(7_000);
  });

  it('does not touch the board objects', () => {
    service.addObject(boardId, 'user-a', newRect('o1'));

    service.markOccupied(boardId);
    service.markEmpty(boardId);

    expect(service.getBoard(boardId).objects.size).toBe(1);
  });

  it('throws BOARD_NOT_FOUND when the board does not exist', () => {
    expect(codeOf(() => service.markEmpty('nope'))).toBe('BOARD_NOT_FOUND');
    expect(codeOf(() => service.markOccupied('nope'))).toBe('BOARD_NOT_FOUND');
  });
});

describe('BoardsService.deleteExpiredBoards', () => {
  const TTL = LIMITS.emptyBoardTtlMs;
  let service: TestBoardsService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    service = new TestBoardsService();
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('keeps a board that has been empty for less than the TTL', () => {
    service.createBoard();
    jest.setSystemTime(TTL - 1);

    expect(service.deleteExpiredBoards()).toBe(0);
    expect(service.store.size).toBe(1);
  });

  it('deletes a board that has been empty for exactly the TTL', () => {
    const id = service.createBoard();
    jest.setSystemTime(TTL);

    expect(service.deleteExpiredBoards()).toBe(1);
    expect(codeOf(() => service.getBoard(id))).toBe('BOARD_NOT_FOUND');
  });

  it('deletes a board and its objects after more than the TTL', () => {
    const id = service.createBoard();
    service.addObject(id, 'user-a', newRect('o1'));
    jest.setSystemTime(TTL + 1);

    service.deleteExpiredBoards();

    expect(service.store.size).toBe(0);
  });

  it('never deletes a board that has people on it', () => {
    const id = service.createBoard();
    service.markOccupied(id);
    jest.setSystemTime(TTL * 10);

    expect(service.deleteExpiredBoards()).toBe(0);
    expect(service.store.size).toBe(1);
  });

  it('deletes only the expired boards and returns how many', () => {
    const busy = service.createBoard();
    service.markOccupied(busy);
    service.createBoard();
    service.createBoard();
    jest.setSystemTime(TTL);

    expect(service.deleteExpiredBoards()).toBe(2);
    expect(service.store.has(busy)).toBe(true);
  });

  it('starts a new TTL when someone joined and left again', () => {
    const id = service.createBoard();
    jest.setSystemTime(TTL - 1000);
    service.markOccupied(id);
    service.markEmpty(id); // empty again from here
    jest.setSystemTime(TTL + 1000);

    expect(service.deleteExpiredBoards()).toBe(0);
    expect(service.store.has(id)).toBe(true);
  });

  it('deletes expired boards by itself once the timer is started', () => {
    service.onModuleInit();
    service.createBoard();

    jest.advanceTimersByTime(TTL + LIMITS.sweepIntervalMs);

    expect(service.store.size).toBe(0);
  });

  it('stops sweeping after the module is destroyed', () => {
    service.onModuleInit();
    service.createBoard();
    service.onModuleDestroy();

    jest.advanceTimersByTime(TTL * 2);

    expect(service.store.size).toBe(1);
  });
});
