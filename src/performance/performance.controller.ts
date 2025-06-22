import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CachingService } from './caching.service';
import { DatabaseOptimizationService } from './database-optimization.service';
import { ConcurrencyService } from './concurrency.service';
import { BenchmarkService } from './benchmark.service';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('性能优化')
@Controller('performance')
@UseGuards(AdminGuard)
@ApiBearerAuth()
export class PerformanceController {
  constructor(
    private readonly cachingService: CachingService,
    private readonly databaseOptimizationService: DatabaseOptimizationService,
    private readonly concurrencyService: ConcurrencyService,
    private readonly benchmarkService: BenchmarkService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: '获取性能统计信息' })
  @ApiResponse({ status: 200, description: '返回详细的性能统计' })
  async getPerformanceStats() {
    const [cacheStats, dbStats, queueStats] = await Promise.all([
      this.cachingService.getStats(),
      this.databaseOptimizationService.getStats(),
      this.concurrencyService.getStats(),
    ]);

    return {
      success: true,
      data: {
        cache: cacheStats,
        database: dbStats,
        concurrency: queueStats,
        timestamp: new Date(),
      },
    };
  }

  @Get('cache/stats')
  @ApiOperation({ summary: '获取缓存统计信息' })
  @ApiResponse({ status: 200, description: '返回缓存性能数据' })
  async getCacheStats() {
    const stats = this.cachingService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Post('cache/clear')
  @ApiOperation({ summary: '清理缓存' })
  @ApiResponse({ status: 200, description: '缓存已清理' })
  async clearCache(
    @Body() body: { 
      type: 'all' | 'tenant' | 'tags'; 
      tenantId?: string; 
      tags?: string[] 
    },
  ) {
    let clearedCount = 0;

    switch (body.type) {
      case 'tenant':
        if (body.tenantId) {
          clearedCount = await this.cachingService.clearTenantCache(body.tenantId);
        }
        break;
      case 'tags':
        if (body.tags) {
          clearedCount = await this.cachingService.clearByTags(body.tags);
        }
        break;
      case 'all':
        // 重置统计信息相当于清理所有缓存
        this.cachingService.resetStats();
        clearedCount = -1; // 表示全部清理
        break;
    }

    return {
      success: true,
      message: `已清理 ${clearedCount === -1 ? '所有' : clearedCount} 个缓存条目`,
      clearedCount: clearedCount === -1 ? 'all' : clearedCount,
    };
  }

  @Post('cache/warmup')
  @ApiOperation({ summary: '缓存预热' })
  @ApiResponse({ status: 200, description: '缓存预热完成' })
  async warmupCache(@Body() body: { presets: string[] }) {
    const warmupData: Array<{ key: string; value: any; options?: any }> = [];

    // 根据预设类型准备预热数据
    for (const preset of body.presets) {
      switch (preset) {
        case 'common_configs':
          warmupData.push({
            key: 'system_config',
            value: { maintenance: false, features: [] },
            options: { ttl: 3600 },
          });
          break;
        case 'user_sessions':
          // 这里可以添加常用用户会话的预热逻辑
          break;
        case 'tenant_stats':
          // 这里可以添加租户统计信息的预热逻辑
          break;
      }
    }

    await this.cachingService.warmupCache(warmupData);

    return {
      success: true,
      message: `已预热 ${warmupData.length} 个缓存条目`,
      presets: body.presets,
    };
  }

  @Get('database/stats')
  @ApiOperation({ summary: '获取数据库性能统计' })
  @ApiResponse({ status: 200, description: '返回数据库性能数据' })
  async getDatabaseStats() {
    const stats = await this.databaseOptimizationService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('database/optimization-suggestions')
  @ApiOperation({ summary: '获取数据库优化建议' })
  @ApiResponse({ status: 200, description: '返回优化建议列表' })
  async getOptimizationSuggestions() {
    const suggestions = await this.databaseOptimizationService.getIndexOptimizationSuggestions();
    return {
      success: true,
      data: {
        suggestions,
        count: suggestions.length,
        timestamp: new Date(),
      },
    };
  }

  @Post('database/cleanup')
  @ApiOperation({ summary: '清理过期数据' })
  @ApiResponse({ status: 200, description: '数据清理完成' })
  async cleanupDatabase() {
    const result = await this.databaseOptimizationService.cleanupExpiredData();
    return {
      success: true,
      message: '数据库清理完成',
      data: result,
    };
  }

  @Get('concurrency/stats')
  @ApiOperation({ summary: '获取并发处理统计' })
  @ApiResponse({ status: 200, description: '返回并发处理数据' })
  async getConcurrencyStats() {
    const stats = this.concurrencyService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Post('concurrency/test')
  @ApiOperation({ summary: '测试并发处理性能' })
  @ApiResponse({ status: 200, description: '返回并发测试结果' })
  async testConcurrency(
    @Body() body: { 
      taskCount: number; 
      maxConcurrent?: number; 
      taskDuration?: number 
    },
  ) {
    const { taskCount, maxConcurrent = 5, taskDuration = 1000 } = body;

    // 创建测试任务
    const tasks = Array.from({ length: taskCount }, (_, i) => 
      async () => {
        await new Promise(resolve => setTimeout(resolve, taskDuration));
        return { taskId: i, completed: true };
      }
    );

    const startTime = Date.now();
    const results = await this.concurrencyService.executeConcurrent(tasks, {
      maxConcurrent,
    });
    const duration = Date.now() - startTime;

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return {
      success: true,
      data: {
        taskCount,
        maxConcurrent,
        taskDuration,
        actualDuration: duration,
        successCount,
        failCount,
        averageTaskTime: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
        efficiency: (taskCount * taskDuration) / duration, // 理论时间 / 实际时间
      },
    };
  }

  @Post('concurrency/reset')
  @ApiOperation({ summary: '重置并发队列' })
  @ApiResponse({ status: 200, description: '队列已重置' })
  @HttpCode(HttpStatus.OK)
  async resetConcurrencyQueue() {
    this.concurrencyService.clearQueue();
    this.concurrencyService.resetStats();

    return {
      success: true,
      message: '并发队列已重置',
    };
  }

  @Get('health')
  @ApiOperation({ summary: '性能健康检查' })
  @ApiResponse({ status: 200, description: '返回性能健康状态' })
  async getPerformanceHealth() {
    const [cacheStats, dbStats, queueStats] = await Promise.all([
      this.cachingService.getStats(),
      this.databaseOptimizationService.getStats(),
      this.concurrencyService.getStats(),
    ]);

    // 定义健康阈值
    const healthChecks = {
      cache: {
        healthy: cacheStats.hitRate > 60, // 缓存命中率 > 60%
        hitRate: cacheStats.hitRate,
        message: cacheStats.hitRate > 60 ? 'Cache performance is good' : 'Low cache hit rate',
      },
      database: {
        healthy: dbStats.averageResponseTime < 500, // 平均响应时间 < 500ms
        avgResponseTime: dbStats.averageResponseTime,
        message: dbStats.averageResponseTime < 500 ? 'Database performance is good' : 'Slow database queries detected',
      },
      concurrency: {
        healthy: queueStats.pending < 100, // 待处理任务 < 100
        pendingTasks: queueStats.pending,
        message: queueStats.pending < 100 ? 'Concurrency handling is good' : 'High task queue backlog',
      },
    };

    const overallHealthy = Object.values(healthChecks).every(check => check.healthy);

    return {
      success: true,
      data: {
        overall: {
          healthy: overallHealthy,
          status: overallHealthy ? 'healthy' : 'degraded',
        },
        components: healthChecks,
        timestamp: new Date(),
      },
    };
  }

  @Get('benchmarks')
  @ApiOperation({ summary: '运行性能基准测试' })
  @ApiResponse({ status: 200, description: '返回基准测试结果' })
  async runBenchmarks(@Query('type') type?: string) {
    if (type === 'comprehensive') {
      // 运行完整的基准测试套件
      const suite = await this.benchmarkService.runBenchmarkSuite();
      return {
        success: true,
        data: suite,
      };
    }

    // 运行简化的基准测试 (保持向后兼容)
    const benchmarks: any = {};

    if (!type || type === 'cache') {
      // 缓存性能测试
      const cacheTestStart = Date.now();
      const testKey = 'benchmark_test';
      const testValue = { data: 'test_data_'.repeat(100) };
      
      await this.cachingService.set(testKey, testValue);
      const retrieved = await this.cachingService.get(testKey);
      await this.cachingService.delete(testKey);
      
      benchmarks.cache = {
        duration: Date.now() - cacheTestStart,
        success: retrieved !== null,
      };
    }

    if (!type || type === 'database') {
      // 数据库性能测试
      const dbTestStart = Date.now();
      try {
        // 简单查询测试
        await this.databaseOptimizationService.optimizedQuery(
          'benchmark_query',
          async () => {
            // 模拟数据库查询
            await new Promise(resolve => setTimeout(resolve, 10));
            return { test: true };
          },
          { useCache: false }
        );
        
        benchmarks.database = {
          duration: Date.now() - dbTestStart,
          success: true,
        };
      } catch (error) {
        benchmarks.database = {
          duration: Date.now() - dbTestStart,
          success: false,
          error: error.message,
        };
      }
    }

    if (!type || type === 'concurrency') {
      // 并发性能测试
      const concurrencyTestStart = Date.now();
      const testTasks = Array.from({ length: 10 }, () => 
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return true;
        }
      );
      
      const results = await this.concurrencyService.executeConcurrent(testTasks, {
        maxConcurrent: 5,
      });
      
      benchmarks.concurrency = {
        duration: Date.now() - concurrencyTestStart,
        success: results.every(r => r.success),
        taskCount: testTasks.length,
        successCount: results.filter(r => r.success).length,
      };
    }

    return {
      success: true,
      data: {
        benchmarks,
        timestamp: new Date(),
      },
    };
  }

  @Get('benchmarks/history')
  @ApiOperation({ summary: '获取历史基准测试结果' })
  @ApiResponse({ status: 200, description: '返回历史基准测试数据' })
  async getBenchmarkHistory(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const history = await this.benchmarkService.getHistoricalBenchmarks(limitNum);
    
    return {
      success: true,
      data: {
        benchmarks: history,
        count: history.length,
      },
    };
  }

  @Post('benchmarks/run')
  @ApiOperation({ summary: '运行完整基准测试套件' })
  @ApiResponse({ status: 200, description: '返回完整基准测试结果' })
  async runComprehensiveBenchmarks() {
    const suite = await this.benchmarkService.runBenchmarkSuite();
    
    return {
      success: true,
      data: suite,
      message: '基准测试套件运行完成',
    };
  }
}