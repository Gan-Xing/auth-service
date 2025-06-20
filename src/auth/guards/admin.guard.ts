import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UsersService } from '../services/users.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // 检查是否有有效的管理员会话
    const adminToken = this.extractTokenFromRequest(request);
    if (!adminToken) {
      throw new UnauthorizedException('需要管理员权限');
    }

    try {
      // 验证JWT令牌
      const payload = await this.jwtService.verifyAsync(adminToken, {
        secret: process.env.JWT_SECRET,
      });

      // 检查用户是否存在且为管理员
      const user = await this.usersService.findOne(payload.sub);
      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      // 检查是否为超级管理员或管理员角色
      if (!this.isAdmin(user)) {
        throw new UnauthorizedException('需要管理员权限');
      }

      // 将用户信息添加到请求对象
      request['user'] = user;
      request['isAdmin'] = true;

      return true;
    } catch (error) {
      throw new UnauthorizedException('无效的管理员令牌');
    }
  }

  private extractTokenFromRequest(request: Request): string | undefined {
    // 优先从Authorization头获取
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) {
      return token;
    }

    // 从cookie获取
    const cookieToken = request.cookies?.['admin_token'];
    if (cookieToken) {
      return cookieToken;
    }

    // 从session获取
    const sessionToken = request.session?.['admin_token'];
    if (sessionToken) {
      return sessionToken;
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

    // 检查是否为系统管理员（没有租户限制）
    if (!user.tenantId && user.isSystemAdmin) {
      return true;
    }

    return false;
  }
}