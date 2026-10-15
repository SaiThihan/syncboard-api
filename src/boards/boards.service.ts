import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppError } from '../common/errors/errors';
import { LIMITS } from '../common/limits/limits';
import { PresenceService } from '../presence/presence.service';
import type {
  BoardSnapshot,
  BoardState,
  DrawingObject,
  NewObject,
  ObjectPatch,
  User,
} from './types/boards.types';

const ID_RETRIES = 5;

// Fields a client may change. Never `id`, `type`, `authorId` or `version`.
const COMMON_FIELDS = ['x', 'y', 'stroke', 'strokeWidth', 'fill'];
const PATCH_FIELDS: Record<DrawingObject['type'], string[]> = {
  pen: COMMON_FIELDS,
  rect: [...COMMON_FIELDS, 'width', 'height'],
  circle: [...COMMON_FIELDS, 'width', 'height'],
  arrow: [...COMMON_FIELDS, 'dx', 'dy'],
  text: [...COMMON_FIELDS, 'text', 'fontSize'],
};

@Injectable()
export class BoardsService implements OnModuleInit, OnModuleDestroy {
  protected readonly boards = new Map<string, BoardState>();
  private sweepTimer?: NodeJS.Timeout;

  constructor(private readonly presence: PresenceService) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(
      () => this.deleteExpiredBoards(),
      LIMITS.sweepIntervalMs,
    );
    this.sweepTimer.unref(); // this timer alone should not keep the process alive
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  createBoard(): string {
    if (this.boards.size >= LIMITS.maxBoards) {
      throw new AppError('BOARD_LIMIT');
    }

    let id = '';
    for (let i = 0; i < ID_RETRIES; i++) {
      const candidate = randomBytes(6).toString('base64url'); // 6 bytes = 8 characters
      if (!this.boards.has(candidate)) {
        id = candidate;
        break;
      }
    }
    if (!id) throw new AppError('INTERNAL');

    this.boards.set(id, {
      id,
      createdAt: Date.now(),
      emptySince: Date.now(), // nobody has joined yet
      objects: new Map(),
    });
    return id;
  }

  getBoard(id: string): BoardState {
    const board = this.boards.get(id);
    if (!board) throw new AppError('BOARD_NOT_FOUND');
    return board;
  }

  // The board only knows its objects; `join` adds `users` from presence.
  getSnapshot(id: string): Omit<BoardSnapshot, 'users'> {
    const board = this.getBoard(id);
    return { id: board.id, objects: [...board.objects.values()] };
  }

  addObject(boardId: string, userId: string, object: NewObject): DrawingObject {
    const board = this.getBoard(boardId);
    if (board.objects.size >= LIMITS.maxObjectsPerBoard) {
      throw new AppError('BOARD_FULL');
    }
    if (board.objects.has(object.id)) {
      throw new AppError('DUPLICATE_OBJECT');
    }
    if (
      object.type === 'pen' &&
      this.countPenPoints(board) + object.points.length >
        LIMITS.maxPenPointsPerBoard
    ) {
      throw new AppError('BOARD_FULL');
    }
    // The server decides the author and version, so these override anything the client sent.
    const saved: DrawingObject = { ...object, authorId: userId, version: 1 };
    board.objects.set(saved.id, saved);
    return saved;
  }

  // Counted when a stroke is added, so there is no number to keep in step with deletes.
  // ponytail: walks every shape (at most maxObjectsPerBoard); keep a running total if that gets slow
  private countPenPoints(board: BoardState): number {
    let total = 0;
    for (const object of board.objects.values()) {
      if (object.type === 'pen') total += object.points.length;
    }
    return total;
  }

  updateObject(
    boardId: string,
    objectId: string,
    patch: ObjectPatch,
  ): DrawingObject {
    const board = this.getBoard(boardId);
    const existing = board.objects.get(objectId);
    if (!existing) throw new AppError('OBJECT_NOT_FOUND');

    const fields = Object.keys(patch);
    const allowed = PATCH_FIELDS[existing.type];
    if (fields.length === 0 || fields.some((f) => !allowed.includes(f))) {
      throw new AppError('VALIDATION_FAILED');
    }

    // The server raises the version; replacing an existing key keeps the drawing order.
    const updated = {
      ...existing,
      ...patch,
      version: existing.version + 1,
    } as DrawingObject;
    board.objects.set(objectId, updated);
    return updated;
  }

  deleteObject(boardId: string, objectId: string): void {
    const board = this.getBoard(boardId);
    if (!board.objects.delete(objectId)) {
      throw new AppError('OBJECT_NOT_FOUND');
    }
  }

  // Registers a connection on a board and starts or stops the empty-board timer.
  // `isFirstSocket` is false when the same user is already on the board in another tab.
  join(
    socketId: string,
    boardId: string,
    who: { id: string; name: string },
  ): { user: User; isFirstSocket: boolean; board: BoardSnapshot } {
    if (this.presence.getBySocket(socketId)) {
      throw new AppError('ALREADY_JOINED');
    }
    this.getBoard(boardId); // throws BOARD_NOT_FOUND before anything is registered

    const { user, isFirstSocket } = this.presence.join(socketId, boardId, who);
    this.markOccupied(boardId);
    return {
      user,
      isFirstSocket,
      board: {
        ...this.getSnapshot(boardId),
        users: this.presence.getRoster(boardId),
      },
    };
  }

  // Removes a connection. When nobody is left on the board, its 30 minute timer starts.
  // Returns undefined for a connection that never joined a board.
  leave(
    socketId: string,
  ): { boardId: string; user: User; isLastSocket: boolean } | undefined {
    const left = this.presence.leave(socketId);
    if (left && this.presence.getRoster(left.boardId).length === 0) {
      this.markEmpty(left.boardId);
    }
    return left;
  }

  // Starts the empty-board timer. Keeps the first time if the board is already empty.
  markEmpty(boardId: string): void {
    const board = this.getBoard(boardId);
    board.emptySince ??= Date.now();
  }

  // Stops the empty-board timer.
  markOccupied(boardId: string): void {
    this.getBoard(boardId).emptySince = null;
  }

  // Deletes boards that have had nobody on them for the full TTL. Returns how many.
  deleteExpiredBoards(): number {
    const now = Date.now();
    let deleted = 0;
    for (const [id, board] of this.boards) {
      const expired =
        board.emptySince !== null &&
        now - board.emptySince >= LIMITS.emptyBoardTtlMs;
      if (expired) {
        this.boards.delete(id);
        deleted++;
      }
    }
    return deleted;
  }
}
