# Platform Ecosystem - Auth Service

## 项目概述

**通用、模块化、可复用、可自托管的统一认证与权限管理系统平台**

这是一个基于 NestJS 的**完整独立认证服务**，采用类似 **Cloudflare 服务模式**，支持多租户架构，可以为任意项目提供统一的认证功能。

### 🎯 设计理念

- **🏗️ 服务自包含** - 单个服务完整可用，不依赖其他微服务
- **🔌 可嵌入接入** - 通过 API Key 或 JWT 轻松集成到任何项目
- **🌐 统一认证入口** - 提供 SSR 登录/注册页面，支持跨应用跳转
- **🏢 多租户支持** - 一套服务支持多个独立的应用/组织
- **📈 渐进式架构** - 根据需求逐步演进，避免过度设计

### ✅ 当前功能状态 (完成度: 75%)

**已完成核心功能:**
- 🔐 JWT 认证 (Access Token + Refresh Token)
- 👥 多租户架构 (Tenant + User + ApiKey)
- 📧 邮箱验证码 (注册 + 密码重置)
- 🔑 API Key 认证与管理
- 📨 内置邮件服务 (Nodemailer)
- 🔒 密码管理 (强度验证 + 哈希存储)
- 📊 Swagger API 文档
- 🛡️ 安全机制 (频率限制 + 输入验证)

**🚧 待完成功能:**
- 🔗 SSO 第三方登录集成 (GitHub/Google/微信)
- 📱 短信服务集成
- 🎛️ 管理后台界面 (租户管理/用户管理/配置管理)
- 📊 使用统计和监控面板
- 🔌 外部服务集成开关 (usage/rate-limiter/notification)
- 🔄 配置热更新和服务发现

## 技术栈

- **框架**: NestJS 10.x
- **数据库**: PostgreSQL + Prisma ORM
- **缓存**: Redis (ioredis)
- **认证**: JWT + Passport
- **验证**: class-validator + class-transformer
- **文档**: Swagger/OpenAPI
- **邮件**: Nodemailer
- **密码**: bcrypt
- **语言**: TypeScript

## 项目结构

```
auth-service/
├── src/
│   ├── auth/                    # 认证模块
│   │   ├── controllers/         # 控制器
│   │   ├── dto/                # 数据传输对象
│   │   ├── guards/             # 守卫
│   │   ├── services/           # 服务层
│   │   ├── strategies/         # Passport 策略
│   │   ├── decorators/         # 自定义装饰器
│   │   ├── auth.controller.ts  # 主控制器
│   │   ├── auth.service.ts     # 主服务
│   │   └── auth.module.ts      # 模块定义
│   ├── common/                 # 公共模块
│   ├── config/                 # 配置管理
│   ├── database/               # 数据库模块
│   ├── email/                  # 邮件服务
│   ├── sms/                    # 短信服务
│   ├── app.module.ts           # 根模块
│   └── main.ts                 # 应用入口
├── prisma/
│   └── schema.prisma           # 数据库模式
├── package.json
├── tsconfig.json
├── Dockerfile
└── docker-compose.yml
```

## 数据库模型

### 核心表结构
- **Tenant**: 租户信息
- **User**: 用户信息 (支持多租户)
- **UserSession**: 用户会话管理
- **ApiKey**: API 密钥管理
- **VerificationCode**: 验证码存储

### 关键关系
- 一个租户可以有多个用户
- 一个用户可以有多个会话
- 一个租户可以有多个 API Key

## 🚀 使用场景

### 典型集成流程

```mermaid
graph LR
    A[用户访问应用] --> B{是否已登录?}
    B -->|否| C[跳转到 auth.example.com/login]
    C --> D[统一登录页面]
    D --> E[登录成功]
    E --> F[签发 JWT]
    F --> G[跳转回原应用]
    B -->|是| H[正常访问]
```

### 对接方式

**1. 前端集成方式**
```javascript
// 检测登录状态，未登录自动跳转
if (!localStorage.getItem('jwt_token')) {
  window.location.href = 'https://auth.example.com/login?redirect=' + 
    encodeURIComponent(window.location.href);
}
```

**2. 后端 API 调用**
```bash
# 使用 API Key 认证
curl -X POST https://auth.example.com/auth/login \
  -H "Authorization: Bearer your-api-key" \
  -d '{"email": "user@example.com", "password": "password"}'
```

**3. JWT 验证**
```bash
# 其他服务验证 JWT
curl https://auth.example.com/.well-known/jwks.json
```

## 📋 API 接口

### 统一认证接口

