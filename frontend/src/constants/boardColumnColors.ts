import type { BoardColumnColorKey } from '@kanban/contracts/board';

interface BoardColumnColorClasses {
  accentClass: string;
}

/**
 * 將持久化的 colorKey 映射為前端樣式。
 * Database／API 不保存 Tailwind class，避免設計實作洩漏到 domain data。
 */
export const boardColumnColorMap = {
  coral: {
    accentClass: 'board__column-accent--coral',
  },
  mint: {
    accentClass: 'board__column-accent--mint',
  },
  amber: {
    accentClass: 'board__column-accent--amber',
  },
  violet: {
    accentClass: 'board__column-accent--violet',
  },
} as const satisfies Record<BoardColumnColorKey, BoardColumnColorClasses>;

/** 新增／編輯 BoardColumn 時顯示的固定色票。 */
export const boardColumnColorList: ReadonlyArray<{
  value: BoardColumnColorKey;
  title: string;
}> = [
  { value: 'coral', title: '珊瑚橘' },
  { value: 'mint', title: '薄荷綠' },
  { value: 'amber', title: '琥珀黃' },
  { value: 'violet', title: '紫羅蘭' },
];
