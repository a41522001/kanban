import { HttpStatus } from '@nestjs/common';

export type AppExceptionOptions = {
  status: HttpStatus;
  code: number;
  message: string;
  errors?: Record<string, string[]>;
};
