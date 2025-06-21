import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError } from 'rxjs';
import { Request } from 'express';
import { AuditService } from '../audit.service';
import { AUDIT_METADATA_KEY, AuditMetadata } from '../decorators/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.get<AuditMetadata>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    // 提取用户和租户信息
    const { tenantId, userId } = this.extractUserInfo(request);

    if (!tenantId) {
      // 如果没有租户信息，跳过审计日志
      return next.handle();
    }

    return next.handle().pipe(
      tap((result) => {
        // 操作成功时记录日志
        this.logSuccess(
          auditMetadata,
          tenantId,
          userId,
          request,
          result,
          Date.now() - startTime,
        );
      }),
      catchError((error) => {
        // 操作失败时记录日志
        if (!auditMetadata.skipOnError) {
          this.logError(
            auditMetadata,
            tenantId,
            userId,
            request,
            error,
            Date.now() - startTime,
          );
        }
        throw error;
      }),
    );
  }

  private extractUserInfo(request: Request): { tenantId?: string; userId?: number } {
    // 从request中提取用户信息
    const user = (request as any).user;
    const tenant = (request as any).tenant;
    const apiKey = (request as any).apiKey;

    return {
      tenantId: tenant?.id || apiKey?.tenantId,
      userId: user?.userId || user?.id,
    };
  }

  private async logSuccess(
    metadata: AuditMetadata,
    tenantId: string,
    userId: number | undefined,
    request: Request,
    result: any,
    duration: number,
  ): Promise<void> {
    try {
      await this.auditService.log(
        {
          tenantId,
          userId,
          action: metadata.action,
          resource: metadata.resource,
          resourceId: this.extractResourceId(result),
          description: metadata.description || `${metadata.resource} 操作成功`,
          details: {
            duration,
            resultType: typeof result,
            ...this.extractRelevantData(result),
          },
          success: true,
        },
        {
          ip: this.getClientIp(request),
          userAgent: request.headers['user-agent'],
          method: request.method,
          path: request.path,
        },
      );
    } catch (error) {
      this.logger.error('记录成功审计日志失败', error);
    }
  }

  private async logError(
    metadata: AuditMetadata,
    tenantId: string,
    userId: number | undefined,
    request: Request,
    error: any,
    duration: number,
  ): Promise<void> {
    try {
      await this.auditService.log(
        {
          tenantId,
          userId,
          action: metadata.action,
          resource: metadata.resource,
          description: metadata.description || `${metadata.resource} 操作失败`,
          details: {
            duration,
            error: error.message,
            stack: error.stack,
          },
          success: false,
          errorCode: error.code || error.status?.toString(),
          errorMessage: error.message,
        },
        {
          ip: this.getClientIp(request),
          userAgent: request.headers['user-agent'],
          method: request.method,
          path: request.path,
        },
      );
    } catch (logError) {
      this.logger.error('记录失败审计日志失败', logError);
    }
  }

  private extractResourceId(result: any): string | undefined {
    if (!result) return undefined;

    // 尝试从结果中提取资源ID
    if (typeof result === 'object') {
      return result.id || result._id || result.uuid;
    }

    if (typeof result === 'string' || typeof result === 'number') {
      return result.toString();
    }

    return undefined;
  }

  private extractRelevantData(result: any): any {
    if (!result || typeof result !== 'object') {
      return {};
    }

    // 提取非敏感的相关数据
    const relevantFields = ['id', 'name', 'email', 'status', 'type', 'count'];
    const extracted: any = {};

    for (const field of relevantFields) {
      if (result[field] !== undefined) {
        extracted[field] = result[field];
      }
    }

    return extracted;
  }

  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }
}