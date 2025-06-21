import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

export interface AuditMetadata {
  action: AuditAction;
  resource: string;
  description?: string;
  skipOnError?: boolean;
}

export const AUDIT_METADATA_KEY = 'audit:metadata';

/**
 * 审计日志装饰器
 * 自动记录方法执行的审计日志
 * 
 * @param metadata 审计元数据
 * 
 * @example
 * @Audit({
 *   action: AuditAction.USER_CREATE,
 *   resource: 'user',
 *   description: '创建新用户'
 * })
 * async createUser(data: CreateUserDto) {
 *   // 业务逻辑
 * }
 */
export const Audit = (metadata: AuditMetadata) => SetMetadata(AUDIT_METADATA_KEY, metadata);