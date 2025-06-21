import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MonitoringService } from './monitoring.service';
import { AlertService } from './alert.service';
import { MonitoringController } from './monitoring.controller';
import { MonitoringMiddleware } from './monitoring.middleware';
import { MonitoringInterceptor } from './monitoring.interceptor';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    EmailModule,
    forwardRef(() => AuthModule),
  ],
  providers: [
    MonitoringService,
    AlertService,
    MonitoringMiddleware,
    MonitoringInterceptor,
  ],
  controllers: [MonitoringController],
  exports: [
    MonitoringService,
    AlertService,
    MonitoringMiddleware,
    MonitoringInterceptor,
  ],
})
export class MonitoringModule {}