<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="card-dialog card-dialog--detail" :show-close-button="false">
      <DialogHeader class="card-dialog__header">
        <p class="card-dialog__eyebrow">卡片 · 位於「{{ columnTitle }}」</p>
        <DialogTitle class="card-dialog__title">卡片詳情</DialogTitle>
        <DialogDescription class="sr-only">查看或修改卡片內容。</DialogDescription>
      </DialogHeader>

      <DialogClose aria-label="關閉卡片詳情視窗" class="card-dialog__close" :disabled="isBusy">
        <X :size="18" aria-hidden="true" />
      </DialogClose>

      <template v-if="card">
        <!-- VIEWER: plain text, no inputs, save or archive. -->
        <div v-if="!canEdit" class="card-dialog__read-only" data-testid="read-only">
          <span class="card-dialog__viewer-badge">
            <Eye :size="16" aria-hidden="true" />
            檢視者 · 只能查看
          </span>
          <h3 class="card-dialog__read-title">{{ card.title }}</h3>
          <div class="card-dialog__read-row">
            <h4 class="card-dialog__section-label">類別</h4>
            <CategoryChip
              v-if="currentCategory"
              :name="currentCategory.name"
              :color-key="currentCategory.colorKey"
            />
            <p v-else class="card-dialog__meta">沒有類別</p>
          </div>
          <section class="card-dialog__read-section">
            <h4 class="card-dialog__section-label">描述</h4>
            <p v-if="card.description" class="card-dialog__read-description">
              {{ card.description }}
            </p>
            <p v-else class="card-dialog__meta">沒有描述</p>
          </section>
          <p class="card-dialog__meta">{{ metaText }}</p>
          <DialogFooter class="card-dialog__footer">
            <Button type="button" variant="outline" @click="handleOpenChange(false)">關閉</Button>
          </DialogFooter>
        </div>

        <form v-else class="card-dialog__form" novalidate @submit.prevent="handleSave">
          <div v-if="hasConflict" class="card-dialog__conflict" role="alert">
            <CircleAlert :size="20" aria-hidden="true" class="card-dialog__conflict-icon" />
            <div class="card-dialog__conflict-text">
              <p class="card-dialog__conflict-title">這張卡片已被其他成員修改</p>
              <p class="card-dialog__conflict-detail">
                你這次的修改沒有儲存。重新載入後會顯示最新內容。
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              class="card-dialog__conflict-button"
              @click="emit('reload')"
            >
              重新載入
            </Button>
          </div>

          <!-- Board spec §6.1: dragging must not be the only way to move a card. -->
          <div class="card-dialog__move-row">
            <p class="card-dialog__meta">目前位於「{{ columnTitle }}」</p>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  type="button"
                  variant="outline"
                  class="card-dialog__move-button"
                  :disabled="isBusy || !hasMoveTarget"
                >
                  <ArrowRight :size="16" aria-hidden="true" />
                  移動至…
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-60">
                <DropdownMenuLabel class="card-dialog__move-label">
                  移到欄位的最下面
                </DropdownMenuLabel>
                <DropdownMenuItem
                  v-for="column in columns"
                  :key="column.id"
                  :disabled="column.id === card.columnId"
                  @select="emit('move', column.id)"
                >
                  {{ column.title
                  }}<span v-if="column.id === card.columnId" class="card-dialog__move-current"
                    >（目前位置）</span
                  >
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <FormField input-id="card-detail-title" label="卡片標題" required :error="titleError">
            <template #default="{ invalid, describedBy }">
              <Input
                id="card-detail-title"
                v-model="title"
                :maxlength="TITLE_MAX_LENGTH"
                :invalid="invalid"
                :aria-describedby="describedBy"
              />
              <span class="card-dialog__counter">
                {{ title.trim().length }} / {{ TITLE_MAX_LENGTH }}
              </span>
            </template>
          </FormField>

          <FormField input-id="card-category" label="類別" hint="選填">
            <CategorySelect
              v-model="categoryId"
              :project-id="projectId"
              :categories="categories"
              :disabled="isBusy"
              @created="emit('categoryCreated', $event)"
            />
          </FormField>

          <FormField input-id="card-detail-description" label="描述" hint="選填，清空即移除描述">
            <textarea
              id="card-detail-description"
              v-model="description"
              class="card-dialog__textarea card-dialog__textarea--tall"
              :maxlength="DESCRIPTION_MAX_LENGTH"
              placeholder="補充背景、驗收條件或相關連結"
              rows="7"
            />
            <span class="card-dialog__counter">
              {{ description.length }} / {{ DESCRIPTION_MAX_LENGTH }}
            </span>
          </FormField>

          <p class="card-dialog__meta">{{ metaText }}</p>

          <DialogFooter class="card-dialog__footer">
            <Button
              type="button"
              variant="ghost"
              class="card-dialog__archive-button"
              :disabled="isBusy"
              @click="isArchiveConfirmOpen = true"
            >
              <Archive :size="16" aria-hidden="true" />
              封存卡片
            </Button>
            <Button
              type="button"
              variant="outline"
              :disabled="isBusy"
              @click="handleOpenChange(false)"
            >
              取消
            </Button>
            <Button type="submit" :loading="isSaving" :disabled="hasConflict || isArchiving">
              儲存
            </Button>
          </DialogFooter>
        </form>
      </template>
    </DialogContent>
  </Dialog>

  <AlertDialog :open="isArchiveConfirmOpen" @update:open="handleArchiveConfirmChange">
    <AlertDialogContent class="card-dialog__confirm">
      <AlertDialogHeader class="text-left">
        <AlertDialogTitle class="card-dialog__confirm-title">封存這張卡片？</AlertDialogTitle>
        <AlertDialogDescription class="card-dialog__confirm-description">
          「{{ card?.title }}」會從看板上移除。<br />目前無法還原封存的卡片。
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="gap-3">
        <AlertDialogCancel :disabled="isArchiving">取消</AlertDialogCancel>
        <!-- A plain Button, because AlertDialogAction closes before the request finishes. -->
        <Button type="button" :disabled="isArchiving" @click="handleArchive">
          {{ isArchiving ? '封存中…' : '封存' }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Archive, ArrowRight, CircleAlert, Eye, X } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { ApiCode } from '@kanban/contracts/api';
