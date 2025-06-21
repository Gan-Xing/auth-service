import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { 
  authenticationExamples, 
  tenantManagementExamples, 
  frontendIntegrationExamples,
  backendIntegrationExamples,
  mobileIntegrationExamples 
} from './examples/authentication.examples';

@ApiTags('API文档与示例')
@Controller('docs')
export class DocumentationController {

  @Get('examples')
  @ApiOperation({ summary: '获取所有API使用示例' })
  @ApiResponse({ status: 200, description: '返回所有示例的索引' })
  getAllExamples() {
    return {
      success: true,
      data: {
        categories: [
          {
            name: 'authentication',
            title: '认证流程示例',
            description: '用户注册、登录、OAuth等认证相关示例',
            examples: Object.keys(authenticationExamples),
          },
          {
            name: 'tenant-management',
            title: '租户管理示例',
            description: '租户创建、API Key管理等示例',
            examples: Object.keys(tenantManagementExamples),
          },
          {
            name: 'frontend-integration',
            title: '前端集成示例',
            description: 'React、Vue.js等前端框架集成示例',
            examples: Object.keys(frontendIntegrationExamples),
          },
          {
            name: 'backend-integration',
            title: '后端集成示例',
            description: 'Node.js、Python等后端服务集成示例',
            examples: Object.keys(backendIntegrationExamples),
          },
          {
            name: 'mobile-integration',
            title: '移动端集成示例',
            description: 'React Native、Flutter等移动应用集成示例',
            examples: Object.keys(mobileIntegrationExamples),
          },
        ],
        totalExamples: Object.keys(authenticationExamples).length +
                      Object.keys(tenantManagementExamples).length +
                      Object.keys(frontendIntegrationExamples).length +
                      Object.keys(backendIntegrationExamples).length +
                      Object.keys(mobileIntegrationExamples).length,
      },
    };
  }

  @Get('examples/:category')
  @ApiOperation({ summary: '获取指定分类的示例' })
  @ApiParam({ name: 'category', description: '示例分类' })
  @ApiResponse({ status: 200, description: '返回指定分类的示例列表' })
  getExamplesByCategory(@Param('category') category: string) {
    const exampleCollections = {
      'authentication': authenticationExamples,
      'tenant-management': tenantManagementExamples,
      'frontend-integration': frontendIntegrationExamples,
      'backend-integration': backendIntegrationExamples,
      'mobile-integration': mobileIntegrationExamples,
    };

    const examples = exampleCollections[category];
    if (!examples) {
      return {
        success: false,
        message: '分类不存在',
        availableCategories: Object.keys(exampleCollections),
      };
    }

    return {
      success: true,
      data: {
        category,
        examples: Object.keys(examples).map(key => ({
          name: key,
          title: examples[key].description,
          hasCode: !!examples[key].code,
        })),
      },
    };
  }

  @Get('examples/:category/:example')
  @ApiOperation({ summary: '获取具体示例的代码' })
  @ApiParam({ name: 'category', description: '示例分类' })
  @ApiParam({ name: 'example', description: '示例名称' })
  @ApiQuery({ name: 'format', description: '返回格式 (json|code)', required: false })
  @ApiResponse({ status: 200, description: '返回示例代码' })
  getExampleCode(
    @Param('category') category: string,
    @Param('example') example: string,
    @Query('format') format: string = 'json',
    @Res() res: Response,
  ) {
    const exampleCollections = {
      'authentication': authenticationExamples,
      'tenant-management': tenantManagementExamples,
      'frontend-integration': frontendIntegrationExamples,
      'backend-integration': backendIntegrationExamples,
      'mobile-integration': mobileIntegrationExamples,
    };

    const examples = exampleCollections[category];
    if (!examples || !examples[example]) {
      return res.status(404).json({
        success: false,
        message: '示例不存在',
      });
    }

    const exampleData = examples[example];

    if (format === 'code') {
      // 返回纯代码格式
      res.setHeader('Content-Type', 'text/plain');
      return res.send(exampleData.code);
    }

    // 返回 JSON 格式
    return res.json({
      success: true,
      data: {
        category,
        example,
        description: exampleData.description,
        code: exampleData.code,
        metadata: {
          language: this.detectLanguage(exampleData.code),
          linesOfCode: exampleData.code.split('\n').length,
        },
      },
    });
  }

