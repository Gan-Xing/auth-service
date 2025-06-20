import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsDateString } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ description: '租户名称', example: 'My Company' })
  @IsString()
  @IsNotEmpty({ message: '租户名称不能为空' })
  name: string;

  @ApiProperty({ description: '自定义域名', required: false, example: 'mycompany.com' })
  @IsOptional()
  @IsString()
  domain?: string;
}

export class CreateApiKeyDto {
  @ApiProperty({ description: 'API Key 名称', example: 'Production API Key' })
  @IsString()
  @IsNotEmpty({ message: 'API Key 名称不能为空' })
  name: string;

  @ApiProperty({
    description: '权限列表',
    example: ['auth:read', 'auth:write'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @ApiProperty({
    description: '过期时间',
    required: false,
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class TenantResponseDto {
  @ApiProperty({ description: '租户ID', example: 'uuid-string' })
  id: string;

  @ApiProperty({ description: '租户名称', example: 'My Company' })
  name: string;

  @ApiProperty({ description: '自定义域名', example: 'mycompany.com' })
  domain?: string;

  @ApiProperty({ description: '主 API Key', example: 'uuid-string' })
  apiKey: string;

  @ApiProperty({ description: '是否活跃', example: true })
  isActive: boolean;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class ApiKeyResponseDto {
  @ApiProperty({ description: 'API Key ID', example: 'uuid-string' })
  id: string;

  @ApiProperty({ description: 'API Key 名称', example: 'Production API Key' })
  name: string;

  @ApiProperty({ description: '权限列表', example: ['auth:read', 'auth:write'] })
  permissions: string[];

  @ApiProperty({ description: '是否活跃', example: true })
  isActive: boolean;

  @ApiProperty({ description: '过期时间' })
  expiresAt?: Date;

  @ApiProperty({ description: '最后使用时间' })
  lastUsedAt?: Date;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '实际的 API Key（仅在创建时返回）' })
  key?: string;
}
