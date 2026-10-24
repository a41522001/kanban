<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent
      class="avatar-settings"
      :show-close-button="false"
      @escape-key-down="handleDismissAttempt"
      @pointer-down-outside="handleDismissAttempt"
    >
      <DialogHeader class="avatar-settings__header">
        <DialogTitle class="avatar-settings__title">{{ t('avatar.title') }}</DialogTitle>
        <DialogDescription :class="view === 'crop' && !retryRemaining ? 'avatar-settings__description' : 'sr-only'">
          {{ view === 'crop' ? t('avatar.cropDescription') : t('avatar.formatHint') }}
        </DialogDescription>
        <button
          type="button"
          class="avatar-settings__close"
          :disabled="isBusy"
          :aria-label="t('avatar.close')"
          @click="closeDialog"
        >
          <X :size="18" :stroke-width="2" aria-hidden="true" />
        </button>
      </DialogHeader>

      <input
        ref="fileInputRef"
        class="sr-only"
        type="file"
        tabindex="-1"
        :accept="AVATAR_ACCEPT"
        aria-hidden="true"
        @change="handleFileChange"
      />

      <!-- Crop -->
      <template v-if="view === 'crop' && imageUrl">
        <div v-if="retryRemaining" class="avatar-settings__notice avatar-settings__notice--warning" role="status" aria-live="polite">
          <Clock :size="18" :stroke-width="2" aria-hidden="true" />
          <p class="avatar-settings__notice-title">{{ t('avatar.rateLimited') }}</p>
        </div>

        <div class="avatar-settings__cropper-frame" :aria-label="t('avatar.cropperLabel')" role="group">
          <Cropper
            ref="cropperRef"
            class="avatar-settings__cropper"
            :src="imageUrl"
            :stencil-component="CircleStencil"
            :stencil-props="{ aspectRatio: 1 }"
            :canvas="AVATAR_CANVAS_OPTIONS"
            image-restriction="stencil"
            @change="handleCropChange"
            @error="showError('invalidImage')"
          />
          <div v-if="busy === 'uploading'" class="avatar-settings__cropper-veil">
            <LoaderCircle class="avatar-settings__spinner" :size="32" aria-hidden="true" />
          </div>
        </div>

        <div class="avatar-settings__zoom">
          <button
            type="button"
            class="avatar-settings__icon-button"
            :disabled="isBusy || zoomLevel <= ZOOM_MIN"
            :aria-label="t('avatar.zoomOut')"
            @click="setZoom(zoomLevel - ZOOM_STEP)"
          >
            <Minus :size="18" :stroke-width="2" aria-hidden="true" />
          </button>
          <input
            class="avatar-settings__slider"
            type="range"
            :min="ZOOM_MIN"
            :max="ZOOM_MAX"
            step="1"
            :value="zoomLevel"
            :disabled="isBusy"
            :aria-label="t('avatar.zoom')"
            @input="setZoom(Number(($event.target as HTMLInputElement).value))"
          />
          <button
            type="button"
            class="avatar-settings__icon-button"
            :disabled="isBusy || zoomLevel >= ZOOM_MAX"
            :aria-label="t('avatar.zoomIn')"
            @click="setZoom(zoomLevel + ZOOM_STEP)"
          >
            <Plus :size="18" :stroke-width="2" aria-hidden="true" />
          </button>
        </div>

        <div class="avatar-settings__preview">
          <span class="avatar-settings__preview-label">{{ t('avatar.previewLabel') }}</span>
          <template v-if="previewSource">
            <Preview
              class="avatar-settings__preview-image"
              :width="64"
              :height="64"
              :image="previewSource.image"
              :coordinates="previewSource.coordinates"
            />
            <Preview
              class="avatar-settings__preview-image"
              :width="32"
              :height="32"
              :image="previewSource.image"
              :coordinates="previewSource.coordinates"
            />
          </template>
          <span class="avatar-settings__hint">{{ t('avatar.formatHint') }}</span>
        </div>

        <DialogFooter class="avatar-settings__footer">
          <Button
            type="button"
            variant="ghost"
            class="avatar-settings__rechoose"
            :disabled="isBusy"
            @click="openFilePicker"
          >
            <RefreshCw :stroke-width="2" aria-hidden="true" />
            {{ t('avatar.rechoose') }}
          </Button>
          <Button type="button" variant="outline" class="avatar-settings__action" :disabled="isBusy" @click="closeDialog">
            {{ t('avatar.cancel') }}
          </Button>
          <Button
            type="button"
            class="avatar-settings__action avatar-settings__upload"
            :loading="busy === 'uploading'"
            :disabled="isBusy || retryRemaining > 0"
            @click="handleUpload"
          >
            {{ uploadLabel }}
          </Button>
        </DialogFooter>
      </template>

      <!-- Error -->
      <template v-else-if="view === 'error' && errorKey">
        <div class="avatar-settings__notice avatar-settings__notice--error" role="alert">
          <CircleAlert :size="18" :stroke-width="2" aria-hidden="true" />
          <div>
            <p class="avatar-settings__notice-title">{{ t(`avatar.errors.${errorKey}.title`) }}</p>
            <p class="avatar-settings__notice-detail">{{ t(`avatar.errors.${errorKey}.detail`) }}</p>
          </div>
        </div>
        <DialogFooter class="avatar-settings__footer avatar-settings__footer--end">
          <Button type="button" variant="outline" class="avatar-settings__action" @click="closeDialog">
            {{ t('avatar.cancel') }}
          </Button>
          <Button type="button" class="avatar-settings__action" @click="openFilePicker">
            {{ t('avatar.rechoose') }}
          </Button>
        </DialogFooter>
      </template>

      <!-- Idle -->
      <template v-else>
        <div class="avatar-settings__current">
          <Avatar
            :name="displayName"
            :src="currentAvatarUrl"
            :size="128"
            :class="{ 'opacity-50': busy === 'removing' }"
          />
          <span class="avatar-settings__hint">{{ t('avatar.formatHint') }}</span>
        </div>

        <div v-if="errorKey" class="avatar-settings__notice avatar-settings__notice--error" role="alert">
          <CircleAlert :size="18" :stroke-width="2" aria-hidden="true" />
          <div>
            <p class="avatar-settings__notice-title">{{ t(`avatar.errors.${errorKey}.title`) }}</p>
            <p class="avatar-settings__notice-detail">{{ t(`avatar.errors.${errorKey}.detail`) }}</p>
          </div>
        </div>

        <div class="avatar-settings__idle-actions">
          <Button type="button" class="avatar-settings__block-action" :disabled="isBusy" @click="openFilePicker">
            <ImageIcon :stroke-width="2" aria-hidden="true" />
            {{ hasAvatar ? t('avatar.chooseNew') : t('avatar.choose') }}
          </Button>
          <Button
            v-if="hasAvatar"
            type="button"
            variant="outline"
            class="avatar-settings__block-action avatar-settings__remove"
            :loading="busy === 'removing'"
            :disabled="isBusy"
            @click="handleRemove"
          >
            {{ busy === 'removing' ? t('avatar.removing') : t('avatar.remove') }}
          </Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Cropper, CircleStencil, Preview, type Coordinates } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import {
  CircleAlert,
  Clock,
  Image as ImageIcon,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  X,
} from 'lucide-vue-next';
import Avatar from '@/components/shared/Avatar/Avatar.vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { deleteAvatarApi, uploadAvatarApi } from '@/services/avatar';
import { useUserStore } from '@/stores/user';
import {
  AVATAR_ACCEPT,
  AVATAR_CANVAS_OPTIONS,
  canvasToPngBlob,
  resolveAvatarFailure,
  validateAvatarFile,
  type AvatarErrorKey,
} from './avatarSettings';

