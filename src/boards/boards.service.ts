import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppError } from '../common/errors/errors';
import { LIMITS } from '../common/limits/limits';
import type {
  BoardSnapshot,
  BoardState,
  DrawingObject,
  NewObject,
  ObjectPatch,
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
export class BoardsService {
  protected readonly boards = new Map<string, BoardState>();

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

  // The gateway adds `users` from presence; the board only knows its objects.
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
    // The server decides the author and version, so these override anything the client sent.
    const saved: DrawingObject = { ...object, authorId: userId, version: 1 };
    board.objects.set(saved.id, saved);
    return saved;
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
}
