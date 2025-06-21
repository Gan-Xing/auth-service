import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// 强密码验证器
@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string, args: ValidationArguments) {
    if (!password) return false;
    
    // 至少8位，包含大小写字母、数字和特殊字符
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
  }

  defaultMessage(args: ValidationArguments) {
    return '密码必须至少8位，包含大小写字母、数字和特殊字符(@$!%*?&)';
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}

// 邮箱验证器（更严格）
@ValidatorConstraint({ name: 'isBusinessEmail', async: false })
export class IsBusinessEmailConstraint implements ValidatorConstraintInterface {
  validate(email: string, args: ValidationArguments) {
    if (!email) return false;
    
    // 更严格的邮箱格式验证
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) return false;
    
    // 检查是否为临时邮箱域名
    const tempEmailDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com',
      'throwaway.email',
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    return !tempEmailDomains.includes(domain);
  }

  defaultMessage(args: ValidationArguments) {
    return '请提供有效的商业邮箱地址';
  }
}

export function IsBusinessEmail(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsBusinessEmailConstraint,
    });
  };
}

// 用户名验证器
@ValidatorConstraint({ name: 'isValidUsername', async: false })
export class IsValidUsernameConstraint implements ValidatorConstraintInterface {
  validate(username: string, args: ValidationArguments) {
    if (!username) return false;
    
    // 用户名：3-20位，字母数字下划线，不能以数字开头
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
    if (!usernameRegex.test(username)) return false;
    
    // 禁用词汇检查
    const reservedWords = [
      'admin', 'administrator', 'root', 'system', 'api', 'www', 'ftp', 'mail',
      'test', 'demo', 'guest', 'null', 'undefined', 'support', 'help',
    ];
    
    return !reservedWords.includes(username.toLowerCase());
  }

  defaultMessage(args: ValidationArguments) {
    return '用户名必须3-20位，字母开头，只能包含字母、数字和下划线，不能使用保留词汇';
  }
}

export function IsValidUsername(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidUsernameConstraint,
    });
  };
}

// 手机号验证器（支持多国格式）
@ValidatorConstraint({ name: 'isValidPhoneNumber', async: false })
export class IsValidPhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(phoneNumber: string, args: ValidationArguments) {
    if (!phoneNumber) return true; // 可选字段
    
    // 支持中国大陆、香港、台湾、美国等主要地区手机号格式
    const phoneRegexes = [
      /^\+86[1-9]\d{10}$/, // 中国大陆 +86
      /^\+852[0-9]{8}$/, // 香港 +852
      /^\+886[0-9]{9}$/, // 台湾 +886
      /^\+1[0-9]{10}$/, // 美国/加拿大 +1
      /^1[3-9]\d{9}$/, // 中国大陆无国际码
    ];
    
    return phoneRegexes.some(regex => regex.test(phoneNumber));
  }

  defaultMessage(args: ValidationArguments) {
    return '请提供有效的手机号码格式（支持+86/+852/+886/+1等国际格式）';
  }
}

export function IsValidPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPhoneNumberConstraint,
    });
  };
}

// 租户域名验证器
@ValidatorConstraint({ name: 'isValidDomain', async: false })
export class IsValidDomainConstraint implements ValidatorConstraintInterface {
  validate(domain: string, args: ValidationArguments) {
    if (!domain) return true; // 可选字段
    
    // 域名格式验证
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) return false;
    
    // 禁止使用的域名
    const restrictedDomains = [
      'localhost',
      'example.com',
      'test.com',
      'admin.com',
      'api.com',
    ];
    
    return !restrictedDomains.includes(domain.toLowerCase());
  }

  defaultMessage(args: ValidationArguments) {
    return '请提供有效的域名格式（如：company.com）';
  }
}

export function IsValidDomain(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidDomainConstraint,
    });
  };
}