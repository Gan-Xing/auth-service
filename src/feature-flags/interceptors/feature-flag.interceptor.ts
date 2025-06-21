import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../feature-flags.service';
import { Request } from 'express';

@Injectable()
export class FeatureFlagInterceptor implements NestInterceptor {
  private readonly logger = new Logger(FeatureFlagInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = this.extractTenantId(request);

    return next.handle().pipe(
      map(async (data) => {
        // 只有在开发环境或管理员请求时才添加功能开关信息
        const includeFeatureInfo = this.shouldIncludeFeatureInfo(request);
        
        if (!includeFeatureInfo) {
          return data;
        }

        try {
          // 获取当前激活的功能列表
          const activeFeatures = await this.getActiveFeatures(tenantId);
          
          return {
            ...data,
            _meta: {
              ...((data as any)?._meta || {}),
              features: {
                tenant: tenantId || null,
                active: activeFeatures,
                timestamp: new Date().toISOString(),
              },
            },
          };
        } catch (error) {
          this.logger.error(`Failed to add feature info: ${error.message}`);
          return data;
        }
      }),
    );
  }

  private extractTenantId(request: Request): string | undefined {
    return (
      request.headers['x-tenant-id'] as string ||
      request.query.tenantId as string ||
      (request as any).user?.tenantId ||
      undefined
    );
  }

  private shouldIncludeFeatureInfo(request: Request): boolean {
    // 检查是否是开发环境
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    // 检查是否有调试头部
    if (request.headers['x-debug-features'] === 'true') {
      return true;
    }

    // 检查是否是管理员路径
    if (request.path.startsWith('/admin')) {
      return true;
    }

    // 检查是否是功能开关相关的API
    if (request.path.includes('feature-flags')) {
      return true;
    }

    return false;
  }

  private async getActiveFeatures(tenantId?: string): Promise<string[]> {
    try {
      const allFlags = await this.featureFlagsService.getAllFlags(tenantId);
      return allFlags
        .filter(flag => flag.enabled)
        .map(flag => flag.flag);
    } catch (error) {
      this.logger.error(`Failed to get active features: ${error.message}`);
      return [];
    }
  }
}