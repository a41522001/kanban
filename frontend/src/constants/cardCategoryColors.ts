import type { CardCategoryColorKey } from '@/types/board';

interface CardCategoryColorClasses {
  backgroundClass: string;
  textClass: string;
}

export const cardCategoryColorMap = {
  coral: {
    backgroundClass: 'bg-category-coral-soft',
    textClass: 'text-category-coral',
  },
  rose: {
    backgroundClass: 'bg-category-rose-soft',
    textClass: 'text-category-rose',
  },
  orange: {
    backgroundClass: 'bg-category-orange-soft',
    textClass: 'text-category-orange',
  },
  mint: {
    backgroundClass: 'bg-category-mint-soft',
    textClass: 'text-category-mint',
  },
  amber: {
    backgroundClass: 'bg-category-amber-soft',
    textClass: 'text-category-amber',
  },
  lime: {
    backgroundClass: 'bg-category-lime-soft',
    textClass: 'text-category-lime',
  },
  teal: {
    backgroundClass: 'bg-category-teal-soft',
    textClass: 'text-category-teal',
  },
  cyan: {
    backgroundClass: 'bg-category-cyan-soft',
    textClass: 'text-category-cyan',
  },
  lavender: {
    backgroundClass: 'bg-category-lavender-soft',
    textClass: 'text-category-lavender',
  },
  indigo: {
    backgroundClass: 'bg-category-indigo-soft',
    textClass: 'text-category-indigo',
  },
  violet: {
    backgroundClass: 'bg-category-violet-soft',
    textClass: 'text-category-violet',
  },
  pink: {
    backgroundClass: 'bg-category-pink-soft',
    textClass: 'text-category-pink',
  },
  blue: {
    backgroundClass: 'bg-category-blue-soft',
    textClass: 'text-category-blue',
  },
  slate: {
    backgroundClass: 'bg-category-slate-soft',
    textClass: 'text-category-slate',
  },
} as const satisfies Record<CardCategoryColorKey, CardCategoryColorClasses>;

export const cardCategoryColorList: ReadonlyArray<{
  value: CardCategoryColorKey;
  title: string;
}> = [
  { value: 'coral', title: '珊瑚橘' },
  { value: 'rose', title: '玫瑰紅' },
  { value: 'orange', title: '暖橘色' },
  { value: 'mint', title: '薄荷綠' },
  { value: 'amber', title: '琥珀黃' },
  { value: 'lime', title: '萊姆綠' },
  { value: 'teal', title: '青綠色' },
  { value: 'cyan', title: '青藍色' },
  { value: 'lavender', title: '薰衣草紫' },
  { value: 'indigo', title: '靛藍色' },
  { value: 'violet', title: '紫羅蘭' },
  { value: 'pink', title: '桃紅色' },
  { value: 'blue', title: '天空藍' },
  { value: 'slate', title: '石板灰' },
];
