import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

export enum FeatureFlag {
  // 邮件服务
  EMAIL_SERVICE = 'email_service',
  EMAIL_VERIFICATION = 'email_verification', 
  EMAIL_PASSWORD_RESET = 'email_password_reset',
  EMAIL_WELCOME = 'email_welcome',
  
  // 短信服务
  SMS_SERVICE = 'sms_service',
  SMS_VERIFICATION = 'sms_verification',
  SMS_INTERNATIONAL = 'sms_international',
  
  // OAuth服务
  OAUTH_GITHUB = 'oauth_github',
  OAUTH_GOOGLE = 'oauth_google',
  OAUTH_WECHAT = 'oauth_wechat',
  
  // 监控和告警
  MONITORING_ENABLED = 'monitoring_enabled',
  ALERTS_ENABLED = 'alerts_enabled',
  METRICS_COLLECTION = 'metrics_collection',
  
  // 安全功能
  RATE_LIMITING = 'rate_limiting',
  BRUTE_FORCE_PROTECTION = 'brute_force_protection',
  IP_WHITELIST = 'ip_whitelist',
  
  // 审计功能
  AUDIT_LOGGING = 'audit_logging',
  AUDIT_DETAILED = 'audit_detailed',
  
  // 用户注册
  USER_REGISTRATION = 'user_registration',
  REGISTRATION_EMAIL_VERIFICATION = 'registration_email_verification',
  
  // 高级功能
  ADMIN_PANEL = 'admin_panel',
  API_DOCUMENTATION = 'api_documentation',
  HEALTH_CHECKS = 'health_checks',
}

export interface FeatureFlagConfig {
  flag: FeatureFlag;
  enabled: boolean;
  description: string;
  category: string;
  dependencies?: FeatureFlag[];
  environment?: string[];
  lastModified?: Date;
  modifiedBy?: string;
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly cachePrefix = 'feature_flag:';
  private readonly cacheTTL = 300; // 5分钟缓存

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 检查功能是否启用
   */
  async isEnabled(flag: FeatureFlag, tenantId?: string): Promise<boolean> {
    try {
      // 1. 先检查Redis缓存
      const cacheKey = this.getCacheKey(flag, tenantId);
      const cached = await this.redisService.get<boolean>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // 2. 从配置文件获取默认值
      const defaultValue = this.getDefaultValue(flag);
      
      // 3. 检查数据库中的配置（如果有租户特定配置）
      if (tenantId) {
        const tenantConfig = await this.getTenantFeatureConfig(flag, tenantId);
        if (tenantConfig !== null) {
          await this.redisService.set(cacheKey, tenantConfig, this.cacheTTL);
          return tenantConfig;
        }
      }

      // 4. 检查全局数据库配置
      const globalConfig = await this.getGlobalFeatureConfig(flag);
      const finalValue = globalConfig !== null ? globalConfig : defaultValue;

      // 5. 缓存结果
      await this.redisService.set(cacheKey, finalValue, this.cacheTTL);
      
      return finalValue;
    } catch (error) {
      this.logger.error(`Failed to check feature flag ${flag}: ${error.message}`);
      // 降级到默认配置
      return this.getDefaultValue(flag);
    }
  }