  @Get('quick-start')
  @ApiOperation({ summary: '获取快速开始指南' })
  @ApiResponse({ status: 200, description: '返回快速开始步骤' })
  getQuickStart() {
    return {
      success: true,
      data: {
        title: 'Auth Service 快速开始指南',
        steps: [
          {
            step: 1,
            title: '创建租户',
            description: '首先创建一个租户来获取API密钥',
            endpoint: 'POST /tenant',
            example: {
              request: {
                name: 'My Company',
                domain: 'mycompany.com',
              },
              response: {
                id: 'tenant-uuid',
                apiKey: 'api-key-here',
              },
            },
          },
          {
            step: 2,
            title: '用户注册',
            description: '使用API密钥创建新用户',
            endpoint: 'POST /auth/register',
            headers: {
              'Authorization': 'Bearer YOUR_API_KEY',
              'Content-Type': 'application/json',
            },
            example: {
              request: {
                email: 'user@example.com',
                password: 'SecurePassword123!',
                firstName: 'John',
                lastName: 'Doe',
              },
            },
          },
          {
            step: 3,
            title: '用户登录',
            description: '用户登录获取JWT令牌',
            endpoint: 'POST /auth/login',
            example: {
              request: {
                email: 'user@example.com',
                password: 'SecurePassword123!',
              },
              response: {
                accessToken: 'jwt-access-token',
                refreshToken: 'jwt-refresh-token',
                user: {
                  id: 1,
                  email: 'user@example.com',
                  firstName: 'John',
                  lastName: 'Doe',
                },
              },
            },
          },
          {
            step: 4,
            title: '访问受保护资源',
            description: '使用JWT令牌访问需要认证的接口',
            endpoint: 'GET /auth/profile',
            headers: {
              'Authorization': 'Bearer JWT_ACCESS_TOKEN',
            },
          },
        ],
        nextSteps: [
          {
            title: '集成前端应用',
            description: '查看 React、Vue.js 等前端框架的集成示例',
            link: '/docs/examples/frontend-integration',
          },
          {
            title: '第三方登录',
            description: '配置 GitHub、Google 等 OAuth 登录',
            link: '/docs/examples/authentication/oauthLogin',
          },
          {
            title: '邮件验证',
            description: '配置邮件验证和密码重置功能',
            link: '/docs/examples/authentication/passwordReset',
          },
        ],
      },
    };
  }

  @Get('api-reference')
  @ApiOperation({ summary: '获取API参考文档结构' })
  @ApiResponse({ status: 200, description: '返回API文档结构' })
  getApiReference() {
    return {
      success: true,
      data: {
        title: 'Auth Service API 参考',
        baseUrl: 'https://auth.example.com',
        version: '1.0.0',
        sections: [
          {
            name: 'Authentication',
            description: '用户认证相关接口',
            endpoints: [
              'POST /auth/register',
              'POST /auth/login',
              'POST /auth/logout',
              'POST /auth/refresh',
              'GET /auth/profile',
              'PATCH /auth/change-password',
            ],
          },
          {
            name: 'OAuth Integration',
            description: '第三方登录集成',
            endpoints: [
              'GET /auth/oauth/github',
              'POST /auth/oauth/github/callback',
              'GET /auth/oauth/google',
              'POST /auth/oauth/google/callback',
            ],
          },
          {
            name: 'Tenant Management',
            description: '租户和API密钥管理',
            endpoints: [
              'POST /tenant',
              'GET /tenant/:id',
              'POST /tenant/api-keys',
              'GET /tenant/api-keys',
              'DELETE /tenant/api-keys/:id',
            ],
          },
          {
            name: 'Monitoring',
            description: '系统监控和健康检查',
            endpoints: [
              'GET /monitoring/health',
              'GET /monitoring/metrics',
              'GET /monitoring/alerts',
            ],
          },
          {
            name: 'Performance',
            description: '性能优化和统计',
            endpoints: [
              'GET /performance/stats',
              'GET /performance/cache/stats',
              'POST /performance/cache/clear',
            ],
          },
        ],
        authentication: {
          apiKey: {
            description: 'API密钥认证，用于服务端调用',
            header: 'Authorization: Bearer YOUR_API_KEY',
            scope: '租户级别的API访问',
          },
          jwt: {
            description: 'JWT令牌认证，用于用户会话',
            header: 'Authorization: Bearer JWT_TOKEN',
            scope: '用户级别的数据访问',
          },
        },
      },
    };
  }

