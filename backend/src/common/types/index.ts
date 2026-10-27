import { FieldErrors } from '@kanban/contracts/api';
import { HttpStatus } from '@nestjs/common';
import { ApiCode } from '@kanban/contracts/api';
import type { LogEvent } from '@/common/constants/logEvents';
export type AppExceptionOptions = {
  status: HttpStatus;
  code: ApiCode;
  message: string;
  data?: unknown;
  errors?: FieldErrors | null;
  cause?: unknown;
  event?: LogEvent;
};
