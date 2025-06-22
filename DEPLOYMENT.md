# 🚀 Auth Service 生产环境部署指南

## 📋 部署概览

Auth Service 提供了完整的生产环境部署解决方案，包括容器化、负载均衡、监控和安全配置。

## 🏗️ 架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │      Nginx      │    │  Auth Service   │
│    (Optional)   │───▶│  Reverse Proxy  │───▶│   Application   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Monitoring    │    │   PostgreSQL    │    │      Redis      │
│ (Prometheus +   │    │    Database     │    │     Cache       │
│    Grafana)     │    └─────────────────┘    └─────────────────┘
└─────────────────┘
```

## 📦 部署组件

### 核心服务
- **Auth Service**: 主应用服务
- **PostgreSQL**: 主数据库
- **Redis**: 缓存和会话存储
- **Nginx**: 反向代理和负载均衡

### 可选服务
- **Prometheus**: 指标收集
- **Grafana**: 监控仪表板
- **Fluentd**: 日志聚合

## 🚀 快速部署

### 1. 准备环境

```bash
# 克隆项目
git clone <repository-url>
cd auth-service

# 创建生产环境配置
cp .env.production.example .env.production
```

### 2. 配置环境变量

编辑 `.env.production` 文件：

```bash
# 必须更改的安全配置
JWT_ACCESS_SECRET="your-strong-secret-512-bits"
JWT_REFRESH_SECRET="your-different-strong-secret"
POSTGRES_PASSWORD="secure-database-password"
REDIS_PASSWORD="secure-redis-password"
ADMIN_PASSWORD="secure-admin-password"

# 域名配置
CORS_ORIGIN="https://yourdomain.com"
FRONTEND_URL="https://yourdomain.com"

# 邮件配置
SMTP_HOST="smtp.gmail.com"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

### 3. 运行部署脚本

```bash
# 使用部署脚本（推荐）
./deploy/deploy.sh production deploy

# 或手动部署
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 4. 验证部署

```bash
# 检查服务状态
./deploy/deploy.sh production status

# 查看健康状态
curl http://localhost:3001/monitoring/health
```

## ⚙️ 详细配置

### SSL/TLS 配置

1. **准备 SSL 证书**
```bash
# 创建 SSL 目录
mkdir -p ssl

# 复制证书文件
cp your-cert.pem ssl/cert.pem
cp your-key.pem ssl/key.pem
```

2. **更新 Nginx 配置**
```bash
# 编辑 nginx.conf
vim nginx.conf

# 更新域名
server_name your-domain.com;
```

3. **启用 HTTPS**
```bash
# 重新部署以应用 SSL 配置
./deploy/deploy.sh production restart
```

### 数据库配置

1. **外部数据库**
```bash
# 如果使用外部 PostgreSQL
DATABASE_URL="postgresql://user:pass@external-db:5432/auth_service"

# 注释掉 docker-compose.prod.yml 中的 postgres 服务
```

2. **数据库备份**
```bash
# 创建备份
./deploy/deploy.sh production backup

# 自动备份 (添加到 crontab)
0 2 * * * /path/to/auth-service/deploy/deploy.sh production backup
```

### 监控配置

1. **启用监控服务**
```bash
# 启动 Prometheus 和 Grafana
docker-compose -f docker-compose.prod.yml --profile monitoring up -d
```

2. **访问监控面板**
- Grafana: http://localhost:3000 (admin/your-password)
- Prometheus: http://localhost:9090

### 扩展配置

1. **水平扩展**
```bash
# 扩展到多个实例
./deploy/deploy.sh production scale auth-service 3
```

2. **负载均衡**
```bash
# 启用 Nginx 负载均衡
docker-compose -f docker-compose.prod.yml --profile nginx up -d
```

## 🔒 安全最佳实践

### 1. 密钥管理
- 使用强随机密钥（至少 256 位）
- 定期轮换 JWT 密钥
- 使用环境变量存储敏感信息

### 2. 网络安全
- 配置防火墙规则
- 使用 HTTPS/TLS 1.3
- 实施 IP 白名单（管理端点）

### 3. 数据库安全
- 启用 SSL 连接
- 使用强密码
- 定期备份和恢复测试

### 4. 容器安全
- 使用非 root 用户运行
- 定期更新基础镜像
- 扫描容器安全漏洞

## 📊 监控和告警

### 1. 健康检查
```bash
# 服务健康状态
curl http://localhost:3001/monitoring/health