  @Get('sdk-downloads')
  @ApiOperation({ summary: '获取SDK下载链接' })
  @ApiResponse({ status: 200, description: '返回各语言SDK信息' })
  getSdkDownloads() {
    return {
      success: true,
      data: {
        title: 'Auth Service SDK',
        description: '各种编程语言的SDK，简化集成过程',
        sdks: [
          {
            language: 'JavaScript/TypeScript',
            name: '@auth-service/js-sdk',
            version: '1.0.0',
            npm: 'npm install @auth-service/js-sdk',
            github: 'https://github.com/yourorg/auth-service-js-sdk',
            documentation: '/docs/sdk/javascript',
            features: ['Promise-based API', 'TypeScript support', 'Automatic token refresh'],
          },
          {
            language: 'Python',
            name: 'auth-service-python',
            version: '1.0.0',
            pip: 'pip install auth-service-python',
            github: 'https://github.com/yourorg/auth-service-python-sdk',
            documentation: '/docs/sdk/python',
            features: ['Async/await support', 'Type hints', 'Django integration'],
          },
          {
            language: 'Java',
            name: 'auth-service-java',
            version: '1.0.0',
            maven: 'groupId: com.yourorg, artifactId: auth-service-java',
            github: 'https://github.com/yourorg/auth-service-java-sdk',
            documentation: '/docs/sdk/java',
            features: ['Spring Boot integration', 'Reactive support', 'JWT validation'],
          },
          {
            language: 'PHP',
            name: 'auth-service-php',
            version: '1.0.0',
            composer: 'composer require yourorg/auth-service-php',
            github: 'https://github.com/yourorg/auth-service-php-sdk',
            documentation: '/docs/sdk/php',
            features: ['Laravel integration', 'PSR-7 compatibility', 'Caching support'],
          },
        ],
        customSdk: {
          title: '自定义SDK开发',
          description: '基于我们的OpenAPI规范，您可以生成任何语言的SDK',
          openApiSpec: '/api/docs-json',
          generator: 'https://openapi-generator.tech/',
        },
      },
    };
  }

  @Get('tutorials')
  @ApiOperation({ summary: '获取教程列表' })
  @ApiResponse({ status: 200, description: '返回教程列表' })
  getTutorials() {
    return {
      success: true,
      data: {
        title: 'Auth Service 教程',
        categories: [
          {
            name: 'getting-started',
            title: '入门教程',
            tutorials: [
              {
                title: '5分钟快速集成',
                description: '从零开始，5分钟完成Auth Service的基本集成',
                duration: '5 min',
                difficulty: 'beginner',
                url: '/docs/tutorials/quick-integration',
              },
              {
                title: '理解多租户架构',
                description: '深入了解Auth Service的多租户设计',
                duration: '15 min',
                difficulty: 'intermediate',
                url: '/docs/tutorials/multi-tenant',
              },
            ],
          },
          {
            name: 'frontend',
            title: '前端集成',
            tutorials: [
              {
                title: 'React应用集成详解',
                description: '详细的React应用认证集成指南',
                duration: '30 min',
                difficulty: 'intermediate',
                url: '/docs/tutorials/react-integration',
              },
              {
                title: 'Vue.js应用集成',
                description: 'Vue.js应用的认证实现方案',
                duration: '25 min',
                difficulty: 'intermediate',
                url: '/docs/tutorials/vue-integration',
              },
            ],
          },
          {
            name: 'backend',
            title: '后端集成',
            tutorials: [
              {
                title: 'Node.js服务验证JWT',
                description: '在Node.js微服务中验证Auth Service的JWT',
                duration: '20 min',
                difficulty: 'intermediate',
                url: '/docs/tutorials/nodejs-jwt-validation',
              },
              {
                title: 'Python Flask集成',
                description: 'Python Flask应用的认证集成',
                duration: '25 min',
                difficulty: 'intermediate',
                url: '/docs/tutorials/python-flask',
              },
            ],
          },
          {
            name: 'advanced',
            title: '高级特性',
            tutorials: [
              {
                title: '自定义OAuth提供商',
                description: '添加自定义的OAuth登录提供商',
                duration: '45 min',
                difficulty: 'advanced',
                url: '/docs/tutorials/custom-oauth',
              },
              {
                title: '监控和性能优化',
                description: '配置监控系统并优化性能',
                duration: '35 min',
                difficulty: 'advanced',
                url: '/docs/tutorials/monitoring-optimization',
              },
            ],
          },
        ],
      },
    };
  }

  private detectLanguage(code: string): string {
    if (code.includes('import React') || code.includes('const [')) {
      return 'javascript/react';
    }
    if (code.includes('from flask import') || code.includes('def ')) {
      return 'python';
    }
    if (code.includes('const express') || code.includes('app.get(')) {
      return 'javascript/node';
    }
    if (code.includes('curl -X')) {
      return 'bash';
    }
    return 'unknown';
  }
}