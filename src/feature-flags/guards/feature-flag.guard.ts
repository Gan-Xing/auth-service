import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService, FeatureFlag } from '../feature-flags.service';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';
import { Request } from 'express';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  private readonly logger = new Logger(FeatureFlagGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取方法和类级别的功能开关元数据
    const methodMetadata = this.reflector.get<{
      flag?: FeatureFlag;
      flags?: FeatureFlag[];
      operator?: 'AND' | 'OR';
      allowTenantOverride?: boolean;
      disabledMessage?: string;
    }>(
      FEATURE_FLAG_KEY,
      context.getHandler(),
    );
    const classMetadata = this.reflector.get<{
      flag?: FeatureFlag;
      flags?: FeatureFlag[];
      operator?: 'AND' | 'OR';
      allowTenantOverride?: boolean;
      disabledMessage?: string;
    }>(
      FEATURE_FLAG_KEY,
      context.getClass(),
    );

    // 如果没有设置功能开关要求，允许访问
    const metadata = methodMetadata || classMetadata;
    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = this.extractTenantId(request);

    try {
      // 处理单个功能开关
      if (metadata.flag) {
        return await this.checkSingleFeature({
          flag: metadata.flag,
          allowTenantOverride: metadata.allowTenantOverride,
        }, tenantId);
      }

      // 处理多个功能开关
      if (metadata.flags) {
        return await this.checkMultipleFeatures({
          flags: metadata.flags,
          operator: metadata.operator || 'AND',
          allowTenantOverride: metadata.allowTenantOverride,
        }, tenantId);
      }

      return true;
    } catch (error) {
      this.logger.error(`Feature flag check failed: ${error.message}`);
      
      // 自定义错误消息或使用默认消息
      const message = metadata.disabledMessage || 
        `此功能当前不可用，请联系管理员`;
      
      throw new ForbiddenException(message);
    }
  }

  private async checkSingleFeature(
    metadata: { flag: FeatureFlag; allowTenantOverride?: boolean },
    tenantId?: string,
  ): Promise<boolean> {
    const { flag, allowTenantOverride = true } = metadata;
    
    // 检查功能是否启用
    const tenantIdToCheck = allowTenantOverride ? tenantId : undefined;
    const isEnabled = await this.featureFlagsService.isEnabled(flag, tenantIdToCheck);
    
    if (!isEnabled) {
      this.logger.warn(
        `Feature ${flag} is disabled${tenantId ? ` for tenant ${tenantId}` : ' globally'}`
      );
      return false;
    }

    return true;
  }

  private async checkMultipleFeatures(
    metadata: { 
      flags: FeatureFlag[]; 
      operator: 'AND' | 'OR'; 
      allowTenantOverride?: boolean 
    },
    tenantId?: string,
  ): Promise<boolean> {
    const { flags, operator, allowTenantOverride = true } = metadata;
    const tenantIdToCheck = allowTenantOverride ? tenantId : undefined;

    const results = await Promise.all(
      flags.map(flag => 
        this.featureFlagsService.isEnabled(flag, tenantIdToCheck)
      )
    );

    if (operator === 'OR') {
      // 至少一个功能启用
      const hasAnyEnabled = results.some(enabled => enabled);
      if (!hasAnyEnabled) {
        this.logger.warn(
          `None of the required features [${flags.join(', ')}] are enabled`
        );
        return false;
      }
    } else {
      // 所有功能都必须启用
      const allEnabled = results.every(enabled => enabled);
      if (!allEnabled) {
        const disabledFlags = flags.filter((_, index) => !results[index]);
        this.logger.warn(
          `Required features [${disabledFlags.join(', ')}] are disabled`
        );
        return false;
      }
    }

    return true;
  }

  private extractTenantId(request: Request): string | undefined {
    // 从多个可能的来源提取租户ID
    return (
      request.headers['x-tenant-id'] as string ||
      request.query.tenantId as string ||
      (request as any).user?.tenantId ||
      undefined
    );
  }
}