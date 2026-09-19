<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="project-dialog" :show-close-button="false">
      <DialogHeader>
        <DialogTitle>{{ t('workspace.projectDialog.title') }}</DialogTitle>
        <DialogDescription>
          {{ t('workspace.projectDialog.description', { workspace: workspaceName }) }}
        </DialogDescription>
      </DialogHeader>

      <form class="project-dialog__form" @submit.prevent="handleSubmit">
        <FormField
          input-id="project-name"
          :label="t('workspace.projectDialog.nameLabel')"
          required
          :error="nameError"
        >
          <template #default="{ invalid, describedBy }">
            <Input
              id="project-name"
              v-model="name"
              :maxlength="100"
              :placeholder="t('workspace.projectDialog.namePlaceholder')"
              :invalid="invalid"
              :aria-describedby="describedBy"
              @blur="hasTriedSubmit = true"
            />
          </template>
        </FormField>

        <FormField
          input-id="project-description"
          :label="t('workspace.projectDialog.descriptionLabel')"
        >
          <textarea
            id="project-description"
            v-model="description"
            class="project-dialog__textarea"
            :maxlength="500"
            :placeholder="t('workspace.projectDialog.descriptionPlaceholder')"
            rows="4"
          />
        </FormField>

        <DialogFooter class="project-dialog__footer">
          <Button
            type="button"
            variant="outline"
            :disabled="isCreating"
            @click="handleOpenChange(false)"
          >
            {{ t('workspace.actions.cancel') }}
          </Button>
          <Button type="submit" :loading="isCreating">{{
            t('workspace.actions.createProject')
          }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import FormField from '@/components/shared/FormField/FormField.vue';
import Input from '@/components/shared/Input/Input.vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApiErrorResponse } from '@/services/http';
import { useProjectStore } from '@/stores/project';

const props = defineProps<{ open: boolean; workspaceId: string; workspaceName: string }>();
const emit = defineEmits<{ 'update:open': [value: boolean]; created: [] }>();
const { t } = useI18n();
const projectStore = useProjectStore();
const name = ref('');
const description = ref('');
const hasTriedSubmit = ref(false);
const isCreating = ref(false);

const nameError = computed(() => {
  if (!hasTriedSubmit.value) return undefined;
  if (!name.value.trim()) return t('workspace.projectValidation.nameRequired');
  if (name.value.trim().length > 100) return t('workspace.projectValidation.nameMaxLength');
  return undefined;
});

const reset = () => {
  name.value = '';
  description.value = '';
  hasTriedSubmit.value = false;
};

const handleOpenChange = (value: boolean) => {
  if (isCreating.value) return;
  emit('update:open', value);
  if (!value) reset();
};

const handleSubmit = async () => {
  hasTriedSubmit.value = true;
  if (nameError.value) return;
  isCreating.value = true;
  try {
    const trimmedDescription = description.value.trim();
    await projectStore.createProject({
      workspaceId: props.workspaceId,
      name: name.value.trim(),
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
    });
    emit('created');
    emit('update:open', false);
    reset();
  } catch (error) {
    toast.error(getApiErrorResponse(error)?.message ?? t('error.requestFailed'));
  } finally {
    isCreating.value = false;
  }
};
</script>

<style scoped src="./CreateProjectDialog.css"></style>
