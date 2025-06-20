import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeaturesConfig, loadFeaturesConfig } from '../../config/features.config';

@Injectable()
export class FeaturesService {
  private readonly logger = new Logger(FeaturesService.name);
  private featuresConfig: FeaturesConfig;

  constructor(private readonly configService: ConfigService) {
    this.featuresConfig = loadFeaturesConfig();
    this.logger.log('Features configuration loaded');
  }

  /**
   * 获取完整的功能配置
   */
  getConfig(): FeaturesConfig {
    return this.featuresConfig;
  }

  /**
   * 检查功能是否启用
   */
  isEnabled(featurePath: string): boolean {
    const keys = featurePath.split('.');
    let current: any = this.featuresConfig;
    
    for (const key of keys) {
      current = current?.[key];
      if (current === undefined) {
        return false;
      }
    }
    
    return current?.enabled === true || current === true;
  }

  /**
   * 获取功能配置
   */
  getFeatureConfig(featurePath: string): any {
    const keys = featurePath.split('.');
    let current: any = this.featuresConfig;
    
    for (const key of keys) {
      current = current?.[key];
      if (current === undefined) {
        return null;
      }
    }
    
    return current;
  }

  /**
   * SSO 提供商相关
   */
  isSSOEnabled(provider: 'github' | 'google' | 'wechat'): boolean {
    return this.isEnabled(`sso.${provider}`);
  }

  getSSOConfig(provider: 'github' | 'google' | 'wechat') {
    return this.getFeatureConfig(`sso.${provider}`);
  }

  getEnabledSSOProviders(): string[] {
    const providers = [];
    if (this.isSSOEnabled('github')) providers.push('github');
    if (this.isSSOEnabled('google')) providers.push('google');
    if (this.isSSOEnabled('wechat')) providers.push('wechat');
    return providers;
  }

  /**
   * 外部服务集成相关
   */
  isServiceEnabled(serviceName: string): boolean {
    return this.isEnabled(`services.${serviceName}`);
  }

  getServiceConfig(serviceName: string) {
    return this.getFeatureConfig(`services.${serviceName}`);
  }

  /**
   * 使用统计服务
   */
  isUsageServiceEnabled(): boolean {
    return this.isServiceEnabled('usageService');
  }

  getUsageServiceConfig() {
    return this.getServiceConfig('usageService');
  }

  /**
   * 速率限制服务
   */
  isRateLimiterEnabled(): boolean {
    return this.isServiceEnabled('rateLimiter');
  }

  getRateLimiterConfig() {
    return this.getServiceConfig('rateLimiter');
  }

  /**
   * 通知服务
   */
  isNotificationServiceEnabled(): boolean {
    return this.isServiceEnabled('notificationService');
  }

  getNotificationServiceConfig() {
    return this.getServiceConfig('notificationService');
  }

  /**
   * Webhook 服务
   */
  isWebhookServiceEnabled(): boolean {
    return this.isServiceEnabled('webhookService');
  }

  getWebhookServiceConfig() {
    return this.getServiceConfig('webhookService');
  }

  /**
   * 内置功能相关
   */
  isFeatureEnabled(featureName: string): boolean {
    return this.isEnabled(`features.${featureName}`);
  }

  getFeatureConfigByName(featureName: string) {
    return this.getFeatureConfig(`features.${featureName}`);
  }

  /**
   * 邮件验证
   */
  isEmailVerificationEnabled(): boolean {
    return this.isFeatureEnabled('emailVerification');
  }

  isEmailVerificationRequired(): boolean {
    const config = this.getFeatureConfigByName('emailVerification');
    return config?.required === true;
  }

  /**
   * 审计日志
   */
  isAuditLogEnabled(): boolean {
    return this.isFeatureEnabled('auditLog');
  }

  getAuditLogEvents(): string[] {
    const config = this.getFeatureConfigByName('auditLog');
    return config?.events || [];
  }

  /**
   * API 限制
   */
  isApiLimitsEnabled(): boolean {
    return this.isFeatureEnabled('apiLimits');
  }

  getApiLimits() {
    return this.getFeatureConfigByName('apiLimits');
  }

  /**
   * 热更新配置（如果对接了配置服务）
   */
  async refreshConfig(): Promise<void> {
    if (this.isServiceEnabled('configService')) {
      try {
        const configServiceConfig = this.getServiceConfig('configService');
        // 这里可以实现从配置服务拉取最新配置的逻辑
        this.logger.log('Configuration refreshed from config service');
      } catch (error) {
        this.logger.warn('Failed to refresh config from config service:', error.message);
      }
    }
  }

  /**
   * 获取功能状态摘要
   */
  getFeaturesSummary() {
    return {
      sso: {
        enabled: this.getEnabledSSOProviders(),
      },
      services: {
        usageService: this.isUsageServiceEnabled(),
        rateLimiter: this.isRateLimiterEnabled(),
        notificationService: this.isNotificationServiceEnabled(),
        webhookService: this.isWebhookServiceEnabled(),
      },
      features: {
        emailVerification: this.isEmailVerificationEnabled(),
        auditLog: this.isAuditLogEnabled(),
        apiLimits: this.isApiLimitsEnabled(),
      },
    };
  }
}