type View = 'idle' | 'crop' | 'error';
type Busy = 'none' | 'uploading' | 'removing';

interface CropperInstance {
  getResult: () => { canvas?: HTMLCanvasElement };
  zoom: (factor: number) => void;
}

interface CropChange {
  coordinates: Coordinates;
  image: unknown;
}

const ZOOM_MIN = 0;
const ZOOM_MAX = 100;
const ZOOM_STEP = 10;

const open = defineModel<boolean>('open', { default: false });
const { t } = useI18n();
const userStore = useUserStore();

const fileInputRef = ref<HTMLInputElement | null>(null);
const cropperRef = ref<CropperInstance | null>(null);
const view = ref<View>('idle');
const busy = ref<Busy>('none');
const imageUrl = ref<string | null>(null);
const errorKey = ref<AvatarErrorKey | null>(null);
const zoomLevel = ref(ZOOM_MIN);
const previewSource = ref<CropChange | null>(null);
const retryRemaining = ref(0);
let retryTimer: ReturnType<typeof setInterval> | undefined;

const displayName = computed(() => userStore.user?.displayName ?? '');
const avatar = computed(() => userStore.user?.avatar ?? null);
const hasAvatar = computed(() => avatar.value !== null);
const currentAvatarUrl = computed(() => avatar.value ? (avatar.value.largeUrl ?? avatar.value.mediumUrl) : null);
const isBusy = computed(() => busy.value !== 'none');
const uploadLabel = computed(() => {
  if (busy.value === 'uploading') return t('avatar.uploading');
  if (retryRemaining.value > 0) return t('avatar.retryIn', { seconds: retryRemaining.value });
  return t('avatar.upload');
});

