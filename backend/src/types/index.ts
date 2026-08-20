import { FieldErrors } from '@kanban/contracts/api';
import { HttpStatus } from '@nestjs/common';

export type AppExceptionOptions = {
  status: HttpStatus;
  code: number;
  message: string;
  errors?: FieldErrors | null;
};
