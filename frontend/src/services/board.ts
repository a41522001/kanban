import type { ApiResponse } from '@kanban/contracts/api';
import type { BoardColumnRecord } from '@/types/board';
import api from './http';

export const getBoardColumnsApi = async (
  projectId: string,
): Promise<ApiResponse<BoardColumnRecord[]>> => {
  const response = await api<ApiResponse<BoardColumnRecord[]>>({
    url: `/board/${projectId}`,
    method: 'get',
  });

  return response.data;
};
