FROM node:18-alpine

# 安装 curl 用于健康检查
RUN apk add --no-cache curl

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装构建工具
RUN apk add --no-cache make gcc g++ python3

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 复制源代码
COPY . .

# 删除可能不兼容的 node_modules
RUN rm -rf node_modules

# 重新安装所有依赖（包括开发依赖用于构建）
RUN npm install

# 生成Prisma Client
RUN npx prisma generate

# 构建应用
RUN npm run build

# 清理开发依赖
RUN npm prune --production

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/auth/health || exit 1

# 启动应用
CMD ["node", "dist/src/main.js"] 