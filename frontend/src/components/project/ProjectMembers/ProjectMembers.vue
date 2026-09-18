<template>
  <div class="project-members">
    <div class="project-members__heading">
      <div>
        <p class="project-members__eyebrow">{{ t('workspace.projects.selectedProject') }}</p>
        <h3>{{ project.name }}</h3>
      </div>
      <span class="project-members__status" :data-status="project.status">
        {{ t(`workspace.projects.status.${project.status}`) }}
      </span>
    </div>

    <p class="project-members__description">
      {{ project.description || t('workspace.projects.noDescription') }}
    </p>

    <div class="project-members__section-heading">
      <h4>{{ t('workspace.projects.members') }}</h4>
      <span v-if="!loading">{{
        t('workspace.projects.memberCount', { count: members.length })
      }}</span>
    </div>

    <div v-if="loading" class="project-members__list" aria-busy="true">
      <Skeleton v-for="index in 3" :key="index" class="h-12 w-full" />
    </div>
    <p v-else-if="!members.length" class="project-members__empty">
      {{ t('workspace.projects.noMembers') }}
    </p>
    <ul v-else class="project-members__list">
      <li v-for="member in members" :key="member.memberId">
        <img v-if="member.avatarUrl" :src="member.avatarUrl" :alt="member.displayName" />
        <span v-else class="project-members__avatar" aria-hidden="true">
          {{ member.displayName.trim().charAt(0).toUpperCase() }}
        </span>
        <span>{{ member.displayName }}</span>
      </li>
    </ul>

    <Button class="project-members__board-button" @click="$emit('enter-board')">
      {{ t('workspace.actions.enterBoard') }}
      <ArrowRight :size="17" aria-hidden="true" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ArrowRight } from 'lucide-vue-next';
import type { ProjectListItemDto, ProjectMemberDto } from '@kanban/contracts/project';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

defineProps<{ project: ProjectListItemDto; members: ProjectMemberDto[]; loading: boolean }>();
defineEmits<{ 'enter-board': [] }>();
const { t } = useI18n();
</script>

<style scoped src="./ProjectMembers.css"></style>
