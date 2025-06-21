-- CreateEnum
CREATE TYPE "VerificationCodeType" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILED', 'AUTH_LOGOUT', 'AUTH_REGISTER', 'AUTH_PASSWORD_RESET_REQUEST', 'AUTH_PASSWORD_RESET_SUCCESS', 'AUTH_PASSWORD_CHANGE', 'AUTH_EMAIL_VERIFICATION', 'AUTH_OAUTH_LOGIN', 'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_ACTIVATE', 'USER_DEACTIVATE', 'USER_ROLE_CHANGE', 'TENANT_CREATE', 'TENANT_UPDATE', 'TENANT_DELETE', 'TENANT_ACTIVATE', 'TENANT_DEACTIVATE', 'APIKEY_CREATE', 'APIKEY_UPDATE', 'APIKEY_DELETE', 'APIKEY_REGENERATE', 'ADMIN_ACCESS', 'ADMIN_CONFIG_CHANGE', 'ADMIN_USER_IMPERSONATE', 'SYSTEM_BACKUP', 'SYSTEM_RESTORE', 'SYSTEM_MAINTENANCE', 'SECURITY_BREACH_ATTEMPT', 'SECURITY_SUSPICIOUS_ACTIVITY', 'SECURITY_RATE_LIMIT_EXCEEDED');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('RESPONSE_TIME', 'DATABASE_QUERY_TIME', 'REDIS_OPERATION_TIME', 'CPU_USAGE', 'MEMORY_USAGE', 'DISK_USAGE', 'REQUEST_COUNT', 'ERROR_RATE', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'REGISTRATION_COUNT', 'ACTIVE_CONNECTIONS', 'QUEUE_SIZE', 'CACHE_HIT_RATE', 'FAILED_LOGIN_ATTEMPTS', 'SUSPICIOUS_ACTIVITY', 'BLOCKED_IPS');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('HIGH_RESPONSE_TIME', 'HIGH_ERROR_RATE', 'HIGH_CPU_USAGE', 'HIGH_MEMORY_USAGE', 'LOW_DISK_SPACE', 'HIGH_FAILED_LOGINS', 'UNUSUAL_TRAFFIC', 'SERVICE_UNAVAILABLE', 'BRUTE_FORCE_ATTACK', 'SUSPICIOUS_ACTIVITY', 'UNAUTHORIZED_ACCESS', 'DATABASE_CONNECTION_ERROR', 'REDIS_CONNECTION_ERROR', 'EXTERNAL_SERVICE_ERROR');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "apiKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "permissions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "password" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "country" TEXT,
    "hashedRt" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "wechatId" TEXT,
    "unionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "device" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "type" "VerificationCodeType" NOT NULL,
    "target" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "username" TEXT,
    "avatar" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" INTEGER,
    "action" "AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "method" TEXT,
    "path" TEXT,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" TEXT NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "tenantId" TEXT,
    "userId" INTEGER,
    "endpoint" TEXT,
    "method" TEXT,
    "metadata" JSONB,
    "tags" TEXT[],
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "triggerValue" DOUBLE PRECISION,
    "thresholdValue" DOUBLE PRECISION,
    "tenantId" TEXT,
    "endpoint" TEXT,
    "ip" TEXT,
    "details" JSONB,
    "stackTrace" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "webhookSent" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_apiKey_key" ON "tenants"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_username_key" ON "users"("tenantId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_wechatId_key" ON "users"("tenantId", "wechatId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_unionId_key" ON "users"("tenantId", "unionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_accessToken_key" ON "user_sessions"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshToken_key" ON "user_sessions"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_codes_token_key" ON "verification_codes"("token");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_userId_provider_key" ON "oauth_accounts"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_providerId_key" ON "oauth_accounts"("provider", "providerId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "audit_logs"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "system_metrics_metricType_timestamp_idx" ON "system_metrics"("metricType", "timestamp");

-- CreateIndex
CREATE INDEX "system_metrics_tenantId_timestamp_idx" ON "system_metrics"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "system_metrics_name_timestamp_idx" ON "system_metrics"("name", "timestamp");

-- CreateIndex
CREATE INDEX "system_metrics_tags_timestamp_idx" ON "system_metrics"("tags", "timestamp");

-- CreateIndex
CREATE INDEX "alerts_alertType_createdAt_idx" ON "alerts"("alertType", "createdAt");

-- CreateIndex
CREATE INDEX "alerts_severity_status_idx" ON "alerts"("severity", "status");

-- CreateIndex
CREATE INDEX "alerts_tenantId_createdAt_idx" ON "alerts"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "alerts_status_createdAt_idx" ON "alerts"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_metrics" ADD CONSTRAINT "system_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_metrics" ADD CONSTRAINT "system_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 插入默认测试数据
INSERT INTO "tenants" ("id", "name", "domain", "apiKey", "isActive", "createdAt", "updatedAt")
VALUES 
    ('default-tenant', 'Default Tenant', 'localhost', 'test-api-key-12345', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('demo-tenant', 'Demo Company', 'demo.example.com', 'demo-api-key-67890', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 插入默认管理员用户 (密码: admin123)
INSERT INTO "users" ("tenantId", "email", "username", "firstName", "lastName", "password", "isActive", "isVerified", "createdAt", "updatedAt")
VALUES 
    ('default-tenant', 'admin@localhost', 'admin', 'Admin', 'User', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/UnChSIta1PQ1DxO0K', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('default-tenant', 'test@localhost', 'testuser', 'Test', 'User', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/UnChSIta1PQ1DxO0K', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 插入API密钥
INSERT INTO "api_keys" ("id", "tenantId", "name", "keyHash", "permissions", "isActive", "createdAt", "updatedAt")
VALUES 
    ('api-key-1', 'default-tenant', 'Default API Key', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/UnChSIta1PQ1DxO0K', ARRAY['read', 'write'], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);