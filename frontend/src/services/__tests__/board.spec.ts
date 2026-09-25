import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiCode } from '@kanban/contracts/api';
import api from '@/services/http';
import { getBoardColumnsApi } from '@/services/board';

vi.mock('@/services/http', () => ({
  default: vi.fn<typeof api>(),
}));

const mockedApi = vi.mocked(api);

describe('board service', () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockResolvedValue({
      data: {
        code: ApiCode.Success,
        data: null,
        message: 'ok',
        time: '2026-09-22T00:00:00.000Z',
        error: null,
      },
    } as Awaited<ReturnType<typeof api>>);
  });

  it('以 projectId 取得目前看板欄位', async () => {
    await getBoardColumnsApi('project-1');

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/board/project-1',
      method: 'get',
    });
  });
});
