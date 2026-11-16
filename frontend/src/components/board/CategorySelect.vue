<template>
  <div class="category-select">
    <button
      id="card-category"
      type="button"
      class="category-select__trigger"
      :class="{ 'category-select__trigger--open': isOpen }"
      :aria-expanded="isOpen"
      aria-controls="card-category-panel"
      :disabled="disabled"
      @click="toggle"
    >
      <CategoryChip
        v-if="selectedCategory"
        :name="selectedCategory.name"
        :color-key="selectedCategory.colorKey"
      />
      <span v-else class="category-select__placeholder">選擇類別</span>
      <ChevronDown :size="18" aria-hidden="true" class="category-select__chevron" />
    </button>

    <div v-if="isOpen" id="card-category-panel" class="category-select__panel">
      <div class="category-select__search">
        <Search :size="18" aria-hidden="true" />
        <input
          ref="searchInput"
          v-model="query"
          type="text"
          class="category-select__search-input"
          placeholder="搜尋或建立類別"
          :maxlength="NAME_MAX_LENGTH"
          aria-label="搜尋或建立類別"
          @keydown.enter.prevent="handleEnter"
          @keydown.esc.prevent="close"
        />
      </div>

      <ul class="category-select__list" role="listbox" aria-label="類別">
        <li>
          <button
            type="button"
            role="option"
            class="category-select__option category-select__option--none"
            :aria-selected="modelValue === null"
            @click="select(null)"
          >
            不設定類別
          </button>
        </li>
        <li v-for="category in filteredCategories" :key="category.id">
          <button
            type="button"
            role="option"
            class="category-select__option"
            :class="{ 'category-select__option--selected': category.id === modelValue }"
            :aria-selected="category.id === modelValue"
            @click="select(category.id)"
          >
            <CategoryChip :name="category.name" :color-key="category.colorKey" />
            <Check
              v-if="category.id === modelValue"
              :size="18"
              aria-hidden="true"
              class="category-select__check"
            />
          </button>
        </li>
        <li v-if="trimmedQuery && filteredCategories.length === 0" class="category-select__empty">
          沒有符合「{{ trimmedQuery }}」的類別
        </li>
      </ul>

      <!-- Create: only when the typed name does not exist yet (case-insensitive, Board spec Q5). -->
      <div v-if="canCreate" class="category-select__create">
        <p class="category-select__create-title">
          <Plus :size="18" aria-hidden="true" />
          建立「{{ trimmedQuery }}」
        </p>
        <p class="category-select__meta">類別色彩</p>
        <div class="category-select__swatches" role="radiogroup" aria-label="類別色彩">
          <button
            v-for="color in cardCategoryColorList"
            :key="color.value"
            type="button"
            role="radio"
            class="category-select__swatch"
            :class="[
              cardCategoryColorMap[color.value].backgroundClass,
              { 'category-select__swatch--selected': color.value === newColorKey },
            ]"
            :aria-checked="color.value === newColorKey"
            :aria-label="color.title"
            :title="color.title"
            @click="newColorKey = color.value"
          />
        </div>
        <div class="category-select__create-actions">
          <span class="category-select__meta">預覽</span>
          <CategoryChip :name="trimmedQuery" :color-key="newColorKey" />
          <Button
            type="button"
            size="sm"
            class="category-select__create-button"
            :loading="isCreating"
            @click="createCategory"
          >
            建立
          </Button>
        </div>
        <p v-if="createError" class="category-select__error" role="alert">{{ createError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { Check, ChevronDown, Plus, Search } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { ApiCode } from '@kanban/contracts/api';
import type {
  AddCategoryResult,
  CardCategoryColorKey,
  CardCategorySnapshot,
} from '@kanban/contracts/board';
import { Button } from '@/components/ui/button';
import { cardCategoryColorList, cardCategoryColorMap } from '@/constants/cardCategoryColors';
import { addCategoryApi } from '@/services/board';
import { getApiErrorResponse } from '@/services/http';
import CategoryChip from './CategoryChip.vue';

const NAME_MAX_LENGTH = 20;

const props = defineProps<{
  projectId: string;
  categories: CardCategorySnapshot[];
  disabled?: boolean;
}>();
const modelValue = defineModel<string | null>({ required: true });
const emit = defineEmits<{
  // The parent adds the category to the board and keeps boardRevision in sync.
  created: [result: AddCategoryResult];
}>();

const isOpen = ref(false);
const query = ref('');
const newColorKey = ref<CardCategoryColorKey>('coral');
const isCreating = ref(false);
const createError = ref<string | undefined>(undefined);
const searchInput = ref<HTMLInputElement | null>(null);

const trimmedQuery = computed(() => query.value.trim());
const normalizedQuery = computed(() => trimmedQuery.value.toLowerCase());

const selectedCategory = computed(
  () => props.categories.find((category) => category.id === modelValue.value) ?? null,
);
const filteredCategories = computed(() =>
  normalizedQuery.value
    ? props.categories.filter((category) =>
        category.name.toLowerCase().includes(normalizedQuery.value),
      )
    : props.categories,
);
const exactMatch = computed(() =>
  props.categories.find((category) => category.name.toLowerCase() === normalizedQuery.value),
);
const canCreate = computed(() => trimmedQuery.value.length > 0 && !exactMatch.value);

/** Default to the first palette color no category uses yet (Board spec Q21). */
const firstUnusedColor = (): CardCategoryColorKey => {
  const used = new Set(props.categories.map((category) => category.colorKey));
  return cardCategoryColorList.find((color) => !used.has(color.value))?.value ?? 'coral';
};

const open = async () => {
  isOpen.value = true;
  query.value = '';
  createError.value = undefined;
  newColorKey.value = firstUnusedColor();
  await nextTick();
  searchInput.value?.focus();
};

const close = () => {
  isOpen.value = false;
};

const toggle = () => (isOpen.value ? close() : void open());

const select = (categoryId: string | null) => {
  modelValue.value = categoryId;
  close();
};

const handleEnter = () => {
  if (exactMatch.value) {
    select(exactMatch.value.id);
  } else if (canCreate.value) {
    void createCategory();
  } else {
    const [onlyMatch, ...others] = filteredCategories.value;
    if (onlyMatch && others.length === 0) select(onlyMatch.id);
  }
};

const createCategory = async () => {
  if (!canCreate.value || isCreating.value) return;
  isCreating.value = true;
  createError.value = undefined;
  try {
    const response = await addCategoryApi({
      projectId: props.projectId,
      name: trimmedQuery.value,
      colorKey: newColorKey.value,
    });
    if (response.data) {
      emit('created', response.data);
      select(response.data.category.id);
    }
  } catch (error) {
    const apiError = getApiErrorResponse(error);
    if (
      apiError?.code === ApiCode.CardCategoryLimitExceeded ||
      apiError?.code === ApiCode.ValidationError
    ) {
      createError.value = apiError.message;
    } else {
      toast.error(apiError?.message ?? '建立類別失敗，請稍後再試。');
    }
  } finally {
    isCreating.value = false;
  }
};
</script>

<style scoped>
@reference '../../styles/index.css';

.category-select {
  @apply grid gap-2;
}

.category-select__trigger {
  @apply flex min-h-13 w-full cursor-pointer items-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-left outline-none transition-colors focus-visible:border-action-primary focus-visible:ring-3 focus-visible:ring-action-primary/20 disabled:cursor-not-allowed disabled:opacity-60;
}

.category-select__trigger--open {
  @apply border-action-primary;
}

.category-select__placeholder {
  @apply text-sm text-content-tertiary;
}

.category-select__chevron {
  @apply ml-auto shrink-0 text-content-secondary;
}

.category-select__panel {
  @apply grid gap-1 rounded-surface border border-border bg-surface p-2 shadow-card;
}

.category-select__search {
  @apply flex items-center gap-2 rounded-control border border-border px-3 text-content-secondary focus-within:border-action-primary;
}

.category-select__search-input {
  @apply h-10 flex-1 bg-transparent text-sm text-content-primary outline-none placeholder:text-content-tertiary;
}

.category-select__list {
  @apply grid max-h-56 gap-0.5 overflow-y-auto py-1;
}

.category-select__option {
  @apply flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-left hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none;
}

.category-select__option--none {
  @apply text-sm text-content-secondary;
}

.category-select__option--selected {
  @apply bg-surface-subtle;
}

.category-select__check {
  @apply ml-auto text-action-primary-hover;
}

.category-select__empty {
  @apply px-2 py-2 text-xs text-content-secondary;
}

.category-select__create {
  @apply grid gap-2 border-t border-border px-2 pt-3 pb-1;
}

.category-select__create-title {
  @apply flex items-center gap-2 text-sm font-bold text-action-primary-hover;
}

.category-select__meta {
  @apply text-xs text-content-secondary;
}

.category-select__swatches {
  @apply flex flex-wrap gap-1.5;
}

.category-select__swatch {
  @apply size-7 cursor-pointer rounded-full border border-border-strong outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-action-primary;
}

.category-select__swatch--selected {
  @apply ring-2 ring-content-primary;
}

.category-select__create-actions {
  @apply flex items-center gap-2;
}

.category-select__create-button {
  @apply ml-auto;
}

.category-select__error {
  @apply text-xs text-feedback-danger;
}
</style>
