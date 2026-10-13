import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { BoardsService } from './../src/boards/boards.service';

describe('REST error shape (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it('replies 400 VALIDATION_FAILED with the reason for a badly formed board id', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/boards/bad!char')
      .expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'id must be an 8 character board id',
    });
  });

  it('replies 404 NOT_FOUND for a route that does not exist', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/nothing')
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Cannot GET /api/nothing',
    });
  });

  it('replies 404 NOT_FOUND for a method the route does not have', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/boards')
      .expect(404);

    expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('replies 400 VALIDATION_FAILED for a body that is not valid JSON', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/boards')
      .set('Content-Type', 'application/json')
      .send('{bad')
      .expect(400);

    expect(res.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  it('keeps the code and status of its own errors', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/boards/AAAAAAAA')
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      code: 'BOARD_NOT_FOUND',
      message: 'BOARD_NOT_FOUND',
    });
  });

  it('replies 500 INTERNAL without details when something unexpected breaks', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(app.get(BoardsService), 'createBoard').mockImplementation(() => {
      throw new Error('secret connection string');
    });

    const res = await request(app.getHttpServer())
      .post('/api/boards')
      .expect(500);

    expect(res.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL',
      message: 'INTERNAL',
    });
  });
});
