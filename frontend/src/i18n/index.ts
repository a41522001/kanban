import { createI18n } from 'vue-i18n';
import { zhTW } from './locales/zh-TW';
import { en } from './locales/en';
export const i18n = createI18n({
  legacy: false,
  locale: 'zh-TW',
  fallbackLocale: 'en',
  messages: {
    'zh-TW': zhTW,
    en,
  },
});
