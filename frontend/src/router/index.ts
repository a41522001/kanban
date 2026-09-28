import { createRouter, createWebHistory } from 'vue-router';
import LoginView from '@/views/loginView/LoginView.vue';
import SignupView from '@/views/signupView/SignupView.vue';
import ProjectView from '@/views/projectView/ProjectView.vue';
import WorkspaceView from '@/views/workspaceView/WorkspaceView.vue';
import { useUserStore } from '@/stores/user';
import { useNotificationStore } from '@/stores/notification';
import { ensureConnected } from '@/services/socket';

import CheckEmailView from '@/views/checkEmailView/CheckEmailView.vue';
import EmailVerifyView from '@/views/emailVerifyView/EmailVerifyView.vue';
import { useEmailVerificationStore } from '@/stores/emailVerification';

const routes = [
  {
    path: '/checkEmail',
    name: 'checkEmail',
    component: CheckEmailView,
    meta: { public: true },
  },
  {
    path: '/verifyEmail/:token',
    name: 'verifyEmail',
    component: EmailVerifyView,
    meta: { public: true },
  },
  {
    path: '/verifyEmail',
    name: 'verifyEmailMissingToken',
    component: EmailVerifyView,
    meta: { public: true },
  },
  {
    path: '/login',
    name: 'login',
    meta: { public: true },
    component: LoginView,
  },
  {
    path: '/signup',
    name: 'signup',
    meta: { public: true },
    component: SignupView,
  },
  {
    path: '/projects/:projectId',
    name: 'projects',
    component: ProjectView,
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
  if (to.name === 'checkEmail' && !useEmailVerificationStore().email) {
    return { name: 'login' };
  }
  if (to.meta.public) {
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
