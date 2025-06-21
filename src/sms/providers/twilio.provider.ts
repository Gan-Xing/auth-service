import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { SmsProvider, SmsMessage, SmsResult } from '../interfaces/sms-provider.interface';

@Injectable()
export class TwilioProvider implements SmsProvider {
  public readonly name = 'twilio';
  private readonly logger = new Logger(TwilioProvider.name);
  private client: Twilio | null = null;
  private config: any;

  constructor(private configService: ConfigService) {
    this.config = this.configService.get('sms.twilio');
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      if (this.validateConfig()) {
        this.client = new Twilio(this.config.accountSid, this.config.authToken);
        this.logger.log('Twilio SMS 客户端初始化成功');
      }
    } catch (error) {
      this.logger.error('Twilio SMS 客户端初始化失败', error);
    }
  }

  validateConfig(): boolean {
    return !!(this.config?.accountSid && this.config?.authToken && this.config?.from);
  }

  getSupportedCountries(): string[] {
    // Twilio 支持全球大部分国家
    return [
      'US', 'GB', 'CN', 'IN', 'BR', 'RU', 'JP', 'DE', 'FR', 'IT', 'ES', 'CA', 'AU', 'MX',
      'KR', 'TH', 'VN', 'MY', 'SG', 'ID', 'PH', 'TW', 'HK', 'AR', 'CL', 'CO', 'PE',
      'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'RO', 'GR', 'PT', 'IE',
      'NZ', 'ZA', 'EG', 'NG', 'KE', 'MA', 'IL', 'TR', 'SA', 'AE', 'QA', 'KW',
      // Twilio 支持更多国家
    ];
  }

  async sendSms(message: SmsMessage): Promise<SmsResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Twilio 客户端未初始化',
        provider: this.name,
      };
    }

    try {
      this.logger.log(`发送 Twilio 短信至: ${this.maskPhoneNumber(message.to)}`);

      const response = await this.client.messages.create({
        to: message.to,
        from: message.from || this.config.from,
        body: message.text,
      });

      if (response.sid) {
        this.logger.log(`Twilio 短信发送成功: ${response.sid}`);
        return {
          success: true,
          messageId: response.sid,
          cost: parseFloat(response.price) || 0,
          provider: this.name,
        };
      }

      return {
        success: false,
        error: response.errorMessage || '未知错误',
        provider: this.name,
      };
    } catch (error) {
      this.logger.error('Twilio 短信发送异常', error);
      
      // Twilio 特定错误处理
      let errorMessage = error.message || '短信发送失败';
      if (error.code) {
        errorMessage = `Twilio 错误 ${error.code}: ${error.message}`;
      }

      return {
        success: false,
        error: errorMessage,
        provider: this.name,
      };
    }
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return phone;
    return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
  }
}