| 方法 | 路径 | 功能 | 认证要求 |
|-----|------|------|---------|
| `GET` | `/login` | SSR 登录页面 | 无 |
| `POST` | `/login` | 处理登录 + 跳转 | 无 |
| `GET` | `/register` | SSR 注册页面 | 无 |
| `POST` | `/register` | 处理注册 + 自动登录 | 无 |
| `GET` | `/profile` | 认证成功页面 | 无 |
| `GET` | `/.well-known/jwks.json` | JWT 公钥 | 无 |
| `GET` | `/.well-known/openid_configuration` | OIDC 发现 | 无 |

### 管理后台接口

| 方法 | 路径 | 功能 | 认证要求 |
|-----|------|------|---------|
| `GET` | `/admin` | 管理后台首页 | Admin |
| `GET` | `/admin/dashboard` | 仪表板 | Admin |
| `GET` | `/admin/tenants` | 租户管理 | Admin |
| `GET` | `/admin/users` | 用户管理 | Admin |
| `GET` | `/admin/settings` | 配置管理 | Admin |
| `GET` | `/admin/logs` | 审计日志 | Admin |

### 认证 API (`/auth`)

| 方法 | 路径 | 功能 | 认证要求 |
|-----|------|------|---------|
| `POST` | `/auth/login` | API 登录 | API Key |
| `POST` | `/auth/register` | API 注册 | API Key |
| `POST` | `/auth/register-with-code` | 验证码注册 | API Key |
| `POST` | `/auth/send-verification-code` | 发送验证码 | 无 |
| `POST` | `/auth/request-password-reset` | 密码重置 | API Key |
| `POST` | `/auth/reset-password` | 重置密码 | 无 |
| `PATCH` | `/auth/change-password` | 修改密码 | JWT |
| `POST` | `/auth/refresh` | 刷新 Token | 无 |
| `POST` | `/auth/logout` | 登出 | JWT |
| `GET` | `/auth/profile` | 用户信息 | JWT |
| `GET` | `/auth/health` | 健康检查 | 无 |

### 租户管理 (`/tenant`)

| 方法 | 路径 | 功能 | 认证要求 |
|-----|------|------|---------|
| `POST` | `/tenant` | 创建租户 | 无 |
| `GET` | `/tenant/:id` | 租户信息 | API Key |
| `POST` | `/tenant/api-keys` | 创建 API Key | API Key |
| `GET` | `/tenant/api-keys` | API Key 列表 | API Key |
| `DELETE` | `/tenant/api-keys/:id` | 删除 API Key | API Key |

## 🎛️ 管理后台功能

### 核心功能模块

**📊 仪表板 (Dashboard)**
- 实时统计数据展示 (登录/注册/API调用量)
- 系统健康状态监控
- 使用趋势图表
- 安全告警和异常通知

**🏢 租户管理 (Tenant Management)**
- 租户列表 (分页/搜索/筛选)
- 创建新租户向导
- 租户详情和配置编辑
- API Key 生成和管理
- 租户级别的功能开关

**👥 用户管理 (User Management)**
- 用户列表和高级搜索
- 用户详情查看和编辑
- 密码重置和账户解锁
- 邮箱验证状态管理
- 用户会话监控

**⚙️ 配置管理 (Settings)**
- 功能开关配置面板
- SSO 提供商配置 (GitHub/Google/微信)
- 外部服务集成设置 (usage/rate-limiter/notification)
- 邮件服务配置和模板管理
- 安全策略配置 (密码策略/会话管理)
- 域名白名单管理

**🔍 审计日志 (Audit Logs)**
- 登录/注册日志查看
- 管理员操作审计
- 安全事件监控
- 日志导出功能

**🔌 服务集成 (Service Integration)**
- 外部服务健康检查
- Webhook 配置和测试
- API 调用统计
- 服务发现和配置同步

### 管理后台架构

**技术栈：**
- **前端**: SSR 页面 (Handlebars) + 现代 CSS + 原生 JavaScript
- **后端**: NestJS 控制器 + 专用的管理 API
- **认证**: 基于角色的访问控制 (RBAC)
- **数据**: 复用现有的数据模型和服务

**设计原则：**
- 🏗️ **自包含设计** - 管理后台集成在 auth-service 内部
- 🎨 **响应式界面** - 支持桌面和移动端访问
- 🔒 **安全优先** - 严格的管理员认证和权限控制
- 📊 **实时数据** - WebSocket 支持的实时监控
- 🔧 **易于配置** - 图形化配置界面，支持导入导出

