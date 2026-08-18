import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiResponse } from '@kanban/contracts/api';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    // TODO: 寫log

    const apiResponse: ApiResponse<null> = {
      code: 0,
      message: '',
      time: new Date().toISOString(),
      data: null,
      error: null,
    };
    // App自訂錯誤
    if (exception instanceof AppException) {
      console.log('是AppException');
      console.log(exception.code);
      console.log(exception.message);
      console.log(exception.errors);
      apiResponse.code = exception.code;
      apiResponse.message = exception.message;
      apiResponse.error = exception?.errors ?? null;
      response.status(status).json(apiResponse);
      return;
    }
    // Http錯誤
    if (exception instanceof HttpException) {
      apiResponse.message = exception.message;
      response.status(status).json(apiResponse);
      return;
    }
    // 非預期錯誤
    apiResponse.code = 5000;
    apiResponse.message = '發生非預期錯誤';
    response.status(status).json(apiResponse);
  }
}
