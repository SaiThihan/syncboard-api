import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { fail } from './ack';
import { AppError } from './errors';

// Replies through the client's ack callback instead of Nest's default `exception` event,
// so the client knows which request failed. Never disconnects the socket.
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const args = host.getArgs();
    const ack: unknown = args[args.length - 1];

    let response = fail('INTERNAL');
    if (exception instanceof AppError) {
      response = fail(exception.code, exception.message);
    } else {
      this.logger.error(exception);
    }

    if (typeof ack === 'function') (ack as (r: unknown) => void)(response);
  }
}
