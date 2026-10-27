import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { HttpStatus } from '@nestjs/common';
import type { LogEvent } from '@/common/constants/logEvents';

export class InvalidAvatarImageException extends AppException {
  constructor(reason: string) {
    super({
      status: HttpStatus.BAD_REQUEST,
      code: ApiCode.AvatarInvalidImage,
      message: reason,
    });
  }
}

export class UnsupportedAvatarTypeException extends AppException {
  constructor(reason: string) {
    super({
      status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      code: ApiCode.AvatarUnsupportedType,
      message: reason,
    });
  }
}

export class AvatarStorageUnavailableException extends AppException {
  constructor(reason: string, options?: { cause?: unknown; event?: LogEvent }) {
    super({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: ApiCode.AvatarStorageUnavailable,
      message: reason,
      ...options,
    });
  }
}
