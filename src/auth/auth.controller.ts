import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import {
  LoginDto,
  RegisterDto,
  RegisterWithCodeDto,
  RefreshTokenDto,
  SendVerificationCodeDto,
  ResetPasswordDto,
  RequestPasswordResetDto,
  ChangePasswordDto,
  TokenResponseDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 每分钟最多5次登录尝试
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功', type: TokenResponseDto })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  async login(@Body() loginDto: LoginDto, @Request() req: any): Promise<TokenResponseDto> {
    return this.authService.login(loginDto, req.tenant?.id);
  }

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 每分钟最多3次注册尝试
  @ApiOperation({ summary: '用户注册（基础版本）' })
  @ApiResponse({ status: 201, description: '注册成功', type: TokenResponseDto })
  @ApiResponse({ status: 409, description: '用户已存在' })
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  async register(@Body() registerDto: RegisterDto, @Request() req: any): Promise<TokenResponseDto> {
    return this.authService.register(registerDto, req.tenant?.id);
  }

  @Post('register-with-code')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 每分钟最多3次验证码注册尝试
  @ApiOperation({ summary: '邮箱验证码注册' })
  @ApiResponse({ status: 201, description: '注册成功', type: TokenResponseDto })
  @ApiResponse({ status: 400, description: '验证码无效' })
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  async registerWithCode(@Body() registerDto: RegisterWithCodeDto, @Request() req: any): Promise<TokenResponseDto> {
    return this.authService.registerWithVerificationCode({ ...registerDto, tenantId: req.tenant?.id });
  }

  @Post('send-verification-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 60000 } }) // 每分钟最多2次验证码发送
  @ApiOperation({ summary: '发送邮箱验证码' })
  @ApiResponse({ status: 200, description: '验证码发送成功' })
  @ApiResponse({ status: 400, description: '发送失败或频率限制' })
  async sendVerificationCode(@Body() sendCodeDto: SendVerificationCodeDto) {
    return this.authService.sendEmailVerificationCode(sendCodeDto.email);
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 300000 } }) // 每5分钟最多2次密码重置请求
  @ApiOperation({ summary: '申请密码重置' })
  @ApiResponse({ status: 200, description: '重置邮件已发送' })
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  async requestPasswordReset(@Body() requestDto: RequestPasswordResetDto, @Request() req: any) {
    return this.authService.requestPasswordReset(requestDto.email, req.tenant?.id);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 每5分钟最多3次密码重置执行
  @ApiOperation({ summary: '重置密码' })
  @ApiResponse({ status: 200, description: '密码重置成功' })
  @ApiResponse({ status: 400, description: '重置链接无效或已过期' })
  async resetPassword(@Body() resetDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetDto);
  }

  @Patch('change-password')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 300000 } }) // 每5分钟最多5次密码修改
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({ status: 200, description: '密码修改成功' })
  @ApiResponse({ status: 401, description: '原密码错误' })
  async changePassword(@Request() req: any, @Body() changeDto: ChangePasswordDto) {
    return this.authService.changePassword(
      req.user.id,
      changeDto.oldPassword,
      changeDto.newPassword,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新Token' })
  @ApiResponse({ status: 200, description: '刷新成功', type: TokenResponseDto })
  @ApiResponse({ status: 401, description: '无效的刷新Token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登出' })
  @ApiResponse({ status: 200, description: '登出成功' })
  async logout(@Request() req: any) {
    return this.authService.logout(req.user.id);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Get('health')
  @ApiOperation({ summary: '健康检查' })
  @ApiResponse({ status: 200, description: '服务正常' })
  async healthCheck() {
    return {
      status: 'ok',
      service: 'auth-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      features: [
        'user-registration',
        'user-login',
        'jwt-authentication',
        'email-verification',
        'password-reset',
        'password-change',
        'token-refresh',
      ],
    };
  }

  @Get('stats')
  @ApiOperation({ summary: '服务统计信息' })
  @ApiResponse({ status: 200, description: '统计信息' })
  async getStats() {
    // 这里可以添加一些基础统计信息
    return {
      service: 'auth-service',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      features: {
        emailVerification: true,
        passwordReset: true,
        jwtAuth: true,
        userRegistration: true,
      },
      endpoints: [
        'POST /auth/login',
        'POST /auth/register',
        'POST /auth/register-with-code',
        'POST /auth/send-verification-code',
        'POST /auth/request-password-reset',
        'POST /auth/reset-password',
        'PATCH /auth/change-password',
        'POST /auth/refresh',
        'POST /auth/logout',
        'GET /auth/profile',
        'GET /auth/health',
        'GET /auth/stats',
      ],
    };
  }
}
