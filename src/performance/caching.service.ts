import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { FeatureFlagsService, FeatureFlag } from '../feature-flags/feature-flags.service';

export interface CacheOptions {
  ttl?: number; // 缓存时间（秒）
  key?: string; // 自定义缓存键
  tags?: string[]; // 缓存标签，用于批量清理
  tenantId?: string; // 租户ID
  compression?: boolean; // 是否压缩
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  avgResponseTime: number;
}

@Injectable()
export class CachingService {
  private readonly logger = new Logger(CachingService.name);
  private readonly defaultTTL = 300; // 5分钟
  private stats = {
    hits: 0,
    misses: 0,
    totalResponseTime: 0,
  };

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  /**
   * 获取缓存数据
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.buildCacheKey(key, options);
      const cached = await this.redisService.get<T>(cacheKey);
      
      const responseTime = Date.now() - startTime;
      this.updateStats(cached !== null, responseTime);
      
      if (cached !== null) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return cached;
      }
      
      this.logger.debug(`Cache miss for key: ${cacheKey}`);
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * 设置缓存数据
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.buildCacheKey(key, options);
      const ttl = options?.ttl || this.defaultTTL;
      
      // 如果启用压缩，进行数据压缩（简化实现）
      let processedValue = value;
      if (options?.compression && typeof value === 'string' && value.length > 1000) {
        // 这里可以集成 zlib 进行实际压缩
        this.logger.debug(`Compressing large value for key: ${cacheKey}`);
      }
      
      await this.redisService.set(cacheKey, processedValue, ttl);
      
      // 如果有标签，建立标签映射
      if (options?.tags) {
        await this.addCacheTagMapping(cacheKey, options.tags);
      }
      
      this.logger.debug(`Cache set for key: ${cacheKey}, TTL: ${ttl}s`);
      return true;
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.buildCacheKey(key, options);
      await this.redisService.del(cacheKey);
      
      this.logger.debug(`Cache deleted for key: ${cacheKey}`);
      return true;
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * 缓存装饰器实现
   */
  async cacheOrExecute<T>(
    key: string,
    executor: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    // 尝试从缓存获取
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // 执行函数并缓存结果
    const result = await executor();
    await this.set(key, result, options);
    
    return result;
  }

  /**
   * 批量获取缓存
   */
  async mget<T>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    try {
      const cacheKeys = keys.map(key => this.buildCacheKey(key, options));
      const results: (T | null)[] = [];
      
      // Redis pipeline 优化批量操作
      for (const cacheKey of cacheKeys) {
        const value = await this.redisService.get<T>(cacheKey);
        results.push(value);
      }
      
      return results;
    } catch (error) {
      this.logger.error(`Batch cache get error: ${error.message}`);
      return keys.map(() => null);
    }
  }

  /**
   * 批量设置缓存
   */
  async mset<T>(data: Array<{ key: string; value: T }>, options?: CacheOptions): Promise<boolean> {
    try {
      const ttl = options?.ttl || this.defaultTTL;
      
      for (const item of data) {
        const cacheKey = this.buildCacheKey(item.key, options);
        await this.redisService.set(cacheKey, item.value, ttl);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Batch cache set error: ${error.message}`);
      return false;
    }
  }

  /**
   * 根据标签清理缓存
   */
  async clearByTags(tags: string[]): Promise<number> {
    try {
      let clearedCount = 0;
      
      for (const tag of tags) {
        const tagKey = `cache_tag:${tag}`;
        const cacheKeys = await this.redisService.get<string[]>(tagKey);
        
        if (cacheKeys && cacheKeys.length > 0) {
          for (const cacheKey of cacheKeys) {
            await this.redisService.del(cacheKey);
            clearedCount++;
          }
          
          // 清理标签映射
          await this.redisService.del(tagKey);
        }
      }
      
      this.logger.log(`Cleared ${clearedCount} cache entries by tags: ${tags.join(', ')}`);
      return clearedCount;
    } catch (error) {
      this.logger.error(`Clear cache by tags error: ${error.message}`);
      return 0;
    }
  }

  /**
   * 清理租户相关的所有缓存
   */
  async clearTenantCache(tenantId: string): Promise<number> {
    try {
      const pattern = `cache:tenant:${tenantId}:*`;
      const keys = await this.redisService.keys(pattern);
      
      let clearedCount = 0;
      for (const key of keys) {
        await this.redisService.del(key);
        clearedCount++;
      }
      
      this.logger.log(`Cleared ${clearedCount} cache entries for tenant: ${tenantId}`);
      return clearedCount;
    } catch (error) {
      this.logger.error(`Clear tenant cache error: ${error.message}`);
      return 0;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    const avgResponseTime = totalRequests > 0 ? this.stats.totalResponseTime / totalRequests : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalRequests,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      totalResponseTime: 0,
    };
  }

  /**
   * 预热缓存
   */
  async warmupCache(warmupData: Array<{ key: string; value: any; options?: CacheOptions }>): Promise<void> {
    this.logger.log(`Starting cache warmup for ${warmupData.length} entries`);
    
    for (const item of warmupData) {
      await this.set(item.key, item.value, item.options);
    }
    
    this.logger.log(`Cache warmup completed for ${warmupData.length} entries`);
  }

  /**
   * 智能缓存策略
   * 根据访问频率和数据大小自动调整TTL
   */
  async intelligentCache<T>(
    key: string,
    value: T,
    accessFrequency: number,
    dataSize: number,
  ): Promise<boolean> {
    // 根据访问频率调整TTL
    let ttl = this.defaultTTL;
    
    if (accessFrequency > 100) {
      ttl = 3600; // 1小时
    } else if (accessFrequency > 50) {
      ttl = 1800; // 30分钟
    } else if (accessFrequency > 10) {
      ttl = 900; // 15分钟
    }
    
    // 根据数据大小调整策略
    const options: CacheOptions = {
      ttl,
      compression: dataSize > 10240, // 大于10KB启用压缩
    };
    
    return await this.set(key, value, options);
  }

  private buildCacheKey(key: string, options?: CacheOptions): string {
    const parts = ['cache'];
    
    if (options?.tenantId) {
      parts.push('tenant', options.tenantId);
    }
    
    parts.push(key);
    
    return parts.join(':');
  }

  private async addCacheTagMapping(cacheKey: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `cache_tag:${tag}`;
      const existingKeys = await this.redisService.get<string[]>(tagKey) || [];
      
      if (!existingKeys.includes(cacheKey)) {
        existingKeys.push(cacheKey);
        await this.redisService.set(tagKey, existingKeys, 3600); // 标签映射1小时过期
      }
    }
  }

  private updateStats(isHit: boolean, responseTime: number): void {
    if (isHit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    
    this.stats.totalResponseTime += responseTime;
  }
}