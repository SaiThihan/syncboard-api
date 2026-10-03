import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { fail } from '../acknowledgements/ack';
import { AppError } from '../errors/errors';

// Replies through the client's ack callback instead of Nest's default `exception` event,
// so the client knows which request failed. Never disconnects the socket.
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // The arguments are [socket, data, ack, eventName]; the ack is the only function.
    const ack: unknown = host.getArgs().find((a) => typeof a === 'function');

    let response = fail('INTERNAL');
    if (exception instanceof AppError) {
      response = fail(exception.code, exception.message);
    } else {
      this.logger.error(exception);
    }

    if (typeof ack === 'function') (ack as (r: unknown) => void)(response);
  }
}