## 🏗️ 服务架构策略

### 核心原则：服务自包含 > 微服务拆分

**❌ 避免的架构问题:**
- 过度拆分导致服务间强依赖
- 单个功能需要多个服务协作才能完成
- 分布式单体应用
- 服务启动顺序依赖

**✅ 采用的架构原则:**
- **Auth-Service 完全自包含** - 包含所有认证相关功能
- **其他服务作为可选增强** - 存在时提供额外功能，不存在也不影响
- **渐进式架构演进** - 根据实际需求决定拆分时机
- **服务独立部署运行** - 每个服务都能独立工作

### 服务边界定义

| 服务 | 核心职责 | 独立性 | 扩展方向 |
|-----|---------|-------|---------|
| **auth-service** | 完整认证功能 | ✅ 完全独立 | 保持功能完整 |
| **gateway-service** | API 路由 + JWT 验证 | ✅ 独立 | 可选集成 auth |
| **notification-service** | 高级通知功能 | ✅ 独立 | 可选被 auth 调用 |
| **rbac-service** | 权限管理 | ✅ 独立 | 可选验证 JWT |
| **admin-ui** | 管理界面 | ✅ 独立 | 调用各服务 API |

### Auth-Service 功能保留策略

**🔒 核心功能（永久保留）:**
- 用户注册/登录/登出
- JWT Token 签发/验证/刷新
- 密码管理（重置/修改/验证）
- 邮箱验证码（生成+发送+验证）
- 用户资料管理
- 多租户管理
- API Key 管理
- SSR 登录/注册页面
- 跨域跳转逻辑
- JWKS 公钥服务

**📧 通知功能（保留 + 可选增强）:**
```javascript
// 当前实现：内置邮件功能
emailService.sendVerificationCode(email, code)

// 未来可选：尝试外部服务，失败时降级
try {
  await notificationService.sendEmail(template, data)
} catch {
  await emailService.sendVerificationCode(email, code) // 降级
}
```

## 📅 实施路线图

### 🎯 阶段 1：完善 Auth-Service 核心功能 (当前重点)

**优先级 🔥 立即执行:**
1. **添加 SSR 登录/注册页面**
   ```
   GET /login?redirect=https://app.example.com/dashboard
   GET /register?redirect=https://app.example.com/dashboard
   ```

2. **实现 redirect 参数处理**
   ```javascript
   // 安全的跳转逻辑
   const redirect = req.query.redirect;
   if (!isAllowedRedirect(redirect)) {
     throw new ForbiddenException('Invalid redirect URL');
   }
   ```

3. **添加 JWKS 端点**
   ```
   GET /.well-known/jwks.json
   ```

4. **完善错误处理和安全机制**
   - Open Redirect 漏洞防护
   - CSRF 保护
   - 登录失败次数限制

**保持现状 ✅ 不拆分:**
- EmailService 保留在 auth-service
- VerificationService 完整保留
- 确保 auth-service 可以完全独立部署

### 🚀 阶段 2：可选服务增强 (有需求时)

**只在以下情况考虑拆分:**
- 需要复杂的邮件模板管理
- 需要大量批量邮件发送
- 需要营销邮件功能
- 需要多渠道通知（短信+推送+邮件）

**拆分方式:**
- 创建 notification-service
- auth-service 尝试调用，失败时降级到内置功能
- 确保向后兼容，不影响现有功能

### 🌐 阶段 3：生态系统扩展 (并行开发)

**独立开发以下服务:**
```bash
gateway-service    # API 网关 + JWT 验证 + 统一入口
rbac-service      # 角色权限管理
usage-service     # API 使用统计
admin-ui          # 统一管理界面
```

**集成方式:**
- 每个服务独立部署和运行
- 通过 HTTP API 相互调用
- 使用 auth-service 的 JWT 进行认证

## 环境变量配置

创建 `.env` 文件：

```bash
# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/auth_db"

# 服务器配置
PORT=3001

# JWT 配置
JWT_ACCESS_SECRET="your-super-secret-access-key-change-this-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-this-in-production"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Redis 配置
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""
REDIS_DB=0

# 邮件配置
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="noreply@auth-service.com"

# 短信配置 (阿里云)
ALICLOUD_ACCESS_KEY_ID=""
ALICLOUD_ACCESS_KEY_SECRET=""
SMS_SIGN_NAME="AuthService"
SMS_TEMPLATE_CODE="SMS_123456789"

# 微信配置
WECHAT_APP_ID=""
WECHAT_APP_SECRET=""

# CORS 配置
CORS_ORIGIN="http://localhost:3000,http://localhost:3001"

# 环境配置
NODE_ENV="development"
```

