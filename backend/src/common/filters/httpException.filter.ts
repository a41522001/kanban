import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import type { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import { LOG_EVENTS } from '@/common/constants/logEvents';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(@Optional() private readonly logger?: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const apiResponse: ApiResponse<unknown> = {
      code: ApiCode.InternalError,
      message: '發生非預期錯誤',
      time: new Date().toISOString(),
      data: null,
      error: null,
    };
    if (status >= 500) {
      this.logger?.error(
        {
          event:
            exception instanceof AppException && exception.event
              ? exception.event
              : LOG_EVENTS.httpRequestUnexpectedError,
          err:
            exception instanceof HttpException && exception.cause
              ? exception.cause
              : exception,
        },
        '請求處理失敗',
      );
    }

    // App自訂錯誤
    if (exception instanceof AppException) {
      apiResponse.code = exception.code;
      apiResponse.message = exception.message;
      apiResponse.data = exception.data ?? null;
      apiResponse.error = exception.errors ?? null;
      response.status(status).json(apiResponse);
      return;
    }
    // Http錯誤
    if (exception instanceof HttpException) {
      apiResponse.code = ApiCode.RequestError;
      apiResponse.message = '請求失敗';
      response.status(status).json(apiResponse);
      return;
    }

    response.status(status).json(apiResponse);
  }
}
