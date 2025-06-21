import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {
    this.initializeRedis();
  }

  private initializeRedis() {
    const redisConfig = this.configService.get('redis');
    
    this.client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password || undefined,
      db: redisConfig.db,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connection established');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis client ready');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // Token management
  async storeRefreshToken(userId: number, tokenId: string, token: string, expiresIn: number): Promise<void> {
    const key = `refresh_token:${userId}:${tokenId}`;
    await this.client.setex(key, expiresIn, token);
  }

  async getRefreshToken(userId: number, tokenId: string): Promise<string | null> {
    const key = `refresh_token:${userId}:${tokenId}`;
    return await this.client.get(key);
  }

  async revokeRefreshToken(userId: number, tokenId: string): Promise<void> {
    const key = `refresh_token:${userId}:${tokenId}`;
    await this.client.del(key);
  }

  async revokeAllUserTokens(userId: number): Promise<void> {
    const pattern = `refresh_token:${userId}:*`;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  // Verification code management
  async storeVerificationCode(email: string, code: string, expiresIn: number = 300): Promise<void> {
    const key = `verification_code:${email}`;
    await this.client.setex(key, expiresIn, code);
  }

  async getVerificationCode(email: string): Promise<string | null> {
    const key = `verification_code:${email}`;
    return await this.client.get(key);
  }

  async deleteVerificationCode(email: string): Promise<void> {
    const key = `verification_code:${email}`;
    await this.client.del(key);
  }

  // Rate limiting
  async incrementLoginAttempts(identifier: string, windowSeconds: number = 900): Promise<number> {
    const key = `login_attempts:${identifier}`;
    const current = await this.client.incr(key);
    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }
    return current;
  }

  async getLoginAttempts(identifier: string): Promise<number> {
    const key = `login_attempts:${identifier}`;
    const attempts = await this.client.get(key);
    return attempts ? parseInt(attempts, 10) : 0;
  }

  async resetLoginAttempts(identifier: string): Promise<void> {
    const key = `login_attempts:${identifier}`;
    await this.client.del(key);
  }

  // Session management
  async storeUserSession(userId: number, sessionId: string, sessionData: any, expiresIn: number): Promise<void> {
    const key = `user_session:${userId}:${sessionId}`;
    await this.client.setex(key, expiresIn, JSON.stringify(sessionData));
  }

  async getUserSession(userId: number, sessionId: string): Promise<any | null> {
    const key = `user_session:${userId}:${sessionId}`;
    const session = await this.client.get(key);
    return session ? JSON.parse(session) : null;
  }

  async deleteUserSession(userId: number, sessionId: string): Promise<void> {
    const key = `user_session:${userId}:${sessionId}`;
    await this.client.del(key);
  }

  async deleteAllUserSessions(userId: number): Promise<void> {
    const pattern = `user_session:${userId}:*`;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  // Password reset tokens
  async storePasswordResetToken(email: string, token: string, expiresIn: number = 3600): Promise<void> {
    const key = `password_reset:${email}`;
    await this.client.setex(key, expiresIn, token);
  }

  async getPasswordResetToken(email: string): Promise<string | null> {
    const key = `password_reset:${email}`;
    return await this.client.get(key);
  }

  async deletePasswordResetToken(email: string): Promise<void> {
    const key = `password_reset:${email}`;
    await this.client.del(key);
  }

  // Cache management
  async set(key: string, value: any, expiresIn?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (expiresIn) {
      await this.client.setex(key, expiresIn, serializedValue);
    } else {
      await this.client.set(key, serializedValue);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  // Health check
  async ping(): Promise<string> {
    return await this.client.ping();
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.ping();
      return true;
    } catch {
      return false;
    }
  }
}