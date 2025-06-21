import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FeatureFlag } from '../feature-flags.service';
import { RequireFeature, RequireFeatures, OptionalFeature } from '../decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../guards/feature-flag.guard';

/**
 * 示例：在控制器中使用功能开关装饰器
 * 这个文件展示了如何在控制器中正确使用功能开关装饰器
 */

@ApiTags('Email API (功能开关示例)')
@Controller('example/email')
@UseGuards(FeatureFlagGuard) // 在类级别启用功能开关守卫
export class EmailControllerExample {

  /**
   * 发送验证码 - 需要邮件服务启用
   */
  @Post('verification-code')
  @ApiOperation({ summary: '发送邮箱验证码' })
  @RequireFeature(FeatureFlag.EMAIL_VERIFICATION, {
    disabledMessage: '邮箱验证功能当前不可用，请联系管理员'
  })
  async sendVerificationCode(@Body() body: { email: string }) {
    return {
      success: true,
      message: '验证码已发送',
      email: body.email,
    };
  }

  /**
   * 发送欢迎邮件 - 可选功能
   */
  @Post('welcome')
  @ApiOperation({ summary: '发送欢迎邮件' })
  @OptionalFeature(FeatureFlag.EMAIL_WELCOME, {
    warningMessage: '欢迎邮件功能未启用，邮件可能不会发送'
  })
  async sendWelcomeEmail(@Body() body: { email: string; name: string }) {
    return {
      success: true,
      message: '欢迎邮件处理完成',
      recipient: body.email,
    };
  }

  /**
   * 密码重置 - 需要多个功能都启用
   */
  @Post('password-reset')
  @ApiOperation({ summary: '发送密码重置邮件' })
  @RequireFeatures([
    FeatureFlag.EMAIL_SERVICE,
    FeatureFlag.EMAIL_PASSWORD_RESET
  ], {
    operator: 'AND',
    disabledMessage: '密码重置功能当前不可用'
  })
  async sendPasswordReset(@Body() body: { email: string }) {
    return {
      success: true,
      message: '密码重置邮件已发送',
      email: body.email,
    };
  }
}

@ApiTags('OAuth API (功能开关示例)')
@Controller('example/oauth')
@UseGuards(FeatureFlagGuard)
export class OAuthControllerExample {

  /**
   * GitHub登录 - 需要GitHub OAuth启用
   */
  @Get('github')
  @ApiOperation({ summary: 'GitHub OAuth登录' })
  @RequireFeature(FeatureFlag.OAUTH_GITHUB, {
    allowTenantOverride: true,
    disabledMessage: 'GitHub登录功能当前不可用'
  })
  async githubLogin() {
    return {
      success: true,
      redirectUrl: 'https://github.com/login/oauth/authorize...',
    };
  }

  /**
   * Google登录 - 需要Google OAuth启用
   */
  @Get('google')
  @ApiOperation({ summary: 'Google OAuth登录' })
  @RequireFeature(FeatureFlag.OAUTH_GOOGLE)
  async googleLogin() {
    return {
      success: true,
      redirectUrl: 'https://accounts.google.com/oauth2/auth...',
    };
  }

  /**
   * 社交登录汇总 - 需要至少一个OAuth提供商启用
   */
  @Get('providers')
  @ApiOperation({ summary: '获取可用的OAuth提供商' })
  @RequireFeatures([
    FeatureFlag.OAUTH_GITHUB,
    FeatureFlag.OAUTH_GOOGLE,
    FeatureFlag.OAUTH_WECHAT
  ], {
    operator: 'OR', // 至少一个启用即可
    disabledMessage: '当前没有可用的第三方登录方式'
  })
  async getAvailableProviders() {
    return {
      success: true,
      providers: ['github', 'google', 'wechat'],
    };
  }
}

@ApiTags('Admin API (功能开关示例)')
@Controller('example/admin')
@UseGuards(FeatureFlagGuard)
export class AdminControllerExample {

