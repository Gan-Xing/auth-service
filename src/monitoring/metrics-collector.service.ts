import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import * as process from 'process';

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
    heap: {
      total: number;
      used: number;
      usage: number;
    };
  };
  disk: {
    usage: number;
    available: number;
  };
  network: {
    connections: number;
    bytesReceived: number;
    bytesSent: number;
  };
}

export interface ApplicationMetrics {
  uptime: number;
  version: string;
  environment: string;
  processId: number;
  activeConnections: number;
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  requestsPerMinute: number;
}

export interface DatabaseMetrics {
  connectionCount: number;
  activeQueries: number;
  totalQueries: number;
  averageQueryTime: number;
  slowQueries: number;
  tableStats: {
    [tableName: string]: {
      rowCount: number;
      sizeBytes: number;
    };
  };
}

export interface RedisMetrics {
  memory: {
    used: number;
    peak: number;
    fragmentation: number;
  };
  keyspace: {
    totalKeys: number;
    expiringKeys: number;
    expiredKeys: number;
  };
  operations: {
    commandsPerSecond: number;
    hitRate: number;
    missRate: number;
  };
  connections: {
    connected: number;
    blocked: number;
  };
}

export interface SecurityMetrics {
  failedLogins: number;
  successfulLogins: number;
  suspiciousActivities: number;
  blockedIPs: number;
  activeSessions: number;
  tokenValidations: number;
  passwordResets: number;
}

export interface BusinessMetrics {
  users: {
    total: number;
    active: number;
    newRegistrations: number;
    deletions: number;
  };
  tenants: {
    total: number;
    active: number;
    new: number;
  };
  authentication: {
    totalLogins: number;
    oauthLogins: number;
    apiKeyUsage: number;
    sessionDuration: number;
  };
}

