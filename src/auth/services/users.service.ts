import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  async findByEmail(email: string, tenantId?: string) {
    if (tenantId) {
      return this.prisma.user.findUnique({
        where: { 
          tenantId_email: {
            tenantId,
            email,
          }
        },
        include: {
          tenant: true,
        },
      });
    }
    
    // 如果没有tenantId，使用findFirst
    return this.prisma.user.findFirst({
      where: { email },
      include: {
        tenant: true,
      },
    });
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    search?: string;
    tenantId?: string;
    role?: string;
    status?: string;
  } = {}) {
    const { page = 1, limit = 10, search, tenantId, role, status } = options;
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.isActive = status === 'active';
    }

    // 获取总数
    const total = await this.prisma.user.count({ where });

    // 获取数据
    const users = await this.prisma.user.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
        start: skip + 1,
        end: Math.min(skip + limit, total),
      },
    };
  }

  async create(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    tenantId: string;
    username?: string;
    phoneNumber?: string;
  }) {
    return this.prisma.user.create({
      data: {
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
        phoneNumber: userData.phoneNumber,
        tenantId: userData.tenantId,
        isActive: true,
        isVerified: false,
      },
      include: {
        tenant: true,
      },
    });
  }

  async update(id: number, updateData: Partial<{
    firstName: string;
    lastName: string;
    phoneNumber: string;
    username: string;
    isActive: boolean;
    isVerified: boolean;
  }>) {
    return this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        tenant: true,
      },
    });
  }

  async updatePassword(id: number, hashedPassword: string) {
    return this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  async delete(id: number) {
    // 删除用户及相关数据
    await this.prisma.$transaction([
      // 删除用户会话
      this.prisma.userSession.deleteMany({
        where: { userId: id },
      }),
      // 删除验证码（基于用户邮箱）
      this.prisma.verificationCode.deleteMany({
        where: { target: await this.getUserEmail(id) },
      }),
      // 删除用户
      this.prisma.user.delete({
        where: { id },
      }),
    ]);

    return { success: true };
  }

  async suspend(id: number) {
    return this.update(id, { isActive: false });
  }

  async activate(id: number) {
    return this.update(id, { isActive: true });
  }

  async getStats() {
    const [totalUsers, activeUsers, newUsersToday] = await Promise.all([
      // 总用户数
      this.prisma.user.count(),
      
      // 活跃用户数
      this.prisma.user.count({
        where: { isActive: true },
      }),
      
      // 今日新增用户
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      newUsersToday,
      inactiveUsers: totalUsers - activeUsers,
    };
  }

  async getTenantUsers(tenantId: string, options: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}) {
    return this.findAll({
      ...options,
      tenantId,
    });
  }

  async getUserSessions(userId: number) {
    return this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async revokeUserSessions(userId: number) {
    return this.prisma.userSession.deleteMany({
      where: { userId },
    });
  }

  private async getUserEmail(id: number): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { email: true },
    });
    return user?.email || '';
  }
}