  /**
   * 管理面板 - 需要管理功能启用
   */
  @Get('dashboard')
  @ApiOperation({ summary: '管理仪表板' })
  @RequireFeature(FeatureFlag.ADMIN_PANEL, {
    allowTenantOverride: false, // 不允许租户覆盖，只检查全局设置
    disabledMessage: '管理面板功能已被禁用'
  })
  async getDashboard() {
    return {
      success: true,
      data: {
        users: 100,
        tenants: 5,
        requests: 1000,
      },
    };
  }

  /**
   * 监控数据 - 需要监控功能启用
   */
  @Get('monitoring')
  @ApiOperation({ summary: '获取监控数据' })
  @RequireFeatures([
    FeatureFlag.MONITORING_ENABLED,
    FeatureFlag.METRICS_COLLECTION
  ])
  async getMonitoringData() {
    return {
      success: true,
      metrics: {
        cpu: '45%',
        memory: '62%',
        responseTime: '120ms',
      },
    };
  }
}

@ApiTags('User API (功能开关示例)')
@Controller('example/users')
@UseGuards(FeatureFlagGuard)
export class UserControllerExample {

  /**
   * 用户注册 - 需要注册功能启用
   */
  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  @RequireFeature(FeatureFlag.USER_REGISTRATION, {
    disabledMessage: '用户注册功能当前已关闭，请联系管理员'
  })
  async register(@Body() userData: any) {
    return {
      success: true,
      message: '注册成功',
      userId: 12345,
    };
  }

  /**
   * 注册并验证邮箱 - 需要注册和邮箱验证都启用
   */
  @Post('register-with-verification')
  @ApiOperation({ summary: '注册并发送验证邮件' })
  @RequireFeatures([
    FeatureFlag.USER_REGISTRATION,
    FeatureFlag.REGISTRATION_EMAIL_VERIFICATION
  ], {
    disabledMessage: '注册或邮箱验证功能不可用'
  })
  async registerWithVerification(@Body() userData: any) {
    return {
      success: true,
      message: '注册成功，验证邮件已发送',
      userId: 12345,
      emailSent: true,
    };
  }

  /**
   * 获取用户列表 - 可选审计功能
   */
  @Get()
  @ApiOperation({ summary: '获取用户列表' })
  @OptionalFeature(FeatureFlag.AUDIT_DETAILED, {
    warningMessage: '详细审计未启用，部分信息可能不完整'
  })
  async getUsers() {
    return {
      success: true,
      users: [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
      ],
    };
  }
}

/**
 * 混合使用示例 - 展示复杂的功能开关组合
 */
@ApiTags('Complex Features (复杂功能开关示例)')
@Controller('example/complex')
@UseGuards(FeatureFlagGuard)
export class ComplexFeatureExample {

  /**
   * 完整的用户注册流程
   * 需要：用户注册 + (邮箱验证 OR 短信验证)
   */
  @Post('full-registration')
  @ApiOperation({ summary: '完整注册流程' })
  @RequireFeature(FeatureFlag.USER_REGISTRATION) // 基础要求
  async fullRegistration(@Body() userData: any) {
    // 在方法内部检查可选的验证方式
    // 这里需要在方法内部使用FeatureFlagsService进行更复杂的逻辑判断
    
    return {
      success: true,
      message: '注册流程已启动',
      registrationId: '12345',
    };
  }

  /**
   * 高级监控端点
   * 需要：监控启用 + 告警启用 + 指标收集启用
   */
  @Get('advanced-monitoring')
  @ApiOperation({ summary: '高级监控数据' })
  @RequireFeatures([
    FeatureFlag.MONITORING_ENABLED,
    FeatureFlag.ALERTS_ENABLED,
    FeatureFlag.METRICS_COLLECTION
  ], {
    operator: 'AND',
    disabledMessage: '高级监控功能需要完整的监控套件启用'
  })
  async getAdvancedMonitoring() {
    return {
      success: true,
      monitoring: {
        realtime: true,
        alerts: 3,
        metrics: 150,
      },
    };
  }
}