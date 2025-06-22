import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MetricType, AlertType, AlertSeverity, AlertStatus } from '@prisma/client';
import * as os from 'os';
import * as process from 'process';

export interface SystemMetricData {
  metricType: MetricType;
  name: string;
  value: number;
  unit?: string;
  tenantId?: string;
  userId?: number;
  endpoint?: string;
  method?: string;
  metadata?: any;
  tags?: string[];
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: boolean;
    redis: boolean;
    memory: boolean;
    cpu: boolean;
  };
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
    responseTime: number;
  };
  uptime: number;
  timestamp: Date;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private startTime: Date;
  private requestCount = 0;
  private errorCount = 0;
  private totalResponseTime = 0;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.startTime = new Date();
  }

  /**
   * 记录系统指标
   */
  async recordMetric(data: SystemMetricData): Promise<void> {
    try {
      const config = this.configService.get('metrics');
      if (!config?.enabled) {
        return;
      }

      // 尝试存储到数据库
      try {
        await this.prismaService.systemMetric.create({
          data: {
            metricType: data.metricType,
            name: data.name,
            value: data.value,
            unit: data.unit,
            tenantId: data.tenantId,
            userId: data.userId,
            endpoint: data.endpoint,
            method: data.method,
            metadata: data.metadata,
            tags: data.tags || [],
          },
        });
      } catch (error) {
        this.logger.error(`Failed to store metric to database: ${error.message}`);
        
        // 降级到Redis存储
        const metricKey = `metric:${data.metricType}:${data.name}:${Date.now()}`;
        await this.redisService.set(metricKey, data, 3600); // 1小时过期
      }
    } catch (error) {
      this.logger.error(`Failed to record metric: ${error.message}`);
    }
  }

  /**
   * 记录API请求指标
   */
  async recordApiRequest(
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
    tenantId?: string,
    userId?: number,
  ): Promise<void> {
    this.requestCount++;
    this.totalResponseTime += responseTime;

    if (statusCode >= 400) {
      this.errorCount++;
    }

    // 记录响应时间指标
    await this.recordMetric({
      metricType: MetricType.RESPONSE_TIME,
      name: `api_response_time`,
      value: responseTime,
      unit: 'ms',
      endpoint,
      method,
      tenantId,
      userId,
      tags: [`status:${statusCode}`, `endpoint:${endpoint}`],
    });

    // 记录请求计数
    await this.recordMetric({
      metricType: MetricType.REQUEST_COUNT,
      name: 'api_request_count',
      value: 1,
      unit: 'count',
      endpoint,
      method,
      tenantId,
      userId,
      tags: [`status:${statusCode}`, `endpoint:${endpoint}`],
      metadata: { statusCode },
    });

    // 如果是错误，记录错误率
    if (statusCode >= 400) {
      await this.recordMetric({
        metricType: MetricType.ERROR_RATE,
        name: 'api_error_count',
        value: 1,
        unit: 'count',
        endpoint,
        method,
        tenantId,
        userId,
        tags: [`status:${statusCode}`, `endpoint:${endpoint}`],
        metadata: { statusCode },
      });
    }
  }

  /**
   * 记录登录相关指标
   */
  async recordLoginMetric(
    success: boolean,
    tenantId?: string,
    userId?: number,
    metadata?: any,
  ): Promise<void> {
    const metricType = success ? MetricType.LOGIN_SUCCESS : MetricType.LOGIN_FAILURE;
    const name = success ? 'login_success_count' : 'login_failure_count';

    await this.recordMetric({
      metricType,
      name,
      value: 1,
      unit: 'count',
      tenantId,
      userId,
      tags: success ? ['event:login_success'] : ['event:login_failure'],
      metadata,
    });
  }

  /**
   * 记录数据库查询时间
   */
  async recordDatabaseQuery(queryTime: number, operation: string): Promise<void> {
    await this.recordMetric({
      metricType: MetricType.DATABASE_QUERY_TIME,
      name: 'database_query_time',
      value: queryTime,
      unit: 'ms',
      tags: [`operation:${operation}`],
      metadata: { operation },
    });
  }

  /**
   * 记录Redis操作时间
   */
  async recordRedisOperation(operationTime: number, operation: string): Promise<void> {
    await this.recordMetric({
      metricType: MetricType.REDIS_OPERATION_TIME,
      name: 'redis_operation_time',
      value: operationTime,
      unit: 'ms',
      tags: [`operation:${operation}`],
      metadata: { operation },
    });
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const cpuUsage = this.getCpuUsage();
    const memoryUsage = this.getMemoryUsage();
    
    // 检查各组件状态
    const isDatabaseHealthy = await this.checkDatabaseHealth();
    const isRedisHealthy = await this.checkRedisHealth();
    const isMemoryHealthy = memoryUsage < 80; // 80%阈值
    const isCpuHealthy = cpuUsage < 80; // 80%阈值

    // 计算整体状态
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!isDatabaseHealthy || !isRedisHealthy) {
      status = 'unhealthy';
    } else if (!isMemoryHealthy || !isCpuHealthy) {
      status = 'degraded';
    }

    const avgResponseTime = this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0;
    const uptime = Date.now() - this.startTime.getTime();

    return {
      status,
      components: {
        database: isDatabaseHealthy,
        redis: isRedisHealthy,
        memory: isMemoryHealthy,
        cpu: isCpuHealthy,
      },
      metrics: {
        cpuUsage,
        memoryUsage,
        activeConnections: this.requestCount,
        responseTime: avgResponseTime,
      },
      uptime: Math.floor(uptime / 1000), // 秒
      timestamp: new Date(),
    };
  }

  /**
   * 获取指标统计数据
   */
  async getMetricsStats(
    metricType?: MetricType,
    tenantId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    try {
      const where: any = {};
      
      if (metricType) {
        where.metricType = metricType;
      }
      
      if (tenantId) {
        where.tenantId = tenantId;
      }
      
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) {
          where.timestamp.gte = startDate;
        }
        if (endDate) {
          where.timestamp.lte = endDate;
        }
      }

      const metrics = await this.prismaService.systemMetric.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 1000, // 限制返回数量
      });

      // 按类型分组统计
      const grouped = metrics.reduce((acc, metric) => {
        const key = metric.metricType;
        if (!acc[key]) {
          acc[key] = {
            count: 0,
            total: 0,
            min: Number.MAX_VALUE,
            max: Number.MIN_VALUE,
            avg: 0,
            recent: [],
          };
        }
        
        acc[key].count++;
        acc[key].total += metric.value;
        acc[key].min = Math.min(acc[key].min, metric.value);
        acc[key].max = Math.max(acc[key].max, metric.value);
        acc[key].recent.push({
          value: metric.value,
          timestamp: metric.timestamp,
          tags: metric.tags,
        });
        
        return acc;
      }, {});

      // 计算平均值
      Object.keys(grouped).forEach(key => {
        grouped[key].avg = grouped[key].total / grouped[key].count;
        grouped[key].recent = grouped[key].recent.slice(0, 10); // 只保留最近10条
      });

      return grouped;
    } catch (error) {
      this.logger.error(`Failed to get metrics stats: ${error.message}`);
      return {};
    }
  }

  /**
   * 定时收集系统指标
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async collectSystemMetrics(): Promise<void> {
    const config = this.configService.get('monitoring');
    if (!config?.enabled) {
      return;
    }

    try {
      // CPU使用率
      const cpuUsage = this.getCpuUsage();
      await this.recordMetric({
        metricType: MetricType.CPU_USAGE,
        name: 'system_cpu_usage',
        value: cpuUsage,
        unit: '%',
        tags: ['system:cpu'],
      });

      // 内存使用率
      const memoryUsage = this.getMemoryUsage();
      await this.recordMetric({
        metricType: MetricType.MEMORY_USAGE,
        name: 'system_memory_usage',
        value: memoryUsage,
        unit: '%',
        tags: ['system:memory'],
      });

      // 活跃连接数
      await this.recordMetric({
        metricType: MetricType.ACTIVE_CONNECTIONS,
        name: 'active_connections',
        value: this.requestCount,
        unit: 'count',
        tags: ['system:connections'],
      });

      this.logger.debug(`Collected system metrics - CPU: ${cpuUsage}%, Memory: ${memoryUsage}%`);
    } catch (error) {
      this.logger.error(`Failed to collect system metrics: ${error.message}`);
    }
  }

  /**
   * 定时清理过期指标
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldMetrics(): Promise<void> {
    const config = this.configService.get('metrics');
    if (!config?.enabled) {
      return;
    }

    try {
      const retentionDays = config.retentionDays || 30;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      const deleted = await this.prismaService.systemMetric.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Cleaned up ${deleted.count} old metrics older than ${retentionDays} days`);
    } catch (error) {
      this.logger.error(`Failed to cleanup old metrics: ${error.message}`);
    }
  }

  private getCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    
    return Math.round((1 - idle / total) * 100);
  }

  private getMemoryUsage(): number {
    // 获取Node.js进程内存使用情况，而不是系统总内存
    const memUsage = process.memoryUsage();
    // 使用RSS (Resident Set Size) - 进程占用的物理内存
    // 设定合理的基准值 (比如200MB) 来计算百分比
    const baseMemoryMB = 200; // 200MB作为基准
    const usedMemoryMB = memUsage.rss / 1024 / 1024; // 转换为MB
    
    // 返回相对于基准值的百分比，最大不超过100%
    return Math.min(Math.round((usedMemoryMB / baseMemoryMB) * 100), 100);
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      await this.redisService.ping();
      return true;
    } catch {
      return false;
    }
  }
}