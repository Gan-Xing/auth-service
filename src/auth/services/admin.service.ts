import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from './password.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // 尝试在应用启动时创建默认管理员账户
    try {
      await this.ensureDefaultAdminExists();
    } catch (error) {
      this.logger.warn('无法在启动时创建默认管理员账户，可能是数据库连接问题', error.message);
    }
  }

  /**
   * 确保默认管理员账户存在
   */
  async ensureDefaultAdminExists(): Promise<{
    created: boolean;
    email: string;
    message: string;
  }> {
    try {
      // 1. 检查或创建系统租户
      let systemTenant = await this.prisma.tenant.findFirst({
        where: { name: 'System' },
      });

      if (!systemTenant) {
        systemTenant = await this.prisma.tenant.create({
          data: {
            name: 'System',
            domain: null, // 系统租户没有域名限制
            isActive: true,
          },
        });
        this.logger.log('✅ 创建系统租户成功');
      }

      // 2. 检查默认管理员账户
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@auth-service.com';
      const adminPassword = process.env.ADMIN_PASSWORD || this.generateSecurePassword();

      let adminUser = await this.prisma.user.findFirst({
        where: { 
          email: adminEmail,
          tenantId: systemTenant.id,
        },
      });

      if (!adminUser) {
        // 创建默认管理员账户
        const hashedPassword = await this.passwordService.hashPassword(adminPassword);

        adminUser = await this.prisma.user.create({
          data: {
            email: adminEmail,
            password: hashedPassword,
            firstName: 'Super',
            lastName: 'Admin',
            username: 'superadmin',
            tenantId: systemTenant.id,
            isActive: true,
            isVerified: true,
          },
        });

        this.logger.log('✅ 创建默认超级管理员账户成功');
        this.logger.warn('⚠️  请立即修改默认管理员密码！');
        this.logger.log(`管理员登录信息:\n   邮箱: ${adminEmail}\n   密码: ${adminPassword}`);

        return {
          created: true,
          email: adminEmail,
          message: `默认管理员账户创建成功！邮箱: ${adminEmail}, 密码: ${adminPassword}`,
        };
      } else {
        this.logger.log('ℹ️  默认管理员账户已存在');
        return {
          created: false,
          email: adminEmail,
          message: '默认管理员账户已存在',
        };
      }
    } catch (error) {
      this.logger.error('创建默认管理员账户失败', error.stack);
      throw error;
    }
  }

  /**
   * 创建新的管理员账户
   */
  async createAdminUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    username?: string;
  }): Promise<any> {
    // 获取系统租户
    const systemTenant = await this.prisma.tenant.findFirst({
      where: { name: 'System' },
    });

    if (!systemTenant) {
      throw new Error('系统租户不存在，请先运行种子脚本');
    }

    // 检查管理员是否已存在
    const existingAdmin = await this.prisma.user.findFirst({
      where: {
        email: data.email,
        tenantId: systemTenant.id,
      },
    });

    if (existingAdmin) {
      throw new Error('该邮箱的管理员账户已存在');
    }

    // 验证密码强度
    const passwordValidation = this.passwordService.validatePasswordStrength(data.password);
    if (!passwordValidation.isValid) {
      throw new Error(`密码强度不够: ${passwordValidation.errors.join(', ')}`);
    }

    // 创建管理员账户
    const hashedPassword = await this.passwordService.hashPassword(data.password);
    
    const adminUser = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username || `${data.firstName.toLowerCase()}${data.lastName.toLowerCase()}`,
        tenantId: systemTenant.id,
        isActive: true,
        isVerified: true,
      },
    });

    this.logger.log(`新管理员账户创建成功: ${data.email}`);

    // 返回非敏感信息
    return {
      id: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      username: adminUser.username,
      createdAt: adminUser.createdAt,
    };
  }

  /**
   * 获取所有管理员用户
   */
  async getAdminUsers(): Promise<any[]> {
    const systemTenant = await this.prisma.tenant.findFirst({
      where: { name: 'System' },
    });

    if (!systemTenant) {
      return [];
    }

    const adminUsers = await this.prisma.user.findMany({
      where: {
        tenantId: systemTenant.id,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return adminUsers;
  }

  /**
   * 检查邮箱是否为管理员
   */
  async isAdminEmail(email: string): Promise<boolean> {
    try {
      const systemTenant = await this.prisma.tenant.findFirst({
        where: { name: 'System' },
      });

      if (!systemTenant) {
        return false;
      }

      const adminUser = await this.prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          tenantId: systemTenant.id,
          isActive: true,
        },
      });

      return !!adminUser;
    } catch (error) {
      this.logger.error('检查管理员权限失败', error);
      return false;
    }
  }

  /**
   * 重置管理员密码
   */
  async resetAdminPassword(email: string, newPassword: string): Promise<void> {
    const systemTenant = await this.prisma.tenant.findFirst({
      where: { name: 'System' },
    });

    if (!systemTenant) {
      throw new Error('系统租户不存在');
    }

    // 验证密码强度
    const passwordValidation = this.passwordService.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`密码强度不够: ${passwordValidation.errors.join(', ')}`);
    }

    const hashedPassword = await this.passwordService.hashPassword(newPassword);

    await this.prisma.user.updateMany({
      where: {
        email: email.toLowerCase(),
        tenantId: systemTenant.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    this.logger.log(`管理员密码重置成功: ${email}`);
  }

  /**
   * 生成安全密码
   */
  private generateSecurePassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@$!%*?&';
    let password = '';
    
    // 确保包含各种字符类型
    password += 'A'; // 大写字母
    password += 'a'; // 小写字母
    password += '1'; // 数字
    password += '@'; // 特殊字符
    
    // 填充剩余字符
    for (let i = 4; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // 打乱字符顺序
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * 健康检查 - 验证管理员系统是否正常
   */
  async healthCheck(): Promise<{
    status: 'ok' | 'error';
    systemTenantExists: boolean;
    adminCount: number;
    message: string;
  }> {
    try {
      const systemTenant = await this.prisma.tenant.findFirst({
        where: { name: 'System' },
      });

      if (!systemTenant) {
        return {
          status: 'error',
          systemTenantExists: false,
          adminCount: 0,
          message: '系统租户不存在，请运行种子脚本',
        };
      }

      const adminCount = await this.prisma.user.count({
        where: {
          tenantId: systemTenant.id,
          isActive: true,
        },
      });

      return {
        status: 'ok',
        systemTenantExists: true,
        adminCount,
        message: `管理员系统正常，共有 ${adminCount} 个活跃管理员账户`,
      };
    } catch (error) {
      return {
        status: 'error',
        systemTenantExists: false,
        adminCount: 0,
        message: `健康检查失败: ${error.message}`,
      };
    }
  }
}