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
</template>

<script setup lang="ts">
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
