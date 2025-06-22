import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../auth/services/users.service';

export interface BenchmarkResult {
  operation: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  throughput: number; // requests per second
  errorRate: number; // percentage
  p50: number;
  p95: number;
  p99: number;
  timestamp: Date;
}

export interface BenchmarkSuite {
  name: string;
  description: string;
  results: BenchmarkResult[];
  totalDuration: number;
  overallThroughput: number;
  timestamp: Date;
}

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Run comprehensive performance benchmarks
   */
  async runBenchmarkSuite(): Promise<BenchmarkSuite> {
    const startTime = Date.now();
    this.logger.log('Starting comprehensive benchmark suite');

    const results: BenchmarkResult[] = [];

    try {
      // Database performance tests
      results.push(await this.benchmarkDatabaseRead());
      results.push(await this.benchmarkDatabaseWrite());
      
      // Redis performance tests
      results.push(await this.benchmarkRedisOperations());
      
      // Authentication performance tests
      results.push(await this.benchmarkUserRegistration());
      results.push(await this.benchmarkUserLogin());
      results.push(await this.benchmarkTokenGeneration());
      
      // API endpoint performance tests
      results.push(await this.benchmarkProfileRetrieval());

      const totalDuration = Date.now() - startTime;
      const overallThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;

      const suite: BenchmarkSuite = {
        name: 'Auth Service Performance Benchmark',
        description: 'Comprehensive performance testing of core operations',
        results,
        totalDuration,
        overallThroughput,
        timestamp: new Date(),
      };

      // Store benchmark results
      await this.storeBenchmarkResults(suite);

      this.logger.log(`Benchmark suite completed in ${totalDuration}ms`);
      return suite;

    } catch (error) {
      this.logger.error('Benchmark suite failed', error);
      throw error;
    }
  }

  /**
   * Benchmark database read operations
   */
  private async benchmarkDatabaseRead(): Promise<BenchmarkResult> {
    const operation = 'Database Read Operations';
    const totalRequests = 1000;
    const responseTimes: number[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    this.logger.log(`Running ${operation} benchmark with ${totalRequests} requests`);

    const startTime = Date.now();

    for (let i = 0; i < totalRequests; i++) {
      const requestStart = Date.now();
      
      try {
        await this.prismaService.user.count();
        const responseTime = Date.now() - requestStart;
        responseTimes.push(responseTime);
        successfulRequests++;
      } catch (error) {
        failedRequests++;
      }
    }

    const totalDuration = Date.now() - startTime;
    return this.calculateBenchmarkResult(
      operation,
      totalRequests,
      successfulRequests,
      failedRequests,
      responseTimes,
      totalDuration
    );
  }

  /**
   * Benchmark database write operations
   */
  private async benchmarkDatabaseWrite(): Promise<BenchmarkResult> {
    const operation = 'Database Write Operations';
    const totalRequests = 100; // Fewer writes to avoid data pollution
    const responseTimes: number[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    // Create test tenant for benchmarking
    const testTenant = await this.ensureTestTenant();

    this.logger.log(`Running ${operation} benchmark with ${totalRequests} requests`);

    const startTime = Date.now();

    for (let i = 0; i < totalRequests; i++) {
      const requestStart = Date.now();
      
      try {
        await this.prismaService.auditLog.create({
          data: {
            action: 'SYSTEM_MAINTENANCE',
            resource: 'benchmark',
            resourceId: `benchmark-${i}`,
            description: `Benchmark test operation ${i}`,
            userId: null,
            tenantId: testTenant.id,
            success: true,
            details: { benchmarkIndex: i },
          }
        });
        
        const responseTime = Date.now() - requestStart;
        responseTimes.push(responseTime);
        successfulRequests++;
      } catch (error) {
        failedRequests++;
      }
    }

    // Cleanup benchmark data
    await this.prismaService.auditLog.deleteMany({
      where: {
        action: 'SYSTEM_MAINTENANCE',
        tenantId: testTenant.id,
      }
    });

    const totalDuration = Date.now() - startTime;
    return this.calculateBenchmarkResult(
      operation,
      totalRequests,
      successfulRequests,
      failedRequests,
      responseTimes,
      totalDuration
    );
  }

  /**
   * Benchmark Redis operations
   */
  private async benchmarkRedisOperations(): Promise<BenchmarkResult> {
    const operation = 'Redis Operations';
    const totalRequests = 2000;
    const responseTimes: number[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    this.logger.log(`Running ${operation} benchmark with ${totalRequests} requests`);

    const startTime = Date.now();

    for (let i = 0; i < totalRequests; i++) {
      const requestStart = Date.now();
      
      try {
        // Mix of set and get operations
        if (i % 2 === 0) {
          await this.redisService.set(`benchmark:${i}`, `value-${i}`, 60);
        } else {
          await this.redisService.get(`benchmark:${i - 1}`);
        }
        
        const responseTime = Date.now() - requestStart;
        responseTimes.push(responseTime);
        successfulRequests++;
      } catch (error) {
        failedRequests++;
      }
    }

    // Cleanup Redis keys
    for (let i = 0; i < totalRequests; i += 2) {
      try {
        await this.redisService.del(`benchmark:${i}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    const totalDuration = Date.now() - startTime;
    return this.calculateBenchmarkResult(
      operation,
      totalRequests,
      successfulRequests,
      failedRequests,
      responseTimes,
      totalDuration
    );
  }

  /**
   * Benchmark user registration
   */
  private async benchmarkUserRegistration(): Promise<BenchmarkResult> {
    const operation = 'User Registration';
    const totalRequests = 50;
    const responseTimes: number[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    const testTenant = await this.ensureTestTenant();

    this.logger.log(`Running ${operation} benchmark with ${totalRequests} requests`);

    const startTime = Date.now();

    for (let i = 0; i < totalRequests; i++) {
      const requestStart = Date.now();
      
      try {
        await this.authService.register({
          email: `benchmark-user-${i}@example.com`,
          password: 'BenchmarkPass123!',
          firstName: `Benchmark`,
          lastName: `User ${i}`,
          tenantId: testTenant.id,
        });
        
        const responseTime = Date.now() - requestStart;
        responseTimes.push(responseTime);
        successfulRequests++;
      } catch (error) {
        failedRequests++;
      }
    }

    // Cleanup benchmark users
    await this.prismaService.user.deleteMany({
      where: {
        email: {
          startsWith: 'benchmark-user-',
        },
        tenantId: testTenant.id,
      }
    });

    const totalDuration = Date.now() - startTime;
    return this.calculateBenchmarkResult(
      operation,
      totalRequests,
      successfulRequests,
      failedRequests,
      responseTimes,
      totalDuration
    );
  }

  /**
   * Benchmark user login
   */
  private async benchmarkUserLogin(): Promise<BenchmarkResult> {
    const operation = 'User Login';
    const totalRequests = 100;
    const responseTimes: number[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    const testTenant = await this.ensureTestTenant();

    // Create a test user for login benchmarks
    const testUser = await this.authService.register({
      email: 'benchmark-login-user@example.com',
      password: 'BenchmarkPass123!',
      firstName: 'Benchmark',
      lastName: 'Login User',
      tenantId: testTenant.id,
    });

    this.logger.log(`Running ${operation} benchmark with ${totalRequests} requests`);

    const startTime = Date.now();

    for (let i = 0; i < totalRequests; i++) {
      const requestStart = Date.now();
      
      try {
        await this.authService.login({
          email: 'benchmark-login-user@example.com',
          password: 'BenchmarkPass123!',
        }, testTenant.id);
        
        const responseTime = Date.now() - requestStart;
        responseTimes.push(responseTime);
        successfulRequests++;
      } catch (error) {
        failedRequests++;
      }
    }

    // Cleanup test user and sessions
    const user = await this.prismaService.user.findFirst({
      where: { email: 'benchmark-login-user@example.com' }
    });
    if (user) {
      await this.prismaService.userSession.deleteMany({
        where: { userId: user.id }
      });
      await this.prismaService.user.delete({
        where: { id: user.id }
      });
    }

    const totalDuration = Date.now() - startTime;
    return this.calculateBenchmarkResult(
      operation,
      totalRequests,
      successfulRequests,
      failedRequests,
      responseTimes,
      totalDuration
    );
  }

  /**
   * Benchmark JWT token generation
   */
  private async benchmarkTokenGeneration(): Promise<BenchmarkResult> {
    const operation = 'JWT Token Generation';
    const totalRequests = 1000;
    const responseTimes: number[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    const testTenant = await this.ensureTestTenant();

    this.logger.log(`Running ${operation} benchmark with ${totalRequests} requests`);

    const startTime = Date.now();

    for (let i = 0; i < totalRequests; i++) {
      const requestStart = Date.now();
      
      try {
        // Simulate token generation
        const payload = {
          sub: `test-user-${i}`,
          email: `test${i}@example.com`,
          tenantId: testTenant.id,
        };
        
        // This would normally use JwtService.sign()
        const token = await this.generateMockToken(payload);
        
        const responseTime = Date.now() - requestStart;
        responseTimes.push(responseTime);
        successfulRequests++;
      } catch (error) {
        failedRequests++;
      }
    }

    const totalDuration = Date.now() - startTime;
    return this.calculateBenchmarkResult(
      operation,
      totalRequests,
      successfulRequests,
      failedRequests,
      responseTimes,
      totalDuration
    );
  }

  /**
   * Benchmark profile retrieval
   */
  private async benchmarkProfileRetrieval(): Promise<BenchmarkResult> {
    const operation = 'Profile Retrieval';
    const totalRequests = 200;
    const responseTimes: number[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    const testTenant = await this.ensureTestTenant();

    // Create a test user
    const testUser = await this.usersService.create({
      email: 'benchmark-profile-user@example.com',
      password: 'hashedpassword',
      firstName: 'Benchmark',
      lastName: 'Profile User',
      tenantId: testTenant.id,
    });

    this.logger.log(`Running ${operation} benchmark with ${totalRequests} requests`);

    const startTime = Date.now();

    for (let i = 0; i < totalRequests; i++) {
      const requestStart = Date.now();
      
      try {
        await this.usersService.findOne(testUser.id);
        
        const responseTime = Date.now() - requestStart;
        responseTimes.push(responseTime);
        successfulRequests++;
      } catch (error) {
        failedRequests++;
      }
    }

    // Cleanup test user
    await this.prismaService.user.delete({
      where: { id: testUser.id }
    });

    const totalDuration = Date.now() - startTime;
    return this.calculateBenchmarkResult(
      operation,
      totalRequests,
      successfulRequests,
      failedRequests,
      responseTimes,
      totalDuration
    );
  }

  /**
   * Calculate benchmark results from raw data
   */
  private calculateBenchmarkResult(
    operation: string,
    totalRequests: number,
    successfulRequests: number,
    failedRequests: number,
    responseTimes: number[],
    totalDuration: number
  ): BenchmarkResult {
    responseTimes.sort((a, b) => a - b);

    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    const minResponseTime = responseTimes.length > 0 ? responseTimes[0] : 0;
    const maxResponseTime = responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0;

    const throughput = (successfulRequests / totalDuration) * 1000; // requests per second
    const errorRate = (failedRequests / totalRequests) * 100;

    // Percentiles
    const p50 = this.getPercentile(responseTimes, 50);
    const p95 = this.getPercentile(responseTimes, 95);
    const p99 = this.getPercentile(responseTimes, 99);

    return {
      operation,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      minResponseTime,
      maxResponseTime,
      throughput: Math.round(throughput * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      p50,
      p95,
      p99,
      timestamp: new Date(),
    };
  }

  /**
   * Get percentile value from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Ensure test tenant exists
   */
  private async ensureTestTenant() {
    const tenantId = 'benchmark-tenant';
    
    let tenant = await this.prismaService.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      tenant = await this.prismaService.tenant.create({
        data: {
          id: tenantId,
          name: 'Benchmark Tenant',
          isActive: true,
        }
      });
    }

    return tenant;
  }

  /**
   * Generate mock token for benchmarking
   */
  private async generateMockToken(payload: any): Promise<string> {
    // This is a simplified token generation for benchmarking
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = 'mock-signature';
    
    return `${header}.${payloadStr}.${signature}`;
  }

  /**
   * Store benchmark results for historical tracking
   */
  private async storeBenchmarkResults(suite: BenchmarkSuite): Promise<void> {
    try {
      for (const result of suite.results) {
        await this.prismaService.systemMetric.create({
          data: {
            metricType: 'REQUEST_COUNT',
            name: 'benchmark_result',
            value: result.throughput,
            metadata: {
              operation: result.operation,
              totalRequests: result.totalRequests,
              successfulRequests: result.successfulRequests,
              failedRequests: result.failedRequests,
              averageResponseTime: result.averageResponseTime,
              minResponseTime: result.minResponseTime,
              maxResponseTime: result.maxResponseTime,
              errorRate: result.errorRate,
              p50: result.p50,
              p95: result.p95,
              p99: result.p99,
              suiteTimestamp: suite.timestamp,
            }
          }
        });
      }

      this.logger.log('Benchmark results stored successfully');
    } catch (error) {
      this.logger.error('Failed to store benchmark results', error);
    }
  }

  /**
   * Get historical benchmark results
   */
  async getHistoricalBenchmarks(limit: number = 10): Promise<BenchmarkSuite[]> {
    const results = await this.prismaService.systemMetric.findMany({
      where: {
        name: 'benchmark_result'
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit * 7, // Approximate number of operations per suite
    });

    // Group results by suite timestamp
    const suiteMap = new Map<string, BenchmarkResult[]>();
    
    for (const result of results) {
      const metadata = result.metadata as any;
      const suiteKey = metadata.suiteTimestamp;
      
      if (!suiteMap.has(suiteKey)) {
        suiteMap.set(suiteKey, []);
      }
      
      suiteMap.get(suiteKey)!.push({
        operation: metadata.operation,
        totalRequests: metadata.totalRequests,
        successfulRequests: metadata.successfulRequests,
        failedRequests: metadata.failedRequests,
        averageResponseTime: metadata.averageResponseTime,
        minResponseTime: metadata.minResponseTime,
        maxResponseTime: metadata.maxResponseTime,
        throughput: result.value,
        errorRate: metadata.errorRate,
        p50: metadata.p50,
        p95: metadata.p95,
        p99: metadata.p99,
        timestamp: result.timestamp,
      });
    }

    // Convert to suite format
    const suites: BenchmarkSuite[] = [];
    for (const [suiteTimestamp, suiteResults] of suiteMap.entries()) {
      const overallThroughput = suiteResults.reduce((sum, r) => sum + r.throughput, 0) / suiteResults.length;
      
      suites.push({
        name: 'Auth Service Performance Benchmark',
        description: 'Historical benchmark results',
        results: suiteResults,
        totalDuration: 0, // Not stored historically
        overallThroughput,
        timestamp: new Date(suiteTimestamp),
      });
    }

    return suites.slice(0, limit);
  }
}