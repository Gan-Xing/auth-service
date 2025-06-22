import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Monitoring API (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let redisService: RedisService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = app.get(PrismaService);
    redisService = app.get(RedisService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/monitoring/health (GET)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/monitoring/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('services');
          expect(res.body.services).toHaveProperty('database');
          expect(res.body.services).toHaveProperty('redis');
          expect(['healthy', 'unhealthy']).toContain(res.body.status);
        });
    });

    it('should include service-specific health information', () => {
      return request(app.getHttpServer())
        .get('/monitoring/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.services.database).toHaveProperty('status');
          expect(res.body.services.redis).toHaveProperty('status');
          expect(['healthy', 'unhealthy']).toContain(res.body.services.database.status);
          expect(['healthy', 'unhealthy']).toContain(res.body.services.redis.status);
        });
    });
  });

  describe('/monitoring/metrics (GET)', () => {
    it('should return system metrics', () => {
      return request(app.getHttpServer())
        .get('/monitoring/metrics')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('users');
          expect(res.body).toHaveProperty('sessions');
          expect(res.body).toHaveProperty('system');
          expect(res.body).toHaveProperty('redis');
          expect(res.body).toHaveProperty('timestamp');
          
          expect(res.body.users).toHaveProperty('total');
          expect(res.body.users).toHaveProperty('active');
          expect(res.body.sessions).toHaveProperty('total');
          expect(res.body.system).toHaveProperty('auditLogs');
          
          expect(typeof res.body.users.total).toBe('number');
          expect(typeof res.body.users.active).toBe('number');
          expect(typeof res.body.sessions.total).toBe('number');
        });
    });

    it('should include Redis metrics', () => {
      return request(app.getHttpServer())
        .get('/monitoring/metrics')
        .expect(200)
        .expect((res) => {
          expect(res.body.redis).toHaveProperty('version');
          expect(res.body.redis).toHaveProperty('memory');
          expect(typeof res.body.redis.version).toBe('string');
        });
    });
  });

  describe('/monitoring/performance (GET)', () => {
    it('should return performance metrics with default time range', () => {
      return request(app.getHttpServer())
        .get('/monitoring/performance')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('responseTime');
          expect(res.body).toHaveProperty('totalRequests');
          expect(res.body).toHaveProperty('timeRange');
          
          expect(res.body.responseTime).toHaveProperty('avg');
          expect(res.body.responseTime).toHaveProperty('max');
          expect(res.body.responseTime).toHaveProperty('min');
          
          expect(typeof res.body.responseTime.avg).toBe('number');
          expect(typeof res.body.responseTime.max).toBe('number');
          expect(typeof res.body.responseTime.min).toBe('number');
          expect(typeof res.body.totalRequests).toBe('number');
        });
    });

    it('should accept custom time range parameters', () => {
      const startTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      const endTime = new Date().toISOString();

      return request(app.getHttpServer())
        .get('/monitoring/performance')
        .query({ startTime, endTime })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('timeRange');
          expect(res.body.timeRange).toHaveProperty('start');
          expect(res.body.timeRange).toHaveProperty('end');
        });
    });

    it('should return 400 for invalid time range', () => {
      return request(app.getHttpServer())
        .get('/monitoring/performance')
        .query({ startTime: 'invalid-date', endTime: 'invalid-date' })
        .expect(400);
    });
  });

  describe('/monitoring/alerts (GET)', () => {
    it('should return alerts list', () => {
      return request(app.getHttpServer())
        .get('/monitoring/alerts')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // Each alert should have required properties if any exist
          if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('id');
            expect(res.body[0]).toHaveProperty('type');
            expect(res.body[0]).toHaveProperty('severity');
            expect(res.body[0]).toHaveProperty('message');
            expect(res.body[0]).toHaveProperty('timestamp');
          }
        });
    });

    it('should support severity filter', () => {
      return request(app.getHttpServer())
        .get('/monitoring/alerts')
        .query({ severity: 'high' })
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // All returned alerts should match the severity filter
          res.body.forEach(alert => {
            expect(alert.severity).toBe('high');
          });
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/monitoring/alerts')
        .query({ page: 1, limit: 10 })
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeLessThanOrEqual(10);
        });
    });
  });

  describe('Monitoring Middleware Integration', () => {
    it('should record API request metrics', async () => {
      // Make a few API requests
      await request(app.getHttpServer())
        .get('/monitoring/health')
        .expect(200);

      await request(app.getHttpServer())
        .get('/monitoring/metrics')
        .expect(200);

      // Wait a bit for async recording
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that metrics were recorded
      const metricsCount = await prismaService.systemMetric.count({
        where: {
          name: 'api_request'
        }
      });

      expect(metricsCount).toBeGreaterThan(0);
    });

    it('should record response times', async () => {
      await request(app.getHttpServer())
        .get('/monitoring/health')
        .expect(200);

      // Wait for async recording
      await new Promise(resolve => setTimeout(resolve, 100));

      const responseTimeMetrics = await prismaService.systemMetric.findMany({
        where: {
          name: 'api_request'
        },
        select: {
          metadata: true
        },
        take: 1,
        orderBy: {
          timestamp: 'desc'
        }
      });

      if (responseTimeMetrics.length > 0) {
        const metadata = responseTimeMetrics[0].metadata as any;
        expect(metadata).toHaveProperty('responseTime');
        expect(typeof metadata.responseTime).toBe('number');
        expect(metadata.responseTime).toBeGreaterThan(0);
      }
    });
  });
});