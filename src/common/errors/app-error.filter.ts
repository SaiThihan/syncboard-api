import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AppError, HTTP_STATUS } from './errors';

// Turns an AppError thrown by a service into an HTTP reply with the right status.
@Catch(AppError)
export class AppErrorFilter implements ExceptionFilter<AppError> {
  catch(error: AppError, host: ArgumentsHost): void {
    const status = HTTP_STATUS[error.code];
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, code: error.code, message: error.message });
  }
}
