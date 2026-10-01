export type ErrorCode =
  | 'BOARD_NOT_FOUND'
  | 'NOT_JOINED'
  | 'ALREADY_JOINED'
  | 'VALIDATION_FAILED'
  | 'OBJECT_NOT_FOUND'
  | 'DUPLICATE_OBJECT'
  | 'BOARD_FULL'
  | 'BOARD_LIMIT'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}
