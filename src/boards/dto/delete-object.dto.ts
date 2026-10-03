import { IsUUID } from 'class-validator';

// Payload of the `object:delete` socket event.
export class DeleteObjectDto {
  @IsUUID()
  id: string;
}
