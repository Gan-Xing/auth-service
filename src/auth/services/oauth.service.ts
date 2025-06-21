import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../auth.service';
import { PasswordService } from './password.service';
import { AuditService } from '../../audit/audit.service';
import { OAuthUserDto, OAuthLinkAccountDto } from '../dto/oauth.dto';
import { TokenResponseDto } from '../dto/auth.dto';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 处理OAuth登录或注册
   */
  async handleOAuthLogin(
    oauthUser: OAuthUserDto,
    tenantId?: string,
  ): Promise<TokenResponseDto> {
    try {
      this.logger.log(`处理${oauthUser.provider}登录: ${oauthUser.email}`);

      // 1. 查找或创建租户
      let tenant;
      if (tenantId) {
        tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
        });
        if (!tenant || !tenant.isActive) {
          throw new NotFoundException('租户不存在或已被禁用');
        }
      } else {
        // 如果没有指定租户，使用默认租户或创建新租户
        tenant = await this.getOrCreateDefaultTenant();
      }

      // 2. 查找现有的OAuth账户关联
      let oauthAccount = await this.prisma.oAuthAccount.findFirst({
        where: {
          provider: oauthUser.provider,
          providerId: oauthUser.providerId,
        },
        include: { user: true },
      });

      let user;

      if (oauthAccount) {
        // 已有OAuth账户关联，直接登录
        user = oauthAccount.user;
        this.logger.log(`现有OAuth用户登录: ${user.email}`);

        // 更新OAuth账户信息
        await this.prisma.oAuthAccount.update({
          where: { id: oauthAccount.id },
          data: {
            accessToken: oauthUser.accessToken,
            refreshToken: oauthUser.refreshToken,
            lastLoginAt: new Date(),
          },
        });
      } else {
        // 3. 检查是否有相同邮箱的用户
        const existingUser = await this.prisma.user.findFirst({
          where: {
            email: oauthUser.email,
            tenantId: tenant.id,
          },
        });

        if (existingUser) {
          // 邮箱已存在，关联OAuth账户
          user = existingUser;
          await this.createOAuthAccount(user.id, oauthUser);
          this.logger.log(`关联OAuth账户到现有用户: ${user.email}`);
        } else {
          // 4. 创建新用户和OAuth账户
          user = await this.createUserWithOAuth(tenant.id, oauthUser);
          this.logger.log(`创建新OAuth用户: ${user.email}`);
        }
      }

      // 5. 检查用户状态
      if (!user.isActive) {
        throw new ConflictException('用户账户已被禁用');
      }

      // 6. 更新最后登录时间
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // 7. 记录OAuth登录成功审计日志
      await this.auditService.logAuthSuccess(
        user.tenantId,
        user.id,
        'oauth',
        oauthUser.provider
      );

      // 8. 生成JWT tokens
      const tokens = await this.authService.generateTokens({ userId: user.id });
      
      this.logger.log(`OAuth登录成功: ${user.email} via ${oauthUser.provider}`);
      return tokens;
    } catch (error) {
      this.logger.error(`OAuth登录失败: ${oauthUser.email}`, error.stack);
      throw error;
    }
  }

  /**
   * 关联OAuth账户到现有用户
   */
  async linkOAuthAccount(
    userId: number,
    linkData: OAuthLinkAccountDto,
  ): Promise<void> {
    // 检查是否已经关联
    const existingLink = await this.prisma.oAuthAccount.findFirst({
      where: {
        userId,
        provider: linkData.provider,
      },
    });

    if (existingLink) {
      throw new ConflictException(`用户已关联${linkData.provider}账户`);
    }

    // 检查第三方账户是否已被其他用户使用
    const existingAccount = await this.prisma.oAuthAccount.findFirst({
      where: {
        provider: linkData.provider,
        providerId: linkData.providerId,
      },
    });

    if (existingAccount) {
      throw new ConflictException(`该${linkData.provider}账户已被其他用户关联`);
    }

    // 创建关联
    await this.prisma.oAuthAccount.create({
      data: {
        userId,
        provider: linkData.provider,
        providerId: linkData.providerId,
        username: linkData.providerUsername,
        avatar: linkData.avatar,
      },
    });

    this.logger.log(`用户${userId}成功关联${linkData.provider}账户`);
  }

  /**
   * 取消OAuth账户关联
   */
  async unlinkOAuthAccount(userId: number, provider: string): Promise<void> {
    const oauthAccount = await this.prisma.oAuthAccount.findFirst({
      where: {
        userId,
        provider,
      },
    });

    if (!oauthAccount) {
      throw new NotFoundException(`未找到${provider}账户关联`);
    }

    await this.prisma.oAuthAccount.delete({
      where: { id: oauthAccount.id },
    });

    this.logger.log(`用户${userId}取消关联${provider}账户`);
  }

  /**
   * 获取用户的OAuth账户列表
   */
  async getUserOAuthAccounts(userId: number) {
    const accounts = await this.prisma.oAuthAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        username: true,
        avatar: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return accounts;
  }

  /**
   * 生成OAuth授权URL
   */
  getOAuthAuthorizationUrl(provider: string, tenantId?: string): string {
    const baseUrl = this.configService.get<string>('app.baseUrl');
    const state = this.generateState(tenantId);

    switch (provider) {
      case 'github':
        const githubClientId = this.configService.get<string>('oauth.github.clientId');
        return `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${baseUrl}/auth/oauth/github/callback&scope=user:email&state=${state}`;
      
      case 'google':
        const googleClientId = this.configService.get<string>('oauth.google.clientId');
        return `https://accounts.google.com/oauth/authorize?client_id=${googleClientId}&redirect_uri=${baseUrl}/auth/oauth/google/callback&scope=email profile&response_type=code&state=${state}`;
      
      default:
        throw new Error(`不支持的OAuth提供商: ${provider}`);
    }
  }

  /**
   * 获取或创建默认租户
   */
  private async getOrCreateDefaultTenant() {
    let tenant = await this.prisma.tenant.findFirst({
      where: { name: 'Default' },
    });

    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          name: 'Default',
          domain: null,
          isActive: true,
        },
      });
      this.logger.log('创建默认租户用于OAuth用户');
    }

    return tenant;
  }

  /**
   * 创建OAuth账户记录
   */
  private async createOAuthAccount(userId: number, oauthUser: OAuthUserDto) {
    return await this.prisma.oAuthAccount.create({
      data: {
        userId,
        provider: oauthUser.provider,
        providerId: oauthUser.providerId,
        username: oauthUser.username,
        avatar: oauthUser.avatar,
        accessToken: oauthUser.accessToken,
        refreshToken: oauthUser.refreshToken,
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * 创建新用户并关联OAuth账户
   */
  private async createUserWithOAuth(tenantId: string, oauthUser: OAuthUserDto) {
    // 生成随机密码（OAuth用户不需要密码登录）
    const randomPassword = await this.passwordService.hashPassword(
      Math.random().toString(36).substring(2, 15),
    );

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: oauthUser.email,
        password: randomPassword,
        firstName: oauthUser.firstName,
        lastName: oauthUser.lastName || '',
        username: oauthUser.username,
        isActive: true,
        isVerified: true, // OAuth用户默认已验证
      },
    });

    // 创建OAuth账户关联
    await this.createOAuthAccount(user.id, oauthUser);

    return user;
  }

  /**
   * 生成state参数
   */
  private generateState(tenantId?: string): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 15);
    const data = tenantId ? `${tenantId}:${timestamp}:${random}` : `${timestamp}:${random}`;
    return Buffer.from(data).toString('base64url');
  }

  /**
   * 解析state参数
   */
  parseState(state: string): { tenantId?: string; timestamp: number } {
    try {
      const decoded = Buffer.from(state, 'base64url').toString();
      const parts = decoded.split(':');
      
      if (parts.length === 3) {
        return {
          tenantId: parts[0],
          timestamp: parseInt(parts[1]),
        };
      } else if (parts.length === 2) {
        return {
          timestamp: parseInt(parts[0]),
        };
      }
      
      throw new Error('Invalid state format');
    } catch (error) {
      throw new Error('Invalid state parameter');
    }
  }
}