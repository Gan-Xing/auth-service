import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditAction } from '@prisma/client';

export interface AuditLogData {
  tenantId: string;
  userId?: number;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  description: string;
  details?: any;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Optional() @Inject(REQUEST) private readonly request?: Request,
  ) {}

  /**
   * 记录审计日志
   */
  async log(data: AuditLogData, context?: RequestContext): Promise<void> {
    try {
      // 获取请求上下文信息
      const requestContext = this.extractRequestContext(context);

      // 创建审计日志记录
      const auditLog = await this.prisma.auditLog.create({
        data: {
          tenantId: data.tenantId,
          userId: data.userId || null,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId || null,
          description: data.description,
          details: data.details ? JSON.stringify(data.details) : null,
          ip: requestContext.ip,
          userAgent: requestContext.userAgent,
          method: requestContext.method,
          path: requestContext.path,
          success: data.success,
          errorCode: data.errorCode || null,
          errorMessage: data.errorMessage || null,
        },
      });

      // 异步缓存关键操作到Redis
      this.cacheImportantAction(auditLog).catch(error => {
        this.logger.warn('缓存审计日志到Redis失败', error);
      });

      this.logger.debug(`审计日志记录成功: ${data.action} - ${data.description}`);
    } catch (error) {
      this.logger.error('记录审计日志失败', error.stack);
      // 审计日志失败不应该影响主业务流程
    }
  }

  /**
   * 记录认证成功
   */
  async logAuthSuccess(
    tenantId: string,
    userId: number,
    method: 'password' | 'oauth' | 'apikey',
    provider?: string,
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: method === 'oauth' ? AuditAction.AUTH_OAUTH_LOGIN : AuditAction.AUTH_LOGIN_SUCCESS,
      resource: 'auth',
      description: `用户登录成功 (${method}${provider ? ` - ${provider}` : ''})`,
      details: { method, provider },
      success: true,
    });
  }

  /**
   * 记录认证失败
   */
  async logAuthFailure(
    tenantId: string,
    email: string,
    reason: string,
    errorCode?: string,
  ): Promise<void> {
    await this.log({
      tenantId,
      action: AuditAction.AUTH_LOGIN_FAILED,
      resource: 'auth',
      description: `用户登录失败: ${email} - ${reason}`,
      details: { email, reason },
      success: false,
      errorCode,
      errorMessage: reason,
    });
  }

  /**
   * 记录用户注册
   */
  async logUserRegister(tenantId: string, userId: number, email: string): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: AuditAction.AUTH_REGISTER,
      resource: 'user',
      resourceId: userId.toString(),
      description: `新用户注册: ${email}`,
      details: { email },
      success: true,
    });
  }

  /**
   * 记录密码重置
   */
  async logPasswordReset(tenantId: string, userId: number, email: string): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: AuditAction.AUTH_PASSWORD_RESET_SUCCESS,
      resource: 'user',
      resourceId: userId.toString(),
      description: `用户密码重置成功: ${email}`,
      details: { email },
      success: true,
    });
  }

  /**
   * 记录管理员操作
   */
  async logAdminAction(
    tenantId: string,
    adminUserId: number,
    action: AuditAction,
    description: string,
    details?: any,
  ): Promise<void> {
    await this.log({
      tenantId,
      userId: adminUserId,
      action,
      resource: 'admin',
      description: `管理员操作: ${description}`,
      details,
      success: true,
    });
  }

  /**
   * 记录安全事件
   */
  async logSecurityEvent(
    tenantId: string,
    action: AuditAction,
    description: string,
    details?: any,
    userId?: number,
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action,
      resource: 'security',
      description: `安全事件: ${description}`,
      details,
      success: false,
    });
  }

  /**
   * 记录API Key操作
   */
  async logApiKeyAction(
    tenantId: string,
    action: AuditAction,
    apiKeyId: string,
    description: string,
    adminUserId?: number,
  ): Promise<void> {
    await this.log({
      tenantId,
      userId: adminUserId,
      action,
      resource: 'apikey',
      resourceId: apiKeyId,
      description,
      success: true,
    });
  }

  /**
   * 获取审计日志
   */
  async getAuditLogs(params: {
    tenantId?: string;
    userId?: number;
    action?: AuditAction;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const {
      tenantId,
      userId,
      action,
      resource,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = params;

    const where: any = {};

    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          tenant: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  /**
   * 获取审计统计
   */
  async getAuditStats(tenantId?: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: any = {
      createdAt: { gte: startDate },
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const [
      totalLogs,
      successLogs,
      failedLogs,
      actionStats,
      userStats,
    ] = await Promise.all([
      // 总日志数
      this.prisma.auditLog.count({ where }),
      
      // 成功操作数
      this.prisma.auditLog.count({
        where: { ...where, success: true },
      }),
      
      // 失败操作数
      this.prisma.auditLog.count({
        where: { ...where, success: false },
      }),
      
      // 按操作类型统计
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
      
      // 按用户统计（排除系统操作）
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { ...where, userId: { not: null } },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      period: `最近${days}天`,
      totalLogs,
      successLogs,
      failedLogs,
      successRate: totalLogs > 0 ? ((successLogs / totalLogs) * 100).toFixed(2) : '0',
      actionStats: actionStats.map(stat => ({
        action: stat.action,
        count: stat._count.action,
      })),
      topUsers: userStats.map(stat => ({
        userId: stat.userId,
        count: stat._count.userId,
      })),
    };
  }

  /**
   * 清理旧的审计日志
   */
  async cleanupOldLogs(daysToKeep: number = 365): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      const result = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      this.logger.log(`清理了 ${result.count} 条超过 ${daysToKeep} 天的审计日志`);
      
      return { deletedCount: result.count };
    } catch (error) {
      this.logger.error('清理审计日志失败', error.stack);
      throw error;
    }
  }

  /**
   * 提取请求上下文信息
   */
  private extractRequestContext(context?: RequestContext): RequestContext {
    if (context) {
      return context;
    }

    if (!this.request) {
      return {};
    }

    return {
      ip: this.getClientIp(this.request),
      userAgent: this.request.headers['user-agent'] || undefined,
      method: this.request.method,
      path: this.request.path,
    };
  }

  /**
   * 获取客户端真实IP
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      (req.connection?.remoteAddress) ||
      (req.socket?.remoteAddress) ||
      'unknown'
    );
  }

  /**
   * 缓存重要操作到Redis (异步，不影响主流程)
   */
  private async cacheImportantAction(auditLog: any): Promise<void> {
    const importantActions = [
      AuditAction.AUTH_LOGIN_FAILED,
      AuditAction.SECURITY_BREACH_ATTEMPT,
      AuditAction.SECURITY_SUSPICIOUS_ACTIVITY,
      AuditAction.SECURITY_RATE_LIMIT_EXCEEDED,
      AuditAction.ADMIN_ACCESS,
    ];

    if (importantActions.includes(auditLog.action)) {
      const key = `audit:important:${auditLog.tenantId}:${auditLog.action}`;
      await this.redisService.set(
        `${key}:${auditLog.id}`,
        JSON.stringify({
          id: auditLog.id,
          action: auditLog.action,
          description: auditLog.description,
          ip: auditLog.ip,
          createdAt: auditLog.createdAt,
        }),
        3600 // 1小时过期
      );
    }
  }
}