import { SetMetadata } from '@nestjs/common';
import { FeatureFlag } from '../feature-flags.service';

export const FEATURE_FLAG_KEY = 'feature_flag';

/**
 * 功能开关装饰器
 * 用于在控制器方法或类上标记需要的功能开关
 */
export const RequireFeature = (flag: FeatureFlag, options?: {
  /** 是否允许租户级别的覆盖 */
  allowTenantOverride?: boolean;
  /** 功能禁用时的错误消息 */
  disabledMessage?: string;
}) => SetMetadata(FEATURE_FLAG_KEY, { flag, ...options });

/**
 * 多个功能开关装饰器
 * 要求所有指定的功能都必须启用
 */
export const RequireFeatures = (flags: FeatureFlag[], options?: {
  /** 逻辑操作符：'AND' 表示所有功能都必须启用，'OR' 表示至少一个启用 */
  operator?: 'AND' | 'OR';
  /** 是否允许租户级别的覆盖 */
  allowTenantOverride?: boolean;
  /** 功能禁用时的错误消息 */
  disabledMessage?: string;
}) => SetMetadata(FEATURE_FLAG_KEY, { 
  flags, 
  operator: options?.operator || 'AND',
  ...options 
});

/**
 * 可选功能装饰器
 * 如果功能未启用，不会阻止访问，但会在响应中添加警告
 */
export const OptionalFeature = (flag: FeatureFlag, options?: {
  /** 警告消息 */
  warningMessage?: string;
}) => SetMetadata(`${FEATURE_FLAG_KEY}_optional`, { flag, ...options });