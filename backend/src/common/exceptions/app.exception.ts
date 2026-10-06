import { AppExceptionOptions } from '@/types';
import type { ApiCode, FieldErrors } from '@kanban/contracts/api';
import { HttpException } from '@nestjs/common';

export class AppException extends HttpException {
  public readonly code: ApiCode;
  public readonly data?: unknown;
  public readonly errors?: FieldErrors | null;
  constructor({ status, code, message, data, errors }: AppExceptionOptions) {
    super(
      {
        message,
        data,
        errors,
      },
      status,
    );

    this.code = code;
    this.data = data;
    this.errors = errors;
  }
}
