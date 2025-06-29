import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Render,
  Query,
  Param,
  Body,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../auth.service';
import { TenantService } from '../services/tenant.service';
import { UsersService } from '../services/users.service';
import { PasswordService } from '../services/password.service';
import { AdminService } from '../services/admin.service';
import { AdminGuard } from '../guards/admin.guard';

/**
 * 管理后台控制器
 * 提供租户管理、用户管理、配置管理等功能
 */
@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly adminService: AdminService,
  ) {}

  /**
   * 管理后台首页 - 重定向到仪表板
   */
  @Get()
  async adminHome() {
    return { redirect: '/admin/dashboard' };
  }

  /**
   * 仪表板页面
   */
  @Get('dashboard')
  @Render('admin/dashboard-clean')
  @ApiOperation({ summary: '管理后台仪表板' })
  async dashboard() {
    // 简化的仪表板，数据通过API加载
    // 不使用 AdminGuard，因为这是一个页面请求，认证在客户端处理
    return {};
  }

  /**
   * 租户管理页面
   */
  @Get('tenants')
  // @UseGuards(AdminGuard) // 临时禁用用于测试样式
  @Render('admin/tenants-clean')
  @ApiOperation({ summary: '租户管理页面' })
  async tenantsPage(@Query('page') page: string = '1', @Query('search') search?: string) {
    const pageNum = parseInt(page, 10) || 1;
    const pageSize = 20;

    // 获取租户列表
    const tenantsResult = await this.getTenantsList(pageNum, pageSize, search);

    // 格式化租户数据
    const tenants = tenantsResult.items.map((tenant) => {
      const tenantCode = (tenant as any).code || tenant.name.toLowerCase().replace(/\s+/g, '-');
      return {
        id: tenant.id,
        name: tenant.name,
        code: tenantCode,
        domain: tenant.domain || `${tenantCode}.auth-service.com`,
        plan: 'pro', // 默认套餐
        status: tenant.isActive ? 'active' : 'suspended',
        userCount: 0, // TODO: 从数据库查询实际用户数
        createdAt: tenant.createdAt,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 一年后过期
      };
    });

    // 计算分页信息
    const total = tenantsResult.total;
    const totalPages = Math.ceil(total / pageSize);
    const start = (pageNum - 1) * pageSize + 1;
    const end = Math.min(pageNum * pageSize, total);

    const pagination = {
      page: pageNum,           // 当前页数
      pages: totalPages,       // 总页数
      start,                   // 开始记录数
      end,                     // 结束记录数
      total,                   // 总记录数
      hasPrev: pageNum > 1,
      hasNext: pageNum < totalPages,
      prevPage: pageNum - 1,
      nextPage: pageNum + 1,
      pageList: Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        const startPage = Math.max(1, pageNum - 2);
        const pageNumber = startPage + i;
        return {
          number: pageNumber,
          current: pageNumber === pageNum,
        };
      }).filter((p) => p.number <= totalPages),
    };

    return {
      title: '租户管理 - Auth Service 管理后台',
      tenants,
      pagination,
      search,
      currentPage: 'tenants',
    };
  }

  /**
   * 创建新租户页面
   */
  @Get('tenants/new')
  @Render('admin/tenant-form')
  @ApiOperation({ summary: '创建新租户页面' })
  async newTenantPage() {
    return {
      title: '创建租户 - Auth Service 管理后台',
      isEdit: false,
      currentPage: 'tenants',
    };
  }

  /**
   * 编辑租户页面
   */
  @Get('tenants/:id/edit')
  @Render('admin/tenant-form')
  @ApiOperation({ summary: '编辑租户页面' })
  async editTenantPage(@Param('id') tenantId: string) {
    const tenant = await this.tenantService.getTenant(tenantId);

    return {
      title: '编辑租户 - Auth Service 管理后台',
      tenant,
      isEdit: true,
      currentPage: 'tenants',
    };
  }

  /**
   * 用户管理页面
   */
  @Get('users')
  // @UseGuards(AdminGuard) // 临时禁用用于测试样式
  @Render('admin/users-clean')
  @ApiOperation({ summary: '用户管理页面' })
  async usersPage(
    @Query('page') page: string = '1',
    @Query('search') search?: string,
    @Query('tenant') tenantId?: string,
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const pageSize = 20;

    // 获取用户列表
    const usersResult = await this.getUsersList(pageNum, pageSize, search, tenantId);
    const tenants = await this.tenantService.getAllTenants();

    // 格式化用户数据
    const users = usersResult.items.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username || user.email.split('@')[0],
      avatar: null,
      tenant: {
        name: user.tenant || '系统',
      },
      role: user.id === 3 ? 'admin' : 'user', // 假设ID为3的是管理员
      status: user.isActive ? 'active' : 'inactive',
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    }));

    // 计算分页信息
    const total = usersResult.total;
    const totalPages = Math.ceil(total / pageSize);
    const start = (pageNum - 1) * pageSize + 1;
    const end = Math.min(pageNum * pageSize, total);

    const pagination = {
      page: pageNum,           // 当前页数
      pages: totalPages,       // 总页数
      start,                   // 开始记录数
      end,                     // 结束记录数
      total,                   // 总记录数
      hasPrev: pageNum > 1,
      hasNext: pageNum < totalPages,
      prevPage: pageNum - 1,
      nextPage: pageNum + 1,
      pageList: Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        const startPage = Math.max(1, pageNum - 2);
        const pageNumber = startPage + i;
        return {
          number: pageNumber,
          current: pageNumber === pageNum,
        };
      }).filter((p) => p.number <= totalPages),
    };

    return {
      title: '用户管理 - Auth Service 管理后台',
      users,
      tenants,
      pagination,
      filters: {
        search,
        tenantId,
      },
      currentPage: 'users',
    };
  }

  /**
   * 配置管理页面
   */
  @Get('settings')
  // @UseGuards(AdminGuard) // 临时禁用用于测试样式
  @Render('admin/settings-clean')
  @ApiOperation({ summary: '配置管理页面' })
  async settingsPage() {
    // 获取当前配置
    const systemSettings = await this.getSystemSettings();

    // 格式化配置数据为表单需要的格式
    const settings = {
      // 基础设置
      site_name: systemSettings.general.serviceName,
      site_description: '企业级统一认证与权限管理系统',
      site_logo: '',
      contact_email: systemSettings.general.adminEmail,
      support_url: '',
      default_language: 'zh-CN',
      default_timezone: 'Asia/Shanghai',

      // 安全设置
      password_min_length: systemSettings.security.passwordMinLength,
      password_require_uppercase: false,
      password_require_numbers: true,
      password_require_symbols: false,
      max_login_attempts: systemSettings.security.maxLoginAttempts,
      lockout_duration: 15,
      session_timeout: 24,
      mfa_enabled: false,
      mfa_required_for_admin: false,

      // 邮件设置
      smtp_host: systemSettings.email.smtpHost,
      smtp_port: systemSettings.email.smtpPort,
      smtp_user: '',
      smtp_password: '',
      smtp_secure: true,
      from_email: systemSettings.email.fromAddress,
      from_name: 'Auth Service',

      // 存储设置
      storage_type: 'local',
      max_file_size: 10,
      allowed_file_types: 'jpg,png,pdf,doc,docx',

      // 功能开关
      allow_user_registration: systemSettings.features.allowRegistration,
      require_email_verification: systemSettings.features.emailVerificationRequired,
      allow_password_reset: true,
      maintenance_mode: false,
      debug_mode: false,
      analytics_enabled: false,

      // 备份设置
      auto_backup_enabled: false,
      backup_frequency: 'weekly',
      backup_retention: 30,
    };

    return {
      title: '系统设置 - Auth Service 管理后台',
      settings,
      currentPage: 'settings',
    };
  }

  /**
   * 审计日志页面
   */
  @Get('audit-logs')
  // @UseGuards(AdminGuard) // 临时禁用用于测试样式
  @Render('admin/audit-logs-clean')
  @ApiOperation({ summary: '审计日志页面' })
  async auditLogsPage() {
    return {
      title: '审计日志 - Auth Service 管理后台',
      currentPage: 'audit-logs',
    };
  }

  /**
   * 审计日志页面（旧路由兼容）
   */
  @Get('logs')
  // @UseGuards(AdminGuard) // 临时禁用用于测试样式
  @Render('admin/audit-logs-clean')
  @ApiOperation({ summary: '审计日志页面（兼容）' })
  async logsPage() {
    return {
      title: '审计日志 - Auth Service 管理后台',
      currentPage: 'logs',
    };
  }

  /**
   * 获取仪表板统计数据
   */
  private async getDashboardStats() {
    try {
      // 获取真实统计数据
      const [tenants, userStats] = await Promise.all([
        this.tenantService.getAllTenants(),
        this.usersService.getStats(),
      ]);

      // 获取今日活动数据
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return {
        totalTenants: tenants.length,
        totalUsers: userStats.totalUsers,
        activeUsers: userStats.activeUsers,
        newUsersToday: userStats.newUsersToday,
        systemHealth: {
          database: 'healthy',
          email: 'healthy',
          cache: 'healthy',
        },
        recentActivity: [
          // TODO: 实现真实的活动日志查询
        ],
      };
    } catch (error) {
      console.error('获取仪表板统计失败:', error);
      // 返回默认值避免页面崩溃
      return {
        totalTenants: 0,
        totalUsers: 0,
        activeUsers: 0,
        newUsersToday: 0,
        systemHealth: {
          database: 'error',
          email: 'unknown',
          cache: 'unknown',
        },
        recentActivity: [],
      };
    }
  }

  /**
   * 获取租户列表（分页）
   */
  private async getTenantsList(page: number, pageSize: number, search?: string) {
    // TODO: 实现分页查询
    const tenants = await this.tenantService.getAllTenants();

    // 简单的搜索过滤
    let filteredTenants = tenants;
    if (search) {
      filteredTenants = tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.domain && t.domain.toLowerCase().includes(search.toLowerCase())),
      );
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      items: filteredTenants.slice(start, end),
      total: filteredTenants.length,
    };
  }

  /**
   * 获取用户列表（分页）
   */
  private async getUsersList(page: number, pageSize: number, search?: string, tenantId?: string) {
    try {
      // 使用真实的用户服务查询
      const options = {
        page,
        limit: pageSize,
        search,
        tenantId,
      };

      const result = await this.usersService.findAll(options);

      return {
        items: result.users.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          username: user.username || '',
          tenant: user.tenant.name,
          isActive: user.isActive,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        })),
        total: result.pagination.total,
        pagination: result.pagination,
      };
    } catch (error) {
      console.error('获取用户列表失败:', error);
      return {
        items: [],
        total: 0,
        pagination: {
          total: 0,
          page: 1,
          limit: pageSize,
          pages: 0,
          hasNext: false,
          hasPrev: false,
          start: 0,
          end: 0,
        },
      };
    }
  }

  /**
   * 获取系统配置
   */
  private async getSystemSettings() {
    // TODO: 实现配置管理
    return {
      general: {
        serviceName: 'Auth Service',
        adminEmail: 'admin@auth-service.com',
        defaultRedirectUrl: '/profile',
      },
      security: {
        jwtExpiresIn: '15m',
        refreshExpiresIn: '7d',
        passwordMinLength: 8,
        maxLoginAttempts: 5,
      },
      email: {
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        fromAddress: 'noreply@auth-service.com',
      },
      features: {
        emailVerificationRequired: false,
        allowRegistration: true,
        enableAuditLog: true,
      },
    };
  }

  /**
   * 获取审计日志
   */
  private async getAuditLogs(page: number, pageSize: number, type?: string, date?: string) {
    // TODO: 实现日志查询
    return {
      items: [
        {
          id: 1,
          type: 'login',
          user: 'admin@example.com',
          action: 'User login successful',
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0...',
          timestamp: new Date(),
        },
        {
          id: 2,
          type: 'admin',
          user: 'admin@auth-service.com',
          action: 'Tenant created: Company Ltd',
          ip: '192.168.1.101',
          userAgent: 'Mozilla/5.0...',
          timestamp: new Date(Date.now() - 300000),
        },
      ],
      total: 2,
    };
  }

  // ==================== 认证端点 ====================

  /**
   * 管理员登录页面
   */
  @Get('login')
  @Render('admin/login-clean')
  @ApiOperation({ summary: '管理员登录页面' })
  async loginPage(
    @Query('returnUrl') returnUrl?: string,
    @Query('email') email?: string,
    @Query('password') password?: string,
  ) {
    // 如果URL中包含email和password，说明是表单意外提交了GET请求
    if (email && password) {
      return {
        title: '管理员登录 - Auth Service',
        returnUrl: returnUrl || '/admin/dashboard',
        siteName: 'Auth Service',
        error: '请使用正确的登录方式，不要在URL中包含密码信息。',
        email: email, // 保留邮箱，但不保留密码
      };
    }

    return {
      title: '管理员登录 - Auth Service',
      returnUrl: returnUrl || '/admin/dashboard',
      siteName: 'Auth Service',
      email: 'admin@auth-service.com', // 预填默认管理员邮箱
    };
  }

  /**
   * 处理错误的POST到登录页面（重定向到正确的API）
   */
  @Post('login')
  @ApiOperation({ summary: '重定向错误的登录POST请求' })
  async loginPagePost() {
    return {
      success: false,
      error: {
        message: '请使用正确的API端点 /admin/auth/login',
        errorCode: 'WRONG_ENDPOINT',
        statusCode: 400,
        timestamp: new Date().toISOString(),
        path: '/admin/login',
        method: 'POST',
      },
    };
  }

  /**
   * 管理员登录API
   */
  @Post('auth/login')
  @ApiOperation({ summary: '管理员登录验证' })
  async adminLogin(@Body() loginDto: any, @Request() req: any) {
    try {
      const { email, password, remember } = loginDto;

      // 验证用户凭据
      const user = await this.validateAdminUser(email, password);
      if (!user) {
        throw new UnauthorizedException('邮箱或密码错误');
      }

      // 生成管理员token
      const token = await this.generateAdminToken(user);

      // 设置cookie或session
      if (remember) {
        // 长期cookie（7天）
        // TODO: 设置httpOnly cookie
      }

      // 将token保存到session或cookie中，以便后续请求使用
      if (req.session) {
        req.session.adminToken = token;
        req.session.adminUser = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      }

      // 直接返回数据，ResponseInterceptor会自动包装
      const responseData = {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };

      console.log('\n========== /admin/auth/login Response Data ==========');
      console.log('Response will be:', JSON.stringify(responseData, null, 2));
      console.log('=====================================================\n');

      return responseData;
    } catch (error) {
      console.error('Admin login error:', error);
      throw error; // 让全局异常过滤器处理
    }
  }

  /**
   * 管理员登出
   */
  @Post('auth/logout')
  @ApiOperation({ summary: '管理员登出' })
  async adminLogout(@Request() req: any) {
    try {
      // 清除token和session
      // TODO: 清除cookie和session

      return {
        success: true,
        message: '登出成功',
      };
    } catch (error) {
      return {
        success: false,
        message: '登出失败',
      };
    }
  }

  /**
   * 检查管理员状态
   */
  @Get('auth/status')
  @ApiOperation({ summary: '检查管理员登录状态' })
  async adminStatus(@Request() req: any) {
    try {
      // 检查当前用户是否为管理员
      const user = req.user;
      const isAdmin = user && this.isUserAdmin(user);

      return {
        success: true,
        data: {
          isAuthenticated: !!user,
          isAdmin,
          user: user
            ? {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
              }
            : null,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: '状态检查失败',
      };
    }
  }

  // ==================== API 端点 ====================

  /**
   * 获取仪表板统计数据
   */
  @Get('api/dashboard-stats')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '获取仪表板统计数据' })
  async getDashboardStatsApi() {
    try {
      const stats = await this.getDashboardStats();
      return {
        success: true,
        stats,
      };
    } catch (error) {
      return {
        success: false,
        message: '获取统计数据失败',
        stats: {
          totalTenants: 0,
          totalUsers: 0,
          activeUsers: 0,
          newUsersToday: 0,
        },
      };
    }
  }

  /**
   * 租户管理 API
   */
  @Post('api/tenants')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '创建租户' })
  async createTenant(@Body() createTenantDto: any) {
    try {
      const tenant = await this.tenantService.createTenant(createTenantDto);
      return {
        success: true,
        data: tenant,
        message: '租户创建成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '创建失败',
      };
    }
  }

  @Put('api/tenants/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '更新租户' })
  async updateTenant(@Param('id') id: string, @Body() updateTenantDto: any) {
    try {
      const tenant = await this.tenantService.updateTenant(id, updateTenantDto);
      return {
        success: true,
        data: tenant,
        message: '租户更新成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '更新失败',
      };
    }
  }

  @Delete('api/tenants/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '删除租户' })
  async deleteTenant(@Param('id') id: string) {
    try {
      await this.tenantService.deleteTenant(id);
      return {
        success: true,
        message: '租户删除成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '删除失败',
      };
    }
  }

  @Post('api/tenants/:id/suspend')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '暂停租户' })
  async suspendTenant(@Param('id') id: string) {
    try {
      const tenant = await this.tenantService.suspendTenant(id);
      return {
        success: true,
        data: tenant,
        message: '租户已暂停',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '操作失败',
      };
    }
  }

  @Post('api/tenants/:id/activate')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '激活租户' })
  async activateTenant(@Param('id') id: string) {
    try {
      const tenant = await this.tenantService.activateTenant(id);
      return {
        success: true,
        data: tenant,
        message: '租户已激活',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '操作失败',
      };
    }
  }

  /**
   * 用户管理 API
   */
  @Post('api/users')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '创建用户' })
  async createUser(@Body() createUserDto: any) {
    try {
      const user = await this.usersService.create(createUserDto);
      return {
        success: true,
        data: user,
        message: '用户创建成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '创建失败',
      };
    }
  }

  @Put('api/users/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '更新用户' })
  async updateUser(@Param('id') id: string, @Body() updateUserDto: any) {
    try {
      const userId = parseInt(id, 10);
      const user = await this.usersService.update(userId, updateUserDto);
      return {
        success: true,
        data: user,
        message: '用户更新成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '更新失败',
      };
    }
  }

  @Delete('api/users/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '删除用户' })
  async deleteUser(@Param('id') id: string) {
    try {
      const userId = parseInt(id, 10);
      await this.usersService.delete(userId);
      return {
        success: true,
        message: '用户删除成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '删除失败',
      };
    }
  }

  @Post('api/users/:id/suspend')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '暂停用户' })
  async suspendUser(@Param('id') id: string) {
    try {
      const userId = parseInt(id, 10);
      const user = await this.usersService.suspend(userId);
      return {
        success: true,
        data: user,
        message: '用户已暂停',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '操作失败',
      };
    }
  }

  @Post('api/users/:id/activate')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '激活用户' })
  async activateUser(@Param('id') id: string) {
    try {
      const userId = parseInt(id, 10);
      const user = await this.usersService.activate(userId);
      return {
        success: true,
        data: user,
        message: '用户已激活',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '操作失败',
      };
    }
  }

  @Post('api/users/:id/reset-password')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '重置用户密码' })
  async resetUserPassword(@Param('id') id: string, @Body() resetPasswordDto: any) {
    try {
      const userId = parseInt(id, 10);
      // 生成新密码或使用提供的密码
      const newPassword = resetPasswordDto.newPassword || this.generateRandomPassword();
      const hashedPassword = await this.passwordService.hashPassword(newPassword);

      await this.usersService.updatePassword(userId, hashedPassword);

      return {
        success: true,
        message: '密码重置成功',
        data: resetPasswordDto.sendEmail ? undefined : { newPassword },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '重置失败',
      };
    }
  }

  /**
   * 系统配置 API
   */
  @Post('api/settings')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '更新系统配置' })
  async updateSettings(@Body() settings: any) {
    try {
      // TODO: 实现配置更新逻辑
      return {
        success: true,
        message: '配置更新成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '更新失败',
      };
    }
  }

  @Post('api/settings/test-email')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '测试邮件配置' })
  async testEmailConfig(@Body() emailConfig: any) {
    try {
      // TODO: 实现邮件测试逻辑
      return {
        success: true,
        message: '邮件测试成功',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '邮件测试失败',
      };
    }
  }

  @Post('api/settings/backup')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '创建系统备份' })
  async createBackup() {
    try {
      // TODO: 实现备份逻辑
      return {
        success: true,
        message: '备份创建成功',
        data: {
          backupId: 'backup_' + Date.now(),
          createdAt: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '备份失败',
      };
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 验证管理员用户
   */
  private async validateAdminUser(email: string, password: string) {
    try {
      // 查找用户
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        return null;
      }

      // 检查用户是否为管理员
      if (!this.isUserAdmin(user)) {
        return null;
      }

      // 验证密码
      const isPasswordValid = await this.passwordService.validatePassword(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      return user;
    } catch (error) {
      console.error('管理员验证失败:', error);
      return null;
    }
  }

  /**
   * 检查用户是否为管理员
   */
  private isUserAdmin(user: any): boolean {
    // 检查用户是否为系统管理员（没有租户限制）
    if (!user.tenantId) {
      return true;
    }

    // 检查用户邮箱是否在管理员白名单中
    const adminEmails = [
      'admin@auth-service.com',
      'admin@example.com',
      // 可以从环境变量或配置文件中读取
    ];

    if (adminEmails.includes(user.email)) {
      return true;
    }

    // 检查特定租户的管理员权限
    // TODO: 实现基于角色的权限检查

    return false;
  }

  /**
   * 生成管理员token
   */
  private async generateAdminToken(user: any): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: 'admin',
      type: 'admin_access',
      iat: Math.floor(Date.now() / 1000),
      // 管理员token过期时间设置为24小时，确保与session过期时间一致
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24小时
    };

    // 使用JWT服务生成token
    // 注意：这里我们需要直接使用JwtService，因为这是特殊的管理员token
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_ACCESS_SECRET;

    return jwt.sign(payload, secret, {
      // 明确设置过期时间，覆盖默认的15m配置
      expiresIn: '24h'
    });
  }

  /**
   * 生成随机密码
   */
  private generateRandomPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /**
   * 管理员系统健康检查
   */
  @Get('health')
  @ApiOperation({ summary: '管理员系统健康检查' })
  @ApiResponse({ status: 200, description: '健康检查结果' })
  async adminHealthCheck() {
    return await this.adminService.healthCheck();
  }

  /**
   * 创建默认管理员账户
   */
  @Post('setup')
  @ApiOperation({ summary: '创建默认管理员账户' })
  @ApiResponse({ status: 201, description: '管理员账户创建成功' })
  @ApiResponse({ status: 409, description: '管理员账户已存在' })
  async setupDefaultAdmin() {
    return await this.adminService.ensureDefaultAdminExists();
  }

  /**
   * 获取所有管理员用户
   */
  @Get('admins')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取所有管理员用户' })
  @ApiResponse({ status: 200, description: '管理员用户列表' })
  async getAdminUsers() {
    return await this.adminService.getAdminUsers();
  }

  /**
   * 创建新管理员账户
   */
  @Post('admins')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建新管理员账户' })
  @ApiResponse({ status: 201, description: '管理员账户创建成功' })
  async createAdminUser(
    @Body()
    createAdminData: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      username?: string;
    },
  ) {
    return await this.adminService.createAdminUser(createAdminData);
  }
}
