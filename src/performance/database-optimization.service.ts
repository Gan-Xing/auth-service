import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CachingService } from './caching.service';
import { MonitoringService } from '../monitoring/monitoring.service';

export interface QueryOptimizationOptions {
  useCache?: boolean;
  cacheTTL?: number;
  batchSize?: number;
  timeout?: number;
  tenantId?: string;
}

export interface DatabaseStats {
  totalQueries: number;
  slowQueries: number;
  averageResponseTime: number;
  cacheHitRate: number;
  connectionPool: {
    active: number;
    idle: number;
    total: number;
  };
}

@Injectable()
export class DatabaseOptimizationService {
  private readonly logger = new Logger(DatabaseOptimizationService.name);
  private readonly slowQueryThreshold: number;
  private queryStats = {
    totalQueries: 0,
    slowQueries: 0,
    totalResponseTime: 0,
  };

  constructor(
    private readonly prismaService: PrismaService,
    private readonly cachingService: CachingService,
    private readonly monitoringService: MonitoringService,
    private readonly configService: ConfigService,
  ) {
    this.slowQueryThreshold = this.configService.get('performance.databaseQueryTimeThreshold') || 500;
  }

  /**
   * 优化查询 - 自动缓存和性能监控
   */
  async optimizedQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    options?: QueryOptimizationOptions,
  ): Promise<T> {
    const startTime = Date.now();
    const cacheKey = `db_query:${queryName}:${JSON.stringify(options)}`;

    try {
      // 如果启用缓存，先尝试从缓存获取
      if (options?.useCache) {
        const cached = await this.cachingService.get<T>(cacheKey, {
          ttl: options.cacheTTL || 300,
          tenantId: options.tenantId,
          tags: ['database', 'query', queryName],
        });
        
        if (cached !== null) {
          this.logger.debug(`Cache hit for query: ${queryName}`);
          return cached;
        }
      }

      // 执行查询
      const result = await this.executeWithTimeout(queryFn, options?.timeout || 10000);
      const responseTime = Date.now() - startTime;

      // 更新统计信息
      this.updateQueryStats(responseTime);

      // 记录监控指标
      if (this.monitoringService) {
        await this.monitoringService.recordDatabaseQuery(responseTime, queryName);
      }

      // 缓存结果
      if (options?.useCache && result) {
        await this.cachingService.set(cacheKey, result, {
          ttl: options.cacheTTL || 300,
          tenantId: options.tenantId,
          tags: ['database', 'query', queryName],
        });
      }

      // 记录慢查询
      if (responseTime > this.slowQueryThreshold) {
        this.logger.warn(`Slow query detected: ${queryName} took ${responseTime}ms`);
      }

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateQueryStats(responseTime);
      
      this.logger.error(`Query error for ${queryName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 批量查询优化
   */
  async batchQuery<T, K>(
    items: K[],
    queryFn: (batch: K[]) => Promise<T[]>,
    options?: QueryOptimizationOptions,
  ): Promise<T[]> {
    const batchSize = options?.batchSize || 100;
    const results: T[] = [];

    // 分批处理
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await this.optimizedQuery(
        `batch_query_${i / batchSize}`,
        () => queryFn(batch),
        options,
      );
      
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 用户查询优化
   */
  async findUserOptimized(
    email: string,
    tenantId?: string,
    options?: QueryOptimizationOptions,
  ): Promise<any> {
    return this.optimizedQuery(
      `find_user_${email}_${tenantId || 'global'}`,
      async () => {
        const whereCondition = tenantId
          ? { tenantId, email: email.toLowerCase() }
          : { email: email.toLowerCase() };

        return await this.prismaService.user.findFirst({
          where: whereCondition,
          include: {
            tenant: true,
            sessions: {
              where: { isActive: true },
              take: 5, // 只获取最近5个活跃会话
            },
          },
        });
      },
      {
        useCache: true,
        cacheTTL: 300, // 5分钟缓存
        tenantId,
        ...options,
      },
    );
  }

  /**
   * 租户统计信息优化查询
   */
  async getTenantStatsOptimized(tenantId: string): Promise<any> {
    return this.optimizedQuery(
      `tenant_stats_${tenantId}`,
      async () => {
        const [userCount, activeSessionCount, totalRequests] = await Promise.all([
          this.prismaService.user.count({ where: { tenantId, isActive: true } }),
          this.prismaService.userSession.count({ 
            where: { 
              user: { tenantId }, 
              isActive: true,
              expiresAt: { gt: new Date() },
            } 
          }),
          this.prismaService.auditLog.count({ 
            where: { 
              tenantId,
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 24小时内
            } 
          }),
        ]);

        return {
          tenantId,
          userCount,
          activeSessionCount,
          totalRequests,
          timestamp: new Date(),
        };
      },
      {
        useCache: true,
        cacheTTL: 600, // 10分钟缓存
        tenantId,
      },
    );
  }

  /**
   * 用户登录历史优化查询
   */
  async getUserLoginHistoryOptimized(
    userId: number,
    limit: number = 10,
    tenantId?: string,
  ): Promise<any[]> {
    return this.optimizedQuery(
      `user_login_history_${userId}_${limit}`,
      async () => {
        return await this.prismaService.auditLog.findMany({
          where: {
            userId,
            tenantId,
            action: {
              in: ['AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILED', 'AUTH_OAUTH_LOGIN'],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            action: true,
            success: true,
            ip: true,
            userAgent: true,
            createdAt: true,
            details: true,
          },
        });
      },
      {
        useCache: true,
        cacheTTL: 180, // 3分钟缓存
        tenantId,
      },
    );
  }

  /**
   * 分页查询优化
   */
  async paginatedQuery<T>(
    tableName: string,
    page: number,
    pageSize: number,
    where?: any,
    orderBy?: any,
    include?: any,
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * pageSize;
    
    return this.optimizedQuery(
      `paginated_${tableName}_${page}_${pageSize}_${JSON.stringify(where)}`,
      async () => {
        const model = (this.prismaService as any)[tableName];
        
        const [data, total] = await Promise.all([
          model.findMany({
            where,
            orderBy,
            include,
            skip: offset,
            take: pageSize,
          }),
          model.count({ where }),
        ]);

        return {
          data,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },
      {
        useCache: true,
        cacheTTL: 120, // 2分钟缓存
      },
    );
  }

  /**
   * 连接池监控
   */
  async getConnectionPoolStats(): Promise<DatabaseStats['connectionPool']> {
    try {
      // Prisma 连接池信息（简化实现）
      const metrics = await this.prismaService.$queryRaw<any[]>`
        SELECT 
          count(*) as total_connections,
          count(*) filter (where state = 'active') as active_connections,
          count(*) filter (where state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      const stats = metrics[0] || {};
      
      return {
        active: parseInt(stats.active_connections || '0'),
        idle: parseInt(stats.idle_connections || '0'),
        total: parseInt(stats.total_connections || '0'),
      };
    } catch (error) {
      this.logger.error(`Failed to get connection pool stats: ${error.message}`);
      return { active: 0, idle: 0, total: 0 };
    }
  }

  /**
   * 数据库统计信息
   */
  async getStats(): Promise<DatabaseStats> {
    const connectionPool = await this.getConnectionPoolStats();
    const cacheStats = this.cachingService.getStats();
    const totalQueries = this.queryStats.totalQueries;
    
    return {
      totalQueries,
      slowQueries: this.queryStats.slowQueries,
      averageResponseTime: totalQueries > 0 
        ? Math.round(this.queryStats.totalResponseTime / totalQueries * 100) / 100 
        : 0,
      cacheHitRate: cacheStats.hitRate,
      connectionPool,
    };
  }

  /**
   * 清理过期数据
   */
  async cleanupExpiredData(): Promise<{
    expiredSessions: number;
    expiredVerificationCodes: number;
    oldAuditLogs: number;
  }> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      const [expiredSessions, expiredVerificationCodes, oldAuditLogs] = await Promise.all([
        // 清理过期会话
        this.prismaService.userSession.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { isActive: false, updatedAt: { lt: thirtyDaysAgo } },
            ],
          },
        }),
        
        // 清理过期验证码
        this.prismaService.verificationCode.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { isUsed: true, createdAt: { lt: thirtyDaysAgo } },
            ],
          },
        }),
        
        // 清理旧审计日志（保留90天）
        this.prismaService.auditLog.deleteMany({
          where: {
            createdAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      this.logger.log(`Cleanup completed: ${expiredSessions.count} sessions, ${expiredVerificationCodes.count} codes, ${oldAuditLogs.count} audit logs`);

      return {
        expiredSessions: expiredSessions.count,
        expiredVerificationCodes: expiredVerificationCodes.count,
        oldAuditLogs: oldAuditLogs.count,
      };
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 索引优化建议
   */
  async getIndexOptimizationSuggestions(): Promise<string[]> {
    const suggestions: string[] = [];

    try {
      // 检查常用查询的索引使用情况
      const missingIndexes = await this.prismaService.$queryRaw<any[]>`
        SELECT schemaname, tablename, attname as column_name, n_distinct, correlation
        FROM pg_stats 
        WHERE schemaname = 'public' 
        AND n_distinct > 100 
        AND correlation < 0.1
        ORDER BY n_distinct DESC
      `;

      for (const index of missingIndexes) {
        suggestions.push(
          `Consider adding index on ${index.tablename}.${index.column_name} (${index.n_distinct} distinct values)`
        );
      }

      // 检查未使用的索引
      const unusedIndexes = await this.prismaService.$queryRaw<any[]>`
        SELECT schemaname, tablename, indexname, idx_scan
        FROM pg_stat_user_indexes 
        WHERE idx_scan = 0 
        AND schemaname = 'public'
      `;

      for (const index of unusedIndexes) {
        suggestions.push(`Consider removing unused index: ${index.indexname} on ${index.tablename}`);
      }

    } catch (error) {
      this.logger.error(`Failed to get index optimization suggestions: ${error.message}`);
    }

    return suggestions;
  }

  private async executeWithTimeout<T>(
    queryFn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Query timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      queryFn()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private updateQueryStats(responseTime: number): void {
    this.queryStats.totalQueries++;
    this.queryStats.totalResponseTime += responseTime;
    
    if (responseTime > this.slowQueryThreshold) {
      this.queryStats.slowQueries++;
    }
  }
}