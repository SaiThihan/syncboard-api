import { Injectable } from '@nestjs/common';
import type { User } from '../boards/boards.types';

export interface PresenceEntry {
  user: User;
  sockets: Set<string>;
}

@Injectable()
export class PresenceService {
  // Behavior arrives in a later implementation step.
  protected readonly bySocket = new Map<
    string,
    { boardId: string; user: User }
  >();
  protected readonly byBoard = new Map<string, Map<string, PresenceEntry>>();
}