## 常用命令

### 开发命令
```bash
# 安装依赖
npm install
# 或使用 pnpm
pnpm install

# 开发模式启动
npm run start:dev

# 生产模式启动
npm run start:prod

# 构建项目
npm run build

# 代码检查
npm run lint

# 运行测试
npm run test
npm run test:watch
npm run test:cov
```

### 数据库命令
```bash
# 生成 Prisma Client
npx prisma generate

# 数据库迁移
npx prisma migrate dev

# 重置数据库
npx prisma migrate reset

# 查看数据库
npx prisma studio
```

### Docker 命令
```bash
# 构建镜像
docker build -t auth-service .

# 运行容器
docker run -p 3001:3001 auth-service

# 使用 docker-compose
docker-compose up -d
```

## 开发指南

### 1. 环境设置
1. 确保安装了 Node.js 18+ 和 PostgreSQL
2. 复制 `.env.example` 为 `.env` 并配置环境变量
3. 运行 `npx prisma generate` 生成 Prisma Client
4. 运行 `npx prisma migrate dev` 创建数据库表

### 2. 启动服务
```bash
npm run start:dev
```
服务将在 http://localhost:3001 启动
API 文档在 http://localhost:3001/api/docs

### 3. 测试 API
使用 Swagger 文档或 curl 测试接口：

```bash
# 健康检查
curl http://localhost:3001/auth/health

# 用户注册
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "firstName": "John",
    "lastName": "Doe",
    "tenantId": "your-tenant-id"
  }'
```

## 🏛️ 架构设计

### 模块化设计

```
auth-service/
├── 🔐 AuthModule              # 认证核心模块
│   ├── AuthController         # 统一认证入口
│   ├── AuthService           # 认证业务逻辑
│   ├── TenantService         # 多租户管理
│   ├── VerificationService   # 验证码管理
│   └── PasswordService       # 密码安全
├── 📨 EmailModule             # 内置邮件服务
├── 🗄️ DatabaseModule          # 数据库连接管理
├── ⚙️ ConfigModule            # 配置管理
└── 🛠️ CommonModule            # 公共功能模块
```

### 设计特点

**🔒 安全特性:**
- JWT Token 认证 (RS256 + JWKS)
- 密码哈希存储 (bcrypt + salt)
- API Key 认证与管理
- 多租户数据隔离
- 输入验证和 SQL 注入防护
- CSRF 和 Open Redirect 防护
- 频率限制和失败重试限制

**🔌 集成特性:**
- RESTful API 设计
- OpenAPI/Swagger 文档
- SSR 页面支持
- 跨域跳转支持
- JWKS 公钥服务
- 容器化部署

**📈 扩展特性:**
- 水平扩展支持
- 状态无关设计
- 可选服务降级
- 渐进式功能增强
- 向后兼容保证

### 部署架构

**单体部署（推荐开始）:**
```
┌─────────────────────┐
│   auth-service      │
├─────────────────────┤
│ ✅ 认证功能         │
│ ✅ 邮件发送         │
│ ✅ 验证码管理       │
│ ✅ 租户管理         │
│ ✅ SSR 页面         │
└─────────────────────┘
        │
        ▼
  ┌──────────────┐
  │ PostgreSQL   │
  └──────────────┘
```

**微服务部署（可选扩展）:**
```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  gateway-service│   │   auth-service  │   │notification-    │
│                 │   │                 │   │service          │
│ ✅ API 路由     │◄──┤ ✅ 完整认证功能 ├──►│ ✅ 高级邮件     │
│ ✅ JWT 验证     │   │ ✅ 内置邮件     │   │ ✅ 批量发送     │
│ ✅ 负载均衡     │   │ ✅ 降级机制     │   │ ✅ 模板管理     │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

## 常见问题

### 1. 数据库连接失败
- 检查 `DATABASE_URL` 配置
- 确保 PostgreSQL 服务运行
- 检查数据库权限

### 2. JWT Token 无效
- 检查 `JWT_ACCESS_SECRET` 和 `JWT_REFRESH_SECRET`
- 确认 Token 格式正确
- 检查 Token 是否过期

### 3. 邮件发送失败
- 检查 SMTP 配置
- 确认邮箱服务商设置
- 检查网络连接

### 4. Redis 连接失败
- 检查 Redis 服务状态
- 确认连接配置
- 检查防火墙设置

## 部署说明

### 生产环境
1. 设置强密码的 JWT 密钥
2. 配置生产数据库
3. 设置邮件和短信服务
4. 配置 CORS 策略
5. 使用 HTTPS
6. 设置日志监控

### Docker 部署
```bash
# 构建生产镜像
docker build -t auth-service:prod .

