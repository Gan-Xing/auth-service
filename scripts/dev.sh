#!/bin/bash

# 开发环境启动脚本
echo "🚀 启动开发环境..."

# 1. 构建项目
echo "📦 构建项目..."
npm run build

# 检查构建是否成功
if [ $? -ne 0 ]; then
    echo "❌ 构建失败，请检查错误信息"
    exit 1
fi

# 2. 复制静态文件到 dist
echo "📁 复制静态文件..."
cp -r views dist/
cp -r public dist/

# 3. 启动开发服务器
echo "🔥 启动开发服务器..."
npm run start:dev