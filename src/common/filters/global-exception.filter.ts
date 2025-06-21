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

    // Log the error for debugging
    this.logger.error(
      `Exception occurred: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
      exception instanceof Error ? exception.stack : undefined,
      {
        url: request.url,
        method: request.method,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );

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
}