import type {
  AddCategoryResult,
  ArchiveCardResult,
  BoardCardSnapshot,
  BoardColumnSnapshot,
  CardCategorySnapshot,
  CardMutationResult,
  UpdateCardRequest,
} from '@kanban/contracts/board';
import FormField from '@/components/shared/FormField/FormField.vue';
import Input from '@/components/shared/Input/Input.vue';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { archiveCardApi, updateCardApi } from '@/services/board';
import { getApiErrorResponse } from '@/services/http';
import CategoryChip from './CategoryChip.vue';
import CategorySelect from './CategorySelect.vue';

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 5000;

const props = defineProps<{
  card: BoardCardSnapshot | null;
  columnTitle: string;
  canEdit: boolean;
  projectId: string;
  categories: CardCategorySnapshot[];
  // Targets for the "移動至…" menu, in board order.
  columns: Pick<BoardColumnSnapshot, 'id' | 'title'>[];
}>();
const emit = defineEmits<{
  updated: [result: CardMutationResult];
  // The parent moves the card to the bottom of this column and saves it (same flow as dragging).
  move: [toColumnId: string];
  archived: [result: ArchiveCardResult];
  // 409: the parent reloads the board; the dialog then reopens with the latest card.
  reload: [];
  // 404: the card is gone or the user lost edit access.
  stale: [];
  categoryCreated: [result: AddCategoryResult];
}>();
const open = defineModel<boolean>('open', { required: true });

const title = ref('');
const description = ref('');
const categoryId = ref<string | null>(null);
const hasTriedSubmit = ref(false);
const serverTitleError = ref<string | undefined>(undefined);
const hasConflict = ref(false);
const isSaving = ref(false);
const isArchiving = ref(false);
const isArchiveConfirmOpen = ref(false);
const isBusy = computed(() => isSaving.value || isArchiving.value);

