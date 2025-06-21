import { Module, Global } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { VonageProvider } from './providers/vonage.provider';
import { TwilioProvider } from './providers/twilio.provider';
import { AwsSnsProvider } from './providers/aws-sns.provider';
import { RedisModule } from '../redis/redis.module';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  imports: [RedisModule, AuditModule],
  providers: [
    SmsService,
    VonageProvider,
    TwilioProvider,
    AwsSnsProvider,
  ],
  controllers: [SmsController],
  exports: [SmsService],
})
export class SmsModule {}