export const DEFAULT_BOARD_COLUMNS = [
  {
    title: '準備開始',
    colorKey: 'ready',
    position: 1024,
  },
  {
    title: '正在進行',
    colorKey: 'active',
    position: 2048,
  },
  {
    title: '等待檢視',
    colorKey: 'review',
    position: 3072,
  },
  {
    title: '已完成',
    colorKey: 'done',
    position: 4096,
  },
] as const;
