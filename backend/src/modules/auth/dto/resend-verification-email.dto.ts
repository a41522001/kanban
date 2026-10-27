import { ApiProperty } from '@nestjs/swagger';
import type { ResendVerificationEmailRequest } from '@kanban/contracts/auth';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class ResendVerificationEmailDto implements ResendVerificationEmailRequest {
  @ApiProperty({
    description: '要重寄驗證信的 Email',
    example: 'jeffery@example.com',
    maxLength: 320,
  })
  @Transform((params: TransformFnParams): unknown => {
    const rawValue: unknown = params.value;
    return typeof rawValue === 'string'
      ? rawValue.trim().toLowerCase()
      : rawValue;
  })
  @IsEmail({}, { message: 'Email 格式不正確' })
  @MaxLength(320, { message: 'Email 長度不可超過 320 個字元' })
  @IsNotEmpty({ message: 'Email 不可為空' })
  email!: string;
}
