import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from '../services/tenant.service';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { Permissions } from '../decorators/permissions.decorator';
import {
  CreateTenantDto,
  CreateApiKeyDto,
  TenantResponseDto,
  ApiKeyResponseDto,
} from '../dto/tenant.dto';

@ApiTags('tenant')
@Controller('tenant')
@UseGuards(ApiKeyGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({ summary: '创建新租户' })
  @ApiResponse({ status: 201, description: '租户创建成功', type: TenantResponseDto })
  @ApiResponse({ status: 409, description: '域名已存在' })
  @Permissions('tenant:create')
  async createTenant(@Body() createTenantDto: CreateTenantDto): Promise<TenantResponseDto> {
    return this.tenantService.createTenant(createTenantDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取租户信息' })
  @ApiResponse({ status: 200, description: '获取成功', type: TenantResponseDto })
  @ApiResponse({ status: 404, description: '租户不存在' })
  @Permissions('tenant:read')
  async getTenant(@Param('id') tenantId: string): Promise<TenantResponseDto> {
    return this.tenantService.getTenant(tenantId);
  }

  @Get()
  @ApiOperation({ summary: '获取当前租户信息' })
  @ApiResponse({ status: 200, description: '获取成功', type: TenantResponseDto })
  @Permissions('tenant:read')
  async getCurrentTenant(@Request() req: any): Promise<TenantResponseDto> {
    return this.tenantService.getTenant(req.tenant.id);
  }

  @Post('api-keys')
  @ApiOperation({ summary: '创建 API Key' })
  @ApiResponse({ status: 201, description: 'API Key 创建成功', type: ApiKeyResponseDto })
  @Permissions('tenant:manage')
  async createApiKey(
    @Request() req: any,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    return this.tenantService.createApiKey(req.tenant.id, createApiKeyDto);
  }

  @Get('api-keys')
  @ApiOperation({ summary: '获取租户的 API Keys' })
  @ApiResponse({ status: 200, description: '获取成功', type: [ApiKeyResponseDto] })
  @Permissions('tenant:read')
  async getApiKeys(@Request() req: any): Promise<ApiKeyResponseDto[]> {
    return this.tenantService.getApiKeys(req.tenant.id);
  }

  @Delete('api-keys/:id')
  @ApiOperation({ summary: '删除 API Key' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: 'API Key 不存在' })
  @Permissions('tenant:manage')
  async deleteApiKey(
    @Request() req: any,
    @Param('id') apiKeyId: string,
  ): Promise<{ message: string }> {
    return this.tenantService.deleteApiKey(req.tenant.id, apiKeyId);
  }
}
