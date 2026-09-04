import { FieldErrors } from '@kanban/contracts/api';
import { HttpStatus } from '@nestjs/common';
import type { ApiCode } from '@kanban/contracts/api';
export type AppExceptionOptions = {
  status: HttpStatus;
  code: ApiCode;
  message: string;
  errors?: FieldErrors | null;
};
