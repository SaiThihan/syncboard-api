import { Injectable } from '@nestjs/common';
import type { User } from '../boards/types/boards.types';

export interface PresenceEntry {
  user: User;
  sockets: Set<string>; // one user can have several connections (tabs)
}

// Colours handed out to users on a board, one each until they run out.
const COLORS = [
  '#2E7D52',
  '#8A5A00',
  '#B33A4C',
  '#19717F',
  '#1F5FA8',
  '#7A4A2B',
  '#4B5563',
  '#A0522D',
];

@Injectable()
export class PresenceService {
  protected readonly bySocket = new Map<
    string,
    { boardId: string; user: User }
  >();
  protected readonly byBoard = new Map<string, Map<string, PresenceEntry>>();

  // Registers a connection on a board. `isFirstSocket` is false when the same
  // user is already on the board with another connection.
  join(
    socketId: string,
    boardId: string,
    who: { id: string; name: string },
  ): { user: User; isFirstSocket: boolean } {
    const room = this.byBoard.get(boardId) ?? new Map<string, PresenceEntry>();
    this.byBoard.set(boardId, room);

    let entry = room.get(who.id);
    const isFirstSocket = !entry;
    if (!entry) {
      const user: User = {
        id: who.id,
        name: who.name,
        color: this.pickColor(room),
      };
      entry = { user, sockets: new Set() };
      room.set(who.id, entry);
    }
    entry.sockets.add(socketId);
    this.bySocket.set(socketId, { boardId, user: entry.user });
    return { user: entry.user, isFirstSocket };
  }

  getBySocket(socketId: string): { boardId: string; user: User } | undefined {
    return this.bySocket.get(socketId);
  }

  getRoster(boardId: string): User[] {
    const room = this.byBoard.get(boardId);
    return room ? [...room.values()].map((entry) => entry.user) : [];
  }

  private pickColor(room: Map<string, PresenceEntry>): string {
    const used = new Set([...room.values()].map((e) => e.user.color));
    return (
      COLORS.find((c) => !used.has(c)) ?? COLORS[room.size % COLORS.length]
    );
  }
}
