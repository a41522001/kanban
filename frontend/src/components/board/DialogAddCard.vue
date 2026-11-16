<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="card-dialog" :show-close-button="false">
      <DialogHeader class="card-dialog__header">
        <p class="card-dialog__eyebrow">卡片</p>
        <DialogTitle class="card-dialog__title">新增卡片</DialogTitle>
        <DialogDescription class="sr-only">在指定欄位最下面新增一張卡片。</DialogDescription>
      </DialogHeader>

      <DialogClose
        aria-label="關閉新增卡片視窗"
        class="card-dialog__close"
        :disabled="isCreating"
      >
        <X :size="18" aria-hidden="true" />
      </DialogClose>

      <form class="card-dialog__form" novalidate @submit.prevent="handleSubmit">
        <div v-if="column" class="card-dialog__target" data-testid="target-column">
          <span class="card-dialog__accent" :class="`card-dialog__accent--${column.colorKey}`" />
          <div class="card-dialog__target-text">
            <span class="card-dialog__meta">新增至</span>
            <span class="card-dialog__target-title">{{ column.title }}</span>
          </div>
          <span class="card-dialog__meta">新增在欄位最下面</span>
        </div>

        <FormField
          input-id="card-title"
          label="卡片標題"
          required
          :error="titleError"
          hint="請用一句可執行、方便團隊理解的工作名稱。"
        >
          <template #default="{ invalid, describedBy }">
            <Input
              id="card-title"
              v-model="title"
              :maxlength="TITLE_MAX_LENGTH"
              placeholder="例如：建立使用者註冊 API"
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
            :disabled="isCreating"
            @created="emit('categoryCreated', $event)"
          />
        </FormField>

        <FormField input-id="card-description" label="描述">
          <textarea
            id="card-description"
            v-model="description"
            class="card-dialog__textarea"
            :maxlength="DESCRIPTION_MAX_LENGTH"
            placeholder="補充背景、驗收條件或相關連結（選填）"
            rows="5"
          />
          <span class="card-dialog__counter">
            {{ description.length }} / {{ DESCRIPTION_MAX_LENGTH }}
          </span>
        </FormField>

        <DialogFooter class="card-dialog__footer">
          <p class="card-dialog__footer-hint">建立後可在卡片詳情中修改。</p>
          <Button
            type="button"
            variant="outline"
            :disabled="isCreating"
            @click="handleOpenChange(false)"
          >
            取消
          </Button>
          <Button type="submit" :loading="isCreating">
            <Plus :size="16" aria-hidden="true" />
            建立
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Plus, X } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { ApiCode } from '@kanban/contracts/api';
import type {
  AddCategoryResult,
  BoardColumnSnapshot,
  CardCategorySnapshot,
  CardMutationResult,
} from '@kanban/contracts/board';
import FormField from '@/components/shared/FormField/FormField.vue';
import Input from '@/components/shared/Input/Input.vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { addCardApi } from '@/services/board';
import { getApiErrorResponse } from '@/services/http';
import CategorySelect from './CategorySelect.vue';

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 5000;

const props = defineProps<{
  column: BoardColumnSnapshot | null;
  projectId: string;
  categories: CardCategorySnapshot[];
}>();
const emit = defineEmits<{
  created: [result: CardMutationResult];
  categoryCreated: [result: AddCategoryResult];
  // The column is gone or the user lost edit access; the board should reload.
  stale: [];
}>();
const open = defineModel<boolean>('open', { required: true });

const title = ref('');
const description = ref('');
const categoryId = ref<string | null>(null);
const hasTriedSubmit = ref(false);
const serverTitleError = ref<string | undefined>(undefined);
const isCreating = ref(false);

const titleError = computed<string | undefined>(() => {
  if (serverTitleError.value) return serverTitleError.value;
  if (!hasTriedSubmit.value) return undefined;
  const trimmed = title.value.trim();
  if (!trimmed) return '卡片標題不可為空';
  if (trimmed.length > TITLE_MAX_LENGTH) return `卡片標題不可超過 ${TITLE_MAX_LENGTH} 字`;
  return undefined;
});

const reset = () => {
  title.value = '';
  description.value = '';
  categoryId.value = null;
  hasTriedSubmit.value = false;
  serverTitleError.value = undefined;
};

const handleOpenChange = (value: boolean) => {
  if (isCreating.value) return;
  open.value = value;
  if (!value) reset();
};

const handleSubmit = async () => {
  hasTriedSubmit.value = true;
  serverTitleError.value = undefined;
  if (titleError.value || !props.column) return;

  isCreating.value = true;
  try {
    const trimmedDescription = description.value.trim();
    const response = await addCardApi({
      columnId: props.column.id,
      title: title.value.trim(),
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      ...(categoryId.value ? { categoryId: categoryId.value } : {}),
    });
    if (response.data) emit('created', response.data);
    isCreating.value = false;
    handleOpenChange(false);
  } catch (error) {
    const apiError = getApiErrorResponse(error);
    if (apiError?.code === ApiCode.ValidationError) {
      // Keep the user's input; show the server message under the title field.
      serverTitleError.value = apiError.message;
    } else if (apiError?.code === ApiCode.ResourceNotFound) {
      toast.error('這個欄位已不存在，或你沒有編輯權限。看板已重新載入。');
      emit('stale');
      isCreating.value = false;
      handleOpenChange(false);
    } else {
      toast.error(apiError?.message ?? '新增卡片失敗，請稍後再試。');
    }
  } finally {
    isCreating.value = false;
  }
};
</script>

<style scoped src="./card-dialog.css"></style>
