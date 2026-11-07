import type { ProjectRole } from './project.js';

/** BoardColumn 可持久化並跨前後端傳遞的色票 key。 */
export const BOARD_COLUMN_COLOR_KEYS = ['coral', 'mint', 'amber', 'violet'] as const;

export type BoardColumnColorKey = (typeof BOARD_COLUMN_COLOR_KEYS)[number];

/** CardCategory 可持久化並跨前後端傳遞的色票 key（Board 規格 §4.5）；順序即建立類別時色票的顯示順序。 */
export const CARD_CATEGORY_COLOR_KEYS = [
  'coral',
  'rose',
  'orange',
  'mint',
  'amber',
  'lime',
  'teal',
  'cyan',
  'lavender',
  'indigo',
  'violet',
  'pink',
  'blue',
  'slate',
] as const;

export type CardCategoryColorKey = (typeof CARD_CATEGORY_COLOR_KEYS)[number];

export interface DefaultBoardColumn {
  title: string;
  colorKey: BoardColumnColorKey;
  position: number;
}

export const DEFAULT_BOARD_COLUMNS = [
  {
    title: '準備開始',
    colorKey: 'coral',
    position: 1024,
  },
  {
    title: '正在進行',
    colorKey: 'mint',
    position: 2048,
  },
  {
    title: '等待檢視',
    colorKey: 'amber',
    position: 3072,
  },
  {
    title: '已完成',
    colorKey: 'violet',
    position: 4096,
  },
] as const satisfies ReadonlyArray<DefaultBoardColumn>;

export interface AddBoardColumnRequest {
  projectId: string;
  title: string;
  colorKey: BoardColumnColorKey;
}

/** 新增欄位的回傳：新欄位（cards 為空陣列）與新的 boardRevision。 */
export interface AddColumnResult {
  column: BoardColumnSnapshot;
  boardRevision: string;
}

export interface MoveBoardColumnRequest {
  projectId: string;
  columnId: string;
  beforeColumnId: string | null;
  afterColumnId: string | null;
  expectedBoardRevision: string;
}

/** 看板上的一張卡片；已封存的卡片不會出現在看板上。 */
export interface BoardCardSnapshot {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  /** 沒有類別時為 null；類別內容從 BoardSnapshot.categories 以 id 查找（Board 規格 Q10）。 */
  categoryId: string | null;
  position: number;
  /** 編輯內容時 +1，編輯與封存需帶回作為 expectedVersion。 */
  version: number;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

/** 看板上的一個欄位，含未封存的卡片（依 position 排序）。 */
export interface BoardColumnSnapshot {
  id: string;
  title: string;
  colorKey: BoardColumnColorKey;
  position: number;
  cards: BoardCardSnapshot[];
}

/** `GET /board/:projectId` 的回傳。 */
export interface BoardSnapshot {
  /** Project.boardRevision；BigInt 無法直接 JSON 序列化，以字串傳輸。 */
  boardRevision: string;
  /** 目前使用者在此專案的角色；VIEWER 在前端只能查看。 */
  currentUserRole: ProjectRole;
  /** 專案內所有類別，依 normalizedName 排序；類別選單與卡片 chip 共用（Board 規格 Q10、Q15）。 */
  categories: CardCategorySnapshot[];
  columns: BoardColumnSnapshot[];
}

export interface AddCardRequest {
  columnId: string;
  title: string;
  description?: string;
  /** 必須屬於卡片所在專案，否則 404；不送代表沒有類別。 */
  categoryId?: string;
}

/** 新增、編輯卡片的回傳：完整卡片與新的 boardRevision（Board 規格 Q14）。 */
export interface CardMutationResult {
  card: BoardCardSnapshot;
  boardRevision: string;
}

/** 編輯卡片；title、description、categoryId 只送要改的欄位，至少要送一個。 */
export interface UpdateCardRequest {
  cardId: string;
  /** 不送代表不改；有送時不可為空。 */
  title?: string;
  /** 不送代表不改；空字串或只有空白代表清空。 */
  description?: string;
  /** 不送代表不改；null 代表移除類別；必須屬於卡片所在專案，否則 404。 */
  categoryId?: string | null;
  /** 使用者開始編輯時看到的 version；與目前版本不符時回 409 / CardVersionConflict。 */
  expectedVersion: number;
}

/** 封存卡片。 */
export interface ArchiveCardRequest {
  cardId: string;
  /** 使用者看到的 version；與目前版本不符時回 409 / CardVersionConflict。 */
  expectedVersion: number;
}

/** 封存卡片的回傳：前端用 cardId、columnId 把卡片從畫面上移除。 */
export interface ArchiveCardResult {
  cardId: string;
  columnId: string;
  boardRevision: string;
}

/**
 * 移動卡片（Board 規格 §5.2、§5.3）；回傳 CardMutationResult。
 * 不檢查也不改變 version：拖曳不應讓正在編輯內容的人收到 409。
 */
export interface MoveCardRequest {
  cardId: string;
  /** 目標欄位；可以是卡片目前所在的欄位（同欄內調整順序）。必須屬於同一專案，否則 404。 */
  toColumnId: string;
  /**
   * 放在這張卡片後面；null 代表放在目標欄位最上面。不可等於 cardId（400）；
   * 已不在目標欄位（被移走或封存）時回 409 / CardMoveConflict。
   */
  afterCardId: string | null;
}

/** 卡片類別（Board 規格 §4.5）；同一專案內共用，名稱不分大小寫不可重複。 */
export interface CardCategorySnapshot {
  id: string;
  name: string;
  colorKey: CardCategoryColorKey;
}

/** 建立類別；名稱已存在（trim 後不分大小寫）時回傳既有的那一筆。 */
export interface AddCategoryRequest {
  projectId: string;
  /** trim 後 1–20 字。 */
  name: string;
  colorKey: CardCategoryColorKey;
}

/** 建立類別的回傳；沿用既有類別時 boardRevision 不變。 */
export interface AddCategoryResult {
  category: CardCategorySnapshot;
  boardRevision: string;
}
