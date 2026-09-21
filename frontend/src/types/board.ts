import type { BoardColumnColorKey } from '@kanban/contracts/board';

export type CardCategoryColorKey =
  | 'coral'
  | 'rose'
  | 'orange'
  | 'amber'
  | 'lime'
  | 'mint'
  | 'teal'
  | 'cyan'
  | 'blue'
  | 'indigo'
  | 'lavender'
  | 'violet'
  | 'pink'
  | 'slate';

export interface CardCategoryData {
  name: string;
  colorKey: CardCategoryColorKey;
}

export interface BoardCardData {
  id: string;
  columnId: string;
  title: string;
  category: CardCategoryData;
  labels: string[];
  position: number;
  version: number;
}

export interface BoardColumnData {
  id: string;
  boardId: string;
  title: string;
  position: number;
  colorKey: BoardColumnColorKey;
  cards: BoardCardData[];
  version: number;
}
