import { AppExceptionOptions } from '@/types';
import type { ApiCode, FieldErrors } from '@kanban/contracts/api';
import { HttpException } from '@nestjs/common';

export class AppException extends HttpException {
  public readonly code: ApiCode;
  public readonly errors?: FieldErrors | null;
  constructor({ status, code, message, errors }: AppExceptionOptions) {
    super(
      {
        message,
        errors,
      },
      status,
    );

    this.code = code;
    this.errors = errors;
  }
}
