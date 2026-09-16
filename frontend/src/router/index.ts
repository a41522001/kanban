import { createRouter, createWebHistory } from 'vue-router';
import LoginView from '@/views/loginView/LoginView.vue';
import SignupView from '@/views/signupView/SignupView.vue';
import BoardView from '@/views/boardView/BoardView.vue';
import WorkspaceView from '@/views/workspaceView/WorkspaceView.vue';
import { useUserStore } from '@/stores/user';
import { useNotificationStore } from '@/stores/notification';
import { ensureConnected } from '@/services/socket';

const publicPaths = new Set(['/login', '/signup']);

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
  },
  {
    path: '/signup',
    name: 'signup',
    component: SignupView,
  },
  {
    path: '/board',
    name: 'board',
    component: BoardView,
  },
  {
    path: '/workspace',
    name: 'workspace',
    component: WorkspaceView,
  },
];
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  if (publicPaths.has(to.path)) {
    return true;
  }

  const userStore = useUserStore();
  const notificationStore = useNotificationStore();
  const user = await userStore.initializeUser();

  if (user) {
    ensureConnected();
    notificationStore.startRealtime();
    return true;
  }

  return { name: 'login' };
});

export default router;
