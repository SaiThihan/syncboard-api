import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppError, type ErrorCode, HTTP_STATUS } from './errors';

// Nest puts the reason in the reply body, as a text or a list of texts.
function messageOf(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'object' && 'message' in body) {
    const { message } = body;
    return Array.isArray(message) ? message.join(', ') : String(message);
  }
  return exception.message;
}

// Every REST error leaves as { statusCode, code, message }, whatever threw it:
// our own AppError, Nest (bad input, unknown route, bad JSON) or a bug.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, code, message } = this.describe(exception);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, code, message });
  }

  private describe(exception: unknown): {
    status: number;
    code: ErrorCode;
    message: string;
  } {
    if (exception instanceof AppError) {
      return {
        status: HTTP_STATUS[exception.code],
        code: exception.code,
        message: exception.message,
      };
    }
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      const status = exception.getStatus();
      return {
        status,
        code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_FAILED',
        message: messageOf(exception),
      };
    }
    // A bug: log it, but never send details to the client.
    this.logger.error(exception);
    return { status: 500, code: 'INTERNAL', message: 'INTERNAL' };
  }
}
