import { Controller } from '@nestjs/common';
import { BoardsService } from './boards.service';

// REST routes (POST /boards, GET /boards/:id) arrive in the next implementation step.
@Controller('boards')
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}
}
