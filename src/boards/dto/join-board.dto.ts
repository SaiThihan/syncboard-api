import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { LIMITS } from '../../common/limits/limits';
import { BOARD_ID_MESSAGE, BOARD_ID_PATTERN } from './board-id.params';

export class JoinUserDto {
  @IsUUID()
  id: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, LIMITS.nameMaxLength)
  name: string;
}

// Payload of the `board:join` socket event.
export class JoinBoardDto {
  @Matches(BOARD_ID_PATTERN, { message: BOARD_ID_MESSAGE })
  boardId: string;

  @IsDefined() // ValidateNested alone lets a missing user through
  @ValidateNested()
  @Type(() => JoinUserDto)
  user: JoinUserDto;
}
