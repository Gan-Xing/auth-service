import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  AuthException,
  ValidationException,
  BusinessException,
  DatabaseException,
  RedisException,
  TokenException,
  TenantException,
} from '../common/exceptions/auth.exceptions';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PasswordService } from './services/password.service';
import { VerificationService } from './services/verification.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import jwtDecode from 'jwt-decode';
import {
  LoginDto,
  RegisterDto,
  RegisterWithCodeDto,
  TokenResponseDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly verificationService: VerificationService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto, tenantId?: string): Promise<TokenResponseDto> {
    const { email, password } = loginDto;
    const loginIdentifier = `${email.toLowerCase()}:${tenantId || 'default'}`;

    try {
      // 检查登录失败次数
      const failedAttempts = await this.redisService.getLoginAttempts(loginIdentifier);
      if (failedAttempts >= 5) {
        this.logger.warn(`登录失败次数过多: ${email}`, { email, tenantId, attempts: failedAttempts });
        throw new AuthException(
          '登录失败次数过多，请15分钟后重试',
          429,
          'TOO_MANY_LOGIN_ATTEMPTS',
          { retryAfter: 15 * 60 } // 15 minutes
        );
      }

      // 查找用户（支持多租户）
      const whereCondition = tenantId
        ? { tenantId, email: email.toLowerCase() }
        : { email: email.toLowerCase() };

      const user = await this.prisma.user.findFirst({
        where: whereCondition,
        include: { tenant: true },
      });

      if (!user) {
        await this.redisService.incrementLoginAttempts(loginIdentifier);
        this.logger.warn(`登录失败 - 用户不存在: ${email}`, { email, tenantId });
        
        // 记录登录失败审计日志
        await this.auditService.logAuthFailure(
          tenantId || 'default',
          email,
          '用户不存在',
          'USER_NOT_FOUND'
        );
        
        throw new AuthException('邮箱或密码错误', 401, 'INVALID_CREDENTIALS');
      }

      if (!user.tenant.isActive) {
        this.logger.warn(`登录失败 - 租户已禁用: ${email}`, { email, tenantId: user.tenantId });
        throw new TenantException('租户已被禁用', user.tenantId, 'login');
      }

      if (!user.isActive) {
        this.logger.warn(`登录失败 - 用户已禁用: ${email}`, { email, userId: user.id });
        throw new AuthException('用户账户已被禁用', 401, 'USER_DISABLED', { userId: user.id });
      }

      // 验证密码
      const isPasswordValid = await this.passwordService.validatePassword(password, user.password);

      if (!isPasswordValid) {
        await this.redisService.incrementLoginAttempts(loginIdentifier);
        this.logger.warn(`登录失败 - 密码错误: ${email}`, { email, userId: user.id });
        
        // 记录登录失败审计日志
        await this.auditService.logAuthFailure(
          user.tenantId,
          email,
          '密码错误',
          'INVALID_PASSWORD'
        );
        
        throw new AuthException('邮箱或密码错误', 401, 'INVALID_CREDENTIALS');
      }

      // 登录成功，重置失败次数
      await this.redisService.resetLoginAttempts(loginIdentifier);

      // 更新最后登录时间
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      this.logger.log(`用户登录成功: ${email}`, { email, userId: user.id, tenantId: user.tenantId });

      // 记录登录成功审计日志
      await this.auditService.logAuthSuccess(
        user.tenantId,
        user.id,
        'password'
      );

      // 生成tokens
      const tokens = await this.generateTokens({ userId: user.id });

      // 更新refresh token哈希
      await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

      return tokens;
    } catch (error) {
      if (error instanceof AuthException || error instanceof TenantException) {
        throw error;
      }
      
      this.logger.error(`登录过程中发生错误: ${email}`, error.stack, { email, tenantId });
      throw new DatabaseException('登录服务暂时不可用，请稍后重试', 'login', error);
    }
  }

  /**
   * 用户注册（基础版本）
   */
  async register(registerDto: RegisterDto, tenantId?: string): Promise<TokenResponseDto> {
    const { email, password, firstName, lastName, username, phoneNumber, country } = registerDto;

    if (!tenantId) {
      throw new BadRequestException('租户ID不能为空');
    }

    // 检查租户是否存在且活跃
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || !tenant.isActive) {
      throw new BadRequestException('租户不存在或已被禁用');
    }

    // 检查邮箱在当前租户内是否已存在
    const existingUser = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: email.toLowerCase(),
      },
    });

    if (existingUser) {
      throw new ConflictException('该邮箱在当前租户内已被注册');
    }

    // 检查用户名在当前租户内是否已存在
    if (username) {
      const existingUsername = await this.prisma.user.findFirst({
        where: {
          tenantId,
          username,
        },
      });

      if (existingUsername) {
        throw new ConflictException('该用户名在当前租户内已被使用');
      }
    }

    // 验证密码强度
    const passwordValidation = this.passwordService.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new BadRequestException(`密码强度不够: ${passwordValidation.errors.join(', ')}`);
    }

    // 哈希密码
    const hashedPassword = await this.passwordService.hashPassword(password);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        username: username || `${lastName}${firstName}`,
        phoneNumber,
        country,
        isVerified: false, // 需要邮箱验证
      },
    });

    // 生成tokens
    const tokens = await this.generateTokens({ userId: user.id });

    // 更新refresh token哈希
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

    // 记录用户注册审计日志
    await this.auditService.logUserRegister(tenantId, user.id, email);

    // 发送欢迎邮件
    try {
      await this.emailService.sendWelcomeEmail(email, firstName);
    } catch (error) {
      // 邮件发送失败不影响注册
      console.log('发送欢迎邮件失败:', error.message);
    }

    return tokens;
  }

  /**
   * 邮箱验证码注册
   */
  async registerWithVerificationCode(registerDto: RegisterWithCodeDto): Promise<TokenResponseDto> {
    const { verificationToken, verificationCode, tenantId, ...userData } = registerDto;

    if (!tenantId) {
      throw new BadRequestException('租户ID不能为空');
    }

    // 验证邮箱验证码
    const verification = await this.verificationService.verifyEmailCode(
      verificationToken,
      verificationCode,
    );

    if (!verification.isValid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    if (verification.email !== userData.email.toLowerCase()) {
      throw new BadRequestException('邮箱与验证码不匹配');
    }

    // 执行注册
    const result = await this.register(userData, tenantId);

    // 标记用户为已验证
    await this.prisma.user.update({
      where: { 
        tenantId_email: {
          tenantId,
          email: userData.email.toLowerCase()
        }
      },
      data: { isVerified: true },
    });

    return result;
  }

  /**
   * 发送邮箱验证码
   */
  async sendEmailVerificationCode(email: string): Promise<{ token: string; message: string }> {
    // 检查邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('邮箱格式不正确');
    }

    // 检查频率限制
    const canSend = await this.verificationService.checkEmailRateLimit(email);
    if (!canSend) {
      throw new BadRequestException('发送过于频繁，请1分钟后再试');
    }

    return await this.verificationService.sendEmailVerificationCode(email);
  }

  /**
   * 申请密码重置
   */
  async requestPasswordReset(email: string, tenantId?: string): Promise<{ message: string }> {
    if (!tenantId) {
      throw new BadRequestException('租户ID不能为空');
    }

    // 检查用户是否存在
    const user = await this.prisma.user.findUnique({
      where: { 
        tenantId_email: {
          tenantId,
          email: email.toLowerCase()
        }
      },
    });

    if (!user) {
      // 为了安全，不告诉用户邮箱不存在
      return { message: '如果该邮箱已注册，您将收到密码重置邮件' };
    }

    // 生成重置token
    const resetToken = await this.verificationService.generatePasswordResetToken(email);

    // 发送重置邮件
    try {
      await this.emailService.sendPasswordResetEmail(email, resetToken);
    } catch (error) {
      throw new BadRequestException('邮件发送失败，请稍后重试');
    }

    return { message: '如果该邮箱已注册，您将收到密码重置邮件' };
  }

  /**
   * 重置密码
   */
  async resetPassword(resetDto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, newPassword } = resetDto;

    // 验证重置token
    const verification = await this.verificationService.verifyPasswordResetToken(token);

    if (!verification.isValid) {
      throw new BadRequestException('重置链接无效或已过期');
    }

    // 验证新密码强度
    const passwordValidation = this.passwordService.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new BadRequestException(`密码强度不够: ${passwordValidation.errors.join(', ')}`);
    }

    // 查找用户 - 需要从验证记录或其他方式获取tenantId
    // 注意：这里需要重新设计，因为密码重置需要知道用户所属的租户
    const user = await this.prisma.user.findFirst({
      where: { email: verification.email },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 哈希新密码
    const hashedPassword = await this.passwordService.hashPassword(newPassword);

    // 更新密码并清除所有refresh token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        hashedRt: null, // 清除refresh token，强制重新登录
      },
    });

    // 标记重置token为已使用
    await this.verificationService.markPasswordResetTokenAsUsed(token);

    return { message: '密码重置成功，请使用新密码登录' };
  }

  /**
   * 修改密码
   */
  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证旧密码
    const isOldPasswordValid = await this.passwordService.validatePassword(
      oldPassword,
      user.password,
    );

    if (!isOldPasswordValid) {
      throw new UnauthorizedException('原密码错误');
    }

    // 验证新密码强度
    const passwordValidation = this.passwordService.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new BadRequestException(`密码强度不够: ${passwordValidation.errors.join(', ')}`);
    }

    // 哈希新密码
    const hashedPassword = await this.passwordService.hashPassword(newPassword);

    // 更新密码
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: '密码修改成功' };
  }

  /**
   * 刷新Token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponseDto> {
    try {
      const jwtConfig = this.configService.get('jwt');
      const payload = this.jwtService.verify(refreshToken, {
        secret: jwtConfig.refreshSecret,
      });

      // 验证用户是否存在且活跃
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        include: { tenant: true },
      });

      if (!user || !user.isActive || !user.tenant.isActive) {
        throw new UnauthorizedException('用户或租户已被禁用');
      }

      // 从Redis验证refresh token
      if (payload.tokenId) {
        const storedToken = await this.redisService.getRefreshToken(payload.userId, payload.tokenId);
        if (!storedToken || storedToken !== refreshToken) {
          throw new UnauthorizedException('无效的刷新Token');
        }
        
        // 撤销旧的refresh token
        await this.redisService.revokeRefreshToken(payload.userId, payload.tokenId);
      } else {
        // 降级到数据库验证（向后兼容）
        if (!user.hashedRt) {
          throw new UnauthorizedException('无效的刷新Token');
        }
        
        const isRtValid = await this.passwordService.validatePassword(refreshToken, user.hashedRt);
        if (!isRtValid) {
          throw new UnauthorizedException('无效的刷新Token');
        }
      }

      // 生成新的tokens
      const tokens = await this.generateTokens({ userId: user.id });

      // 更新refresh token哈希（向后兼容）
      await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('无效的刷新Token');
    }
  }

  /**
   * 用户登出
   */
  async logout(userId: number): Promise<boolean> {
    // 撤销Redis中的所有refresh tokens
    await this.redisService.revokeAllUserTokens(userId);
    
    // 删除所有用户会话
    await this.redisService.deleteAllUserSessions(userId);
    
    // 数据库清除（向后兼容）
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRt: null },
    });

    return true;
  }

  /**
   * 获取用户信息
   */
  async getProfile(userId: number) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        country: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });
  }

  /**
   * 生成访问和刷新Token
   */
  async generateTokens(payload: { userId: number }): Promise<TokenResponseDto> {
    const jwtConfig = this.configService.get('jwt');
    const tokenId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // 添加tokenId到payload中用于Redis存储
    const accessPayload = { ...payload, tokenId };
    const refreshPayload = { ...payload, tokenId, type: 'refresh' };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: jwtConfig.accessSecret,
        expiresIn: jwtConfig.accessExpiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: jwtConfig.refreshSecret,
        expiresIn: jwtConfig.refreshExpiresIn,
      }),
    ]);

    // 解码token获取过期时间
    const accessDecoded = jwtDecode(accessToken) as any;
    const refreshDecoded = jwtDecode(refreshToken) as any;
    
    // 将refresh token存储到Redis中
    const refreshExpiresInSeconds = refreshDecoded.exp - Math.floor(Date.now() / 1000);
    await this.redisService.storeRefreshToken(
      payload.userId, 
      tokenId, 
      refreshToken, 
      refreshExpiresInSeconds
    );

    return {
      accessToken,
      refreshToken,
      accessExpiresIn: accessDecoded.exp * 1000,
      refreshExpiresIn: refreshDecoded.exp * 1000,
      tokenType: 'Bearer',
    };
  }

  /**
   * 更新refresh token哈希（已迁移到Redis，保持数据库兼容性）
   */
  private async updateRefreshTokenHash(userId: number, refreshToken: string): Promise<void> {
    try {
      // 继续更新数据库以保持向后兼容
      const hashedRt = await this.passwordService.hashPassword(refreshToken);
      await this.prisma.user.update({
        where: { id: userId },
        data: { hashedRt },
      });
    } catch (error) {
      // 如果数据库更新失败，不影响Redis存储的token功能
      console.log('数据库refresh token更新失败，但Redis存储正常:', error.message);
    }
  }
}
