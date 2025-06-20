import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../services/users.service';

@Injectable()
export class AdminAuthMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 检查是否为管理后台路由
    if (!req.path.startsWith('/admin')) {
      return next();
    }

    // 跳过登录页面和静态资源
    const publicPaths = ['/admin/login', '/admin/auth/login', '/css/', '/js/', '/images/'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    try {
      // 获取管理员令牌
      const adminToken = this.extractTokenFromRequest(req);
      
      if (!adminToken) {
        return this.redirectToLogin(req, res);
      }

      // 验证令牌
      const payload = await this.jwtService.verifyAsync(adminToken, {
        secret: process.env.JWT_SECRET,
      });

      // 获取用户信息
      const user = await this.usersService.findOne(payload.sub);
      if (!user || !this.isAdmin(user)) {
        return this.redirectToLogin(req, res);
      }

      // 将用户信息添加到请求对象
      req['user'] = user;
      req['isAdmin'] = true;

      // 检查会话过期
      if (this.isSessionExpired(payload)) {
        return this.redirectToLogin(req, res);
      }

      next();
    } catch (error) {
      console.error('Admin auth middleware error:', error);
      return this.redirectToLogin(req, res);
    }
  }

  private extractTokenFromRequest(request: Request): string | undefined {
    // 优先从cookie获取
    const cookieToken = request.cookies?.['admin_token'];
    if (cookieToken) {
      return cookieToken;
    }

    // 从session获取
    const sessionToken = request.session?.['admin_token'];
    if (sessionToken) {
      return sessionToken;
    }

    // 从Authorization头获取
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) {
      return token;
    }

    return undefined;
  }

  private isAdmin(user: any): boolean {
    // 检查用户角色
    if (user.role === 'super_admin' || user.role === 'admin') {
      return true;
    }

    // 检查用户权限
    if (user.permissions && user.permissions.includes('admin')) {
      return true;
    }

    // 检查是否为系统管理员
    if (!user.tenantId && user.isSystemAdmin) {
      return true;
    }

    return false;
  }

  private isSessionExpired(payload: any): boolean {
    // 检查令牌是否过期
    const now = Math.floor(Date.now() / 1000);
    return payload.exp && payload.exp < now;
  }

  private redirectToLogin(req: Request, res: Response) {
    // 清除无效的令牌
    res.clearCookie('admin_token');
    if (req.session) {
      delete req.session['admin_token'];
    }

    // 如果是API请求，返回401
    if (req.path.startsWith('/admin/api/') || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({
        success: false,
        message: '需要管理员权限',
        redirectTo: '/admin/login'
      });
    }

    // 重定向到登录页面
    const returnUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/admin/login?returnUrl=${returnUrl}`);
  }
}