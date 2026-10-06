import type { PinnedProjectRequest } from '@kanban/contracts/project';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class PinnedProjectDto implements PinnedProjectRequest {
  @ApiProperty({
    description:
      '是否將目前使用者的專案置頂；true 會寫入置頂時間，false 會取消置頂',
    example: true,
  })
  @IsBoolean({ message: 'pinned 必須是布林值' })
  pinned!: boolean;
}
