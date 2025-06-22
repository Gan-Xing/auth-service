import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringService } from './monitoring.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockPrismaService = {
      systemMetric: {
        create: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      user: {
        count: jest.fn(),
      },
      userSession: {
        count: jest.fn(),
      },
      auditLog: {
        count: jest.fn(),
      },
    };

    const mockRedisService = {
      ping: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'metrics') {
          return { enabled: true };
        }
        if (key === 'monitoring') {
          return { enabled: true };
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordMetric', () => {
    it('should record a metric successfully', async () => {
      const mockMetric = {
        id: '1',
        metricType: 'CPU_USAGE',
        name: 'cpu_usage',
        value: 50.5,
        unit: '%',
        timestamp: new Date(),
      };

      (prismaService.systemMetric.create as jest.Mock).mockResolvedValue(mockMetric);

      const metricData = {
        metricType: 'CPU_USAGE' as const,
        name: 'cpu_usage',
        value: 50.5,
        unit: '%',
      };

      await service.recordMetric(metricData);

      expect(prismaService.systemMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metricType: metricData.metricType,
          name: metricData.name,
          value: metricData.value,
          unit: metricData.unit,
        }),
      });
    });

    it('should handle errors when recording metrics', async () => {
      (prismaService.systemMetric.create as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const metricData = {
        metricType: 'CPU_USAGE' as const,
        name: 'cpu_usage',
        value: 50.5,
      };

      // Should not throw - errors should be handled gracefully
      await expect(service.recordMetric(metricData)).resolves.not.toThrow();
    });
  });

  describe('getSystemHealth', () => {
    it('should return system health status', async () => {
      (prismaService.user.count as jest.Mock).mockResolvedValue(100);
      redisService.ping.mockResolvedValue('PONG');

      const health = await service.getSystemHealth();

      expect(health.status).toBeDefined();
      expect(health.components).toBeDefined();
      expect(health.components.database).toBeDefined();
      expect(health.components.redis).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });

    it('should handle database connection errors', async () => {
      (prismaService.user.count as jest.Mock).mockRejectedValue(new Error('Connection failed'));
      redisService.ping.mockResolvedValue('PONG');

      const health = await service.getSystemHealth();

      expect(health.status).toBeDefined();
      expect(health.components.database).toBe(false);
    });

    it('should handle redis connection errors', async () => {
      (prismaService.user.count as jest.Mock).mockResolvedValue(100);
      redisService.ping.mockRejectedValue(new Error('Redis connection failed'));

      const health = await service.getSystemHealth();

      expect(health.status).toBeDefined();
      expect(health.components.redis).toBe(false);
    });
  });

  describe('recordApiRequest', () => {
    it('should record API request metrics', async () => {
      const mockMetric = {
        id: '1',
        metricType: 'RESPONSE_TIME',
        name: 'api_response_time',
        value: 100,
        timestamp: new Date(),
      };

      (prismaService.systemMetric.create as jest.Mock).mockResolvedValue(mockMetric);

      await service.recordApiRequest('/api/test', 'GET', 100, 200);

      expect(prismaService.systemMetric.create).toHaveBeenCalled();
    });
  });

  describe('recordLoginMetric', () => {
    it('should record login success metric', async () => {
      const mockMetric = {
        id: '1',
        metricType: 'LOGIN_SUCCESS',
        name: 'login_success',
        value: 1,
        timestamp: new Date(),
      };

      (prismaService.systemMetric.create as jest.Mock).mockResolvedValue(mockMetric);

      await service.recordLoginMetric(true, 'tenant1', 1);

      expect(prismaService.systemMetric.create).toHaveBeenCalled();
    });

    it('should record login failure metric', async () => {
      const mockMetric = {
        id: '1',
        metricType: 'LOGIN_FAILURE',
        name: 'login_failure',
        value: 1,
        timestamp: new Date(),
      };

      (prismaService.systemMetric.create as jest.Mock).mockResolvedValue(mockMetric);

      await service.recordLoginMetric(false, 'tenant1', 1);

      expect(prismaService.systemMetric.create).toHaveBeenCalled();
    });
  });

  describe('collectSystemMetrics', () => {
    it('should collect system metrics successfully', async () => {
      (prismaService.systemMetric.create as jest.Mock).mockResolvedValue({ id: '1' });

      await service.collectSystemMetrics();

      expect(prismaService.systemMetric.create).toHaveBeenCalled();
    });
  });
});
