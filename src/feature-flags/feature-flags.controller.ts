import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FeatureFlagsService, FeatureFlag } from './feature-flags.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';

@ApiTags('功能开关管理')
@Controller('feature-flags')
@UseGuards(AdminGuard)
@ApiBearerAuth()
export class FeatureFlagsController {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取所有功能开关状态' })
  @ApiResponse({ status: 200, description: '返回所有功能开关列表' })
  async getAllFlags(@Query('tenantId') tenantId?: string) {
    const flags = await this.featureFlagsService.getAllFlags(tenantId);
    return {
      success: true,
      data: flags,
    };
  }

  @Get('categories')
  @ApiOperation({ summary: '按分类获取功能开关' })
  @ApiResponse({ status: 200, description: '返回按分类组织的功能开关' })
  async getFlagsByCategory(@Query('tenantId') tenantId?: string) {
    const flagsByCategory = await this.featureFlagsService.getFlagsByCategory(tenantId);
    return {
      success: true,
      data: flagsByCategory,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: '获取功能开关统计信息' })
  @ApiResponse({ status: 200, description: '返回统计信息' })
  async getStats() {
    const stats = await this.featureFlagsService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get(':flag')
  @ApiOperation({ summary: '检查特定功能是否启用' })
  @ApiResponse({ status: 200, description: '返回功能启用状态' })
  async checkFlag(
    @Param('flag') flag: FeatureFlag,
    @Query('tenantId') tenantId?: string,
  ) {
    const enabled = await this.featureFlagsService.isEnabled(flag, tenantId);
    return {
      success: true,
      data: {
        flag,
        enabled,
        tenantId: tenantId || null,
      },
    };
  }

  @Put(':flag')
  @ApiOperation({ summary: '设置功能开关状态' })
  @ApiResponse({ status: 200, description: '功能开关状态已更新' })
  async setFlag(
    @Param('flag') flag: FeatureFlag,
    @Body() body: { enabled: boolean; tenantId?: string },
  ) {
    const modifiedBy = 'admin'; // TODO: 从JWT中获取用户信息

    await this.featureFlagsService.setFlag(
      flag,
      body.enabled,
      modifiedBy,
      body.tenantId,
    );

    // 记录审计日志
    await this.auditService.log({
      tenantId: body.tenantId || 'system',
      action: AuditAction.ADMIN_CONFIG_CHANGE,
      resource: 'feature_flag',
      resourceId: flag,
      description: `功能开关 ${flag} ${body.enabled ? '启用' : '禁用'}`,
      details: {
        flag,
        enabled: body.enabled,
        modifiedBy,
        tenantId: body.tenantId,
      },
      success: true,
    });

    return {
      success: true,
      message: `功能开关 ${flag} 已${body.enabled ? '启用' : '禁用'}`,
    };
  }

  @Post('batch')
  @ApiOperation({ summary: '批量设置功能开关' })
  @ApiResponse({ status: 200, description: '批量操作完成' })
  async setBatchFlags(
    @Body()
    body: {
      flags: Array<{ flag: FeatureFlag; enabled: boolean }>;
      tenantId?: string;
    },
  ) {
    const modifiedBy = 'admin'; // TODO: 从JWT中获取用户信息

    await this.featureFlagsService.setFlags(
      body.flags,
      modifiedBy,
      body.tenantId,
    );

    // 记录审计日志
    await this.auditService.log({
      tenantId: body.tenantId || 'system',
      action: AuditAction.ADMIN_CONFIG_CHANGE,
      resource: 'feature_flags_batch',
      description: `批量修改 ${body.flags.length} 个功能开关`,
      details: {
        flags: body.flags,
        modifiedBy,
        tenantId: body.tenantId,
      },
      success: true,
    });

    return {
      success: true,
      message: `已成功修改 ${body.flags.length} 个功能开关`,
    };
  }

  @Post('reset')
  @ApiOperation({ summary: '重置功能开关为默认值' })
  @ApiResponse({ status: 200, description: '重置完成' })
  async resetToDefaults(@Body() body: { tenantId?: string }) {
    await this.featureFlagsService.resetToDefaults(body.tenantId);

    // 记录审计日志
    await this.auditService.log({
      tenantId: body.tenantId || 'system',
      action: AuditAction.ADMIN_CONFIG_CHANGE,
      resource: 'feature_flags_reset',
      description: '重置所有功能开关为默认值',
      details: {
        tenantId: body.tenantId,
        modifiedBy: 'admin',
      },
      success: true,
    });

    return {
      success: true,
      message: '功能开关已重置为默认值',
    };
  }

  @Post('refresh-cache')
  @ApiOperation({ summary: '刷新功能开关缓存' })
  @ApiResponse({ status: 200, description: '缓存已刷新' })
  @HttpCode(HttpStatus.OK)
  async refreshCache() {
    await this.featureFlagsService.refreshCache();

    return {
      success: true,
      message: '功能开关缓存已刷新',
    };
  }

  @Get('preview/:flag')
  @ApiOperation({ summary: '预览功能开关更改的影响' })
  @ApiResponse({ status: 200, description: '返回影响分析' })
  async previewFlagChange(
    @Param('flag') flag: FeatureFlag,
    @Query('enabled') enabled: boolean,
    @Query('tenantId') tenantId?: string,
  ) {
    // 获取当前状态
    const currentStatus = await this.featureFlagsService.isEnabled(flag, tenantId);
    
    // 获取所有相关的功能开关
    const allFlags = await this.featureFlagsService.getAllFlags(tenantId);
    
    // 找出依赖此功能的其他功能
    const dependentFlags = allFlags.filter(f => 
      f.dependencies?.includes(flag)
    );
    
    // 如果要禁用，检查会影响哪些依赖功能
    const affectedFlags = enabled ? [] : dependentFlags.filter(f => f.enabled);

    return {
      success: true,
      data: {
        flag,
        currentStatus,
        newStatus: enabled,
        willChange: currentStatus !== enabled,
        affectedFlags: affectedFlags.map(f => ({
          flag: f.flag,
          description: f.description,
          willBeDisabled: !enabled,
        })),
        warning: affectedFlags.length > 0 ? 
          `禁用此功能将影响 ${affectedFlags.length} 个相关功能` : null,
      },
    };
  }
}