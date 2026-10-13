import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../../../src/common/errors/http-exception.filter';

// A fake host that records what the filter replies.
function run(exception: unknown) {
  const reply = { status: jest.fn(), json: jest.fn() };
  reply.status.mockReturnValue(reply);
  const host = {
    switchToHttp: () => ({ getResponse: () => reply }),
  } as unknown as ArgumentsHost;

  new HttpExceptionFilter().catch(exception, host);

  return {
    status: reply.status.mock.calls[0] as unknown[],
    body: reply.json.mock.calls[0] as unknown[],
  };
}

describe('HttpExceptionFilter', () => {
  it('uses a plain text reason as the message', () => {
    const { status, body } = run(new HttpException('Not allowed here', 400));

    expect(status).toEqual([400]);
    expect(body).toEqual([
      {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Not allowed here',
      },
    ]);
  });

  it('joins a list of reasons into one message', () => {
    const { body } = run(new BadRequestException(['x is bad', 'y is bad']));

    expect(body).toEqual([
      {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'x is bad, y is bad',
      },
    ]);
  });
});
