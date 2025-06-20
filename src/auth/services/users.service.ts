import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class UsersService {
  constructor(private database: DatabaseService) {}

  async findOne(id: string) {
    const user = await this.database.user.findUnique({
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

  async findByEmail(email: string) {
    return this.database.user.findUnique({
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
    const total = await this.database.user.count({ where });

    // 获取数据
    const users = await this.database.user.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            code: true,
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
    firstName: string;
    lastName: string;
    tenantId: string;
    role?: string;
    phone?: string;
  }) {
    return this.database.user.create({
      data: {
        ...userData,
        role: userData.role || 'user',
        isActive: true,
        isEmailVerified: false,
      },
      include: {
        tenant: true,
      },
    });
  }

  async update(id: string, updateData: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    role: string;
    isActive: boolean;
    isEmailVerified: boolean;
  }>) {
    return this.database.user.update({
      where: { id },
      data: updateData,
      include: {
        tenant: true,
      },
    });
  }

  async updatePassword(id: string, hashedPassword: string) {
    return this.database.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  async delete(id: string) {
    // 删除用户及相关数据
    await this.database.$transaction([
      // 删除用户会话
      this.database.userSession.deleteMany({
        where: { userId: id },
      }),
      // 删除验证码
      this.database.verificationCode.deleteMany({
        where: { email: { in: [await this.getUserEmail(id)] } },
      }),
      // 删除用户
      this.database.user.delete({
        where: { id },
      }),
    ]);

    return { success: true };
  }

  async suspend(id: string) {
    return this.update(id, { isActive: false });
  }

  async activate(id: string) {
    return this.update(id, { isActive: true });
  }

  async getStats() {
    const [totalUsers, activeUsers, newUsersToday] = await Promise.all([
      // 总用户数
      this.database.user.count(),
      
      // 活跃用户数
      this.database.user.count({
        where: { isActive: true },
      }),
      
      // 今日新增用户
      this.database.user.count({
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

  async getUserSessions(userId: string) {
    return this.database.userSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async revokeUserSessions(userId: string) {
    return this.database.userSession.deleteMany({
      where: { userId },
    });
  }

  private async getUserEmail(id: string): Promise<string> {
    const user = await this.database.user.findUnique({
      where: { id },
      select: { email: true },
    });
    return user?.email || '';
  }
}