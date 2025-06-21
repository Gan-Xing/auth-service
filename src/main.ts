import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import * as session from 'express-session';
import { AppModule } from './app.module';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { setupSwagger } from './documentation/swagger.config';
import { registerHandlebarsHelpers } from './config/handlebars.config';

// Node.js 18.16.1 兼容性修复：添加crypto.randomUUID polyfill
if (!globalThis.crypto) {
  const crypto = require('crypto');
  (globalThis as any).crypto = {
    randomUUID: () => crypto.randomUUID(),
  };
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 安全头部设置 - 临时禁用用于调试
  // app.use(helmet({
  //   contentSecurityPolicy: false,
  //   hsts: {
  //     maxAge: 31536000,
  //     includeSubDomains: true,
  //     preload: true,
  //   },
  // }));

  // 配置 session
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'auth-service-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // 生产环境使用 https
        sameSite: 'lax',
      },
    }),
  );

  // 配置模板引擎
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  
  // 注册 Handlebars helpers
  registerHandlebarsHelpers();

  // 启用自定义验证管道
  app.useGlobalPipes(new CustomValidationPipe());

  // 启用CORS（更安全的配置）
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'];
  app.enableCors({
    origin: (origin, callback) => {
      // 允许没有origin的请求（如移动应用、同源请求）
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      
      logger.warn(`CORS blocked origin: ${origin}`);
      return callback(null, true); // 在开发环境中暂时允许所有请求
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
    maxAge: 86400, // 24 hours
  });

  // 设置增强的Swagger文档
  setupSwagger(app);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Auth Service running on http://localhost:${port}`);
  console.log(`📚 API文档: http://localhost:${port}/api/docs`);
}

bootstrap();