# 运行容器
docker run -d \
  --name auth-service \
  -p 3001:3001 \
  --env-file .env \
  auth-service:prod
```

## 代码规范

- 使用 TypeScript 严格模式
- 遵循 NestJS 最佳实践
- 使用 DTO 进行数据验证
- 实现适当的错误处理
- 添加 Swagger 文档注释
- 使用 ESLint 和 Prettier

## 测试策略

- 单元测试覆盖核心业务逻辑
- 集成测试验证 API 接口
- E2E 测试确保端到端功能
- 性能测试验证并发处理能力

## 🎯 当前状态与下一步行动

### 📊 完成度总览

| 功能模块 | 完成状态 | 优先级 | 说明 |
|---------|---------|-------|------|
| 🔐 JWT 认证 | ✅ 100% | 核心 | Access + Refresh Token |
| 👥 多租户架构 | ✅ 100% | 核心 | Tenant + ApiKey 管理 |
| 📧 邮箱验证 | ✅ 100% | 核心 | 验证码 + 密码重置 |
| 📨 邮件发送 | ✅ 100% | 核心 | Nodemailer 集成 |
| 🔑 API Key 认证 | ✅ 100% | 核心 | 完整的认证守卫 |
| 🌐 SSR 登录页 | ✅ 100% | 🔥 高 | 统一登录入口 |
| 🔄 Redirect 跳转 | ✅ 100% | 🔥 高 | 跨应用认证 |
| 🔐 JWKS 端点 | ✅ 100% | 🔥 高 | JWT 公钥服务 |
| 🎛️ 管理后台 | 🚧 20% | 🔥 高 | 租户/用户/配置管理 |
| 📊 统计监控 | ❌ 0% | 中 | 使用统计和健康监控 |
| 🔗 SSO 集成 | ❌ 0% | 中 | 第三方登录 |
| 🔌 服务集成 | ❌ 0% | 中 | 外部服务开关控制 |
| 📱 短信服务 | ❌ 0% | 低 | 可选功能 |

### 🚀 立即执行清单

**当前目标:**
1. ✅ SSR 统一认证页面 (已完成)
2. ✅ JWKS 公钥服务 (已完成)
3. ✅ 安全跳转机制 (已完成)
4. 🔥 管理后台界面实现

**正在实施:**
```bash
# 1. 管理后台基础架构
GET /admin              # 管理后台首页
GET /admin/dashboard    # 仪表板页面
GET /admin/tenants      # 租户管理页面

# 2. 核心管理功能
- 租户创建和管理
- 用户列表和操作
- 配置界面和开关

# 3. 统计和监控
- 实时数据展示
- 系统健康监控
- 使用统计图表
```

### 🎪 服务模式对比

| 对比项 | 当前 Auth-Service | Cloudflare Access | Firebase Auth |
|-------|------------------|-------------------|---------------|
| 🏗️ 架构模式 | 自托管单体服务 | SaaS 网关服务 | SaaS API 服务 |
| 🔐 认证方式 | JWT + API Key | SSO 代理 | JWT + SDK |
| 👥 多租户 | ✅ 原生支持 | ✅ 企业功能 | ❌ 项目隔离 |
| 🌐 统一登录 | 🚧 开发中 | ✅ 核心功能 | ❌ 需自建 |
| 📧 邮件服务 | ✅ 内置 | ❌ 需集成 | ✅ 内置 |
| 💰 成本 | 🆓 免费自托管 | 💰 按使用付费 | 💰 按用户付费 |
| 🔧 定制性 | ✅ 完全可控 | ❌ 有限配置 | ❌ 固定功能 |

### 🛠️ 开发建议

**当前重点:** 专注完善 auth-service 的核心功能，让它成为一个真正的统一认证服务

**避免陷阱:** 不要急于拆分微服务，确保单个服务完整可用

**扩展策略:** 采用渐进式架构，根据实际需求决定是否引入其他服务

---

**📝 最后更新**: 2025-06-20  
**🎯 项目状态**: 75% 完成，专注核心功能实现  
**🚀 下一里程碑**: SSR 认证页面 + JWKS 端点

> 这是一个**生产就绪的认证服务**，采用 Cloudflare 服务模式，提供完整的多租户认证功能。请根据实际需求调整配置和安全设置。 