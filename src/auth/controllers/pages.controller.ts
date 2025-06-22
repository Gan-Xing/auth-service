import {
  Controller,
  Get,
  Post,
  Render,
  Query,
  Body,
  Res,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from '../auth.service';
import { TenantService } from '../services/tenant.service';

interface LoginFormData {
  email: string;
  password: string;
  redirect?: string;
}

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  redirect?: string;
}

@Controller()
export class PagesController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
  ) {}

  /**
   * 渲染登录页面
   */
  @Get('login')
  @Render('login-tailwind')
  async loginPage(@Query('redirect') redirect?: string) {
    return {
      redirect: this.validateRedirect(redirect),
      title: '登录 - Auth Service',
    };
  }

  /**
   * 处理登录表单提交
   */
  @Post('login')
  async handleLogin(@Body() formData: LoginFormData, @Res() res: Response) {
    try {
      const { email, password, redirect } = formData;

      // 验证输入
      if (!email || !password) {
        return this.renderLoginWithError(res, '请填写邮箱和密码', formData);
      }

      // 获取默认租户（或根据域名获取）
      const tenantId = await this.getDefaultTenantId();

      // 执行登录
      const result = await this.authService.login({ email, password }, tenantId);

      // 设置 JWT Cookie（可选）
      this.setAuthCookie(res, result.accessToken);

      // 处理跳转 - 标准 OAuth 流程
      if (redirect) {
        const validatedRedirect = this.validateRedirect(redirect);
        if (validatedRedirect) {
          // 如果是外部跳转，则带上 token 参数
          if (this.isExternalRedirect(validatedRedirect)) {
            const separator = validatedRedirect.includes('?') ? '&' : '?';
            const finalUrl = `${validatedRedirect}${separator}token=${result.accessToken}`;
            return res.redirect(finalUrl);
          }
          // 内部跳转
          return res.redirect(validatedRedirect);
        }
      }

      // 只有当没有有效 redirect 参数时，才显示成功页面
      return res.redirect('/profile');
    } catch (error) {
      return this.renderLoginWithError(res, this.getErrorMessage(error), formData);
    }
  }

  /**
   * 渲染注册页面
   */
  @Get('register')
  @Render('register-tailwind')
  async registerPage(@Query('redirect') redirect?: string) {
    return {
      redirect: this.validateRedirect(redirect),
      title: '注册 - Auth Service',
    };
  }

  /**
   * 处理注册表单提交
   */
  @Post('register')
  async handleRegister(@Body() formData: RegisterFormData, @Res() res: Response) {
    try {
      const { firstName, lastName, email, password, confirmPassword, redirect } = formData;

      // 验证输入
      if (!firstName || !lastName || !email || !password) {
        return this.renderRegisterWithError(res, '请填写所有必填字段', formData);
      }

      if (password !== confirmPassword) {
        return this.renderRegisterWithError(res, '两次输入的密码不一致', formData);
      }

      // 获取默认租户
      const tenantId = await this.getDefaultTenantId();

      // 执行注册
      const result = await this.authService.register({
        firstName,
        lastName,
        email,
        password,
      }, tenantId);

      // 设置 JWT Cookie
      this.setAuthCookie(res, result.accessToken);

      // 处理跳转（注册后自动登录）- 标准 OAuth 流程
      if (redirect) {
        const validatedRedirect = this.validateRedirect(redirect);
        if (validatedRedirect) {
          // 如果是外部跳转，则带上 token 参数
          if (this.isExternalRedirect(validatedRedirect)) {
            const separator = validatedRedirect.includes('?') ? '&' : '?';
            const finalUrl = `${validatedRedirect}${separator}token=${result.accessToken}`;
            return res.redirect(finalUrl);
          }
          // 内部跳转
          return res.redirect(validatedRedirect);
        }
      }

      // 只有当没有有效 redirect 参数时，才显示成功页面
      return res.redirect('/profile');
    } catch (error) {
      return this.renderRegisterWithError(res, this.getErrorMessage(error), formData);
    }
  }

  /**
   * 用户信息页面（认证成功后的默认页面）
   */
  @Get('profile')
  @Render('profile-tailwind')
  async profilePage() {
    return {
      title: '认证成功 - Auth Service',
      message: '认证成功！您现在可以访问受保护的资源。',
      showIntegrationGuide: true,
    };
  }

  /**
   * 验证和清理 redirect 参数，防止 Open Redirect 攻击
   */
  private validateRedirect(redirect?: string): string | undefined {
    if (!redirect) return undefined;

    try {
      // 允许的域名列表（可以从配置文件读取）
      const allowedDomains = [
        'localhost',
        '127.0.0.1',
        'example.com',
        'app.example.com',
        // 可以添加更多允许的域名
      ];

      // 如果是相对路径，直接允许
      if (redirect.startsWith('/') && !redirect.startsWith('//')) {
        return redirect;
      }

      // 解析 URL
      const url = new URL(redirect);
      
      // 检查协议
      if (!['http:', 'https:'].includes(url.protocol)) {
        return undefined;
      }

      // 检查域名
      const hostname = url.hostname;
      const isAllowed = allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      );

      return isAllowed ? redirect : undefined;
    } catch {
      // URL 解析失败，可能是恶意输入
      return undefined;
    }
  }

  /**
   * 判断是否为外部跳转
   */
  private isExternalRedirect(redirect: string): boolean {
    if (redirect.startsWith('/')) return false;
    
    try {
      const url = new URL(redirect);
      return url.hostname !== 'localhost' && url.hostname !== '127.0.0.1';
    } catch {
      return false;
    }
  }

  /**
   * 设置认证 Cookie
   */
  private setAuthCookie(res: Response, token: string): void {
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000, // 15 分钟
      sameSite: 'lax',
    });
  }

  /**
   * 获取默认租户 ID
   */
  private async getDefaultTenantId(): Promise<string> {
    // 暂时使用固定的租户ID，实际使用时需要创建租户
    return 'demo-tenant-id';
  }

  /**
   * 渲染登录页面并显示错误
   */
  private renderLoginWithError(res: Response, error: string, formData: LoginFormData) {
    return res.render('login-tailwind', {
      error,
      email: formData.email,
      redirect: formData.redirect,
      title: '登录 - Auth Service',
    });
  }

  /**
   * 渲染注册页面并显示错误
   */
  private renderRegisterWithError(res: Response, error: string, formData: RegisterFormData) {
    return res.render('register-tailwind', {
      error,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      redirect: formData.redirect,
      title: '注册 - Auth Service',
    });
  }

  /**
   * 获取友好的错误消息
   */
  private getErrorMessage(error: any): string {
    if (error instanceof UnauthorizedException) {
      return '邮箱或密码错误，请重试';
    }
    if (error instanceof ConflictException) {
      return '该邮箱已被注册，请使用其他邮箱';
    }
    if (error instanceof BadRequestException) {
      return error.message || '请求参数错误';
    }
    
    // 记录详细错误到日志
    console.error('Login/Register error:', error);
    return '服务暂时不可用，请稍后重试';
  }
}