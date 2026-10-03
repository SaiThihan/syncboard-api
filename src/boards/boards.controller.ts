import { Controller, Get, Param, Post } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardIdParams } from './dto/board-id.params';

@Controller('boards')
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Post() // replies 201
  create(): { id: string } {
    return { id: this.boards.createBoard() };
  }

  // Only confirms the board exists. The shapes come through the socket when joining.
  @Get(':id')
  get(@Param() params: BoardIdParams): { id: string; createdAt: number } {
    const board = this.boards.getBoard(params.id);
    return { id: board.id, createdAt: board.createdAt };
  }
}
