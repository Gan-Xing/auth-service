import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsUrl } from 'class-validator';

export class OAuthCallbackDto {
  @ApiProperty({ description: 'OAuth授权码', example: 'abc123def456' })
  @IsString()
  code: string;

  @ApiProperty({ description: '状态参数', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ description: '错误码', required: false })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiProperty({ description: '错误描述', required: false })
  @IsOptional()
  @IsString()
  error_description?: string;
}

export class OAuthUserDto {
  @ApiProperty({ description: '第三方用户ID' })
  @IsString()
  providerId: string;

  @ApiProperty({ description: '用户名' })
  @IsString()
  username: string;

  @ApiProperty({ description: '邮箱地址' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '名字' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: '姓氏', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: '头像URL', required: false })
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiProperty({ description: '第三方提供商', example: 'github' })
  @IsString()
  provider: string;

  @ApiProperty({ description: '访问令牌', required: false })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiProperty({ description: '刷新令牌', required: false })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class OAuthLinkAccountDto {
  @ApiProperty({ description: '第三方提供商', example: 'github' })
  @IsString()
  provider: string;

  @ApiProperty({ description: '第三方用户ID' })
  @IsString()
  providerId: string;

  @ApiProperty({ description: '第三方用户名' })
  @IsString()
  providerUsername: string;

  @ApiProperty({ description: '头像URL', required: false })
  @IsOptional()
  @IsUrl()
  avatar?: string;
}

export class OAuthUnlinkAccountDto {
  @ApiProperty({ description: '第三方提供商', example: 'github' })
  @IsString()
  provider: string;
}