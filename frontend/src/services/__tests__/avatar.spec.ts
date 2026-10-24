import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiCode } from '@kanban/contracts/api';
import api from '@/services/http';
import { AVATAR_UPLOAD_TIMEOUT_MS, deleteAvatarApi, uploadAvatarApi } from '@/services/avatar';

vi.mock('@/services/http', () => ({
  default: vi.fn<typeof api>(),
}));

const mockedApi = vi.mocked(api);

describe('avatar service', () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockResolvedValue({
      data: { code: ApiCode.Success, data: null, message: 'ok', time: '', error: null },
    } as Awaited<ReturnType<typeof api>>);
  });

  it('上傳時以 FormData 的 avatar 欄位送出，並使用較長的 timeout', async () => {
    const image = new Blob(['png'], { type: 'image/png' });

    await uploadAvatarApi(image);

    const option = mockedApi.mock.calls[0]![0];
    expect(option).toMatchObject({ url: '/user/avatar', method: 'post', timeout: AVATAR_UPLOAD_TIMEOUT_MS });
    expect(option.data).toBeInstanceOf(FormData);
    expect((option.data as FormData).get('avatar')).toBeInstanceOf(Blob);
    // The browser must set the multipart boundary itself.
    expect(option.headers).toBeUndefined();
  });

  it('移除頭像呼叫 DELETE /user/avatar', async () => {
    await deleteAvatarApi();

    expect(mockedApi).toHaveBeenCalledWith({ url: '/user/avatar', method: 'delete' });
  });
});
