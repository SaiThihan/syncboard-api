export interface Point {
  x: number;
  y: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
}

interface BaseObject {
  id: string;
  authorId: string;
  x: number;
  y: number;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  version: number;
}

export type DrawingObject =
  | (BaseObject & { type: 'pen'; points: Point[] })
  | (BaseObject & { type: 'rect'; width: number; height: number })
  | (BaseObject & { type: 'circle'; width: number; height: number })
  | (BaseObject & { type: 'arrow'; dx: number; dy: number })
  | (BaseObject & { type: 'text'; text: string; fontSize: number });

// Client sends this; the server stamps authorId and version.
export type NewObject = DistributiveOmit<DrawingObject, 'authorId' | 'version'>;

export type ObjectPatch = Partial<{
  x: number;
  y: number;
  width: number;
  height: number;
  dx: number;
  dy: number;
  text: string;
  fontSize: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
}>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export interface BoardState {
  id: string;
  createdAt: number;
  emptySince: number | null;
  objects: Map<string, DrawingObject>; // Map insertion order = z-order
}

export interface BoardSnapshot {
  id: string;
  objects: DrawingObject[];
  users: User[];
}
