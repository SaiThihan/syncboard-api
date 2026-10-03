import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
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

const COLOR = /^#[0-9A-Fa-f]{6}$/;
const COORD = LIMITS.coordinateMax;

// Fields every new shape has. The server adds authorId and version itself,
// so a client that sends them is rejected (forbidNonWhitelisted).
class BaseObjectDto {
  @IsUUID()
  id: string;

  @IsNumber()
  @Min(-COORD)
  @Max(COORD)
  x: number;

  @IsNumber()
  @Min(-COORD)
  @Max(COORD)
  y: number;

  @Matches(COLOR)
  stroke: string;

  @IsNumber()
  @Min(0)
  @Max(LIMITS.strokeWidthMax)
  strokeWidth: number;

  @IsOptional()
  @Matches(COLOR)
  fill?: string;
}

class PointDto {
  @IsNumber()
  @Min(-COORD)
  @Max(COORD)
  x: number;

  @IsNumber()
  @Min(-COORD)
  @Max(COORD)
  y: number;
}

export class PenDto extends BaseObjectDto {
  @Equals('pen')
  type: 'pen';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LIMITS.penMaxPoints)
  @ValidateNested({ each: true })
  @Type(() => PointDto)
  points: PointDto[];
}

export class RectDto extends BaseObjectDto {
  @Equals('rect')
  type: 'rect';

  @IsNumber()
  @Min(0)
  @Max(COORD)
  width: number;

  @IsNumber()
  @Min(0)
  @Max(COORD)
  height: number;
}

export class CircleDto extends BaseObjectDto {
  @Equals('circle')
  type: 'circle';

  @IsNumber()
  @Min(0)
  @Max(COORD)
  width: number;

  @IsNumber()
  @Min(0)
  @Max(COORD)
  height: number;
}

export class ArrowDto extends BaseObjectDto {
  @Equals('arrow')
  type: 'arrow';

  @IsNumber()
  @Min(-COORD)
  @Max(COORD)
  dx: number;

  @IsNumber()
  @Min(-COORD)
  @Max(COORD)
  dy: number;
}

export class TextDto extends BaseObjectDto {
  @Equals('text')
  type: 'text';

  @IsString()
  @Length(1, LIMITS.textMaxLength)
  text: string;

  @IsNumber()
  @Min(1)
  @Max(LIMITS.fontSizeMax)
  fontSize: number;
}

export type NewObjectDto = PenDto | RectDto | CircleDto | ArrowDto | TextDto;

// Payload of the `object:add` socket event.
export class AddObjectDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => Object, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: 'type',
      subTypes: [
        { value: PenDto, name: 'pen' },
        { value: RectDto, name: 'rect' },
        { value: CircleDto, name: 'circle' },
        { value: ArrowDto, name: 'arrow' },
        { value: TextDto, name: 'text' },
      ],
    },
  })
  object: NewObjectDto;
}
