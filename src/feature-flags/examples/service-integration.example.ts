import { Injectable, Logger } from '@nestjs/common';
import { FeatureFlagsService, FeatureFlag } from '../feature-flags.service';

/**
 * 示例：在服务中集成功能开关
 * 这个文件展示了如何在各种服务中正确使用功能开关
 */

@Injectable()
export class EmailServiceWithFeatureFlags {
  private readonly logger = new Logger(EmailServiceWithFeatureFlags.name);

  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    // private readonly emailService: EmailService, // 注入实际的邮件服务
  ) {}

  /**
   * 发送验证码邮件 - 带功能开关检查
   */
  async sendVerificationCode(email: string, code: string, tenantId?: string): Promise<boolean> {
    // 检查邮件服务总开关
    const emailServiceEnabled = await this.featureFlagsService.isEnabled(
      FeatureFlag.EMAIL_SERVICE, 
      tenantId
    );
    
    if (!emailServiceEnabled) {
      this.logger.warn('Email service is disabled');
      return false;
    }

    // 检查验证码邮件开关
    const verificationEnabled = await this.featureFlagsService.isEnabled(
      FeatureFlag.EMAIL_VERIFICATION,
      tenantId
    );
    
    if (!verificationEnabled) {
      this.logger.warn('Email verification is disabled');
      return false;
    }

    // 执行实际的邮件发送逻辑
    try {
      // await this.emailService.sendVerificationCode(email, code);
      this.logger.log(`Verification email sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send verification email: ${error.message}`);
      return false;
    }
  }

  /**
   * 发送欢迎邮件 - 可选功能
   */
  async sendWelcomeEmail(email: string, firstName: string, tenantId?: string): Promise<void> {
    // 检查欢迎邮件功能是否启用
    const welcomeEmailEnabled = await this.featureFlagsService.isEnabled(
      FeatureFlag.EMAIL_WELCOME,
      tenantId
    );
    
    if (!welcomeEmailEnabled) {
      this.logger.debug('Welcome email is disabled, skipping');
      return; // 静默跳过，不影响主流程
    }

    try {
      // await this.emailService.sendWelcomeEmail(email, firstName);
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      // 欢迎邮件发送失败不应该影响主流程
      this.logger.error(`Failed to send welcome email: ${error.message}`);
    }
  }
}

@Injectable()
export class AuthServiceWithFeatureFlags {
  private readonly logger = new Logger(AuthServiceWithFeatureFlags.name);

  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  /**
   * 用户注册 - 带功能开关控制
   */
  async register(userData: any, tenantId?: string): Promise<any> {
    // 检查用户注册功能是否启用
    const registrationEnabled = await this.featureFlagsService.isEnabled(
      FeatureFlag.USER_REGISTRATION,
      tenantId
    );
    
    if (!registrationEnabled) {
      throw new Error('用户注册功能当前不可用');
    }

    // 执行注册逻辑
    const user = await this.createUser(userData);

    // 检查是否需要邮箱验证
    const emailVerificationRequired = await this.featureFlagsService.isEnabled(
      FeatureFlag.REGISTRATION_EMAIL_VERIFICATION,
      tenantId
    );
    
    if (emailVerificationRequired) {
      await this.sendEmailVerification(user.email, tenantId);
    }

    return user;
  }

  /**
   * OAuth登录 - 动态检查提供商是否启用
   */
  async oauthLogin(provider: 'github' | 'google' | 'wechat', tenantId?: string): Promise<any> {
    const flagMap = {
      github: FeatureFlag.OAUTH_GITHUB,
      google: FeatureFlag.OAUTH_GOOGLE,
      wechat: FeatureFlag.OAUTH_WECHAT,
    };

    const flag = flagMap[provider];
    if (!flag) {
      throw new Error('不支持的OAuth提供商');
    }

    const providerEnabled = await this.featureFlagsService.isEnabled(flag, tenantId);
    if (!providerEnabled) {
      throw new Error(`${provider} OAuth登录当前不可用`);
    }

    // 执行OAuth登录逻辑
    return this.processOAuthLogin(provider);
  }

  private async createUser(userData: any): Promise<any> {
    // 模拟用户创建
    return { id: 1, ...userData };
  }

  private async sendEmailVerification(email: string, tenantId?: string): Promise<void> {
    // 模拟发送验证邮件
    this.logger.log(`Sending verification email to ${email}`);
  }

  private async processOAuthLogin(provider: string): Promise<any> {
    // 模拟OAuth登录处理
    this.logger.log(`Processing ${provider} OAuth login`);
    return { success: true, provider };
  }
}

@Injectable()
export class MonitoringServiceWithFeatureFlags {
  private readonly logger = new Logger(MonitoringServiceWithFeatureFlags.name);

  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  /**
   * 记录指标 - 带功能开关检查
   */
  async recordMetric(metricData: any, tenantId?: string): Promise<void> {
    // 检查监控功能是否启用
    const monitoringEnabled = await this.featureFlagsService.isEnabled(
      FeatureFlag.MONITORING_ENABLED,
      tenantId
    );
    
    if (!monitoringEnabled) {
      return; // 静默跳过
    }

    // 检查指标收集是否启用
    const metricsEnabled = await this.featureFlagsService.isEnabled(
      FeatureFlag.METRICS_COLLECTION,
      tenantId
    );
    
    if (!metricsEnabled) {
      return; // 静默跳过
    }

    // 记录指标
    this.logger.debug(`Recording metric: ${JSON.stringify(metricData)}`);
  }

  /**
   * 发送告警 - 带功能开关检查
   */
  async sendAlert(alertData: any, tenantId?: string): Promise<void> {
    // 检查告警功能是否启用
    const alertsEnabled = await this.featureFlagsService.isEnabled(
      FeatureFlag.ALERTS_ENABLED,
      tenantId
    );
    
    if (!alertsEnabled) {
      this.logger.debug('Alerts disabled, skipping alert');
      return;
    }

    // 发送告警
    this.logger.warn(`Sending alert: ${JSON.stringify(alertData)}`);
  }
}

/**
 * 批量检查功能开关的工具类
 */
@Injectable()
export class FeatureFlagHelper {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  /**
   * 检查多个功能是否都启用
   */
  async areAllEnabled(flags: FeatureFlag[], tenantId?: string): Promise<boolean> {
    const results = await Promise.all(
      flags.map(flag => this.featureFlagsService.isEnabled(flag, tenantId))
    );
    return results.every(enabled => enabled);
  }

  /**
   * 检查是否有任一功能启用
   */
  async isAnyEnabled(flags: FeatureFlag[], tenantId?: string): Promise<boolean> {
    const results = await Promise.all(
      flags.map(flag => this.featureFlagsService.isEnabled(flag, tenantId))
    );
    return results.some(enabled => enabled);
  }

  /**
   * 获取启用的功能列表
   */
  async getEnabledFlags(flags: FeatureFlag[], tenantId?: string): Promise<FeatureFlag[]> {
    const results = await Promise.all(
      flags.map(async flag => ({
        flag,
        enabled: await this.featureFlagsService.isEnabled(flag, tenantId)
      }))
    );
    
    return results
      .filter(result => result.enabled)
      .map(result => result.flag);
  }
}