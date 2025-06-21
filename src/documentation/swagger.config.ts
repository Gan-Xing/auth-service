import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Auth Service API')
    .setDescription(`
# 企业级认证服务 API 文档

## 🔐 服务简介

Auth Service 是一个完整的企业级认证与权限管理服务，提供以下核心功能：

- **用户认证**: JWT Token + Refresh Token 机制
- **多租户支持**: 完整的租户隔离和管理
- **第三方登录**: GitHub、Google、微信 OAuth 集成
- **邮件验证**: 注册验证、密码重置等邮件服务
- **短信服务**: 国际短信验证码支持
- **监控告警**: 实时性能监控和智能告警
- **功能开关**: 动态功能启用/禁用控制
- **性能优化**: 缓存、并发处理、数据库优化

## 🚀 快速开始

### 1. 获取 API Key

首先需要创建租户并获取 API Key：

\`\`\`bash
curl -X POST https://auth.example.com/tenant \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Company",
    "domain": "mycompany.com"
  }'
\`\`\`

### 2. 用户注册

\`\`\`bash
curl -X POST https://auth.example.com/auth/register \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
\`\`\`

### 3. 用户登录

\`\`\`bash
curl -X POST https://auth.example.com/auth/login \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
\`\`\`

## 🔑 认证方式

本 API 支持两种认证方式：

### 1. API Key 认证 (用于服务端调用)
在请求头中添加：\`Authorization: Bearer YOUR_API_KEY\`

### 2. JWT Token 认证 (用于用户会话)
在请求头中添加：\`Authorization: Bearer JWT_TOKEN\`

## 📊 状态码说明

- **200**: 请求成功
- **201**: 资源创建成功
- **400**: 请求参数错误
- **401**: 未授权访问
- **403**: 权限不足
- **404**: 资源不存在
- **429**: 请求频率过高
- **500**: 服务器内部错误

## 🏗️ 架构特点

- **微服务架构**: 独立部署，可水平扩展
- **多租户设计**: 天然支持 SaaS 模式
- **高可用**: Redis 缓存 + 数据库主从
- **安全防护**: 速率限制、暴力破解保护
- **监控运维**: 完整的监控和告警体系

## 🔗 相关链接

- [服务状态页面](/monitoring/health)
- [管理后台](/admin)
- [功能开关管理](/feature-flags)
- [性能监控](/performance/stats)
    `)
    .setVersion('1.0.0')
    .setContact(
      'Auth Service Team',
      'https://github.com/yourorg/auth-service',
      'support@yourcompany.com'
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3001', 'Development Server')
    .addServer('https://auth-staging.example.com', 'Staging Server')
    .addServer('https://auth.example.com', 'Production Server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        description: 'API Key authentication (Bearer YOUR_API_KEY)',
      },
      'ApiKey-auth'
    )
    .addTag('Authentication', '用户认证相关接口')
    .addTag('User Management', '用户管理接口')
    .addTag('Tenant Management', '租户管理接口')
    .addTag('OAuth Integration', '第三方登录集成')
    .addTag('Email Services', '邮件服务接口')
    .addTag('SMS Services', '短信服务接口')
    .addTag('Monitoring', '监控系统接口')
    .addTag('Feature Flags', '功能开关管理')
    .addTag('Performance', '性能优化接口')
    .addTag('Admin Panel', '管理后台接口')
    .addTag('Health Check', '健康检查接口')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
    deepScanRoutes: true,
  });

  // 自定义 Swagger UI 配置
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'none',
      defaultModelExpandDepth: 2,
      defaultModelsExpandDepth: 1,
      operationsSorter: 'alpha',
      tagsSorter: 'alpha',
    },
    customSiteTitle: 'Auth Service API Documentation',
    customfavIcon: '/favicon.ico',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    ],
  });

  // 生成 JSON 文档端点
  SwaggerModule.setup('api/docs-json', app, document);
}

export function getSwaggerDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Auth Service API')
    .setDescription('Enterprise Authentication Service API Documentation')
    .setVersion('1.0.0')
    .build();

  return SwaggerModule.createDocument(app, config);
}