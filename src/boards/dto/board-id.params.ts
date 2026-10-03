import { Matches } from 'class-validator';

// The :id in /boards/:id. Board ids are 8 base64url characters.
export class BoardIdParams {
  @Matches(/^[A-Za-z0-9_-]{8}$/, {
    message: 'id must be an 8 character board id',
  })
  id: string;
}