const dateFormatter = new Intl.DateTimeFormat('zh-TW', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const metaText = computed(() => {
  if (!props.card) return '';
  const createdAt = dateFormatter.format(new Date(props.card.createdAt));
  const updatedAt = dateFormatter.format(new Date(props.card.updatedAt));
  return `建立於 ${createdAt}　·　最後更新 ${updatedAt}`;
});

const titleError = computed<string | undefined>(() => {
  if (serverTitleError.value) return serverTitleError.value;
  if (!hasTriedSubmit.value) return undefined;
  const trimmed = title.value.trim();
  if (!trimmed) return '卡片標題不可為空';
  if (trimmed.length > TITLE_MAX_LENGTH) return `卡片標題不可超過 ${TITLE_MAX_LENGTH} 字`;
  return undefined;
});

const fillForm = () => {
  title.value = props.card?.title ?? '';
  description.value = props.card?.description ?? '';
  categoryId.value = props.card?.categoryId ?? null;
  hasTriedSubmit.value = false;
  serverTitleError.value = undefined;
  hasConflict.value = false;
};

// Refill whenever the dialog opens or a newer version of the card arrives (e.g. after reload).
watch(
  () => [open.value, props.card?.id, props.card?.version] as const,
  ([isOpen]) => {
    if (isOpen) fillForm();
  },
  { immediate: true },
);

const handleOpenChange = (value: boolean) => {
  if (isBusy.value) return;
  open.value = value;
};

const handleArchiveConfirmChange = (value: boolean) => {
  if (isArchiving.value) return;
  isArchiveConfirmOpen.value = value;
};

const hasMoveTarget = computed(() =>
  props.columns.some((column) => column.id !== props.card?.columnId),
);

const currentCategory = computed(
  () => props.categories.find((category) => category.id === props.card?.categoryId) ?? null,
);

/** Only send fields that actually changed; '' clears the description, null removes the category. */
const buildChanges = (
  card: BoardCardSnapshot,
): Pick<UpdateCardRequest, 'title' | 'description' | 'categoryId'> => {
  const nextTitle = title.value.trim();
  const nextDescription = description.value.trim();
  return {
    ...(nextTitle !== card.title ? { title: nextTitle } : {}),
    ...(nextDescription !== (card.description ?? '') ? { description: nextDescription } : {}),
    ...(categoryId.value !== card.categoryId ? { categoryId: categoryId.value } : {}),
  };
};

const handleStale = () => {
  toast.error('這張卡片已不存在，或你沒有編輯權限。看板已重新載入。');
  isArchiveConfirmOpen.value = false;
  open.value = false;
  emit('stale');
};

const handleSave = async () => {
  const card = props.card;
  hasTriedSubmit.value = true;
  serverTitleError.value = undefined;
  if (!card || hasConflict.value || titleError.value) return;

  const changes = buildChanges(card);
  if (Object.keys(changes).length === 0) {
    handleOpenChange(false);
    return;
  }

  isSaving.value = true;
  try {
    const response = await updateCardApi({
      cardId: card.id,
      expectedVersion: card.version,
      ...changes,
    });
    if (response.data) emit('updated', response.data);
    isSaving.value = false;
    handleOpenChange(false);
  } catch (error) {
    const apiError = getApiErrorResponse(error);
    if (apiError?.code === ApiCode.CardVersionConflict) {
      hasConflict.value = true;
    } else if (apiError?.code === ApiCode.ValidationError) {
      serverTitleError.value = apiError.message;
    } else if (apiError?.code === ApiCode.ResourceNotFound) {
      isSaving.value = false;
      handleStale();
    } else {
      toast.error(apiError?.message ?? '儲存卡片失敗，請稍後再試。');
    }
  } finally {
    isSaving.value = false;
  }
};

const handleArchive = async () => {
  const card = props.card;
  if (!card) return;

  isArchiving.value = true;
  try {
    const response = await archiveCardApi({ cardId: card.id, expectedVersion: card.version });
    isArchiving.value = false;
    isArchiveConfirmOpen.value = false;
    open.value = false;
    if (response.data) emit('archived', response.data);
  } catch (error) {
    const apiError = getApiErrorResponse(error);
    isArchiving.value = false;
    if (apiError?.code === ApiCode.CardVersionConflict) {
      isArchiveConfirmOpen.value = false;
      hasConflict.value = true;
    } else if (apiError?.code === ApiCode.ResourceNotFound) {
      handleStale();
    } else {
      toast.error(apiError?.message ?? '封存卡片失敗，請稍後再試。');
    }
  } finally {
    isArchiving.value = false;
  }
};
</script>

<style scoped src="./card-dialog.css"></style>