# 详细系统指标
curl -H "Authorization: Bearer <admin-token>" \
     http://localhost:3001/monitoring/metrics/comprehensive
```

### 2. 日志监控
```bash
# 查看应用日志
./deploy/deploy.sh production logs

# 查看特定服务日志
docker-compose -f docker-compose.prod.yml logs auth-service
```

### 3. 性能监控
```bash
# 运行性能基准测试
curl -X POST -H "Authorization: Bearer <admin-token>" \
     http://localhost:3001/performance/benchmarks/run
```

## 🚨 故障排除

### 常见问题

1. **服务无法启动**
```bash
# 检查日志
docker-compose -f docker-compose.prod.yml logs

# 检查端口占用
netstat -tlnp | grep :3001
```

2. **数据库连接失败**
```bash
# 检查数据库状态
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# 验证连接字符串
echo $DATABASE_URL
```

3. **SSL 证书问题**
```bash
# 验证证书
openssl x509 -in ssl/cert.pem -text -noout

# 检查证书有效期
openssl x509 -in ssl/cert.pem -noout -dates
```

### 恢复步骤

1. **数据恢复**
```bash
# 恢复数据库备份
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U auth_user -d auth_service < backup.sql
```

2. **服务重启**
```bash
# 重启所有服务
./deploy/deploy.sh production restart

# 重启单个服务
docker-compose -f docker-compose.prod.yml restart auth-service
```

## 📈 性能优化

### 1. 数据库优化
- 配置连接池
- 创建适当索引
- 定期分析查询性能

### 2. 缓存优化
- 调整 Redis 内存限制
- 配置缓存策略
- 监控缓存命中率

### 3. 应用优化
- 启用 HTTP/2
- 配置 Gzip 压缩
- 优化静态资源缓存

## 🔄 升级和维护

### 1. 应用升级
```bash
# 更新到最新版本
./deploy/deploy.sh production update
```

### 2. 数据库迁移
```bash
# 运行数据库迁移
docker-compose -f docker-compose.prod.yml exec auth-service \
  npx prisma migrate deploy
```

### 3. 定期维护
```bash
# 清理 Docker 资源
./deploy/deploy.sh production cleanup

# 更新依赖
npm audit fix
```

## 📋 部署检查清单

### 部署前检查
- [ ] 配置文件已更新
- [ ] SSL 证书已安装
- [ ] 数据库已准备
- [ ] 环境变量已设置
- [ ] 备份策略已配置

### 部署后验证
- [ ] 健康检查通过
- [ ] 数据库连接正常
- [ ] Redis 连接正常
- [ ] API 端点可访问
- [ ] 管理后台可访问
- [ ] 监控数据正常
- [ ] 日志输出正常

### 上线前测试
- [ ] 用户注册/登录测试
- [ ] API 接口测试
- [ ] 性能基准测试
- [ ] 安全扫描
- [ ] 负载测试

## 🆘 紧急联系

如需紧急支持，请：
1. 检查监控告警
2. 查看应用日志
3. 执行健康检查
4. 联系系统管理员

---

## 📚 相关文档

- [API 文档](http://localhost:3001/api/docs)
- [管理后台](http://localhost:3001/admin)
- [监控指标](http://localhost:3001/monitoring/metrics)
- [项目 README](./README.md)
- [开发指南](./CLAUDE.md)