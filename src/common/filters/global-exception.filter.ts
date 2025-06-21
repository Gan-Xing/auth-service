import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { ThrottlerException } from '@nestjs/throttler';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus;
    let message: string;
    let errorCode: string;
    let details: any;

    // 判断是否为需要忽略的错误
    const isIgnorableError = this.isIgnorableError(request.url, exception);
    
    // 根据错误类型决定日志级别
    if (!isIgnorableError) {
      const logLevel = this.getLogLevel(exception);
      const errorMessage = `Exception occurred: ${exception instanceof Error ? exception.message : 'Unknown error'}`;
      const errorContext = {
        url: request.url,
        method: request.method,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      };

      if (logLevel === 'error') {
        this.logger.error(
          errorMessage,
          exception instanceof Error ? exception.stack : undefined,
          errorContext,
        );
      } else if (logLevel === 'warn') {
        this.logger.warn(errorMessage, errorContext);
      } else {
        this.logger.debug(errorMessage, errorContext);
      }
    }

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        errorCode = responseObj.errorCode || 'HTTP_EXCEPTION';
        details = responseObj.details;
      } else {
        message = exception.message;
        errorCode = 'HTTP_EXCEPTION';
      }
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      message = '请求过于频繁，请稍后重试';
      errorCode = 'RATE_LIMIT_EXCEEDED';
    } else if (exception instanceof PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      errorCode = 'DATABASE_ERROR';
      
      switch (exception.code) {
        case 'P2002':
          message = '数据已存在，违反唯一性约束';
          details = { 
            fields: exception.meta?.target,
            constraint: 'unique_violation'
          };
          break;
        case 'P2025':
          message = '记录未找到';
          details = { constraint: 'record_not_found' };
          break;
        case 'P2003':
          message = '外键约束失败';
          details = { constraint: 'foreign_key_violation' };
          break;
        case 'P2016':
          message = '查询解释错误';
          details = { constraint: 'query_interpretation_error' };
          break;
        default:
          message = '数据库操作失败';
          details = { code: exception.code, meta: exception.meta };
      }
    } else if (exception instanceof PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = '数据验证失败';
      errorCode = 'VALIDATION_ERROR';
      details = { originalError: exception.message };
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '服务器内部错误';
      errorCode = 'INTERNAL_SERVER_ERROR';
      details = process.env.NODE_ENV === 'development' ? {
        originalMessage: exception.message,
        stack: exception.stack,
      } : undefined;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '未知错误';
      errorCode = 'UNKNOWN_ERROR';
    }

    // Security: Don't expose sensitive information in production
    if (process.env.NODE_ENV === 'production') {
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        message = '服务器内部错误';
        details = undefined;
      }
    }

    const errorResponse = {
      success: false,
      error: {
        message,
        errorCode,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        ...(details && { details }),
      },
    };

    // Log security-related errors with higher priority
    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      this.logger.warn(`Security violation: ${message}`, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        url: request.url,
        method: request.method,
      });
    }

    response.status(status).json(errorResponse);
  }

  /**
   * 判断是否为可忽略的错误
   */
  private isIgnorableError(url: string, exception: unknown): boolean {
    // Chrome DevTools 相关的请求
    if (url.includes('/.well-known/appspecific/com.chrome.devtools.json')) {
      return true;
    }

    // 静态资源 404 错误（对于不存在的 CSS、JS 文件）
    if (exception instanceof HttpException && exception.getStatus() === 404) {
      const staticExtensions = ['.css', '.js', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
      return staticExtensions.some(ext => url.endsWith(ext));
    }

    return false;
  }

  /**
   * 根据异常类型确定日志级别
   */
  private getLogLevel(exception: unknown): 'error' | 'warn' | 'debug' {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      
      // 客户端错误（4xx）通常记录为 warn 或 debug
      if (status >= 400 && status < 500) {
        // 认证和授权错误记录为 warn
        if (status === 401 || status === 403) {
          return 'warn';
        }
        // 其他客户端错误记录为 debug
        return 'debug';
      }
      
      // 服务器错误（5xx）记录为 error
      if (status >= 500) {
        return 'error';
      }
    }

    // 数据库错误记录为 error
    if (exception instanceof PrismaClientKnownRequestError || 
        exception instanceof PrismaClientValidationError) {
      return 'error';
    }

    // 其他错误默认记录为 error
    return 'error';
  }
}