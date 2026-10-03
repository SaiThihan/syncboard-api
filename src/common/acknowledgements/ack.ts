import type { ErrorCode } from '../errors/errors';

export type Ack<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };

export const ok = <T>(data: T): Ack<T> => ({ ok: true, data });

export const fail = (code: ErrorCode, message: string = code): Ack<never> => ({
  ok: false,
  error: { code, message },
});
