import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { AlertType, AlertSeverity, AlertStatus, MetricType } from '@prisma/client';

export interface AlertData {
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  triggerValue?: number;
  thresholdValue?: number;
  tenantId?: string;
  endpoint?: string;
  ip?: string;
  details?: any;
  stackTrace?: string;
}

export interface AlertRule {
  metricType: MetricType;
  alertType: AlertType;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  windowMinutes: number; // 检查窗口期（分钟）
  minDataPoints: number; // 最少数据点数量
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly alertRules: AlertRule[] = [];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.initializeAlertRules();
  }

  private initializeAlertRules(): void {
    const config = this.configService.get('alerts');
    if (!config?.enabled) {
      return;
    }

    // 定义默认告警规则
    this.alertRules.push(
      // 性能告警
      {
        metricType: MetricType.RESPONSE_TIME,
        alertType: AlertType.HIGH_RESPONSE_TIME,
        threshold: config.thresholds.responseTime || 3000,
        severity: AlertSeverity.HIGH,
        enabled: true,
        windowMinutes: 5,
        minDataPoints: 10,
      },
      {
        metricType: MetricType.ERROR_RATE,
        alertType: AlertType.HIGH_ERROR_RATE,
        threshold: config.thresholds.errorRate || 10,
        severity: AlertSeverity.HIGH,
        enabled: true,
        windowMinutes: 5,
        minDataPoints: 10,
      },
      {
        metricType: MetricType.CPU_USAGE,
        alertType: AlertType.HIGH_CPU_USAGE,
        threshold: 80,
        severity: AlertSeverity.MEDIUM,
        enabled: true,
        windowMinutes: 10,
        minDataPoints: 5,
      },
      {
        metricType: MetricType.MEMORY_USAGE,
        alertType: AlertType.HIGH_MEMORY_USAGE,
        threshold: 80,
        severity: AlertSeverity.MEDIUM,
        enabled: true,
        windowMinutes: 10,
        minDataPoints: 5,
      },
      // 安全告警
      {
        metricType: MetricType.FAILED_LOGIN_ATTEMPTS,
        alertType: AlertType.BRUTE_FORCE_ATTACK,
        threshold: config.thresholds.failedLogin || 50,
        severity: AlertSeverity.CRITICAL,
        enabled: true,
        windowMinutes: 15,
        minDataPoints: 1,
      },
    );

    this.logger.log(`Initialized ${this.alertRules.length} alert rules`);
  }

  /**
   * 创建告警
   */
  async createAlert(data: AlertData): Promise<void> {
    try {
      const config = this.configService.get('alerts');
      if (!config?.enabled) {
        return;
      }

      // 检查是否已存在类似的未解决告警（防止重复告警）
      const existingAlert = await this.findSimilarAlert(data);
      if (existingAlert) {
        this.logger.debug(`Similar alert already exists: ${existingAlert.id}`);
        return;
      }

      // 创建告警记录
      const alert = await this.prismaService.alert.create({
        data: {
          alertType: data.alertType,
          severity: data.severity,
          title: data.title,
          message: data.message,
          triggerValue: data.triggerValue,
          thresholdValue: data.thresholdValue,
          tenantId: data.tenantId,
          endpoint: data.endpoint,
          ip: data.ip,
          details: data.details,
          stackTrace: data.stackTrace,
          status: AlertStatus.OPEN,
        },
      });

      this.logger.warn(`Alert created: ${alert.id} - ${data.title}`);

      // 异步发送通知
      this.sendAlertNotification(alert.id, data).catch(error => {
        this.logger.error(`Failed to send alert notification: ${error.message}`);
      });

    } catch (error) {
      this.logger.error(`Failed to create alert: ${error.message}`);
    }
  }

  /**
   * 解决告警
   */
  async resolveAlert(
    alertId: string,
    resolvedBy: string,
    resolution: string,
  ): Promise<void> {
    try {
      await this.prismaService.alert.update({
        where: { id: alertId },
        data: {
          status: AlertStatus.RESOLVED,
          resolvedAt: new Date(),
          resolvedBy,
          resolution,
        },
      });

      this.logger.log(`Alert resolved: ${alertId} by ${resolvedBy}`);
    } catch (error) {
      this.logger.error(`Failed to resolve alert: ${error.message}`);
    }
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      await this.prismaService.alert.update({
        where: { id: alertId },
        data: {
          status: AlertStatus.ACKNOWLEDGED,
        },
      });

      this.logger.log(`Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
    } catch (error) {
      this.logger.error(`Failed to acknowledge alert: ${error.message}`);
    }
  }

  /**
   * 抑制告警
   */
  async suppressAlert(alertId: string, suppressedBy: string): Promise<void> {
    try {
      await this.prismaService.alert.update({
        where: { id: alertId },
        data: {
          status: AlertStatus.SUPPRESSED,
        },
      });

      this.logger.log(`Alert suppressed: ${alertId} by ${suppressedBy}`);
    } catch (error) {
      this.logger.error(`Failed to suppress alert: ${error.message}`);
    }
  }

  /**
   * 获取活跃告警
   */
  async getActiveAlerts(tenantId?: string): Promise<any[]> {
    try {
      const where: any = {
        status: {
          in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED],
        },
      };

      if (tenantId) {
        where.tenantId = tenantId;
      }

      return await this.prismaService.alert.findMany({
        where,
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 100,
      });
    } catch (error) {
      this.logger.error(`Failed to get active alerts: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取告警统计
   */
  async getAlertStats(tenantId?: string): Promise<any> {
    try {
      const where: any = {};
      if (tenantId) {
        where.tenantId = tenantId;
      }

      const [total, open, acknowledged, resolved, bySeverity] = await Promise.all([
        this.prismaService.alert.count({ where }),
        this.prismaService.alert.count({
          where: { ...where, status: AlertStatus.OPEN },
        }),
        this.prismaService.alert.count({
          where: { ...where, status: AlertStatus.ACKNOWLEDGED },
        }),
        this.prismaService.alert.count({
          where: { ...where, status: AlertStatus.RESOLVED },
        }),
        this.prismaService.alert.groupBy({
          by: ['severity'],
          where,
          _count: true,
        }),
      ]);

      const severityStats = bySeverity.reduce((acc, item) => {
        acc[item.severity.toLowerCase()] = item._count;
        return acc;
      }, {});

      return {
        total,
        byStatus: {
          open,
          acknowledged,
          resolved,
        },
        bySeverity: severityStats,
      };
    } catch (error) {
      this.logger.error(`Failed to get alert stats: ${error.message}`);
      return {};
    }
  }

  /**
   * 定时检查告警规则
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAlertRules(): Promise<void> {
    const config = this.configService.get('alerts');
    if (!config?.enabled) {
      return;
    }

    for (const rule of this.alertRules) {
      if (!rule.enabled) {
        continue;
      }

      try {
        await this.evaluateAlertRule(rule);
      } catch (error) {
        this.logger.error(`Failed to evaluate alert rule ${rule.alertType}: ${error.message}`);
      }
    }
  }

  /**
   * 定时清理已解决的告警
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupResolvedAlerts(): Promise<void> {
    try {
      const retentionDays = 30; // 保留30天的已解决告警
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      const deleted = await this.prismaService.alert.deleteMany({
        where: {
          status: AlertStatus.RESOLVED,
          resolvedAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Cleaned up ${deleted.count} resolved alerts older than ${retentionDays} days`);
    } catch (error) {
      this.logger.error(`Failed to cleanup resolved alerts: ${error.message}`);
    }
  }

  private async evaluateAlertRule(rule: AlertRule): Promise<void> {
    try {
      // 获取指定时间窗口内的指标数据
      const windowStart = new Date(Date.now() - rule.windowMinutes * 60 * 1000);
      
      const metrics = await this.prismaService.systemMetric.findMany({
        where: {
          metricType: rule.metricType,
          timestamp: {
            gte: windowStart,
          },
        },
        orderBy: { timestamp: 'desc' },
      });

      if (metrics.length < rule.minDataPoints) {
        return; // 数据点不足，跳过检查
      }

      // 计算平均值或其他统计值
      let triggerValue: number;
      
      if (rule.metricType === MetricType.ERROR_RATE) {
        // 错误率：计算错误请求的百分比
        const totalRequests = await this.prismaService.systemMetric.count({
          where: {
            metricType: MetricType.REQUEST_COUNT,
            timestamp: {
              gte: windowStart,
            },
          },
        });
        
        if (totalRequests === 0) return;
        
        const errorRequests = metrics.length;
        triggerValue = (errorRequests / totalRequests) * 100;
      } else {
        // 其他指标：计算平均值
        const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
        triggerValue = sum / metrics.length;
      }

      // 检查是否超过阈值
      if (triggerValue > rule.threshold) {
        await this.createAlert({
          alertType: rule.alertType,
          severity: rule.severity,
          title: this.getAlertTitle(rule.alertType),
          message: this.getAlertMessage(rule.alertType, triggerValue, rule.threshold),
          triggerValue,
          thresholdValue: rule.threshold,
          details: {
            rule: {
              metricType: rule.metricType,
              windowMinutes: rule.windowMinutes,
              dataPoints: metrics.length,
            },
            metrics: metrics.slice(0, 5), // 只包含最近5个数据点
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate alert rule ${rule.alertType}: ${error.message}`);
    }
  }

  private async findSimilarAlert(data: AlertData): Promise<any | null> {
    try {
      const recentTime = new Date(Date.now() - 15 * 60 * 1000); // 15分钟内

      return await this.prismaService.alert.findFirst({
        where: {
          alertType: data.alertType,
          status: {
            in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED],
          },
          createdAt: {
            gte: recentTime,
          },
          tenantId: data.tenantId,
          endpoint: data.endpoint,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to find similar alert: ${error.message}`);
      return null;
    }
  }

  private async sendAlertNotification(alertId: string, data: AlertData): Promise<void> {
    const config = this.configService.get('alerts');
    
    try {
      // 发送邮件通知
      if (config.emailEnabled && config.adminEmail) {
        const subject = `[${data.severity}] ${data.title}`;
        const content = this.generateEmailContent(data);
        
        await this.emailService.sendEmail(config.adminEmail, subject, content);
        
        // 更新通知状态
        await this.prismaService.alert.update({
          where: { id: alertId },
          data: {
            emailSent: true,
            notifiedAt: new Date(),
          },
        });
      }

      // TODO: 发送Webhook通知
      if (config.webhookEnabled && config.webhookUrl) {
        // 实现Webhook通知逻辑
      }

    } catch (error) {
      this.logger.error(`Failed to send alert notification: ${error.message}`);
    }
  }

  private getAlertTitle(alertType: AlertType): string {
    const titles = {
      [AlertType.HIGH_RESPONSE_TIME]: '响应时间过高告警',
      [AlertType.HIGH_ERROR_RATE]: '错误率过高告警',
      [AlertType.HIGH_CPU_USAGE]: 'CPU使用率过高告警',
      [AlertType.HIGH_MEMORY_USAGE]: '内存使用率过高告警',
      [AlertType.LOW_DISK_SPACE]: '磁盘空间不足告警',
      [AlertType.HIGH_FAILED_LOGINS]: '登录失败次数过多告警',
      [AlertType.UNUSUAL_TRAFFIC]: '异常流量告警',
      [AlertType.SERVICE_UNAVAILABLE]: '服务不可用告警',
      [AlertType.BRUTE_FORCE_ATTACK]: '暴力破解攻击告警',
      [AlertType.SUSPICIOUS_ACTIVITY]: '可疑活动告警',
      [AlertType.UNAUTHORIZED_ACCESS]: '未授权访问告警',
      [AlertType.DATABASE_CONNECTION_ERROR]: '数据库连接错误告警',
      [AlertType.REDIS_CONNECTION_ERROR]: 'Redis连接错误告警',
      [AlertType.EXTERNAL_SERVICE_ERROR]: '外部服务错误告警',
    };
    
    return titles[alertType] || '系统告警';
  }

  private getAlertMessage(alertType: AlertType, triggerValue: number, threshold: number): string {
    const messages = {
      [AlertType.HIGH_RESPONSE_TIME]: `API响应时间为 ${triggerValue.toFixed(2)}ms，超过阈值 ${threshold}ms`,
      [AlertType.HIGH_ERROR_RATE]: `错误率为 ${triggerValue.toFixed(2)}%，超过阈值 ${threshold}%`,
      [AlertType.HIGH_CPU_USAGE]: `CPU使用率为 ${triggerValue.toFixed(2)}%，超过阈值 ${threshold}%`,
      [AlertType.HIGH_MEMORY_USAGE]: `内存使用率为 ${triggerValue.toFixed(2)}%，超过阈值 ${threshold}%`,
      [AlertType.BRUTE_FORCE_ATTACK]: `检测到 ${triggerValue} 次失败登录尝试，超过阈值 ${threshold}`,
    };
    
    return messages[alertType] || `指标值 ${triggerValue.toFixed(2)} 超过阈值 ${threshold}`;
  }

  private generateEmailContent(data: AlertData): string {
    return `
告警详情：

标题：${data.title}
严重程度：${data.severity}
告警类型：${data.alertType}
触发时间：${new Date().toLocaleString('zh-CN')}

${data.message}

${data.triggerValue !== undefined ? `触发值：${data.triggerValue}` : ''}
${data.thresholdValue !== undefined ? `阈值：${data.thresholdValue}` : ''}
${data.tenantId ? `租户ID：${data.tenantId}` : ''}
${data.endpoint ? `相关端点：${data.endpoint}` : ''}
${data.ip ? `相关IP：${data.ip}` : ''}

请及时处理此告警。

---
Auth Service 监控系统
    `.trim();
  }
}