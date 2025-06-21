import { Logger } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MetricType } from '@prisma/client';

/**
 * 监控工具类 - 提供可选的监控集成
 */
export class MonitoringHelper {
  private static readonly logger = new Logger(MonitoringHelper.name);

  /**
   * 安全地记录登录指标
   */
  static async recordLogin(
    monitoringService: MonitoringService | undefined,
    success: boolean,
    tenantId?: string,
    userId?: number,
    metadata?: any,
  ): Promise<void> {
    if (!monitoringService) {
      return; // 监控服务未可用
    }

    try {
      await monitoringService.recordLoginMetric(success, tenantId, userId, metadata);
    } catch (error) {
      this.logger.error(`Failed to record login metric: ${error.message}`);
    }
  }

  /**
   * 安全地记录数据库操作指标
   */
  static async recordDatabaseOperation(
    monitoringService: MonitoringService | undefined,
    operationTime: number,
    operation: string,
  ): Promise<void> {
    if (!monitoringService) {
      return;
    }

    try {
      await monitoringService.recordDatabaseQuery(operationTime, operation);
    } catch (error) {
      this.logger.error(`Failed to record database metric: ${error.message}`);
    }
  }

  /**
   * 安全地记录Redis操作指标
   */
  static async recordRedisOperation(
    monitoringService: MonitoringService | undefined,
    operationTime: number,
    operation: string,
  ): Promise<void> {
    if (!monitoringService) {
      return;
    }

    try {
      await monitoringService.recordRedisOperation(operationTime, operation);
    } catch (error) {
      this.logger.error(`Failed to record Redis metric: ${error.message}`);
    }
  }

  /**
   * 安全地记录自定义指标
   */
  static async recordMetric(
    monitoringService: MonitoringService | undefined,
    metricType: MetricType,
    name: string,
    value: number,
    options?: {
      unit?: string;
      tenantId?: string;
      userId?: number;
      endpoint?: string;
      method?: string;
      metadata?: any;
      tags?: string[];
    },
  ): Promise<void> {
    if (!monitoringService) {
      return;
    }

    try {
      await monitoringService.recordMetric({
        metricType,
        name,
        value,
        ...options,
      });
    } catch (error) {
      this.logger.error(`Failed to record custom metric: ${error.message}`);
    }
  }
}