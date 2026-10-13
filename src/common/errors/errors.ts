export type ErrorCode =
  | 'NOT_FOUND'
  | 'BOARD_NOT_FOUND'
  | 'NOT_JOINED'
  | 'ALREADY_JOINED'
  | 'VALIDATION_FAILED'
  | 'OBJECT_NOT_FOUND'
  | 'DUPLICATE_OBJECT'
  | 'BOARD_FULL'
  | 'BOARD_LIMIT'
  | 'INTERNAL';

// How each error code is reported over HTTP (REST).
export const HTTP_STATUS: Record<ErrorCode, number> = {
  NOT_FOUND: 404,
  BOARD_NOT_FOUND: 404,
  OBJECT_NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  NOT_JOINED: 403,
  ALREADY_JOINED: 409,
  DUPLICATE_OBJECT: 409,
  BOARD_FULL: 409,
  BOARD_LIMIT: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}
