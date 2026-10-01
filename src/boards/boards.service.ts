import { Injectable } from '@nestjs/common';
import type { BoardState } from './boards.types';

@Injectable()
export class BoardsService {
  // Behavior arrives in the next implementation step.
  protected readonly boards = new Map<string, BoardState>();
}
