import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MonitoringService } from './monitoring.service';
import { AlertService } from './alert.service';
import { AlertType, AlertSeverity } from '@prisma/client';
import { Request } from 'express';

@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MonitoringInterceptor.name);

  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly alertService: AlertService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const endpoint = request.route?.path || request.path;
    const tenantId = request.headers['x-tenant-id'] as string;
    const userId = (request as any).user?.sub;

    return next.handle().pipe(
      tap(async (data) => {
        // 成功响应的处理
        const responseTime = Date.now() - startTime;
        
        try {
          // 记录数据库查询时间（如果有）
          if ((request as any).dbQueryTime) {
            await this.monitoringService.recordDatabaseQuery(
              (request as any).dbQueryTime,
              'database_operation',
            );
          }

          // 记录Redis操作时间（如果有）
          if ((request as any).redisOperationTime) {
            await this.monitoringService.recordRedisOperation(
              (request as any).redisOperationTime,
              'redis_operation',
            );
          }

          // 检查慢查询告警
          const config = this.monitoringService['configService'].get('monitoring');
          if (responseTime > config?.slowQueryThreshold) {
            await this.alertService.createAlert({
              alertType: AlertType.HIGH_RESPONSE_TIME,
              severity: AlertSeverity.MEDIUM,
              title: '慢查询告警',
              message: `端点 ${endpoint} 响应时间过长: ${responseTime}ms`,
              triggerValue: responseTime,
              thresholdValue: config.slowQueryThreshold,
              endpoint,
              tenantId,
              details: {
                method,
                endpoint,
                responseTime,
                userId,
              },
            });
          }
        } catch (error) {
          this.logger.error(`Monitoring interceptor error: ${error.message}`);
        }
      }),
      catchError(async (error) => {
        // 错误响应的处理
        const responseTime = Date.now() - startTime;
        
        try {
          // 记录错误指标
          await this.monitoringService.recordApiRequest(
            endpoint,
            method,
            responseTime,
            500, // 错误状态码
            tenantId,
            userId,
          );

          // 根据错误类型创建相应的告警
          if (this.isSecurityError(error)) {
            await this.alertService.createAlert({
              alertType: AlertType.SUSPICIOUS_ACTIVITY,
              severity: AlertSeverity.HIGH,
              title: '安全异常告警',
              message: `检测到安全相关错误: ${error.message}`,
              endpoint,
              tenantId,
              details: {
                error: error.message,
                stack: error.stack,
                method,
                endpoint,
                userId,
              },
              stackTrace: error.stack,
            });
          } else if (this.isDatabaseError(error)) {
            await this.alertService.createAlert({
              alertType: AlertType.DATABASE_CONNECTION_ERROR,
              severity: AlertSeverity.CRITICAL,
              title: '数据库错误告警',
              message: `数据库操作失败: ${error.message}`,
              endpoint,
              tenantId,
              details: {
                error: error.message,
                method,
                endpoint,
                userId,
              },
            });
          } else if (this.isRedisError(error)) {
            await this.alertService.createAlert({
              alertType: AlertType.REDIS_CONNECTION_ERROR,
              severity: AlertSeverity.HIGH,
              title: 'Redis错误告警',
              message: `Redis操作失败: ${error.message}`,
              endpoint,
              tenantId,
              details: {
                error: error.message,
                method,
                endpoint,
                userId,
              },
            });
          }
        } catch (monitoringError) {
          this.logger.error(`Monitoring error handling failed: ${monitoringError.message}`);
        }
        
        return throwError(() => error);
      }),
    );
  }

  private isSecurityError(error: any): boolean {
    const securityKeywords = [
      'unauthorized',
      'forbidden',
      'authentication',
      'jwt',
      'token',
      'permission',
      'access denied',
      'brute force',
      'rate limit',
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return securityKeywords.some(keyword => errorMessage.includes(keyword));
  }

  private isDatabaseError(error: any): boolean {
    const dbKeywords = [
      'prisma',
      'database',
      'connection',
      'postgresql',
      'query',
      'relation',
      'constraint',
      'timeout',
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return dbKeywords.some(keyword => errorMessage.includes(keyword));
  }

  private isRedisError(error: any): boolean {
    const redisKeywords = [
      'redis',
      'ioredis',
      'connection refused',
      'redis client',
      'cache',
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return redisKeywords.some(keyword => errorMessage.includes(keyword));
  }
}