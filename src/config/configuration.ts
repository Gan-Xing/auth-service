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
    alicloud: {
      accessKeyId: process.env.ALICLOUD_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.ALICLOUD_ACCESS_KEY_SECRET || '',
      signName: process.env.SMS_SIGN_NAME || 'AuthService',
      templateCode: process.env.SMS_TEMPLATE_CODE || 'SMS_123456789',
    },
  },
  wechat: {
    appId: process.env.WECHAT_APP_ID || '',
    appSecret: process.env.WECHAT_APP_SECRET || '',
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
});
