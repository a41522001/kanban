import { defineStore } from 'pinia';
import { ref } from 'vue';

const storageKey = 'flowboard:email-verification';
type VerificationEntry = 'login' | 'signup' | 'signup-error';

// 僅保存提示頁的信箱與倒數；不保存密碼、Session 或驗證 token。
export const useEmailVerificationStore = defineStore('emailVerification', () => {
  const email = ref('');
  const retryAt = ref(0);
  const entry = ref<VerificationEntry>('login');

  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    if (saved && typeof saved.email === 'string' && typeof saved.retryAt === 'number') {
      email.value = saved.email;
      retryAt.value = saved.retryAt;
      if (saved.entry === 'signup' || saved.entry === 'signup-error') {
        entry.value = saved.entry;
      }
    }
  } catch {
    // 瀏覽器不允許暫存或資料損壞時，仍可由登入流程重新帶入資料。
  }

  const save = () => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ email: email.value, retryAt: retryAt.value, entry: entry.value }),
      );
    } catch {
      // 暫存不可用只影響重新整理，不影響本次操作。
    }
  };

  const setEmail = (value: string) => {
    if (email.value !== value) retryAt.value = 0;
    email.value = value;
    entry.value = 'login';
    save();
  };

  const setSignupResult = (value: string, emailQueued: boolean, seconds: number) => {
    email.value = value;
    entry.value = emailQueued ? 'signup' : 'signup-error';
    retryAt.value = Date.now() + Math.max(0, seconds) * 1000;
    save();
  };

  const startCooldown = (seconds: number) => {
    // 保存截止時間，背景分頁或重新整理不會讓倒數重新開始。
    retryAt.value = Date.now() + Math.max(0, seconds) * 1000;
    save();
  };

  const clear = () => {
    email.value = '';
    retryAt.value = 0;
    entry.value = 'login';
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // 記憶體中的資料已清除。
    }
  };

  return { email, retryAt, entry, setEmail, setSignupResult, startCooldown, clear };
});
