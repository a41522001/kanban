import type { MoveBoardColumnRequest } from '@kanban/contracts/board';

export class MoveBoardColumnDto implements MoveBoardColumnRequest {
  projectId!: string;
  columnId!: string;
  beforeColumnId!: string | null;
  afterColumnId!: string | null;
  expectedBoardRevision!: string;
}
