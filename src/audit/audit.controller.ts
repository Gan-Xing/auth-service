import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseEnumPipe,
  Optional,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuditAction } from '@prisma/client';

@ApiTags('Audit Logs')
@Controller('admin/audit')
@UseGuards(AdminGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: '获取审计日志列表' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  @ApiQuery({ name: 'userId', required: false, description: '用户ID' })
  @ApiQuery({ name: 'action', required: false, enum: AuditAction, description: '操作类型' })
  @ApiQuery({ name: 'resource', required: false, description: '资源类型' })
  @ApiQuery({ name: 'startDate', required: false, description: '开始日期 (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: '结束日期 (ISO string)' })
  @ApiQuery({ name: 'limit', required: false, description: '返回数量限制', type: Number })
  @ApiQuery({ name: 'offset', required: false, description: '偏移量', type: Number })
  @ApiResponse({ status: 200, description: '审计日志列表' })
  async getLogs(
    @Query('tenantId') tenantId?: string,
    @Query('userId', new DefaultValuePipe(0), ParseIntPipe) userId?: number,
    @Query('action') action?: AuditAction,
    @Query('resource') resource?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    const params: any = {
      limit,
      offset,
    };

    if (tenantId) params.tenantId = tenantId;
    if (userId && userId > 0) params.userId = userId;
    if (action) params.action = action;
    if (resource) params.resource = resource;
    if (startDate) params.startDate = new Date(startDate);
    if (endDate) params.endDate = new Date(endDate);

    return await this.auditService.getAuditLogs(params);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取审计统计信息' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  @ApiQuery({ name: 'days', required: false, description: '统计天数', type: Number })
  @ApiResponse({ status: 200, description: '审计统计信息' })
  async getStats(
    @Query('tenantId') tenantId?: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days?: number,
  ) {
    return await this.auditService.getAuditStats(tenantId, days);
  }

  @Get('actions')
  @ApiOperation({ summary: '获取所有可用的审计操作类型' })
  @ApiResponse({ status: 200, description: '操作类型列表' })
  getActions() {
    const actions = Object.values(AuditAction).map(action => ({
      value: action,
      label: this.getActionLabel(action),
      category: this.getActionCategory(action),
    }));

    const categories = [...new Set(actions.map(a => a.category))];

    return {
      actions,
      categories,
      groupedActions: categories.reduce((acc, category) => {
        acc[category] = actions.filter(a => a.category === category);
        return acc;
      }, {} as Record<string, typeof actions>),
    };
  }

  private getActionLabel(action: AuditAction): string {
    const labels: Record<AuditAction, string> = {
      // 认证相关
      AUTH_LOGIN_SUCCESS: '登录成功',
      AUTH_LOGIN_FAILED: '登录失败',
      AUTH_LOGOUT: '登出',
      AUTH_REGISTER: '用户注册',
      AUTH_PASSWORD_RESET_REQUEST: '密码重置请求',
      AUTH_PASSWORD_RESET_SUCCESS: '密码重置成功',
      AUTH_PASSWORD_CHANGE: '密码修改',
      AUTH_EMAIL_VERIFICATION: '邮箱验证',
      AUTH_OAUTH_LOGIN: '第三方登录',

      // 用户管理
      USER_CREATE: '创建用户',
      USER_UPDATE: '更新用户',
      USER_DELETE: '删除用户',
      USER_ACTIVATE: '激活用户',
      USER_DEACTIVATE: '停用用户',
      USER_ROLE_CHANGE: '角色变更',

      // 租户管理
      TENANT_CREATE: '创建租户',
      TENANT_UPDATE: '更新租户',
      TENANT_DELETE: '删除租户',
      TENANT_ACTIVATE: '激活租户',
      TENANT_DEACTIVATE: '停用租户',

      // API Key 管理
      APIKEY_CREATE: '创建API Key',
      APIKEY_UPDATE: '更新API Key',
      APIKEY_DELETE: '删除API Key',
      APIKEY_REGENERATE: '重新生成API Key',

      // 管理员操作
      ADMIN_ACCESS: '管理员访问',
      ADMIN_CONFIG_CHANGE: '配置变更',
      ADMIN_USER_IMPERSONATE: '用户模拟',

      // 系统操作
      SYSTEM_BACKUP: '系统备份',
      SYSTEM_RESTORE: '系统恢复',
      SYSTEM_MAINTENANCE: '系统维护',

      // 安全事件
      SECURITY_BREACH_ATTEMPT: '安全攻击尝试',
      SECURITY_SUSPICIOUS_ACTIVITY: '可疑活动',
      SECURITY_RATE_LIMIT_EXCEEDED: '速率限制超出',
    };

    return labels[action] || action;
  }

  private getActionCategory(action: AuditAction): string {
    if (action.startsWith('AUTH_')) return '认证';
    if (action.startsWith('USER_')) return '用户管理';
    if (action.startsWith('TENANT_')) return '租户管理';
    if (action.startsWith('APIKEY_')) return 'API管理';
    if (action.startsWith('ADMIN_')) return '管理员操作';
    if (action.startsWith('SYSTEM_')) return '系统操作';
    if (action.startsWith('SECURITY_')) return '安全事件';
    return '其他';
  }
}