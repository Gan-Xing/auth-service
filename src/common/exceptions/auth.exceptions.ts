import { HttpException, HttpStatus } from '@nestjs/common';

export class AuthException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.UNAUTHORIZED,
    public readonly errorCode?: string,
    public readonly details?: any,
  ) {
    super(
      {
        message,
        errorCode: errorCode || 'AUTH_ERROR',
        details,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}

export class ValidationException extends HttpException {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        message,
        errorCode: 'VALIDATION_ERROR',
        field,
        value,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}

export class BusinessException extends HttpException {
  constructor(
    message: string,
    public readonly errorCode: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: any,
  ) {
    super(
      {
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}

export class DatabaseException extends HttpException {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly originalError?: any,
  ) {
    super(
      {
        message: 'Database operation failed',
        errorCode: 'DATABASE_ERROR',
        operation,
        details: originalError?.message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class RedisException extends HttpException {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly originalError?: any,
  ) {
    super(
      {
        message: 'Redis operation failed',
        errorCode: 'REDIS_ERROR',
        operation,
        details: originalError?.message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class RateLimitException extends HttpException {
  constructor(
    message: string = '请求过于频繁，请稍后重试',
    public readonly limit: number,
    public readonly windowMs: number,
    public readonly retryAfter?: number,
  ) {
    super(
      {
        message,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        limit,
        windowMs,
        retryAfter,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class TenantException extends HttpException {
  constructor(
    message: string,
    public readonly tenantId: string,
    public readonly operation: string,
  ) {
    super(
      {
        message,
        errorCode: 'TENANT_ERROR',
        tenantId,
        operation,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class TokenException extends HttpException {
  constructor(
    message: string,
    public readonly tokenType: 'access' | 'refresh' | 'verification' | 'reset',
    public readonly reason: 'expired' | 'invalid' | 'malformed' | 'revoked',
  ) {
    super(
      {
        message,
        errorCode: 'TOKEN_ERROR',
        tokenType,
        reason,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}