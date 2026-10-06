/** BoardColumn 可持久化並跨前後端傳遞的色票 key。 */
export const BOARD_COLUMN_COLOR_KEYS = [
  'coral',
  'mint',
  'amber',
  'violet',
] as const;

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
