# Auth Service - 企业级认证服务

<div align="center">
  <h1>🔐 Auth Service</h1>
  <p>一个功能完整的企业级认证与权限管理服务</p>
  <p>
    <a href="#特性">特性</a> •
    <a href="#快速开始">快速开始</a> •
    <a href="#架构">架构</a> •
    <a href="#api文档">API文档</a> •
    <a href="#部署">部署</a>
  </p>
</div>

---

## 📋 项目简介

Auth Service 是一个基于 NestJS 构建的**独立认证服务**，采用类似 Cloudflare 的服务模式，支持多租户架构。它可以作为任何项目的统一认证中心，提供完整的用户认证、权限管理、会话管理等功能。

### 为什么选择 Auth Service？

- **🚀 开箱即用** - 完整的认证解决方案，无需从零开始
- **💰 成本优势** - 自托管，无第三方服务费用
- **🔧 高度可定制** - 完全开源，可根据需求定制
- **🏢 企业级** - 生产就绪，支持高并发和横向扩展
- **🔒 安全可靠** - 多层安全防护，数据完全自主可控

## ✨ 特性

### 核心功能
- ✅ **JWT 认证** - 支持 Access Token + Refresh Token
- ✅ **多租户架构** - 一套服务支持多个独立应用
- ✅ **用户管理** - 注册、登录、密码重置、邮箱验证
- ✅ **OAuth 2.0** - 支持 GitHub、Google、微信等第三方登录
- ✅ **API Key** - 支持服务端认证
- ✅ **RBAC 权限** - 基于角色的访问控制
- ✅ **SSR 页面** - 提供统一的登录/注册页面

### 企业特性
- ✅ **监控告警** - 实时性能监控和智能告警
- ✅ **审计日志** - 完整的操作审计追踪
- ✅ **功能开关** - 动态功能启用/禁用
- ✅ **性能优化** - Redis 缓存、数据库优化
- ✅ **安全防护** - 速率限制、暴力破解防护
- ✅ **管理后台** - 完整的 Web 管理界面

### 通信服务
- ✅ **邮件服务** - SMTP 邮件发送
- ✅ **短信服务** - 支持 Vonage、Twilio、AWS SNS
- ✅ **验证码** - 邮箱/短信验证码

## 🚀 快速开始

### 前置要求

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis >= 6.0
- npm 或 yarn

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd auth-service
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，配置必要的参数
```

4. **设置数据库**
```bash
# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy

# （可选）运行种子数据
npm run db:seed
```

5. **启动服务**
```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

### 使用 Docker Compose 快速启动

```bash
# 启动所有服务（包括 PostgreSQL 和 Redis）
docker-compose up -d

# 查看日志
docker-compose logs -f auth-service

# 停止服务
docker-compose down
```

### 使用外部数据库

如果你已有 PostgreSQL 数据库，可以直接配置连接：

1. 修改 `.env` 文件：
```env
DATABASE_URL="postgresql://用户名:密码@主机:端口/数据库名"
```

2. 修改 `docker-compose.yml`，注释掉 postgres 服务

3. 只启动必要的服务：
```bash
docker-compose up -d redis
npm run start:dev
```

## 🏗️ 架构设计

### 技术栈

- **后端框架**: NestJS + TypeScript
- **数据库**: PostgreSQL + Prisma ORM
- **缓存**: Redis
- **认证**: JWT + Passport
- **文档**: Swagger/OpenAPI
- **视图引擎**: Handlebars
- **验证**: class-validator

### 模块结构

```
src/
├── auth/           # 认证核心模块
├── email/          # 邮件服务
├── sms/            # 短信服务
├── monitoring/     # 监控告警
├── audit/          # 审计日志
├── feature-flags/  # 功能开关
├── performance/    # 性能优化
├── database/       # 数据库管理
└── redis/          # 缓存管理
```

## 📚 API 文档

### 在线文档

服务启动后，访问以下地址查看完整的 API 文档：

- **Swagger UI**: http://localhost:3001/api/docs
- **JSON 格式**: http://localhost:3001/api/docs-json

### 主要端点

#### 认证相关
- `POST /auth/login` - 用户登录
- `POST /auth/register` - 用户注册
- `POST /auth/refresh` - 刷新 Token
- `POST /auth/logout` - 用户登出
- `GET /auth/profile` - 获取用户信息

#### 租户管理
- `POST /tenant` - 创建租户
- `GET /tenant/:id` - 获取租户信息
- `POST /tenant/api-keys` - 创建 API Key

#### 监控健康
- `GET /monitoring/health` - 健康检查
- `GET /monitoring/metrics` - 性能指标
- `GET /monitoring/alerts` - 告警信息

## 🔧 配置说明

### 必需的环境变量

```env
# 数据库配置
DATABASE_URL="postgresql://user:password@localhost:5432/auth_service"

# JWT 配置
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"

# Redis 配置
REDIS_HOST="localhost"
REDIS_PORT=6379

# 邮件配置
SMTP_HOST="smtp.gmail.com"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# 管理员配置
ADMIN_EMAIL="admin@auth-service.com"
ADMIN_PASSWORD="strong-password"
```

### 可选配置

```env
# OAuth 配置
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# 短信服务（选择其一）
VONAGE_API_KEY=""
VONAGE_API_SECRET=""

# 功能开关
FF_EMAIL_SERVICE=true
FF_SMS_SERVICE=false
FF_OAUTH_GITHUB=false
FF_MONITORING_ENABLED=true
```

## 🛡️ 安全建议

1. **生产环境配置**
   - 使用强密码的 JWT 密钥
   - 启用 HTTPS
   - 配置防火墙规则
   - 定期更新依赖

2. **数据库安全**
   - 使用 SSL 连接
   - 定期备份
   - 限制访问权限

3. **监控告警**
   - 设置异常登录告警
   - 监控 API 调用频率
   - 定期审查审计日志

## 🎯 管理后台

### 访问地址
- URL: http://localhost:3001/admin
- 默认账号: `admin@auth-service.com`
- 默认密码: 在 `.env` 中配置或查看启动日志

### 主要功能
- 📊 实时仪表板
- 👥 用户管理
- 🏢 租户管理
- ⚙️ 系统配置
- 📈 性能监控
- 🔍 审计日志

## 🚢 部署指南

### Docker 部署

```bash
# 构建镜像
docker build -t auth-service:latest .

# 运行容器
docker run -d \
  --name auth-service \
  -p 3001:3001 \
  --env-file .env \
  auth-service:latest
```

### 注意事项

1. **视图文件处理**
   - 生产环境需要将 `views/` 目录复制到 `dist/` 目录
   - 可以在 Dockerfile 中添加: `COPY views/ dist/views/`

2. **数据库迁移**
   - 部署前确保运行数据库迁移
   - 使用 `npx prisma migrate deploy` 而非 `migrate dev`

3. **环境变量**
   - 生产环境使用环境变量管理敏感信息
   - 不要将 `.env` 文件提交到版本控制

## 📊 性能指标

- **响应时间**: < 100ms（P95）
- **并发支持**: 10,000+ 并发连接
- **可用性**: 99.9%
- **Token 生成**: < 50ms

## 🤝 贡献指南

欢迎提交 Pull Request 或创建 Issue！

### 开发流程

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范

- 使用 ESLint 和 Prettier
- 遵循 NestJS 最佳实践
- 编写单元测试
- 更新文档

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢所有贡献者和使用者的支持！

---

<div align="center">
  <p>如果这个项目对你有帮助，请给一个 ⭐️</p>
  <p>Made with ❤️ by the Gan-Xing</p>
</div>