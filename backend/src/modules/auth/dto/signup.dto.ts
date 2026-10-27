import type { SignupRequest } from '@kanban/contracts/auth';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto implements SignupRequest {
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
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: '登入密碼',
    example: 'password123',
    minLength: 8,
    maxLength: 72,
    format: 'password',
  })
  @IsString({ message: '密碼必須是字串' })
  @MinLength(8, { message: '密碼至少需要 8 個字元' })
  @MaxLength(72, { message: '密碼不可超過 72 個字元' })
  @IsNotEmpty()
  password!: string;

  @ApiProperty({
    description: '顯示名稱',
    example: 'Jeffery',
    maxLength: 100,
  })
  @Transform((params: TransformFnParams): unknown => {
    const rawValue: unknown = params.value;
    return typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  })
  @IsString({ message: '名稱必須是字串' })
  @MaxLength(100, { message: '名稱不可超過 100 個字元' })
  @IsNotEmpty()
  name!: string;
}
