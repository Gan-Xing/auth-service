import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNS } from 'aws-sdk';
import { SmsProvider, SmsMessage, SmsResult } from '../interfaces/sms-provider.interface';

@Injectable()
export class AwsSnsProvider implements SmsProvider {
  public readonly name = 'aws';
  private readonly logger = new Logger(AwsSnsProvider.name);
  private sns: SNS | null = null;
  private config: any;

  constructor(private configService: ConfigService) {
    this.config = this.configService.get('sms.aws');
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      if (this.validateConfig()) {
        this.sns = new SNS({
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
          region: this.config.region,
        });
        this.logger.log('AWS SNS 客户端初始化成功');
      }
    } catch (error) {
      this.logger.error('AWS SNS 客户端初始化失败', error);
    }
  }

  validateConfig(): boolean {
    return !!(this.config?.accessKeyId && this.config?.secretAccessKey && this.config?.region);
  }

  getSupportedCountries(): string[] {
    // AWS SNS 支持的主要国家（部分国家可能需要特殊申请）
    return [
      'US', 'GB', 'DE', 'FR', 'IT', 'ES', 'CA', 'AU', 'JP', 'KR', 'IN', 'BR',
      'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'IE', 'NZ', 'SG', 'MY',
      // AWS SNS 在某些国家可能有限制，需要根据实际情况调整
    ];
  }

  async sendSms(message: SmsMessage): Promise<SmsResult> {
    if (!this.sns) {
      return {
        success: false,
        error: 'AWS SNS 客户端未初始化',
        provider: this.name,
      };
    }

    try {
      this.logger.log(`发送 AWS SNS 短信至: ${this.maskPhoneNumber(message.to)}`);

      const params = {
        PhoneNumber: message.to,
        Message: message.text,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional', // 事务性短信，确保送达率
          },
        },
      };

      const response = await this.sns.publish(params).promise();

      if (response.MessageId) {
        this.logger.log(`AWS SNS 短信发送成功: ${response.MessageId}`);
        return {
          success: true,
          messageId: response.MessageId,
          provider: this.name,
        };
      }

      return {
        success: false,
        error: '未知的 AWS SNS 响应',
        provider: this.name,
      };
    } catch (error) {
      this.logger.error('AWS SNS 短信发送异常', error);

      // AWS 特定错误处理
      let errorMessage = error.message || '短信发送失败';
      if (error.code) {
        switch (error.code) {
          case 'InvalidParameter':
            errorMessage = '无效的手机号码或参数';
            break;
          case 'Throttling':
            errorMessage = '发送频率过高，请稍后重试';
            break;
          case 'InvalidParameterValue':
            errorMessage = '参数值无效';
            break;
          default:
            errorMessage = `AWS 错误 ${error.code}: ${error.message}`;
        }
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