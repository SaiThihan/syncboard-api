import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppError } from '../common/errors/errors';
import { LIMITS } from '../common/limits/limits';
import type { BoardSnapshot, BoardState } from './types/boards.types';

const ID_RETRIES = 5;

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
}
