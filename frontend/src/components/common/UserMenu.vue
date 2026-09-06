<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action-primary/20"
        :aria-label="t('userMenu.open')"
      >
        <Avatar :name="user.displayName" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-72">
      <DropdownMenuLabel class="px-3 py-2">
        <p class="truncate text-sm font-semibold text-content-primary">{{ user.displayName }}</p>
        <p class="mt-0.5 truncate text-xs font-normal text-content-secondary">{{ user.email }}</p>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled>
        <Settings :size="16" aria-hidden="true" />
        {{ t('userMenu.accountSettings') }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" :disabled="isLoggingOut" @select="handleLogout">
        <LogOut :size="16" aria-hidden="true" />
        {{ isLoggingOut ? t('userMenu.loggingOut') : t('userMenu.logout') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { LogOut, Settings } from 'lucide-vue-next';
import type { PublicUser } from '@kanban/contracts/user';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Avatar from '@/components/common/Avatar.vue';
import { logoutApi } from '@/services/auth';
import { useUserStore } from '@/stores/user';
import { useWorkspaceStore } from '@/stores/workspace';

interface Props {
  user: PublicUser;
}

defineProps<Props>();

const { t } = useI18n();
const router = useRouter();
const userStore = useUserStore();
const workspaceStore = useWorkspaceStore();
const isLoggingOut = ref(false);

const handleLogout = async () => {
  if (isLoggingOut.value) {
    return;
  }

  isLoggingOut.value = true;

  try {
    await logoutApi();
  } catch {
    // Request 無法送達時仍清除本機登入狀態，避免受保護頁面繼續可用。
  } finally {
    userStore.resetUser();
    workspaceStore.resetWorkspaces();
    await router.replace({ name: 'login' });
    isLoggingOut.value = false;
  }
};
</script>
