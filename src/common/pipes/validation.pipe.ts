import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  Logger,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ValidationException } from '../exceptions/auth.exceptions';

@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  private readonly logger = new Logger(CustomValidationPipe.name);

  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return this.sanitizeInput(value);
    }

    // Transform and sanitize input
    const object = plainToClass(metatype, this.sanitizeInput(value));
    const errors = await validate(object, {
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error for extra properties
      transform: true, // Transform types
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
    });

    if (errors.length > 0) {
      const errorMessages = this.formatErrors(errors);
      this.logger.warn('Validation failed', { errors: errorMessages, value });
      
      throw new ValidationException(
        '输入数据验证失败',
        errorMessages[0]?.field,
        errorMessages[0]?.value,
      );
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private sanitizeInput(value: any): any {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }
    
    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeInput(item));
    }
    
    if (value && typeof value === 'object') {
      const sanitized = {};
      for (const [key, val] of Object.entries(value)) {
        // Remove potentially dangerous keys
        if (!this.isDangerousKey(key)) {
          sanitized[key] = this.sanitizeInput(val);
        }
      }
      return sanitized;
    }
    
    return value;
  }

  private sanitizeString(input: string): string {
    if (!input) return input;
    
    // Trim whitespace
    let sanitized = input.trim();
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Basic XSS prevention for specific fields
    if (this.isHtmlField(sanitized)) {
      sanitized = this.escapeHtml(sanitized);
    }
    
    return sanitized;
  }

  private isDangerousKey(key: string): boolean {
    const dangerousKeys = [
      '__proto__',
      'constructor',
      'prototype',
      'eval',
      'function',
      'script',
    ];
    return dangerousKeys.includes(key.toLowerCase());
  }

  private isHtmlField(value: string): boolean {
    // Check if the value contains HTML-like patterns
    return /<[^>]*>/g.test(value);
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatErrors(errors: any[]): Array<{ field: string; value: any; constraints: string[] }> {
    return errors.map(error => ({
      field: error.property,
      value: error.value,
      constraints: Object.values(error.constraints || {}),
    }));
  }
}