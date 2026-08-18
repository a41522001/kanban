import { AppExceptionOptions } from '@/types';
import { HttpException } from '@nestjs/common';

export class AppException extends HttpException {
  public readonly code: number;
  public readonly errors?: Record<string, string[]>;
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
