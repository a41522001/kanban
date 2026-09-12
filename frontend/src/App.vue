<template>
  <!-- <p>websocket狀態: {{ isConnected ? '已連線' : '未連線' }}</p>
  <button class="btn bg-emerald-500" :disabled="isConnected" @click="handleConnect">連線</button>
  <button class="btn bg-red-500" :disabled="!isConnected" @click="handleDisconnect">離線</button>
  <div>
    <input v-model="message" class="input mx-2" type="text" />
    <button class="btn bg-blue-500" :disabled="!isConnected" @click="handleEcho">送出訊息</button>
  </div> -->
  <div class="min-h-dvh h-full bg-auth-page">
    <router-view />
  </div>
  <Toaster position="top-right" />
  <Alert />
  <Loading />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import Alert from '@/components/app/Alert/Alert.vue';
import Loading from '@/components/app/Loading/Loading.vue';
import { Toaster } from '@/components/ui/sonner';
import { sessionExpiredEvent } from '@/services/http';
import { useNotificationStore } from '@/stores/notification';
import { useUserStore } from '@/stores/user';
import { useWorkspaceStore } from '@/stores/workspace';

const router = useRouter();
const notificationStore = useNotificationStore();
const userStore = useUserStore();
const workspaceStore = useWorkspaceStore();

const handleSessionExpired = () => {
  notificationStore.resetNotifications();
  userStore.resetUser();
  workspaceStore.resetWorkspaces();

  if (router.currentRoute.value.name !== 'login') {
    void router.replace({ name: 'login' });
  }
};

onMounted(() => {
  window.addEventListener(sessionExpiredEvent, handleSessionExpired);
});

onUnmounted(() => {
  window.removeEventListener(sessionExpiredEvent, handleSessionExpired);
});

// import { ref } from 'vue';
// import { socket, connect, disconnect, emitEcho, isConnected } from '@/services/socket';
// const message = ref<string>('');

// const handleConnect = () => {
//   connect();
// };
// const handleDisconnect = () => {
//   disconnect();
// };
// const handleEcho = () => {
//   if (message.value.trim() === '') {
//     console.log('請輸入訊息');
//     return;
//   }
//   emitEcho(message.value);
// };
// socket.on('demo:echoed', (payload) => {
//   console.log(payload);
// });
</script>

<style scoped></style>
