import type { LoginRequest } from '@kanban/contracts/auth';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto implements LoginRequest {
  @ApiProperty({
    description: '使用者登入 Email',
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
  @IsString({ message: 'Email 必須是字串' })
  @IsNotEmpty({ message: 'Email 不可為空' })
  email!: string;

  @ApiProperty({
    description: '登入密碼',
    example: 'password123',
    minLength: 8,
    maxLength: 72,
    format: 'password',
  })
  @MaxLength(72, { message: '密碼不可超過 72 個字元' })
  @MinLength(8, { message: '密碼至少需要 8 個字元' })
  @IsString({ message: '密碼必須是字串' })
  @IsNotEmpty({ message: '密碼不可為空' })
  password!: string;
}
