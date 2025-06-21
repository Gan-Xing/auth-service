import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { EmailService } from '../../email/email.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * 发送邮箱验证码
   */
  async sendEmailVerificationCode(email: string): Promise<{ token: string; message: string }> {
    // 生成6位数验证码
    const code = this.generateVerificationCode();

    // 生成验证token
    const token = uuidv4();

    // 设置过期时间（10分钟后）
    const expiresInSeconds = 10 * 60; // 10 minutes
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // 先尝试使用Redis存储验证码
    try {
      // 删除旧的验证码
      await this.redisService.deleteVerificationCode(email.toLowerCase());
      
      // 存储新的验证码到Redis（包含token信息）
      const verificationData = { code, token, email: email.toLowerCase() };
      await this.redisService.set(`verification_token:${token}`, verificationData, expiresInSeconds);
      await this.redisService.storeVerificationCode(email.toLowerCase(), JSON.stringify(verificationData), expiresInSeconds);
    } catch (redisError) {
      // Redis失败时降级到数据库
      console.log('Redis存储验证码失败，降级到数据库:', redisError.message);
      
      // 清理该邮箱的旧验证码
      await this.prisma.verificationCode.deleteMany({
        where: {
          target: email.toLowerCase(),
          type: 'EMAIL',
        },
      });

      // 保存新的验证码
      await this.prisma.verificationCode.create({
        data: {
          type: 'EMAIL',
          target: email.toLowerCase(),
          code,
          token,
          expiresAt,
        },
      });
    }

    // 发送邮件
    const emailSent = await this.emailService.sendVerificationCode(email, code);

    if (!emailSent) {
      throw new BadRequestException('邮件发送失败，请稍后重试');
    }

    return {
      token,
      message: '验证码已发送到您的邮箱，请查收',
    };
  }

  /**
   * 验证邮箱验证码
   */
  async verifyEmailCode(token: string, code: string): Promise<{ email: string; isValid: boolean }> {
    // 首先尝试从Redis获取验证码
    try {
      const redisData = await this.redisService.get<any>(`verification_token:${token}`);
      
      if (redisData) {
        // Redis中找到验证码
        if (redisData.code !== code) {
          return { email: '', isValid: false };
        }
        
        // 验证成功，删除Redis中的验证码（防止重复使用）
        await this.redisService.del(`verification_token:${token}`);
        await this.redisService.deleteVerificationCode(redisData.email);
        
        return {
          email: redisData.email,
          isValid: true,
        };
      }
    } catch (redisError) {
      console.log('Redis验证码查询失败，降级到数据库:', redisError.message);
    }

    // Redis失败或找不到，降级到数据库
    const verification = await this.prisma.verificationCode.findUnique({
      where: { token },
    });

    if (!verification) {
      return { email: '', isValid: false };
    }

    // 检查是否过期
    if (verification.expiresAt < new Date()) {
      await this.prisma.verificationCode.delete({
        where: { token },
      });
      return { email: '', isValid: false };
    }

    // 检查是否已使用
    if (verification.isUsed) {
      return { email: '', isValid: false };
    }

    // 验证码不匹配
    if (verification.code !== code) {
      return { email: '', isValid: false };
    }

    // 标记为已使用
    await this.prisma.verificationCode.update({
      where: { token },
      data: { isUsed: true },
    });

    return {
      email: verification.target,
      isValid: true,
    };
  }

  /**
   * 检查邮箱验证频率限制
   */
  async checkEmailRateLimit(email: string): Promise<boolean> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const recentCodes = await this.prisma.verificationCode.count({
      where: {
        target: email.toLowerCase(),
        type: 'EMAIL',
        createdAt: {
          gte: oneMinuteAgo,
        },
      },
    });

    // 1分钟内最多发送1次
    return recentCodes < 1;
  }

  /**
   * 清理过期的验证码
   */
  async cleanupExpiredCodes(): Promise<void> {
    await this.prisma.verificationCode.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }

  /**
   * 生成6位数验证码
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 生成密码重置Token
   */
  async generatePasswordResetToken(email: string): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期

    // 清理该邮箱的旧重置token
    await this.prisma.verificationCode.deleteMany({
      where: {
        target: email.toLowerCase(),
        type: 'EMAIL',
        code: 'PASSWORD_RESET', // 特殊标记
      },
    });

    // 保存重置token
    await this.prisma.verificationCode.create({
      data: {
        type: 'EMAIL',
        target: email.toLowerCase(),
        code: 'PASSWORD_RESET',
        token,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * 验证密码重置Token
   */
  async verifyPasswordResetToken(token: string): Promise<{ email: string; isValid: boolean }> {
    const verification = await this.prisma.verificationCode.findUnique({
      where: { token },
    });

    if (!verification || verification.code !== 'PASSWORD_RESET') {
      return { email: '', isValid: false };
    }

    // 检查是否过期
    if (verification.expiresAt < new Date()) {
      await this.prisma.verificationCode.delete({
        where: { token },
      });
      return { email: '', isValid: false };
    }

    // 检查是否已使用
    if (verification.isUsed) {
      return { email: '', isValid: false };
    }

    return {
      email: verification.target,
      isValid: true,
    };
  }

  /**
   * 标记密码重置Token为已使用
   */
  async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    await this.prisma.verificationCode.update({
      where: { token },
      data: { isUsed: true },
    });
  }
}
