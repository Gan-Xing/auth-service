import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from './password.service';
import {
  CreateTenantDto,
  CreateApiKeyDto,
  TenantResponseDto,
  ApiKeyResponseDto,
} from '../dto/tenant.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * 创建新租户
   */
  async createTenant(createTenantDto: CreateTenantDto): Promise<TenantResponseDto> {
    const { name, domain } = createTenantDto;

    // 检查域名是否已存在
    if (domain) {
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { domain },
      });

      if (existingTenant) {
        throw new ConflictException('该域名已被使用');
      }
    }

    // 创建租户
    const tenant = await this.prisma.tenant.create({
      data: {
        name,
        domain,
      },
    });

    return {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      apiKey: tenant.apiKey,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  /**
   * 获取所有租户列表
   */
  async getAllTenants(): Promise<TenantResponseDto[]> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    return tenants.map(tenant => ({
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      apiKey: tenant.apiKey,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    }));
  }

  /**
   * 获取租户信息
   */
  async getTenant(tenantId: string): Promise<TenantResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      apiKey: tenant.apiKey,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  /**
   * 创建 API Key
   */
  async createApiKey(
    tenantId: string,
    createApiKeyDto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    const { name, permissions, expiresAt } = createApiKeyDto;

    // 验证租户存在
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    // 生成 API Key
    const apiKey = uuidv4();
    const keyHash = await this.passwordService.hashPassword(apiKey);

    // 创建 API Key 记录
    const apiKeyRecord = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name,
        keyHash,
        permissions,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      permissions: apiKeyRecord.permissions,
      isActive: apiKeyRecord.isActive,
      expiresAt: apiKeyRecord.expiresAt,
      lastUsedAt: apiKeyRecord.lastUsedAt,
      createdAt: apiKeyRecord.createdAt,
      key: apiKey, // 只在创建时返回明文 API Key
    };
  }

  /**
   * 获取租户的 API Keys
   */
  async getApiKeys(tenantId: string): Promise<ApiKeyResponseDto[]> {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map((apiKey) => ({
      id: apiKey.id,
      name: apiKey.name,
      permissions: apiKey.permissions,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      // 不返回明文 API Key
    }));
  }

  /**
   * 删除 API Key
   */
  async deleteApiKey(tenantId: string, apiKeyId: string): Promise<{ message: string }> {
    // 验证 API Key 属于该租户
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, tenantId },
    });

    if (!apiKey) {
      throw new NotFoundException('API Key 不存在');
    }

    await this.prisma.apiKey.delete({
      where: { id: apiKeyId },
    });

    return { message: 'API Key 删除成功' };
  }

  /**
   * 通过域名获取租户
   */
  async getTenantByDomain(domain: string): Promise<TenantResponseDto | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { domain },
    });

    if (!tenant) {
      return null;
    }

    return {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      apiKey: tenant.apiKey,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  /**
   * 通过主 API Key 获取租户
   */
  async getTenantByApiKey(apiKey: string): Promise<TenantResponseDto | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { apiKey },
    });

    if (!tenant || !tenant.isActive) {
      return null;
    }

    return {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      apiKey: tenant.apiKey,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  /**
   * 更新租户信息
   */
  async updateTenant(tenantId: string, updateData: Partial<CreateTenantDto>): Promise<TenantResponseDto> {
    const { name, domain } = updateData;

    // 检查租户是否存在
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!existingTenant) {
      throw new NotFoundException('租户不存在');
    }

    // 如果更新域名，检查是否已被使用
    if (domain && domain !== existingTenant.domain) {
      const domainExists = await this.prisma.tenant.findUnique({
        where: { domain },
      });

      if (domainExists) {
        throw new ConflictException('该域名已被使用');
      }
    }

    // 更新租户
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name && { name }),
        ...(domain !== undefined && { domain }),
      },
    });

    return {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      apiKey: tenant.apiKey,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  /**
   * 删除租户
   */
  async deleteTenant(tenantId: string): Promise<{ message: string }> {
    // 检查租户是否存在
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!existingTenant) {
      throw new NotFoundException('租户不存在');
    }

    // 删除租户（级联删除相关数据）
    await this.prisma.tenant.delete({
      where: { id: tenantId },
    });

    return {
      message: '租户删除成功',
    };
  }

  /**
   * 暂停租户
   */
  async suspendTenant(tenantId: string): Promise<TenantResponseDto> {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive: false },
    });

    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      apiKey: tenant.apiKey,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  /**
   * 激活租户
   */
  async activateTenant(tenantId: string): Promise<TenantResponseDto> {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive: true },
    });

    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      apiKey: tenant.apiKey,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}
