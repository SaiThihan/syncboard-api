import { IsNumber, Max, Min } from 'class-validator';
import { LIMITS } from '../../common/limits/limits';

const COORD = LIMITS.coordinateMax;

// Payload of the `cursor:move` socket event.
export class MoveCursorDto {
  @IsNumber()
  @Min(-COORD)
  @Max(COORD)
  x: number;

  @IsNumber()
  @Min(-COORD)
  @Max(COORD)
  y: number;
}
