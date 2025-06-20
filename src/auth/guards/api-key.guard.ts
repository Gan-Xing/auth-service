import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKeyFromHeader(request);

    if (!apiKey) {
      throw new UnauthorizedException('API Key is required');
    }

    // 验证 API Key
    const apiKeyRecord = await this.validateApiKey(apiKey);
    if (!apiKeyRecord) {
      throw new UnauthorizedException('Invalid API Key');
    }

    // 检查权限（如果需要特定权限）
    const requiredPermissions = this.reflector.get<string[]>('permissions', context.getHandler());
    if (
      requiredPermissions &&
      !this.hasRequiredPermissions(apiKeyRecord.permissions, requiredPermissions)
    ) {
      throw new UnauthorizedException('Insufficient permissions');
    }

    // 将租户信息和 API Key 信息添加到请求中
    request.tenant = apiKeyRecord.tenant;
    request.apiKey = apiKeyRecord;

    // 更新最后使用时间
    await this.updateLastUsedAt(apiKeyRecord.id);

    return true;
  }

  private extractApiKeyFromHeader(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 也支持通过 X-API-Key header 传递
    return request.headers['x-api-key'] || null;
  }

  private async validateApiKey(apiKey: string): Promise<any> {
    try {
      // 查找所有活跃的 API Keys
      const apiKeys = await this.prisma.apiKey.findMany({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          tenant: true,
        },
      });

      // 验证哈希
      for (const apiKeyRecord of apiKeys) {
        const isValid = await bcrypt.compare(apiKey, apiKeyRecord.keyHash);
        if (isValid && apiKeyRecord.tenant.isActive) {
          return apiKeyRecord;
        }
      }

      return null;
    } catch (error) {
      console.error('API Key validation error:', error);
      return null;
    }
  }

  private hasRequiredPermissions(
    userPermissions: string[],
    requiredPermissions: string[],
  ): boolean {
    return requiredPermissions.every((permission) => userPermissions.includes(permission));
  }

  private async updateLastUsedAt(apiKeyId: string): Promise<void> {
    try {
      await this.prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { lastUsedAt: new Date() },
      });
    } catch (error) {
      // 静默处理更新错误，不影响主流程
      console.error('Failed to update API key last used time:', error);
    }
  }
}
