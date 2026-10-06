import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { PublicUser } from '@kanban/contracts/user';
import { getUserInfoApi } from '@/services/user';

export const useUserStore = defineStore('userStore', () => {
  const user = ref<PublicUser | null>(null);
  const hasCheckedSession = ref(false);
  const hasUser = computed(() => user.value !== null);
  let pendingUserRequest: Promise<PublicUser | null> | null = null;

  const initializeUser = (): Promise<PublicUser | null> => {
    if (hasCheckedSession.value) {
      return Promise.resolve(user.value);
    }

    if (pendingUserRequest) {
      return pendingUserRequest;
    }

    pendingUserRequest = getUserInfoApi()
      .then((response) => {
        user.value = response.data;
        return user.value;
      })
      .catch(() => {
        user.value = null;
        return null;
      })
      .finally(() => {
        hasCheckedSession.value = true;
        pendingUserRequest = null;
      });

    return pendingUserRequest;
  };

  const resetUser = () => {
    user.value = null;
    hasCheckedSession.value = false;
  };

  return {
    user,
    hasUser,
    hasCheckedSession,
    initializeUser,
    resetUser,
  };
});
