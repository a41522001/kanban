import { createRouter, createWebHistory } from 'vue-router';
import LoginView from '@/views/loginView/LoginView.vue';
import SignupView from '@/views/signupView/SignupView.vue';
import BoardView from '@/views/boardView/BoardView.vue';
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

export default router;
