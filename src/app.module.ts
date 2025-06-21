import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { RedisModule } from './redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { SmsModule } from './sms/sms.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { PerformanceModule } from './performance/performance.module';
import { DocumentationModule } from './documentation/documentation.module';
import { AdminAuthMiddleware } from './auth/middleware/admin-auth.middleware';
import { MonitoringMiddleware } from './monitoring/monitoring.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuditInterceptor } from './audit/interceptors/audit.interceptor';
import { MonitoringInterceptor } from './monitoring/monitoring.interceptor';
import configuration from './config/configuration';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // 速率限制模块
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1秒
        limit: 10, // 每秒最多10个请求
      },
      {
        name: 'medium',
        ttl: 10000, // 10秒
        limit: 20, // 每10秒最多20个请求
      },
      {
        name: 'long',
        ttl: 60000, // 1分钟
        limit: 100, // 每分钟最多100个请求
      },
    ]),

    // 核心模块
    CommonModule,
    DatabaseModule,
    RedisModule,
    AuditModule,
    SmsModule,
    MonitoringModule,
    FeatureFlagsModule,
    PerformanceModule,
    DocumentationModule,
    AuthModule,
  ],
  controllers: [],
  providers: [
    // 全局速率限制守卫
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 全局异常过滤器
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // 全局响应拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    // 全局审计拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    // 全局监控拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MonitoringMiddleware)
      .forRoutes('*'); // 监控所有路由

    consumer
      .apply(AdminAuthMiddleware)
      .forRoutes('admin/*');
  }
}
