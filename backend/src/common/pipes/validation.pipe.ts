import { AppException } from '@/common/exceptions/app.exception';
import { formatValidationErrors } from '@/common/utils';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ApiCode } from '@kanban/contracts/api';
/**
 * 建立全域 request validation pipe。
 *
 * 將 ValidationPipe 的設定集中在可重用的 factory，確保應用程式啟動與
 * 單元測試使用完全相同的 validation 與錯誤格式。
 */
export const createValidationPipe = (): ValidationPipe =>
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
    exceptionFactory: (errors: ValidationError[]): AppException =>
      new AppException({
        status: HttpStatus.BAD_REQUEST,
        code: ApiCode.ValidationError,
        message: '請求參數錯誤',
        errors: formatValidationErrors(errors),
      }),
  });
