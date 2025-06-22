import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Request, Response } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
  path: string;
  method: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  private readonly logger = new Logger(ResponseInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      map((data) => {
        const isHealthCheck = request.url.includes('/health');
        const isSwaggerDoc = request.url.includes('/api/docs') || request.url.includes('/api-json');
        const isTemplateRoute = request.url.startsWith('/admin/') && !request.url.startsWith('/admin/api/') && !request.url.startsWith('/admin/auth/');
        const isHtmlContent = response.getHeader('Content-Type')?.toString().includes('text/html');
        
        // Don't wrap certain responses (health checks, swagger docs, template pages)
        if (isHealthCheck || isSwaggerDoc || isTemplateRoute || isHtmlContent) {
          return data;
        }

        const wrappedResponse = {
          success: true,
          data,
          message: this.getSuccessMessage(request.method, request.url),
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
        };
        
        // 特别打印 /admin/auth/login 的响应
        if (request.url === '/admin/auth/login') {
          console.log('\n========== ResponseInterceptor: Final Response ==========');
          console.log(JSON.stringify(wrappedResponse, null, 2));
          console.log('========================================================\n');
        }
        
        return wrappedResponse;
      }),
      tap(() => {
        const duration = Date.now() - startTime;
        
        // Log slow requests
        if (duration > 1000) {
          this.logger.warn(`Slow request detected: ${request.method} ${request.url} - ${duration}ms`);
        }
        
        // Log API usage for monitoring
        this.logger.log(`${request.method} ${request.url} - ${response.statusCode} - ${duration}ms`);
      }),
    );
  }

  private getSuccessMessage(method: string, url: string): string {
    // Customize success messages based on operation
    if (url.includes('/login')) return '登录成功';
    if (url.includes('/register')) return '注册成功';
    if (url.includes('/logout')) return '登出成功';
    if (url.includes('/refresh')) return 'Token刷新成功';
    if (url.includes('/verification-code')) return '验证码发送成功';
    if (url.includes('/reset-password')) return '密码重置成功';
    if (url.includes('/change-password')) return '密码修改成功';
    
    switch (method) {
      case 'POST':
        return '创建成功';
      case 'PUT':
      case 'PATCH':
        return '更新成功';
      case 'DELETE':
        return '删除成功';
      case 'GET':
        return '查询成功';
      default:
        return '操作成功';
    }
  }
}