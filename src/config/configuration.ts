export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/auth_db',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'auth-service-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'auth-service-refresh-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    from: process.env.EMAIL_FROM || 'noreply@auth-service.com',
  },
  sms: {
    // 首选：Vonage (原 Nexmo) - 性价比高，覆盖全球
    vonage: {
      apiKey: process.env.VONAGE_API_KEY || '',
      apiSecret: process.env.VONAGE_API_SECRET || '',
      from: process.env.VONAGE_FROM || 'AuthService',
    },
    // 备选：Twilio - 可靠性高，功能丰富
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      from: process.env.TWILIO_FROM || '',
    },
    // 备选：AWS SNS - 与其他AWS服务集成好
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'us-east-1',
    },
    // 服务配置
    provider: process.env.SMS_PROVIDER || 'vonage', // vonage, twilio, aws
    rateLimit: {
      maxSmsPerHour: parseInt(process.env.SMS_RATE_LIMIT_HOUR || '10', 10),
      maxSmsPerDay: parseInt(process.env.SMS_RATE_LIMIT_DAY || '50', 10),
    },
    // 国际短信配置
    international: {
      enabled: process.env.SMS_INTERNATIONAL_ENABLED === 'true',
      allowedCountries: process.env.SMS_ALLOWED_COUNTRIES?.split(',') || [], // 如 ['US', 'CN', 'GB']
      defaultCountryCode: process.env.SMS_DEFAULT_COUNTRY_CODE || '86', // 中国
    },
  },
  wechat: {
    appId: process.env.WECHAT_APP_ID || '',
    appSecret: process.env.WECHAT_APP_SECRET || '',
  },
  oauth: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/auth/oauth/github/callback',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/oauth/google/callback',
    },
  },
  app: {
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:3001',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metricsInterval: parseInt(process.env.MONITORING_METRICS_INTERVAL || '60000', 10),
    slowQueryThreshold: parseInt(process.env.MONITORING_SLOW_QUERY_THRESHOLD || '2000', 10),
    highCpuThreshold: parseInt(process.env.MONITORING_HIGH_CPU_THRESHOLD || '80', 10),
    highMemoryThreshold: parseInt(process.env.MONITORING_HIGH_MEMORY_THRESHOLD || '80', 10),
  },
  alerts: {
    enabled: process.env.ALERTS_ENABLED === 'true',
    emailEnabled: process.env.ALERTS_EMAIL_ENABLED === 'true',
    webhookEnabled: process.env.ALERTS_WEBHOOK_ENABLED === 'true',
    adminEmail: process.env.ALERTS_ADMIN_EMAIL || '',
    webhookUrl: process.env.ALERTS_WEBHOOK_URL || '',
    thresholds: {
      errorRate: parseInt(process.env.ALERT_ERROR_RATE_THRESHOLD || '10', 10),
      responseTime: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD || '3000', 10),
      failedLogin: parseInt(process.env.ALERT_FAILED_LOGIN_THRESHOLD || '50', 10),
      databaseErrors: parseInt(process.env.ALERT_DATABASE_CONNECTION_ERRORS || '5', 10),
      redisErrors: parseInt(process.env.ALERT_REDIS_CONNECTION_ERRORS || '5', 10),
    },
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    retentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30', 10),
    collectionInterval: parseInt(process.env.METRICS_COLLECTION_INTERVAL || '30000', 10),
  },
  performance: {
    apiResponseTimeThreshold: parseInt(process.env.PERF_API_RESPONSE_TIME_THRESHOLD || '1000', 10),
    databaseQueryTimeThreshold: parseInt(process.env.PERF_DATABASE_QUERY_TIME_THRESHOLD || '500', 10),
    redisOperationTimeThreshold: parseInt(process.env.PERF_REDIS_OPERATION_TIME_THRESHOLD || '100', 10),
  },
  security: {
    monitoringEnabled: process.env.SECURITY_MONITORING_ENABLED === 'true',
    bruteForceThreshold: parseInt(process.env.SECURITY_BRUTE_FORCE_THRESHOLD || '10', 10),
    suspiciousActivityThreshold: parseInt(process.env.SECURITY_SUSPICIOUS_ACTIVITY_THRESHOLD || '5', 10),
    ipWhitelist: process.env.SECURITY_IP_WHITELIST?.split(',') || [],
    blockSuspiciousIps: process.env.SECURITY_BLOCK_SUSPICIOUS_IPS === 'true',
  },
  healthCheck: {
    enabled: process.env.HEALTH_CHECK_ENABLED === 'true',
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
    memoryThreshold: parseInt(process.env.HEALTH_CHECK_MEMORY_THRESHOLD || '80', 10),
  },
  featureFlags: {
    // 邮件服务功能开关
    emailService: process.env.FF_EMAIL_SERVICE !== 'false',
    emailVerification: process.env.FF_EMAIL_VERIFICATION !== 'false',
    emailPasswordReset: process.env.FF_EMAIL_PASSWORD_RESET !== 'false',
    emailWelcome: process.env.FF_EMAIL_WELCOME !== 'false',
    
    // 短信服务功能开关
    smsService: process.env.FF_SMS_SERVICE !== 'false',
    smsVerification: process.env.FF_SMS_VERIFICATION !== 'false',
    smsInternational: process.env.FF_SMS_INTERNATIONAL === 'true',
    
    // OAuth服务功能开关
    oauthGithub: process.env.FF_OAUTH_GITHUB !== 'false',
    oauthGoogle: process.env.FF_OAUTH_GOOGLE !== 'false',
    oauthWechat: process.env.FF_OAUTH_WECHAT !== 'false',
    
    // 监控功能开关
    monitoringEnabled: process.env.FF_MONITORING_ENABLED !== 'false',
    alertsEnabled: process.env.FF_ALERTS_ENABLED !== 'false',
    metricsCollection: process.env.FF_METRICS_COLLECTION !== 'false',
    
    // 安全功能开关
    rateLimiting: process.env.FF_RATE_LIMITING !== 'false',
    bruteForceProtection: process.env.FF_BRUTE_FORCE_PROTECTION !== 'false',
    ipWhitelist: process.env.FF_IP_WHITELIST === 'true',
    
    // 审计功能开关
    auditLogging: process.env.FF_AUDIT_LOGGING !== 'false',
    auditDetailed: process.env.FF_AUDIT_DETAILED === 'true',
    
    // 用户管理功能开关
    userRegistration: process.env.FF_USER_REGISTRATION !== 'false',
    registrationEmailVerification: process.env.FF_REGISTRATION_EMAIL_VERIFICATION !== 'false',
    
    // 管理功能开关
    adminPanel: process.env.FF_ADMIN_PANEL !== 'false',
    apiDocumentation: process.env.FF_API_DOCUMENTATION !== 'false',
    healthChecks: process.env.FF_HEALTH_CHECKS !== 'false',
  },
});
