import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { BoardsService } from './../src/boards/boards.service';
import { LIMITS } from './../src/common/limits/limits';

// Supertest does not type the reply body, so say what we expect it to be.
const bodyOf = <T>(res: request.Response) => res.body as T;

describe('Boards REST (e2e)', () => {
  let app: INestApplication<App>;

  const createBoard = async () => {
    const res = await request(app.getHttpServer()).post('/api/boards');
    return bodyOf<{ id: string }>(res).id;
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/boards', () => {
    it('creates a board and replies 201 with only its id', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/boards')
        .expect(201);

      const body = bodyOf<{ id: string }>(res);
      expect(Object.keys(body)).toEqual(['id']);
      expect(body.id).toHaveLength(8);
    });

    it('replies 503 BOARD_LIMIT when there are too many boards', async () => {
      const service = app.get(BoardsService);
      for (let i = 0; i < LIMITS.maxBoards; i++) service.createBoard();

      const res = await request(app.getHttpServer())
        .post('/api/boards')
        .expect(503);

      expect(res.body).toMatchObject({ statusCode: 503, code: 'BOARD_LIMIT' });
    });
  });

  describe('GET /api/boards/:id', () => {
    it('replies 200 with the id and createdAt of an existing board', async () => {
      const id = await createBoard();

      const res = await request(app.getHttpServer())
        .get(`/api/boards/${id}`)
        .expect(200);

      const body = bodyOf<{ id: string; createdAt: number }>(res);
      expect(Object.keys(body).sort()).toEqual(['createdAt', 'id']);
      expect(body.id).toBe(id);
      expect(typeof body.createdAt).toBe('number');
    });

    it('does not send the shapes', async () => {
      const id = await createBoard();

      const res = await request(app.getHttpServer()).get(`/api/boards/${id}`);

      expect(res.body).not.toHaveProperty('objects');
    });

    it('replies 404 BOARD_NOT_FOUND for a well-formed id that does not exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/boards/AAAAAAAA')
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        code: 'BOARD_NOT_FOUND',
      });
    });

    it.each(['abc', 'toolongid1', 'bad!char'])(
      'replies 400 for a badly formed id (%s)',
      async (badId) => {
        await request(app.getHttpServer())
          .get(`/api/boards/${badId}`)
          .expect(400);
      },
    );
  });
});
