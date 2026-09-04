import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  ApiCode,
  type ApiResponse,
  type ApiResult,
} from '@kanban/contracts/api';
import { type Observable, map } from 'rxjs';

@Injectable()
export class WrapResponseInterceptor<T> implements NestInterceptor<
  ApiResult<T>,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<ApiResult<T>>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((result): ApiResponse<T> => {
        const code = result.code ?? ApiCode.Success;
        const data = result.data ?? null;
        const message = result.message ?? '請求成功';

        return {
          code,
          data,
          message,
          time: new Date().toISOString(),
          error: null,
        };
      }),
    );
  }
}