@Injectable()
export class MetricsCollectorService {
  private readonly logger = new Logger(MetricsCollectorService.name);
  private startTime = Date.now();
  private requestCount = 0;
  private errorCount = 0;
  private responseTimeSum = 0;
  private requestCountLastMinute = 0;
  private lastMinuteReset = Date.now();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Record API request metrics
   */
  recordRequest(responseTime: number, isError: boolean = false) {
    this.requestCount++;
    this.responseTimeSum += responseTime;
    
    if (isError) {
      this.errorCount++;
    }

    // Update per-minute counter
    const now = Date.now();
    if (now - this.lastMinuteReset >= 60000) {
      this.requestCountLastMinute = 0;
      this.lastMinuteReset = now;
    }
    this.requestCountLastMinute++;
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      cpu: {
        usage: await this.getCPUUsage(),
        loadAverage: os.loadavg(),
        cores: os.cpus().length,
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usage: (usedMemory / totalMemory) * 100,
        heap: {
          total: memUsage.heapTotal,
          used: memUsage.heapUsed,
          usage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        },
      },
      disk: {
        usage: 0, // Would need additional implementation for actual disk usage
        available: 0,
      },
      network: {
        connections: 0, // Would need additional implementation
        bytesReceived: 0,
        bytesSent: 0,
      },
    };
  }

  /**
   * Collect application metrics
   */
  async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    const uptime = Date.now() - this.startTime;
    const averageResponseTime = this.requestCount > 0 
      ? this.responseTimeSum / this.requestCount 
      : 0;
    const errorRate = this.requestCount > 0 
      ? (this.errorCount / this.requestCount) * 100 
      : 0;

    return {
      uptime,
      version: this.configService.get('app.version', '1.0.0'),
      environment: this.configService.get('NODE_ENV', 'development'),
      processId: process.pid,
      activeConnections: 0, // Would need additional tracking
      totalRequests: this.requestCount,
      errorRate,
      averageResponseTime,
      requestsPerMinute: this.requestCountLastMinute,
    };
  }

  /**
   * Collect database metrics
   */
  async collectDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      const [userCount, tenantCount, sessionCount, auditLogCount] = await Promise.all([
        this.prismaService.user.count(),
        this.prismaService.tenant.count(),
        this.prismaService.userSession.count(),
        this.prismaService.auditLog.count(),
      ]);

      // Get recent query performance
      const recentMetrics = await this.prismaService.systemMetric.findMany({
        where: {
          name: 'database_query',
          timestamp: {
            gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 100,
      });

      const averageQueryTime = recentMetrics.length > 0
        ? recentMetrics.reduce((sum, metric) => sum + metric.value, 0) / recentMetrics.length
        : 0;

      const slowQueries = recentMetrics.filter(metric => metric.value > 1000).length;

      return {
        connectionCount: 1, // Prisma connection pool would need additional tracking
        activeQueries: 0,
        totalQueries: this.requestCount, // Approximation
        averageQueryTime,
        slowQueries,
        tableStats: {
          users: { rowCount: userCount, sizeBytes: 0 },
          tenants: { rowCount: tenantCount, sizeBytes: 0 },
          userSessions: { rowCount: sessionCount, sizeBytes: 0 },
          auditLogs: { rowCount: auditLogCount, sizeBytes: 0 },
        },
      };
    } catch (error) {
      this.logger.error('Failed to collect database metrics', error);
      return {
        connectionCount: 0,
        activeQueries: 0,
        totalQueries: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        tableStats: {},
      };
    }
  }

  /**
   * Collect Redis metrics
   */
  async collectRedisMetrics(): Promise<RedisMetrics> {
    try {
      // TODO: Implement Redis info method in RedisService
      // const info = await this.redisService.info();
      const info = { used_memory: '0', connected_clients: '0' };
      // const parsedInfo = this.parseRedisInfo(info);
      const parsedInfo = { 
        used_memory: 0, 
        connected_clients: 0,
        used_memory_peak: 0,
        mem_fragmentation_ratio: 1.0,
        expired_keys: 0,
        instantaneous_ops_per_sec: 0,
        blocked_clients: 0
      };

      // TODO: Implement Redis dbsize method in RedisService
      // const dbSize = await this.redisService.dbsize();
      const dbSize = 0;
      
      return {
        memory: {
          used: parsedInfo.used_memory || 0,
          peak: parsedInfo.used_memory_peak || 0,
          fragmentation: parsedInfo.mem_fragmentation_ratio || 1,
        },
        keyspace: {
          totalKeys: dbSize,
          expiringKeys: 0, // Would need SCAN with TTL check
          expiredKeys: parsedInfo.expired_keys || 0,
        },
        operations: {
          commandsPerSecond: parsedInfo.instantaneous_ops_per_sec || 0,
          hitRate: this.calculateRedisHitRate(parsedInfo),
          missRate: this.calculateRedisMissRate(parsedInfo),
        },
        connections: {
          connected: parsedInfo.connected_clients || 0,
          blocked: parsedInfo.blocked_clients || 0,
        },
      };
    } catch (error) {
      this.logger.error('Failed to collect Redis metrics', error);
      return {
        memory: { used: 0, peak: 0, fragmentation: 1 },
        keyspace: { totalKeys: 0, expiringKeys: 0, expiredKeys: 0 },
        operations: { commandsPerSecond: 0, hitRate: 0, missRate: 0 },
        connections: { connected: 0, blocked: 0 },
      };
    }
  }

  /**
   * Collect security metrics
   */
  async collectSecurityMetrics(): Promise<SecurityMetrics> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [
        failedLogins,
        successfulLogins,
        suspiciousActivities,
        activeSessions,
        passwordResets,
      ] = await Promise.all([
        this.prismaService.auditLog.count({
          where: {
            action: 'AUTH_LOGIN_FAILED',
            createdAt: { gte: oneDayAgo },
          },
        }),
        this.prismaService.auditLog.count({
          where: {
            action: 'AUTH_LOGIN_SUCCESS',
            createdAt: { gte: oneDayAgo },
          },
        }),
        this.prismaService.auditLog.count({
          where: {
            action: { in: ['SECURITY_SUSPICIOUS_ACTIVITY', 'SECURITY_BREACH_ATTEMPT'] },
            createdAt: { gte: oneDayAgo },
          },
        }),
        this.prismaService.userSession.count({
          where: {
            expiresAt: { gt: new Date() },
          },
        }),
        this.prismaService.auditLog.count({
          where: {
            action: 'AUTH_PASSWORD_RESET_SUCCESS',
            createdAt: { gte: oneDayAgo },
          },
        }),
      ]);

      return {
        failedLogins,
        successfulLogins,
        suspiciousActivities,
        blockedIPs: 0, // Would need IP blocking tracking
        activeSessions,
        tokenValidations: this.requestCount, // Approximation
        passwordResets,
      };
    } catch (error) {
      this.logger.error('Failed to collect security metrics', error);
      return {
        failedLogins: 0,
        successfulLogins: 0,
        suspiciousActivities: 0,
        blockedIPs: 0,
        activeSessions: 0,
        tokenValidations: 0,
        passwordResets: 0,
      };
    }
  }

  /**
   * Collect business metrics
   */
  async collectBusinessMetrics(): Promise<BusinessMetrics> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        activeUsers,
        newUsers,
        totalTenants,
        activeTenants,
        newTenants,
        totalLogins,
        oauthLogins,
      ] = await Promise.all([
        this.prismaService.user.count(),
        this.prismaService.user.count({
          where: {
            sessions: {
              some: {
                expiresAt: { gt: new Date() },
              },
            },
          },
        }),
        this.prismaService.user.count({
          where: {
            createdAt: { gte: oneDayAgo },
          },
        }),
        this.prismaService.tenant.count(),
        this.prismaService.tenant.count({
          where: { isActive: true },
        }),
        this.prismaService.tenant.count({
          where: {
            createdAt: { gte: oneWeekAgo },
          },
        }),
        this.prismaService.auditLog.count({
          where: {
            action: 'AUTH_LOGIN_SUCCESS',
            createdAt: { gte: oneDayAgo },
          },
        }),
        this.prismaService.auditLog.count({
          where: {
            action: 'AUTH_OAUTH_LOGIN',
            createdAt: { gte: oneDayAgo },
          },
        }),
      ]);

      // Calculate average session duration
      const recentSessions = await this.prismaService.userSession.findMany({
        where: {
          createdAt: { gte: oneWeekAgo },
          expiresAt: { lt: new Date() }, // Completed sessions
        },
        select: {
          createdAt: true,
          updatedAt: true,
        },
        take: 1000,
      });

      const avgSessionDuration = recentSessions.length > 0
        ? recentSessions.reduce((sum, session) => {
            return sum + (session.updatedAt.getTime() - session.createdAt.getTime());
          }, 0) / recentSessions.length
        : 0;

      return {
        users: {
          total: totalUsers,
          active: activeUsers,
          newRegistrations: newUsers,
          deletions: 0, // Would need soft delete tracking
        },
        tenants: {
          total: totalTenants,
          active: activeTenants,
          new: newTenants,
        },
        authentication: {
          totalLogins,
          oauthLogins,
          apiKeyUsage: 0, // Would need API key usage tracking
          sessionDuration: avgSessionDuration,
        },
      };
    } catch (error) {
      this.logger.error('Failed to collect business metrics', error);
      return {
        users: { total: 0, active: 0, newRegistrations: 0, deletions: 0 },
        tenants: { total: 0, active: 0, new: 0 },
        authentication: { totalLogins: 0, oauthLogins: 0, apiKeyUsage: 0, sessionDuration: 0 },
      };
    }
  }

  /**
   * Collect all metrics
   */
  async collectAllMetrics() {
    const [
      systemMetrics,
      applicationMetrics,
      databaseMetrics,
      redisMetrics,
      securityMetrics,
      businessMetrics,
    ] = await Promise.all([
      this.collectSystemMetrics(),
      this.collectApplicationMetrics(),
      this.collectDatabaseMetrics(),
      this.collectRedisMetrics(),
      this.collectSecurityMetrics(),
      this.collectBusinessMetrics(),
    ]);

    return {
      system: systemMetrics,
      application: applicationMetrics,
      database: databaseMetrics,
      redis: redisMetrics,
      security: securityMetrics,
      business: businessMetrics,
      timestamp: new Date(),
    };
  }

  /**
   * Store metrics in database for historical tracking
   */
  async storeMetrics(metrics: any) {
    try {
      const metricEntries = [
        { name: 'system_metrics', value: metrics.system.memory.usage, metadata: metrics.system, metricType: 'MEMORY_USAGE' as const },
        { name: 'application_metrics', value: metrics.application.requestsPerMinute, metadata: metrics.application, metricType: 'REQUEST_COUNT' as const },
        { name: 'database_metrics', value: metrics.database.averageQueryTime, metadata: metrics.database, metricType: 'DATABASE_QUERY_TIME' as const },
        { name: 'redis_metrics', value: metrics.redis.operations.hitRate, metadata: metrics.redis, metricType: 'CACHE_HIT_RATE' as const },
        { name: 'security_metrics', value: metrics.security.activeSessions, metadata: metrics.security, metricType: 'ACTIVE_CONNECTIONS' as const },
        { name: 'business_metrics', value: metrics.business.users.total, metadata: metrics.business, metricType: 'REQUEST_COUNT' as const },
      ];

      await Promise.all(
        metricEntries.map(entry =>
          this.prismaService.systemMetric.create({
            data: entry,
          })
        )
      );

      this.logger.debug('Metrics stored successfully');
    } catch (error) {
      this.logger.error('Failed to store metrics', error);
    }
  }

  /**
   * Scheduled metrics collection (every 5 minutes)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async collectAndStoreMetrics() {
    try {
      this.logger.debug('Starting scheduled metrics collection');
      const metrics = await this.collectAllMetrics();
      await this.storeMetrics(metrics);
      this.logger.debug('Scheduled metrics collection completed');
    } catch (error) {
      this.logger.error('Scheduled metrics collection failed', error);
    }
  }

  /**
   * Get CPU usage percentage
   */
  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startTime = process.hrtime();
      const startUsage = process.cpuUsage();

      setTimeout(() => {
        const endTime = process.hrtime(startTime);
        const endUsage = process.cpuUsage(startUsage);

        const userUsage = endUsage.user / 1000; // Convert to milliseconds
        const systemUsage = endUsage.system / 1000;
        const totalTime = endTime[0] * 1000 + endTime[1] / 1000000; // Convert to milliseconds

        const cpuPercent = ((userUsage + systemUsage) / totalTime) * 100;
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const parsed: Record<string, any> = {};
    const lines = info.split('\r\n');

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        const numValue = parseFloat(value);
        parsed[key] = isNaN(numValue) ? value : numValue;
      }
    }

    return parsed;
  }

  /**
   * Calculate Redis hit rate
   */
  private calculateRedisHitRate(info: Record<string, any>): number {
    const hits = info.keyspace_hits || 0;
    const misses = info.keyspace_misses || 0;
    const total = hits + misses;
    
    return total > 0 ? (hits / total) * 100 : 0;
  }

  /**
   * Calculate Redis miss rate
   */
  private calculateRedisMissRate(info: Record<string, any>): number {
    const hits = info.keyspace_hits || 0;
    const misses = info.keyspace_misses || 0;
    const total = hits + misses;
    
    return total > 0 ? (misses / total) * 100 : 0;
  }

  /**
   * Get historical metrics
   */
  async getHistoricalMetrics(hours: number = 24) {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const metrics = await this.prismaService.systemMetric.findMany({
      where: {
        timestamp: { gte: startTime },
        name: { in: ['system_metrics', 'application_metrics', 'database_metrics', 'redis_metrics', 'security_metrics', 'business_metrics'] },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    return metrics;
  }

  /**
   * Reset request counters (for testing)
   */
  resetCounters() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeSum = 0;
    this.requestCountLastMinute = 0;
    this.lastMinuteReset = Date.now();
  }
}