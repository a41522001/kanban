import axios from 'axios';
import { ApiCode } from '@kanban/contracts/api';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_BYTES,
  type AvatarMimeType,
} from '@kanban/contracts/avatar';
import { getApiErrorResponse } from '@/services/http';

/** Copy keys under `avatar.errors.*`. */
export type AvatarErrorKey =
  | 'fileTooLarge'
  | 'unsupportedType'
  | 'invalidImage'
  | 'storageUnavailable'
  | 'unknown';

export type AvatarFailure =
  | { kind: 'error'; key: AvatarErrorKey }
  | { kind: 'rateLimited'; retryAfterSeconds: number };

/** The cropper exports a fixed 512×512 square; the server derives 64/128/256 px from it. */
export const AVATAR_OUTPUT_SIZE = 512;

export const AVATAR_CANVAS_OPTIONS = {
  minWidth: AVATAR_OUTPUT_SIZE,
  minHeight: AVATAR_OUTPUT_SIZE,
  maxWidth: AVATAR_OUTPUT_SIZE,
  maxHeight: AVATAR_OUTPUT_SIZE,
} as const;

export const AVATAR_ACCEPT = AVATAR_ALLOWED_MIME_TYPES.join(',');

const DEFAULT_RETRY_AFTER_SECONDS = 60;

const isAllowedMimeType = (type: string): type is AvatarMimeType =>
  (AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(type);

/**
 * Client-side pre-check before opening the cropper. The server still decodes the
 * image with Sharp, so this only saves a round trip for obviously invalid files.
 */
export const validateAvatarFile = (file: File): AvatarErrorKey | null => {
  if (!isAllowedMimeType(file.type)) {
    return 'unsupportedType';
  }
  if (file.size > AVATAR_MAX_FILE_BYTES) {
    return 'fileTooLarge';
  }
  return null;
};

/** Maps an upload/remove failure to UI copy using stable ApiCodes, never the server message. */
export const resolveAvatarFailure = (error: unknown): AvatarFailure => {
  const response = getApiErrorResponse(error);

  switch (response?.code) {
    case ApiCode.AvatarRateLimited: {
      const data = response.data as { retryAfterSeconds?: unknown } | null;
      const seconds = typeof data?.retryAfterSeconds === 'number' ? data.retryAfterSeconds : DEFAULT_RETRY_AFTER_SECONDS;
      return { kind: 'rateLimited', retryAfterSeconds: Math.max(1, Math.ceil(seconds)) };
    }
    case ApiCode.AvatarFileTooLarge:
      return { kind: 'error', key: 'fileTooLarge' };
    case ApiCode.AvatarUnsupportedType:
      return { kind: 'error', key: 'unsupportedType' };
    case ApiCode.AvatarInvalidImage:
      return { kind: 'error', key: 'invalidImage' };
    case ApiCode.AvatarStorageUnavailable:
      return { kind: 'error', key: 'storageUnavailable' };
  }

  // A proxy (e.g. Nginx) may reject an oversized body before it reaches the API.
  if (axios.isAxiosError(error) && error.response?.status === 413) {
    return { kind: 'error', key: 'fileTooLarge' };
  }

  return { kind: 'error', key: 'unknown' };
};

export const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to export the cropped avatar'));
      }
    }, 'image/png');
  });
