import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { ApiCode } from '@kanban/contracts/api';
import { resolveAvatarFailure, validateAvatarFile } from './avatarSettings';

const fileOf = (type: string, bytes: number) => {
  const file = new File(['x'], 'avatar', { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
};

const axiosErrorWith = (status: number, data: unknown) => {
  const config = { headers: new AxiosHeaders() };
  const response: AxiosResponse = { status, statusText: '', data, headers: {}, config };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, response);
};

const apiError = (status: number, code: ApiCode, data: unknown = null) =>
  axiosErrorWith(status, { code, message: 'server message', time: '', data, error: null });

describe('validateAvatarFile', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('接受 %s', (type) => {
    expect(validateAvatarFile(fileOf(type, 1024))).toBeNull();
  });

  it('拒絕不支援的格式', () => {
    expect(validateAvatarFile(fileOf('image/gif', 1024))).toBe('unsupportedType');
  });

  it('剛好 5 MiB 可以通過，超過則拒絕', () => {
    expect(validateAvatarFile(fileOf('image/png', 5 * 1024 * 1024))).toBeNull();
    expect(validateAvatarFile(fileOf('image/png', 5 * 1024 * 1024 + 1))).toBe('fileTooLarge');
  });
});

describe('resolveAvatarFailure', () => {
  it.each([
    [413, ApiCode.AvatarFileTooLarge, 'fileTooLarge'],
    [415, ApiCode.AvatarUnsupportedType, 'unsupportedType'],
    [400, ApiCode.AvatarInvalidImage, 'invalidImage'],
    [503, ApiCode.AvatarStorageUnavailable, 'storageUnavailable'],
  ] as const)('HTTP %s / ApiCode %s 對應文案 %s', (status, code, key) => {
    expect(resolveAvatarFailure(apiError(status, code))).toEqual({ kind: 'error', key });
  });

  it('429 使用 data.retryAfterSeconds 倒數，並無條件進位', () => {
    expect(resolveAvatarFailure(apiError(429, ApiCode.AvatarRateLimited, { retryAfterSeconds: 41.2 }))).toEqual({
      kind: 'rateLimited',
      retryAfterSeconds: 42,
    });
  });

  it('429 沒有 retryAfterSeconds 時預設 60 秒', () => {
    expect(resolveAvatarFailure(apiError(429, ApiCode.AvatarRateLimited))).toEqual({
      kind: 'rateLimited',
      retryAfterSeconds: 60,
    });
  });

  it('Proxy 回的 413（沒有 API envelope）也視為檔案過大', () => {
    expect(resolveAvatarFailure(axiosErrorWith(413, '<html>Request Entity Too Large</html>'))).toEqual({
      kind: 'error',
      key: 'fileTooLarge',
    });
  });

  it('其他錯誤使用通用文案，不採用後端 message', () => {
    expect(resolveAvatarFailure(apiError(500, ApiCode.InternalError))).toEqual({ kind: 'error', key: 'unknown' });
    expect(resolveAvatarFailure(new Error('network'))).toEqual({ kind: 'error', key: 'unknown' });
  });
});
