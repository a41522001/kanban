/** BoardColumn 可持久化並跨前後端傳遞的色票 key。 */
export const BOARD_COLUMN_COLOR_KEYS = ['coral', 'mint', 'amber', 'violet'] as const;

export type BoardColumnColorKey = (typeof BOARD_COLUMN_COLOR_KEYS)[number];

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
  columns: BoardColumnSnapshot[];
}

export interface AddCardRequest {
  columnId: string;
  title: string;
  description?: string;
}

/** 新增、編輯卡片的回傳：完整卡片與新的 boardRevision（Board 規格 Q14）。 */
export interface CardMutationResult {
  card: BoardCardSnapshot;
  boardRevision: string;
}
