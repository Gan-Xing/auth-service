import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Vonage } from '@vonage/server-sdk';
import { SmsProvider, SmsMessage, SmsResult } from '../interfaces/sms-provider.interface';

@Injectable()
export class VonageProvider implements SmsProvider {
  public readonly name = 'vonage';
  private readonly logger = new Logger(VonageProvider.name);
  private vonage: Vonage | null = null;
  private config: any;

  constructor(private configService: ConfigService) {
    this.config = this.configService.get('sms.vonage');
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      if (this.validateConfig()) {
        this.vonage = new Vonage({
          apiKey: this.config.apiKey,
          apiSecret: this.config.apiSecret,
        } as any);
        this.logger.log('Vonage SMS 客户端初始化成功');
      }
    } catch (error) {
      this.logger.error('Vonage SMS 客户端初始化失败', error);
    }
  }

  validateConfig(): boolean {
    return !!(this.config?.apiKey && this.config?.apiSecret);
  }

  getSupportedCountries(): string[] {
    // Vonage 支持全球大部分国家
    return [
      'US', 'GB', 'CN', 'IN', 'BR', 'RU', 'JP', 'DE', 'FR', 'IT', 'ES', 'CA', 'AU', 'MX',
      'KR', 'TH', 'VN', 'MY', 'SG', 'ID', 'PH', 'TW', 'HK', 'AR', 'CL', 'CO', 'PE',
      // 添加更多国家...
    ];
  }

  async sendSms(message: SmsMessage): Promise<SmsResult> {
    if (!this.vonage) {
      return {
        success: false,
        error: 'Vonage 客户端未初始化',
        provider: this.name,
      };
    }

    try {
      this.logger.log(`发送 Vonage 短信至: ${this.maskPhoneNumber(message.to)}`);

      const response = await this.vonage.sms.send({
        to: message.to,
        from: message.from || this.config.from,
        text: message.text,
      });

      // Vonage API 响应格式检查
      if (response.messages && response.messages[0]) {
        const smsResponse = response.messages[0];
        
        if (smsResponse.status === '0') {
          // 成功
          this.logger.log(`Vonage 短信发送成功: ${smsResponse['message-id']}`);
          return {
            success: true,
            messageId: smsResponse['message-id'],
            cost: parseFloat(smsResponse['message-price']) || 0,
            provider: this.name,
          };
        } else {
          // 失败
          this.logger.error(`Vonage 短信发送失败: ${smsResponse['error-text']}`);
          return {
            success: false,
            error: smsResponse['error-text'] || `错误代码: ${smsResponse.status}`,
            provider: this.name,
          };
        }
      }

      return {
        success: false,
        error: '未知的 Vonage API 响应格式',
        provider: this.name,
      };
    } catch (error) {
      this.logger.error('Vonage 短信发送异常', error);
      return {
        success: false,
        error: error.message || '短信发送失败',
        provider: this.name,
      };
    }
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return phone;
    return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
  }
}