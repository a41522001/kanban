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

/** 後端 `GET /board/:projectId` 目前回傳的欄位資料。 */
export interface BoardColumnRecord {
  id: string;
  projectId: string;
  title: string;
  position: number;
  colorKey: BoardColumnColorKey;
  version: number;
}

/** Board 畫面使用的欄位資料；Card persistence 接上前 cards 維持空陣列。 */
export interface BoardColumnData extends BoardColumnRecord {
  cards: BoardCardData[];
}
