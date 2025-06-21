import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { SmsProvider, SmsMessage, SmsResult } from './interfaces/sms-provider.interface';
import { VonageProvider } from './providers/vonage.provider';
import { TwilioProvider } from './providers/twilio.provider';
import { AwsSnsProvider } from './providers/aws-sns.provider';
import { AuditAction } from '@prisma/client';

export interface SmsVerificationResult {
  success: boolean;
  messageId?: string;
  expiresAt: Date;
  cost?: number;
  provider: string;
  error?: string;
}

export interface SmsRateLimitInfo {
  hourlyCount: number;
  dailyCount: number;
  hourlyLimit: number;
  dailyLimit: number;
  nextResetHour: Date;
  nextResetDay: Date;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private providers = new Map<string, SmsProvider>();
  private currentProvider: SmsProvider | null = null;
  private config: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
    private readonly vonageProvider: VonageProvider,
    private readonly twilioProvider: TwilioProvider,
    private readonly awsSnsProvider: AwsSnsProvider,
  ) {
    this.config = this.configService.get('sms');
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // 注册所有提供商
    this.providers.set('vonage', this.vonageProvider);
    this.providers.set('twilio', this.twilioProvider);
    this.providers.set('aws', this.awsSnsProvider);

    // 选择当前提供商
    const preferredProvider = this.config.provider;
    const provider = this.providers.get(preferredProvider);

    if (provider && provider.validateConfig()) {
      this.currentProvider = provider;
      this.logger.log(`SMS 服务使用提供商: ${provider.name}`);
    } else {
      // 自动选择第一个可用的提供商
      for (const [name, provider] of this.providers) {
        if (provider.validateConfig()) {
          this.currentProvider = provider;
          this.logger.log(`SMS 服务自动选择提供商: ${name}`);
          break;
        }
      }
    }

    if (!this.currentProvider) {
      this.logger.warn('没有可用的 SMS 提供商配置');
    }
  }

  /**
   * 发送验证码短信
   */
  async sendVerificationCode(
    phoneNumber: string,
    code: string,
    tenantId?: string,
    userId?: number,
  ): Promise<SmsVerificationResult> {
    try {
      // 验证手机号格式
      const validatedPhone = this.validateAndFormatPhoneNumber(phoneNumber);
      
      // 检查发送频率限制
      await this.checkRateLimit(validatedPhone);
      
      // 检查国际短信权限
      await this.checkInternationalPermission(validatedPhone);

      // 生成短信内容
      const message = this.generateVerificationMessage(code);

      // 发送短信
      const result = await this.sendSms({
        to: validatedPhone,
        text: message,
      });

      // 记录发送结果
      await this.recordSmsUsage(validatedPhone, result.success);

      // 记录审计日志
      if (tenantId) {
        await this.auditService.log({
          tenantId,
          userId,
          action: AuditAction.AUTH_EMAIL_VERIFICATION, // 复用邮箱验证action
          resource: 'sms',
          description: `发送短信验证码到 ${this.maskPhoneNumber(validatedPhone)}`,
          details: {
            phoneNumber: this.maskPhoneNumber(validatedPhone),
            provider: result.provider,
            cost: result.cost,
          },
          success: result.success,
          errorCode: result.error ? 'SMS_SEND_FAILED' : undefined,
          errorMessage: result.error,
        });
      }

      if (result.success) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟过期
        
        this.logger.log(`短信验证码发送成功: ${this.maskPhoneNumber(validatedPhone)}`);
        
        return {
          success: true,
          messageId: result.messageId,
          expiresAt,
          cost: result.cost,
          provider: result.provider,
        };
      } else {
        this.logger.error(`短信验证码发送失败: ${result.error}`);
        return {
          success: false,
          expiresAt: new Date(),
          provider: result.provider,
          error: result.error,
        };
      }
    } catch (error) {
      this.logger.error('发送短信验证码异常', error);
      return {
        success: false,
        expiresAt: new Date(),
        provider: 'unknown',
        error: error.message,
      };
    }
  }

  /**
   * 发送自定义短信
   */
  async sendCustomSms(
    phoneNumber: string,
    message: string,
    tenantId?: string,
    userId?: number,
  ): Promise<SmsResult> {
    try {
      const validatedPhone = this.validateAndFormatPhoneNumber(phoneNumber);
      await this.checkRateLimit(validatedPhone);
      await this.checkInternationalPermission(validatedPhone);

      const result = await this.sendSms({
        to: validatedPhone,
        text: message,
      });

      await this.recordSmsUsage(validatedPhone, result.success);

      // 记录审计日志
      if (tenantId) {
        await this.auditService.log({
          tenantId,
          userId,
          action: AuditAction.USER_UPDATE, // 使用通用用户操作action
          resource: 'sms',
          description: `发送自定义短信到 ${this.maskPhoneNumber(validatedPhone)}`,
          details: {
            phoneNumber: this.maskPhoneNumber(validatedPhone),
            provider: result.provider,
            messageLength: message.length,
          },
          success: result.success,
          errorMessage: result.error,
        });
      }

      return result;
    } catch (error) {
      this.logger.error('发送自定义短信异常', error);
      return {
        success: false,
        provider: 'unknown',
        error: error.message,
      };
    }
  }

  /**
   * 获取用户SMS发送频率信息
   */
  async getRateLimitInfo(phoneNumber: string): Promise<SmsRateLimitInfo> {
    const validatedPhone = this.validateAndFormatPhoneNumber(phoneNumber);
    const hourKey = this.getHourlyRateKey(validatedPhone);
    const dayKey = this.getDailyRateKey(validatedPhone);

    const [hourlyCount, dailyCount] = await Promise.all([
      this.redisService.get(hourKey).then(count => parseInt((count as string) || '0', 10)),
      this.redisService.get(dayKey).then(count => parseInt((count as string) || '0', 10)),
    ]);

    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    return {
      hourlyCount,
      dailyCount,
      hourlyLimit: this.config.rateLimit.maxSmsPerHour,
      dailyLimit: this.config.rateLimit.maxSmsPerDay,
      nextResetHour: nextHour,
      nextResetDay: nextDay,
    };
  }

  /**
   * 获取支持的国家列表
   */
  getSupportedCountries(): string[] {
    if (!this.currentProvider) {
      return [];
    }
    return this.currentProvider.getSupportedCountries();
  }

  /**
   * 检查服务状态
   */
  getServiceStatus() {
    const status = {
      available: !!this.currentProvider,
      provider: this.currentProvider?.name || 'none',
      supportedCountries: this.getSupportedCountries().length,
      internationalEnabled: this.config.international.enabled,
      providers: Array.from(this.providers.entries()).map(([name, provider]) => ({
        name,
        configured: provider.validateConfig(),
        supportedCountries: provider.getSupportedCountries().length,
      })),
    };

    return status;
  }

  private async sendSms(message: SmsMessage): Promise<SmsResult> {
    if (!this.currentProvider) {
      return {
        success: false,
        error: '没有可用的 SMS 提供商',
        provider: 'none',
      };
    }

    return await this.currentProvider.sendSms(message);
  }

  private validateAndFormatPhoneNumber(phoneNumber: string): string {
    try {
      if (!isValidPhoneNumber(phoneNumber)) {
        throw new BadRequestException('无效的手机号码格式');
      }

      const parsedPhone = parsePhoneNumber(phoneNumber);
      if (!parsedPhone) {
        throw new BadRequestException('无法解析手机号码');
      }

      // 返回E.164格式 (+国家代码+号码)
      return parsedPhone.format('E.164');
    } catch (error) {
      throw new BadRequestException(`手机号码格式错误: ${error.message}`);
    }
  }

  private async checkRateLimit(phoneNumber: string): Promise<void> {
    const hourKey = this.getHourlyRateKey(phoneNumber);
    const dayKey = this.getDailyRateKey(phoneNumber);

    const [hourlyCount, dailyCount] = await Promise.all([
      this.redisService.get(hourKey).then(count => parseInt((count as string) || '0', 10)),
      this.redisService.get(dayKey).then(count => parseInt((count as string) || '0', 10)),
    ]);

    if (hourlyCount >= this.config.rateLimit.maxSmsPerHour) {
      throw new BadRequestException('短信发送过于频繁，请1小时后重试');
    }

    if (dailyCount >= this.config.rateLimit.maxSmsPerDay) {
      throw new BadRequestException('今日短信发送次数已达上限，请明天重试');
    }
  }

  private async checkInternationalPermission(phoneNumber: string): Promise<void> {
    if (!this.config.international.enabled) {
      // 如果未启用国际短信，检查是否为默认国家号码
      const defaultCountryCode = this.config.international.defaultCountryCode;
      if (!phoneNumber.startsWith(`+${defaultCountryCode}`)) {
        throw new BadRequestException('国际短信服务未启用');
      }
      return;
    }

    // 检查国家白名单
    const allowedCountries = this.config.international.allowedCountries;
    if (allowedCountries.length > 0) {
      const parsedPhone = parsePhoneNumber(phoneNumber);
      const countryCode = parsedPhone?.country;
      
      if (!countryCode || !allowedCountries.includes(countryCode)) {
        throw new BadRequestException('该国家/地区不在短信服务支持范围内');
      }
    }
  }

  private async recordSmsUsage(phoneNumber: string, success: boolean): Promise<void> {
    if (!success) return;

    const hourKey = this.getHourlyRateKey(phoneNumber);
    const dayKey = this.getDailyRateKey(phoneNumber);

    await Promise.all([
      this.redisService.incr(hourKey).then(() => 
        this.redisService.expire(hourKey, 3600) // 1小时过期
      ),
      this.redisService.incr(dayKey).then(() => 
        this.redisService.expire(dayKey, 86400) // 24小时过期
      ),
    ]);
  }

  private generateVerificationMessage(code: string): string {
    return `您的验证码是：${code}，10分钟内有效。请勿泄露给他人。【AuthService】`;
  }

  private getHourlyRateKey(phoneNumber: string): string {
    const hour = new Date().getHours();
    const date = new Date().toISOString().split('T')[0];
    return `sms:rate:hour:${phoneNumber}:${date}:${hour}`;
  }

  private getDailyRateKey(phoneNumber: string): string {
    const date = new Date().toISOString().split('T')[0];
    return `sms:rate:day:${phoneNumber}:${date}`;
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return phone;
    return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
  }
}