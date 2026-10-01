export const LIMITS = {
  nameMaxLength: 30,
  textMaxLength: 1000,
  penMaxPoints: 5000,
  maxObjectsPerBoard: 5000,
  maxBoards: 1000,
  emptyBoardTtlMs: 30 * 60 * 1000,
  maxHttpBufferSize: 1_000_000,
} as const;
