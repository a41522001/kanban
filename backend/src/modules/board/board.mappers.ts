import type {
  BoardCardSnapshot,
  CardCategoryColorKey,
  CardCategorySnapshot,
} from '@kanban/contracts/board';

/** Prisma 查出的卡片欄位（日期仍是 Date）。 */
export type CardRecord = Omit<BoardCardSnapshot, 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
};

/** 轉成回傳給前端的格式：日期改為 ISO 8601 字串。 */
export const toCardSnapshot = (card: CardRecord): BoardCardSnapshot => ({
  ...card,
  createdAt: card.createdAt.toISOString(),
  updatedAt: card.updatedAt.toISOString(),
});

/** colorKey is stored as a string; the DTO only ever writes contract keys. */
export const toCategorySnapshot = (category: {
  id: string;
  name: string;
  colorKey: string;
}): CardCategorySnapshot => ({
  id: category.id,
  name: category.name,
  colorKey: category.colorKey as CardCategoryColorKey,
});
