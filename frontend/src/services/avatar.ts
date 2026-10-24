import type { ApiResponse } from '@kanban/contracts/api';
import type { AvatarImageSet } from '@kanban/contracts/avatar';
import api from './http';

/** Uploads can take longer than ordinary JSON requests. */
export const AVATAR_UPLOAD_TIMEOUT_MS = 30_000;

export const uploadAvatarApi = async (image: Blob): Promise<ApiResponse<AvatarImageSet>> => {
  const formData = new FormData();
  formData.append('avatar', image, 'avatar.png');

  // Content-Type is left to the browser so the multipart boundary is set correctly.
  const response = await api<ApiResponse<AvatarImageSet>, FormData>({
    url: '/user/avatar',
    method: 'post',
    data: formData,
    timeout: AVATAR_UPLOAD_TIMEOUT_MS,
  });

  return response.data;
};

export const deleteAvatarApi = async (): Promise<ApiResponse<null>> => {
  const response = await api<ApiResponse<null>>({
    url: '/user/avatar',
    method: 'delete',
  });

  return response.data;
};
