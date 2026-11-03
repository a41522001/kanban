import type { ApiResponse } from '@kanban/contracts/api';
import type { BoardSnapshot } from '@kanban/contracts/board';
import api from './http';

/** 取得整個看板：未封存的欄位與卡片，以及目前的 boardRevision。 */
export const getBoardSnapshotApi = async (
  projectId: string,
): Promise<ApiResponse<BoardSnapshot>> => {
  const response = await api<ApiResponse<BoardSnapshot>>({
    url: `/board/${projectId}`,
    method: 'get',
  });

  return response.data;
};
