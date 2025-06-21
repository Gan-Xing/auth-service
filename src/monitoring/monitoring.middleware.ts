import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from './monitoring.service';

@Injectable()
export class MonitoringMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MonitoringMiddleware.name);

  constructor(private readonly monitoringService: MonitoringService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const originalEnd = res.end.bind(res);

    // 重写 res.end 方法来捕获响应时间和状态码
    res.end = function(chunk?: any, encoding?: any, cb?: any): any {
      const responseTime = Date.now() - startTime;
      const statusCode = res.statusCode;
      const method = req.method;
      const endpoint = req.route?.path || req.path;

      // 异步记录指标，不阻塞响应
      setImmediate(async () => {
        try {
          // 检查监控服务是否可用
          if (this.monitoringService && typeof this.monitoringService.recordApiRequest === 'function') {
            // 从请求中提取租户和用户信息
            const tenantId = req.headers['x-tenant-id'] as string;
            const userId = (req as any).user?.sub;

            await this.monitoringService.recordApiRequest(
              endpoint,
              method,
              responseTime,
              statusCode,
              tenantId,
              userId,
            );
          }
        } catch (error) {
          // 不要因为监控失败而影响主要功能
          // console.error('Monitoring middleware error:', error.message);
          // 静默忽略监控错误，避免日志污染
        }
      });

      // 调用原始的 end 方法
      return originalEnd(chunk, encoding, cb);
    };

    next();
  }
}