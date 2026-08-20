import { AppException } from '@/common/exceptions/app.exception';
import type { FieldErrors } from '@kanban/contracts/api';
import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { HttpExceptionFilter } from './httpException.filter';

type FilterTestContext = {
  host: ArgumentsHost;
  statusMock: jest.Mock;
  jsonMock: jest.Mock;
};

const createFilterTestContext = (): FilterTestContext => {
  const jsonMock = jest.fn();
  const statusMock = jest.fn();
  const response = {
    status: statusMock,
    json: jsonMock,
  } as unknown as Response;

  statusMock.mockReturnValue(response);

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, statusMock, jsonMock };
};

describe('HttpExceptionFilter', () => {
  const fixedTime = new Date('2026-08-20T12:00:00.000Z');
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedTime);
    filter = new HttpExceptionFilter();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('應完整保留 AppException 的 code、message 與 field errors', () => {
    const { host, statusMock, jsonMock } = createFilterTestContext();
    const errors: FieldErrors = {
      email: {
        value: 'invalid-email',
        messages: ['Email 格式不正確'],
      },
      password: {
        value: null,
        messages: ['密碼至少需要 8 個字元'],
      },
    };

    filter.catch(
      new AppException({
        status: HttpStatus.BAD_REQUEST,
        code: 1001,
        message: '請求參數錯誤',
        errors,
      }),
      host,
    );

    expect(statusMock).toHaveBeenCalledTimes(1);
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledTimes(1);
    expect(jsonMock).toHaveBeenCalledWith({
      code: 1001,
      message: '請求參數錯誤',
      time: fixedTime.toISOString(),
      data: null,
      error: errors,
    });
  });

  it('應將一般 HttpException 轉成統一 ApiResponse', () => {
    const { host, statusMock, jsonMock } = createFilterTestContext();

    filter.catch(new HttpException('禁止存取', HttpStatus.FORBIDDEN), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(jsonMock).toHaveBeenCalledWith({
      code: 0,
      message: '禁止存取',
      time: fixedTime.toISOString(),
      data: null,
      error: null,
    });
  });

  it('應隱藏非預期錯誤內容並回傳 500', () => {
    const { host, statusMock, jsonMock } = createFilterTestContext();

    filter.catch(new Error('DATABASE_URL password leaked'), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith({
      code: 5000,
      message: '發生非預期錯誤',
      time: fixedTime.toISOString(),
      data: null,
      error: null,
    });
  });
});
