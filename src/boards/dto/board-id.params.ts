import { Matches } from 'class-validator';

// Board ids are 8 base64url characters.
export const BOARD_ID_PATTERN = /^[A-Za-z0-9_-]{8}$/;
export const BOARD_ID_MESSAGE = 'id must be an 8 character board id';

// The :id in /boards/:id.
export class BoardIdParams {
  @Matches(BOARD_ID_PATTERN, { message: BOARD_ID_MESSAGE })
  id: string;
}
