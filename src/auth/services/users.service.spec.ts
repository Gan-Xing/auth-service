import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 1,
    tenantId: 'tenant1',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    password: 'hashedPassword',
    phoneNumber: null,
    country: null,
    hashedRt: null,
    isActive: true,
    isVerified: true,
    wechatId: null,
    unionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    tenant: {
      id: 'tenant1',
      name: 'Test Tenant',
      domain: 'test.com',
    },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a user when found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findOne(1);

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { tenant: true },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow('用户不存在');
    });
  });

  describe('findByEmail', () => {
    it('should return a user when found with tenantId', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com', 'tenant1');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { 
          tenantId_email: {
            tenantId: 'tenant1',
            email: 'test@example.com',
          }
        },
        include: { tenant: true },
      });
    });

    it('should return a user when found without tenantId', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: { tenant: true },
      });
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'new@example.com',
        password: 'hashedPassword',
        firstName: 'New',
        lastName: 'User',
        tenantId: 'tenant1',
      };

      const createdUser = {
        ...mockUser,
        ...userData,
        id: 2,
      };

      (prismaService.user.create as jest.Mock).mockResolvedValue(createdUser);

      const result = await service.create(userData);

      expect(result).toEqual(createdUser);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          username: undefined,
          phoneNumber: undefined,
          tenantId: userData.tenantId,
          isActive: true,
          isVerified: false,
        },
        include: { tenant: true },
      });
    });
  });

  describe('update', () => {
    it('should update an existing user', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const updatedUser = {
        ...mockUser,
        ...updateData,
      };

      (prismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.update(1, updateData);

      expect(result).toEqual(updatedUser);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData,
        include: { tenant: true },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const users = [mockUser];
      
      (prismaService.user.findMany as jest.Mock).mockResolvedValue(users);
      (prismaService.user.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.users).toEqual(users);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should return paginated users with search', async () => {
      const users = [mockUser];
      
      (prismaService.user.findMany as jest.Mock).mockResolvedValue(users);
      (prismaService.user.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10, search: 'test' });

      expect(result.users).toEqual(users);
      expect(result.pagination.total).toBe(1);
    });
  });
});