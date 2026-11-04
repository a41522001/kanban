import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiCode } from '@kanban/contracts/api';
import api from '@/services/http';
import {
  addCardApi,
  addCategoryApi,
  archiveCardApi,
  getBoardSnapshotApi,
  updateCardApi,
} from '@/services/board';

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

  it('以 projectId 取得整個看板', async () => {
    await getBoardSnapshotApi('project-1');

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/board/project-1',
      method: 'get',
    });
  });

  it('新增卡片', async () => {
    await addCardApi({ columnId: 'column-1', title: '標題' });

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/board/addCard',
      method: 'post',
      data: { columnId: 'column-1', title: '標題' },
    });
  });

  it('以 expectedVersion 修改卡片', async () => {
    await updateCardApi({ cardId: 'card-1', title: '新標題', expectedVersion: 2 });

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/board/updateCard',
      method: 'patch',
      data: { cardId: 'card-1', title: '新標題', expectedVersion: 2 },
    });
  });

  it('以 expectedVersion 封存卡片', async () => {
    await archiveCardApi({ cardId: 'card-1', expectedVersion: 3 });

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/board/archiveCard',
      method: 'patch',
      data: { cardId: 'card-1', expectedVersion: 3 },
    });
  });

  it('建立類別', async () => {
    await addCategoryApi({ projectId: 'project-1', name: '後端', colorKey: 'mint' });

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/board/addCategory',
      method: 'post',
      data: { projectId: 'project-1', name: '後端', colorKey: 'mint' },
    });
  });
});
