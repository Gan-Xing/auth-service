import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { AlertService } from './alert.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { MetricType, AlertType, AlertSeverity } from '@prisma/client';

@ApiTags('监控系统')
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly alertService: AlertService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: '系统健康检查' })
  @ApiResponse({ status: 200, description: '返回系统健康状态' })
  @HttpCode(HttpStatus.OK)
  async getSystemHealth() {
    const health = await this.monitoringService.getSystemHealth();
    return {
      success: true,
      data: health,
    };
  }

  @Get('metrics')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取系统指标统计' })
  @ApiResponse({ status: 200, description: '返回指标统计数据' })
  async getMetricsStats(
    @Query('metricType') metricType?: MetricType,
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const stats = await this.monitoringService.getMetricsStats(
      metricType,
      tenantId,
      start,
      end,
    );

    return {
      success: true,
      data: stats,
    };
  }

  @Get('alerts')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取活跃告警列表' })
  @ApiResponse({ status: 200, description: '返回活跃告警列表' })
  async getActiveAlerts(@Query('tenantId') tenantId?: string) {
    const alerts = await this.alertService.getActiveAlerts(tenantId);
    return {
      success: true,
      data: alerts,
    };
  }

  @Get('alerts/stats')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取告警统计' })
  @ApiResponse({ status: 200, description: '返回告警统计数据' })
  async getAlertStats(@Query('tenantId') tenantId?: string) {
    const stats = await this.alertService.getAlertStats(tenantId);
    return {
      success: true,
      data: stats,
    };
  }

  @Post('alerts/:id/resolve')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '解决告警' })
  @ApiResponse({ status: 200, description: '告警已解决' })
  async resolveAlert(
    @Param('id') alertId: string,
    @Body() body: { resolvedBy: string; resolution: string },
  ) {
    await this.alertService.resolveAlert(
      alertId,
      body.resolvedBy,
      body.resolution,
    );

    return {
      success: true,
      message: '告警已解决',
    };
  }

  @Post('alerts/:id/acknowledge')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '确认告警' })
  @ApiResponse({ status: 200, description: '告警已确认' })
  async acknowledgeAlert(
    @Param('id') alertId: string,
    @Body() body: { acknowledgedBy: string },
  ) {
    await this.alertService.acknowledgeAlert(alertId, body.acknowledgedBy);

    return {
      success: true,
      message: '告警已确认',
    };
  }

  @Post('alerts/:id/suppress')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '抑制告警' })
  @ApiResponse({ status: 200, description: '告警已抑制' })
  async suppressAlert(
    @Param('id') alertId: string,
    @Body() body: { suppressedBy: string },
  ) {
    await this.alertService.suppressAlert(alertId, body.suppressedBy);

    return {
      success: true,
      message: '告警已抑制',
    };
  }

  @Post('alerts/test')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建测试告警' })
  @ApiResponse({ status: 200, description: '测试告警已创建' })
  async createTestAlert(
    @Body()
    body: {
      alertType: AlertType;
      severity: AlertSeverity;
      title: string;
      message: string;
    },
  ) {
    await this.alertService.createAlert({
      alertType: body.alertType,
      severity: body.severity,
      title: body.title,
      message: body.message,
      details: {
        test: true,
        createdBy: 'admin',
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      message: '测试告警已创建',
    };
  }

  @Get('dashboard')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取监控仪表板数据' })
  @ApiResponse({ status: 200, description: '返回仪表板数据' })
  async getDashboardData(@Query('tenantId') tenantId?: string) {
    const [health, alertStats, metricsStats] = await Promise.all([
      this.monitoringService.getSystemHealth(),
      this.alertService.getAlertStats(tenantId),
      this.monitoringService.getMetricsStats(undefined, tenantId),
    ]);

    return {
      success: true,
      data: {
        health,
        alerts: alertStats,
        metrics: metricsStats,
        timestamp: new Date(),
      },
    };
  }

  @Get('status')
  @ApiOperation({ summary: '简单状态检查' })
  @ApiResponse({ status: 200, description: '服务状态正常' })
  @HttpCode(HttpStatus.OK)
  async getStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'auth-service',
      version: process.env.npm_package_version || '1.0.0',
    };
  }
}