// Slider position 0..100 maps to a 1x..3x scale; the cropper only accepts relative factors.
const zoomScale = (level: number) => 1 + level / 50;

const setZoom = (next: number) => {
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  if (clamped === zoomLevel.value) return;
  cropperRef.value?.zoom(zoomScale(clamped) / zoomScale(zoomLevel.value));
  zoomLevel.value = clamped;
};

const revokeImageUrl = () => {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
    imageUrl.value = null;
  }
};

const stopRetryCountdown = () => {
  clearInterval(retryTimer);
  retryTimer = undefined;
  retryRemaining.value = 0;
};

const startRetryCountdown = (seconds: number) => {
  stopRetryCountdown();
  retryRemaining.value = seconds;
  retryTimer = setInterval(() => {
    retryRemaining.value -= 1;
    if (retryRemaining.value <= 0) stopRetryCountdown();
  }, 1000);
};

const resetState = () => {
  revokeImageUrl();
  stopRetryCountdown();
  view.value = 'idle';
  errorKey.value = null;
  zoomLevel.value = ZOOM_MIN;
  previewSource.value = null;
};

const showError = (key: AvatarErrorKey) => {
  errorKey.value = key;
  view.value = 'error';
};

const openFilePicker = () => {
  if (!isBusy.value) fileInputRef.value?.click();
};

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // Clear the value so choosing the same file again still fires `change`.
  input.value = '';
  if (!file) return;

  const invalid = validateAvatarFile(file);
  if (invalid) {
    showError(invalid);
    return;
  }

  revokeImageUrl();
  imageUrl.value = URL.createObjectURL(file);
  zoomLevel.value = ZOOM_MIN;
  previewSource.value = null;
  errorKey.value = null;
  view.value = 'crop';
};

const handleCropChange = (change: CropChange) => {
  previewSource.value = { coordinates: change.coordinates, image: change.image };
};

const handleUpload = async () => {
  if (isBusy.value || retryRemaining.value > 0) return;
  const canvas = cropperRef.value?.getResult().canvas;
  if (!canvas) {
    showError('invalidImage');
    return;
  }

  busy.value = 'uploading';
  try {
    const blob = await canvasToPngBlob(canvas);
    const response = await uploadAvatarApi(blob);
    userStore.setAvatar(response.data);
    toast.success(t('avatar.uploaded'));
    busy.value = 'none';
    closeDialog();
  } catch (error: unknown) {
    const failure = resolveAvatarFailure(error);
    if (failure.kind === 'rateLimited') startRetryCountdown(failure.retryAfterSeconds);
    else showError(failure.key);
  } finally {
    busy.value = 'none';
  }
};

const handleRemove = async () => {
  if (isBusy.value) return;
  busy.value = 'removing';
  errorKey.value = null;
  try {
    await deleteAvatarApi();
    userStore.setAvatar(null);
    toast.success(t('avatar.removed'));
  } catch (error: unknown) {
    const failure = resolveAvatarFailure(error);
    errorKey.value = failure.kind === 'error' ? failure.key : 'unknown';
  } finally {
    busy.value = 'none';
  }
};

const closeDialog = () => {
  if (isBusy.value) return;
  open.value = false;
  resetState();
};

const handleOpenChange = (isOpen: boolean) => {
  if (!isOpen) {
    closeDialog();
    return;
  }
  open.value = true;
};

const handleDismissAttempt = (event: Event) => {
  if (isBusy.value) event.preventDefault();
};

onBeforeUnmount(resetState);
</script>

<style scoped src="./AvatarSettingsDialog.css"></style>
