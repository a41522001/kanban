import { createRouter, createWebHistory } from 'vue-router';
import LoginView from '@/views/loginView/LoginView.vue';
import SignupView from '@/views/signupView/SignupView.vue';
import BoardView from '@/views/boardView/BoardView.vue';
import { useUserStore } from '@/stores/user';

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
  const user = await userStore.initializeUser();

  if (user) {
    return true;
  }

  return { name: 'login' };
});

export default router;
