import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from './services/users.service';
import { PasswordService } from './services/password.service';
import { VerificationService } from './services/verification.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { FeaturesService } from '../common/services/features.service';
import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { AuthException } from '../common/exceptions/auth.exceptions';

// Mock jwt-decode
jest.mock('jwt-decode', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    userId: 1,
    tokenId: 'test-token-id'
  }),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let passwordService: jest.Mocked<PasswordService>;
  let jwtService: jest.Mocked<JwtService>;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;

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
      apiKey: 'test-api-key',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      domain: 'test.com',
    }
  };

  const mockTenant = {
    id: 'tenant1',
    name: 'Test Tenant',
    slug: 'test-tenant',
    isActive: true,
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    };

    const mockPasswordService = {
      hashPassword: jest.fn(),
      validatePassword: jest.fn(),
      validatePasswordStrength: jest.fn(),
      generateRandomPassword: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
    };

    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
      userSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getLoginAttempts: jest.fn().mockResolvedValue(0),
      incrementLoginAttempts: jest.fn(),
      resetLoginAttempts: jest.fn(),
      getRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      storeRefreshToken: jest.fn(),
    };

    const mockVerificationService = {
      sendEmailVerification: jest.fn(),
      verifyEmail: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config = {
          'jwt.accessSecret': 'test-access-secret',
          'jwt.refreshSecret': 'test-refresh-secret',
          'jwt.accessExpiresIn': '15m',
          'jwt.refreshExpiresIn': '7d',
          'jwt': {
            accessSecret: 'test-access-secret',
            refreshSecret: 'test-refresh-secret',
            accessExpiresIn: '15m',
            refreshExpiresIn: '7d',
          }
        };
        return config[key];
      }),
    };

    const mockFeaturesService = {
      isEnabled: jest.fn().mockReturnValue(true),
    };

    const mockEmailService = {
      sendWelcomeEmail: jest.fn(),
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };

    const mockAuditService = {
      logAuthFailure: jest.fn(),
      logAuthSuccess: jest.fn(),
      logUserRegister: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: VerificationService, useValue: mockVerificationService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: FeaturesService, useValue: mockFeaturesService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    passwordService = module.get(PasswordService);
    jwtService = module.get(JwtService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
        tenantId: 'tenant1',
      };

      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      passwordService.validatePassword.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('mock-jwt-token');
      redisService.storeRefreshToken.mockResolvedValue(undefined);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prismaService.user.findFirst).toHaveBeenCalled();
      expect(passwordService.validatePassword).toHaveBeenCalledWith(loginDto.password, mockUser.password);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
        tenantId: 'tenant1',
      };

      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      passwordService.validatePassword.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(AuthException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
        tenantId: 'tenant1',
      };

      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(AuthException);
    });
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      };

      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      passwordService.validatePasswordStrength.mockReturnValue({ isValid: true, errors: [] });
      passwordService.hashPassword.mockResolvedValue('hashedPassword');
      (prismaService.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        id: 2,
        email: registerDto.email,
        password: 'hashedPassword',
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      });
      jwtService.signAsync.mockResolvedValue('mock-jwt-token');
      (prismaService.userSession.create as jest.Mock).mockResolvedValue({
        id: 'session1',
        userId: '2',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.register(registerDto, 'tenant1');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prismaService.user.findFirst).toHaveBeenCalled();
      expect(passwordService.hashPassword).toHaveBeenCalledWith(registerDto.password);
    });

    it('should throw BadRequestException for existing user', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Existing',
        lastName: 'User',
        tenantId: 'tenant1',
      };

      (prismaService.tenant.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.register(registerDto, 'tenant1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh tokens', async () => {
      const refreshToken = 'valid-refresh-token';

      // Mock JWT verify to return a payload
      jwtService.verify.mockReturnValue({ userId: 1, tokenId: 'test-token-id' });
      
      // Mock user lookup
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      
      // Mock Redis verification
      redisService.getRefreshToken.mockResolvedValue('valid-refresh-token');
      redisService.revokeRefreshToken.mockResolvedValue(undefined);
      redisService.storeRefreshToken.mockResolvedValue(undefined);
      
      // Mock token generation
      jwtService.signAsync.mockResolvedValue('new-token');
      
      // Mock the updateRefreshTokenHash (user update)
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);
      
      const result = await service.refreshToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      // Mock JWT verify to throw an error
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });
});