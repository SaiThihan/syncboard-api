import type {
  BoardSnapshot,
  DrawingObject,
  ObjectPatch,
  User,
} from '../types/boards.types';

export const ClientEvent = {
  BoardJoin: 'board:join',
  ObjectAdd: 'object:add',
  ObjectUpdate: 'object:update',
  ObjectDelete: 'object:delete',
  CursorMove: 'cursor:move',
} as const;

export const ServerEvent = {
  ObjectAdded: 'object:added',
  ObjectUpdated: 'object:updated',
  ObjectDeleted: 'object:deleted',
  PresenceJoined: 'presence:joined',
  PresenceLeft: 'presence:left',
  CursorMoved: 'cursor:moved',
} as const;

// ack data
export interface JoinBoardAck {
  board: BoardSnapshot;
  me: User;
}
export interface VersionAck {
  version: number;
}

// server -> client payloads
export interface ObjectAddedPayload {
  object: DrawingObject;
}
export interface ObjectUpdatedPayload {
  id: string;
  patch: ObjectPatch;
  version: number;
}
export interface ObjectDeletedPayload {
  id: string;
}
export interface PresenceJoinedPayload {
  user: User;
}
export interface PresenceLeftPayload {
  userId: string;
}
export interface CursorMovedPayload {
  userId: string;
  x: number;
  y: number;
}
