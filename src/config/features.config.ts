/**
 * 功能开关配置
 * 控制 auth-service 的可选功能启用/禁用
 */

export interface FeaturesConfig {
  // SSO 登录提供商
  sso: {
    github: {
      enabled: boolean;
      clientId?: string;
      clientSecret?: string;
    };
    google: {
      enabled: boolean;
      clientId?: string;
      clientSecret?: string;
    };
    wechat: {
      enabled: boolean;
      appId?: string;
      appSecret?: string;
    };
  };

  // 外部服务集成
  services: {
    // 使用统计服务
    usageService: {
      enabled: boolean;
      endpoint?: string;
      apiKey?: string;
    };

    // 速率限制服务
    rateLimiter: {
      enabled: boolean;
      endpoint?: string;
      defaultLimits: {
        login: number; // 每分钟登录次数
        register: number; // 每分钟注册次数
        verification: number; // 每分钟验证码发送次数
      };
    };

    // 配置服务
    configService: {
      enabled: boolean;
      endpoint?: string;
      refreshInterval: number; // 配置刷新间隔（秒）
    };

    // 通知服务
    notificationService: {
      enabled: boolean;
      endpoint?: string;
      channels: {
        email: boolean;
        sms: boolean;
        webhook: boolean;
      };
    };

    // Webhook 服务
    webhookService: {
      enabled: boolean;
      endpoint?: string;
      events: string[]; // 要通知的事件列表
    };
  };

  // 内置功能开关
  features: {
    // 邮件验证
    emailVerification: {
      enabled: boolean;
      required: boolean; // 是否强制验证
    };

    // 会话管理
    sessionManagement: {
      enabled: boolean;
      maxSessions: number; // 每用户最大会话数
    };

    // 审计日志
    auditLog: {
      enabled: boolean;
      events: string[]; // 要记录的事件
      retention: number; // 日志保留天数
    };

    // API 限制
    apiLimits: {
      enabled: boolean;
      perUser: number; // 每用户每小时请求数
      perTenant: number; // 每租户每小时请求数
    };
  };
}

/**
 * 默认配置
 */
export const defaultFeaturesConfig: FeaturesConfig = {
  sso: {
    github: {
      enabled: false,
    },
    google: {
      enabled: false,
    },
    wechat: {
      enabled: false,
    },
  },

  services: {
    usageService: {
      enabled: false,
    },
    rateLimiter: {
      enabled: false,
      defaultLimits: {
        login: 30,
        register: 10,
        verification: 5,
      },
    },
    configService: {
      enabled: false,
      refreshInterval: 300, // 5分钟
    },
    notificationService: {
      enabled: false,
      channels: {
        email: true,
        sms: false,
        webhook: false,
      },
    },
    webhookService: {
      enabled: false,
      events: ['user.registered', 'user.login', 'user.password_reset'],
    },
  },

  features: {
    emailVerification: {
      enabled: true,
      required: false,
    },
    sessionManagement: {
      enabled: true,
      maxSessions: 5,
    },
    auditLog: {
      enabled: true,
      events: ['login', 'register', 'password_change'],
      retention: 90,
    },
    apiLimits: {
      enabled: true,
      perUser: 1000,
      perTenant: 10000,
    },
  },
};

/**
 * 从环境变量加载配置
 */
export function loadFeaturesConfig(): FeaturesConfig {
  const config = { ...defaultFeaturesConfig };

  // SSO 配置
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    config.sso.github = {
      enabled: true,
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    config.sso.google = {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  // 外部服务配置
  if (process.env.USAGE_SERVICE_ENDPOINT) {
    config.services.usageService = {
      enabled: true,
      endpoint: process.env.USAGE_SERVICE_ENDPOINT,
      apiKey: process.env.USAGE_SERVICE_API_KEY,
    };
  }

  if (process.env.RATE_LIMITER_ENDPOINT) {
    config.services.rateLimiter.enabled = true;
    config.services.rateLimiter.endpoint = process.env.RATE_LIMITER_ENDPOINT;
  }

  // 功能开关
  if (process.env.EMAIL_VERIFICATION_REQUIRED === 'true') {
    config.features.emailVerification.required = true;
  }

  return config;
}
