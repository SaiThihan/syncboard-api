import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { LIMITS } from '../../common/limits/limits';
import type { ObjectPatch } from '../types/boards.types';

const COLOR = /^#[0-9A-Fa-f]{6}$/;
const COORD = LIMITS.coordinateMax;

// The only fields a client may change. `id`, `type`, `authorId`, `version` and `points`
// are not listed, so sending them is rejected. Which of these a shape accepts depends
// on its type, and the service checks that.
export class PatchDto {
  @IsOptional()
  @IsNumber()
  @Min(-COORD)
  @Max(COORD)
  x?: number;

  @IsOptional()
  @IsNumber()
  @Min(-COORD)
  @Max(COORD)
  y?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(COORD)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(COORD)
  height?: number;

  @IsOptional()
  @IsNumber()
  @Min(-COORD)
  @Max(COORD)
  dx?: number;

  @IsOptional()
  @IsNumber()
  @Min(-COORD)
  @Max(COORD)
  dy?: number;

  @IsOptional()
  @IsString()
  @Length(1, LIMITS.textMaxLength)
  text?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(LIMITS.fontSizeMax)
  fontSize?: number;

  @IsOptional()
  @Matches(COLOR)
  stroke?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(LIMITS.strokeWidthMax)
  strokeWidth?: number;

  @IsOptional()
  @Matches(COLOR)
  fill?: string;
}

// Payload of the `object:update` socket event.
export class UpdateObjectDto {
  @IsUUID()
  id: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => PatchDto)
  patch: PatchDto;
}

// A class instance has every declared field, set or not. Keep only what the client sent.
export function toObjectPatch(patch: PatchDto): ObjectPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );
}
