import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, Length, Matches } from 'class-validator';
import { IsStrongPassword, IsBusinessEmail, IsValidUsername, IsValidPhoneNumber } from '../../common/validators/auth.validators';

export class LoginDto {
  @ApiProperty({ description: '邮箱地址', example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email: string;

  @ApiProperty({ description: '密码', example: 'Password123!' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度至少为6位' })
  password: string;
}

export class RegisterDto {
  @ApiProperty({ description: '邮箱地址', example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email: string;

  @ApiProperty({ description: '密码', example: 'Password123!' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(8, { message: '密码长度至少为8位' })
  password: string;

  @ApiProperty({ description: '名字', example: 'John' })
  @IsString()
  @IsNotEmpty({ message: '名字不能为空' })
  firstName: string;

  @ApiProperty({ description: '姓氏', example: 'Doe' })
  @IsString()
  @IsNotEmpty({ message: '姓氏不能为空' })
  lastName: string;

  @ApiProperty({ description: '用户名', required: false, example: 'johndoe' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ description: '手机号', required: false, example: '+1234567890' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ description: '国家', required: false, example: 'US' })
  @IsOptional()
  @Length(2, 3, { message: '国家代码必须为2-3个字符' })
  @Matches(/^[A-Z]{2,3}$/, { message: '国家代码必须为大写字母' })
  country?: string;

  @ApiProperty({
    description: '租户ID（通过API Key自动获取）',
    required: false,
    example: 'tenant-uuid',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class RegisterWithCodeDto {
  @ApiProperty({ description: '邮箱地址', example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email: string;

  @ApiProperty({ description: '密码', example: 'Password123!' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(8, { message: '密码长度至少为8位' })
  password: string;

  @ApiProperty({ description: '名字', example: 'John' })
  @IsString()
  @IsNotEmpty({ message: '名字不能为空' })
  firstName: string;

  @ApiProperty({ description: '姓氏', example: 'Doe' })
  @IsString()
  @IsNotEmpty({ message: '姓氏不能为空' })
  lastName: string;

  @ApiProperty({ description: '用户名', required: false, example: 'johndoe' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ description: '手机号', required: false, example: '+1234567890' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ description: '国家', required: false, example: 'US' })
  @IsOptional()
  @Length(2, 3, { message: '国家代码必须为2-3个字符' })
  @Matches(/^[A-Z]{2,3}$/, { message: '国家代码必须为大写字母' })
  country?: string;

  @ApiProperty({ description: '验证Token', example: 'abc123def456' })
  @IsString()
  @IsNotEmpty({ message: '验证Token不能为空' })
  @Length(10, 100, { message: '验证Token长度不正确' })
  verificationToken: string;

  @ApiProperty({ description: '验证码', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: '验证码不能为空' })
  @Matches(/^\d{6}$/, { message: '验证码必须为6位数字' })
  verificationCode: string;

  @ApiProperty({
    description: '租户ID（通过API Key自动获取）',
    required: false,
    example: 'tenant-uuid',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: '刷新Token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  @IsNotEmpty({ message: '刷新Token不能为空' })
  refreshToken: string;
}

export class TokenResponseDto {
  @ApiProperty({ description: '访问Token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ description: '刷新Token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;

  @ApiProperty({ description: '访问Token过期时间(毫秒)', example: 1648771200000 })
  accessExpiresIn: number;

  @ApiProperty({ description: '刷新Token过期时间(毫秒)', example: 1649376000000 })
  refreshExpiresIn: number;

  @ApiProperty({ description: 'Token类型', example: 'Bearer' })
  tokenType = 'Bearer';
}

export class SendVerificationCodeDto {
  @ApiProperty({ description: '邮箱地址', example: 'user@example.com' })
  @IsBusinessEmail({ message: '请提供有效的商业邮箱地址' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email: string;
}

export class RequestPasswordResetDto {
  @ApiProperty({ description: '邮箱地址', example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: '重置Token', example: 'abc123def456' })
  @IsString()
  @IsNotEmpty({ message: '重置Token不能为空' })
  token: string;

  @ApiProperty({ description: '新密码', example: 'NewPassword123!' })
  @IsString()
  @IsNotEmpty({ message: '新密码不能为空' })
  @MinLength(8, { message: '密码长度至少为8位' })
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: '原密码', example: 'OldPassword123!' })
  @IsString()
  @IsNotEmpty({ message: '原密码不能为空' })
  oldPassword: string;

  @ApiProperty({ description: '新密码', example: 'NewPassword123!' })
  @IsString()
  @IsNotEmpty({ message: '新密码不能为空' })
  @MinLength(8, { message: '密码长度至少为8位' })
  newPassword: string;
}
