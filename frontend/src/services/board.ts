import type { ApiResponse } from '@kanban/contracts/api';
import type {
  AddCardRequest,
  AddCategoryRequest,
  AddCategoryResult,
  ArchiveCardRequest,
  ArchiveCardResult,
  BoardSnapshot,
  CardMutationResult,
  UpdateCardRequest,
} from '@kanban/contracts/board';
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

/** 在指定欄位最下面新增卡片，回傳新卡片與新的 boardRevision。 */
export const addCardApi = async (
  payload: AddCardRequest,
): Promise<ApiResponse<CardMutationResult>> => {
  const response = await api<ApiResponse<CardMutationResult>, AddCardRequest>({
    url: '/board/addCard',
    method: 'post',
    data: payload,
  });

  return response.data;
};

/** 修改卡片標題或描述；expectedVersion 不符時後端回 409。 */
export const updateCardApi = async (
  payload: UpdateCardRequest,
): Promise<ApiResponse<CardMutationResult>> => {
  const response = await api<ApiResponse<CardMutationResult>, UpdateCardRequest>({
    url: '/board/updateCard',
    method: 'patch',
    data: payload,
  });

  return response.data;
};

/** 封存卡片；expectedVersion 不符時後端回 409。 */
export const archiveCardApi = async (
  payload: ArchiveCardRequest,
): Promise<ApiResponse<ArchiveCardResult>> => {
  const response = await api<ApiResponse<ArchiveCardResult>, ArchiveCardRequest>({
    url: '/board/archiveCard',
    method: 'patch',
    data: payload,
  });

  return response.data;
};

/** 建立類別；名稱已存在（不分大小寫）時回傳既有的那一筆，boardRevision 不變。 */
export const addCategoryApi = async (
  payload: AddCategoryRequest,
): Promise<ApiResponse<AddCategoryResult>> => {
  const response = await api<ApiResponse<AddCategoryResult>, AddCategoryRequest>({
    url: '/board/addCategory',
    method: 'post',
    data: payload,
  });

  return response.data;
};
