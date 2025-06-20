import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export class UserResponseDto {
  @ApiProperty({ description: '用户ID' })
  id: number;

  @ApiProperty({ description: '邮箱地址' })
  email: string;

  @ApiProperty({ description: '用户名' })
  username?: string;

  @ApiProperty({ description: '名字' })
  firstName?: string;

  @ApiProperty({ description: '姓氏' })
  lastName?: string;

  @ApiProperty({ description: '手机号' })
  phoneNumber?: string;

  @ApiProperty({ description: '国家' })
  country?: string;

  @ApiProperty({ description: '是否激活' })
  isActive: boolean;

  @ApiProperty({ description: '是否已验证' })
  isVerified: boolean;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;

  @ApiProperty({ description: '最后登录时间' })
  lastLoginAt?: Date;

  // 排除敏感信息
  @Exclude()
  password: string;

  @Exclude()
  hashedRt?: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