  /**
   * 设置功能开关状态
   */
  async setFlag(
    flag: FeatureFlag,
    enabled: boolean,
    modifiedBy: string,
    tenantId?: string,
  ): Promise<void> {
    try {
      // 检查依赖关系
      if (enabled) {
        await this.checkDependencies(flag, tenantId);
      }

      // 保存到数据库（需要先创建相应的表结构）
      // TODO: 实现数据库存储逻辑

      // 清除缓存
      const cacheKey = this.getCacheKey(flag, tenantId);
      await this.redisService.del(cacheKey);

      // 记录修改日志
      this.logger.log(
        `Feature flag ${flag} ${enabled ? 'enabled' : 'disabled'} by ${modifiedBy}${
          tenantId ? ` for tenant ${tenantId}` : ' globally'
        }`
      );

    } catch (error) {
      this.logger.error(`Failed to set feature flag ${flag}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 批量设置功能开关
   */
  async setFlags(
    flags: Array<{ flag: FeatureFlag; enabled: boolean }>,
    modifiedBy: string,
    tenantId?: string,
  ): Promise<void> {
    for (const { flag, enabled } of flags) {
      await this.setFlag(flag, enabled, modifiedBy, tenantId);
    }
  }

  /**
   * 获取所有功能开关状态
   */
  async getAllFlags(tenantId?: string): Promise<FeatureFlagConfig[]> {
    const allFlags = Object.values(FeatureFlag);
    const results: FeatureFlagConfig[] = [];

    for (const flag of allFlags) {
      const enabled = await this.isEnabled(flag, tenantId);
      const config = this.getFeatureFlagMeta(flag);
      
      results.push({
        flag,
        enabled,
        ...config,
      });
    }

    return results;
  }

  /**
   * 获取按分类组织的功能开关
   */
  async getFlagsByCategory(tenantId?: string): Promise<Record<string, FeatureFlagConfig[]>> {
    const allFlags = await this.getAllFlags(tenantId);
    const grouped: Record<string, FeatureFlagConfig[]> = {};

    for (const flag of allFlags) {
      if (!grouped[flag.category]) {
        grouped[flag.category] = [];
      }
      grouped[flag.category].push(flag);
    }

    return grouped;
  }

  /**
   * 重置所有功能开关为默认值
   */
  async resetToDefaults(tenantId?: string): Promise<void> {
    const allFlags = Object.values(FeatureFlag);
    
    for (const flag of allFlags) {
      const cacheKey = this.getCacheKey(flag, tenantId);
      await this.redisService.del(cacheKey);
    }

    // TODO: 清除数据库中的配置
    
    this.logger.log(`Feature flags reset to defaults${tenantId ? ` for tenant ${tenantId}` : ' globally'}`);
  }

  /**
   * 刷新缓存
   */
  async refreshCache(): Promise<void> {
    const pattern = `${this.cachePrefix}*`;
    const keys = await this.redisService.keys(pattern);
    
    for (const key of keys) {
      await this.redisService.del(key);
    }

    this.logger.log('Feature flags cache refreshed');
  }

  /**
   * 获取功能开关统计信息
   */
  async getStats(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    byCategory: Record<string, { enabled: number; total: number }>;
  }> {
    const flags = await this.getAllFlags();
    const enabledCount = flags.filter(f => f.enabled).length;
    
    const byCategory: Record<string, { enabled: number; total: number }> = {};
    
    for (const flag of flags) {
      if (!byCategory[flag.category]) {
        byCategory[flag.category] = { enabled: 0, total: 0 };
      }
      byCategory[flag.category].total++;
      if (flag.enabled) {
        byCategory[flag.category].enabled++;
      }
    }

    return {
      total: flags.length,
      enabled: enabledCount,
      disabled: flags.length - enabledCount,
      byCategory,
    };
  }

  private getCacheKey(flag: FeatureFlag, tenantId?: string): string {
    return `${this.cachePrefix}${flag}${tenantId ? `:${tenantId}` : ':global'}`;
  }

  private getDefaultValue(flag: FeatureFlag): boolean {
    // 从环境变量获取默认值
    const configMap: Record<FeatureFlag, string> = {
      [FeatureFlag.EMAIL_SERVICE]: 'SMTP_USER',
      [FeatureFlag.EMAIL_VERIFICATION]: 'SMTP_USER',
      [FeatureFlag.EMAIL_PASSWORD_RESET]: 'SMTP_USER',
      [FeatureFlag.EMAIL_WELCOME]: 'SMTP_USER',
      
      [FeatureFlag.SMS_SERVICE]: 'VONAGE_API_KEY',
      [FeatureFlag.SMS_VERIFICATION]: 'VONAGE_API_KEY',
      [FeatureFlag.SMS_INTERNATIONAL]: 'SMS_INTERNATIONAL_ENABLED',
      
      [FeatureFlag.OAUTH_GITHUB]: 'GITHUB_CLIENT_ID',
      [FeatureFlag.OAUTH_GOOGLE]: 'GOOGLE_CLIENT_ID',
      [FeatureFlag.OAUTH_WECHAT]: 'WECHAT_APP_ID',
      
      [FeatureFlag.MONITORING_ENABLED]: 'MONITORING_ENABLED',
      [FeatureFlag.ALERTS_ENABLED]: 'ALERTS_ENABLED',
      [FeatureFlag.METRICS_COLLECTION]: 'METRICS_ENABLED',
      
      [FeatureFlag.RATE_LIMITING]: 'NODE_ENV', // 默认启用
      [FeatureFlag.BRUTE_FORCE_PROTECTION]: 'NODE_ENV', // 默认启用
      [FeatureFlag.IP_WHITELIST]: 'SECURITY_IP_WHITELIST',
      
      [FeatureFlag.AUDIT_LOGGING]: 'NODE_ENV', // 默认启用
      [FeatureFlag.AUDIT_DETAILED]: 'NODE_ENV',
      
      [FeatureFlag.USER_REGISTRATION]: 'NODE_ENV', // 默认启用
      [FeatureFlag.REGISTRATION_EMAIL_VERIFICATION]: 'SMTP_USER',
      
      [FeatureFlag.ADMIN_PANEL]: 'NODE_ENV', // 默认启用
      [FeatureFlag.API_DOCUMENTATION]: 'NODE_ENV', // 默认启用
      [FeatureFlag.HEALTH_CHECKS]: 'HEALTH_CHECK_ENABLED',
    };

    const envVar = configMap[flag];
    if (!envVar) {
      return true; // 默认启用
    }

    const value = process.env[envVar];
    
    // 特殊处理布尔值环境变量
    if (envVar.includes('ENABLED') || envVar.includes('enabled')) {
      return value === 'true';
    }
    
    // 有配置值就认为启用
    return !!value && value.trim() !== '';
  }

  private async getTenantFeatureConfig(flag: FeatureFlag, tenantId: string): Promise<boolean | null> {
    // TODO: 从数据库获取租户特定配置
    return null;
  }

  private async getGlobalFeatureConfig(flag: FeatureFlag): Promise<boolean | null> {
    // TODO: 从数据库获取全局配置
    return null;
  }

  private async checkDependencies(flag: FeatureFlag, tenantId?: string): Promise<void> {
    const dependencies = this.getFeatureDependencies(flag);
    
    for (const dependency of dependencies) {
      const isDepEnabled = await this.isEnabled(dependency, tenantId);
      if (!isDepEnabled) {
        throw new Error(`Cannot enable ${flag}: dependency ${dependency} is disabled`);
      }
    }
  }

  private getFeatureDependencies(flag: FeatureFlag): FeatureFlag[] {
    const dependencies: Partial<Record<FeatureFlag, FeatureFlag[]>> = {
      [FeatureFlag.EMAIL_VERIFICATION]: [FeatureFlag.EMAIL_SERVICE],
      [FeatureFlag.EMAIL_PASSWORD_RESET]: [FeatureFlag.EMAIL_SERVICE],
      [FeatureFlag.EMAIL_WELCOME]: [FeatureFlag.EMAIL_SERVICE],
      
      [FeatureFlag.SMS_VERIFICATION]: [FeatureFlag.SMS_SERVICE],
      [FeatureFlag.SMS_INTERNATIONAL]: [FeatureFlag.SMS_SERVICE],
      
      [FeatureFlag.ALERTS_ENABLED]: [FeatureFlag.MONITORING_ENABLED],
      [FeatureFlag.METRICS_COLLECTION]: [FeatureFlag.MONITORING_ENABLED],
      
      [FeatureFlag.REGISTRATION_EMAIL_VERIFICATION]: [
        FeatureFlag.USER_REGISTRATION,
        FeatureFlag.EMAIL_VERIFICATION,
      ],
    };

    return dependencies[flag] || [];
  }

  private getFeatureFlagMeta(flag: FeatureFlag): {
    description: string;
    category: string;
    dependencies: FeatureFlag[];
  } {
    const meta: Record<FeatureFlag, { description: string; category: string }> = {
      [FeatureFlag.EMAIL_SERVICE]: {
        description: '邮件服务总开关',
        category: 'Email Services',
      },
      [FeatureFlag.EMAIL_VERIFICATION]: {
        description: '邮箱验证码发送',
        category: 'Email Services',
      },
      [FeatureFlag.EMAIL_PASSWORD_RESET]: {
        description: '密码重置邮件',
        category: 'Email Services',
      },
      [FeatureFlag.EMAIL_WELCOME]: {
        description: '欢迎邮件',
        category: 'Email Services',
      },
      
      [FeatureFlag.SMS_SERVICE]: {
        description: '短信服务总开关',
        category: 'SMS Services',
      },
      [FeatureFlag.SMS_VERIFICATION]: {
        description: '短信验证码发送',
        category: 'SMS Services',
      },
      [FeatureFlag.SMS_INTERNATIONAL]: {
        description: '国际短信支持',
        category: 'SMS Services',
      },
      
      [FeatureFlag.OAUTH_GITHUB]: {
        description: 'GitHub OAuth登录',
        category: 'OAuth Services',
      },
      [FeatureFlag.OAUTH_GOOGLE]: {
        description: 'Google OAuth登录',
        category: 'OAuth Services',
      },
      [FeatureFlag.OAUTH_WECHAT]: {
        description: '微信OAuth登录',
        category: 'OAuth Services',
      },
      
      [FeatureFlag.MONITORING_ENABLED]: {
        description: '系统监控',
        category: 'Monitoring',
      },
      [FeatureFlag.ALERTS_ENABLED]: {
        description: '告警通知',
        category: 'Monitoring',
      },
      [FeatureFlag.METRICS_COLLECTION]: {
        description: '指标收集',
        category: 'Monitoring',
      },
      
      [FeatureFlag.RATE_LIMITING]: {
        description: 'API速率限制',
        category: 'Security',
      },
      [FeatureFlag.BRUTE_FORCE_PROTECTION]: {
        description: '暴力破解防护',
        category: 'Security',
      },
      [FeatureFlag.IP_WHITELIST]: {
        description: 'IP白名单',
        category: 'Security',
      },
      
      [FeatureFlag.AUDIT_LOGGING]: {
        description: '审计日志',
        category: 'Audit',
      },
      [FeatureFlag.AUDIT_DETAILED]: {
        description: '详细审计日志',
        category: 'Audit',
      },
      
      [FeatureFlag.USER_REGISTRATION]: {
        description: '用户注册',
        category: 'User Management',
      },
      [FeatureFlag.REGISTRATION_EMAIL_VERIFICATION]: {
        description: '注册邮箱验证',
        category: 'User Management',
      },
      
      [FeatureFlag.ADMIN_PANEL]: {
        description: '管理后台',
        category: 'Administration',
      },
      [FeatureFlag.API_DOCUMENTATION]: {
        description: 'API文档',
        category: 'Administration',
      },
      [FeatureFlag.HEALTH_CHECKS]: {
        description: '健康检查',
        category: 'Administration',
      },
    };

    const info = meta[flag];
    return {
      ...info,
      dependencies: this.getFeatureDependencies(flag),
    };
  }
}