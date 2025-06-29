import * as hbs from 'hbs';

export function registerHandlebarsHelpers() {
  // 注册 eq (等于) helper
  hbs.registerHelper('eq', function(a: any, b: any) {
    return a === b;
  });

  // 注册 ne (不等于) helper
  hbs.registerHelper('ne', function(a: any, b: any) {
    return a !== b;
  });

  // 注册 lt (小于) helper
  hbs.registerHelper('lt', function(a: any, b: any) {
    return a < b;
  });

  // 注册 gt (大于) helper
  hbs.registerHelper('gt', function(a: any, b: any) {
    return a > b;
  });

  // 注册 lte (小于等于) helper
  hbs.registerHelper('lte', function(a: any, b: any) {
    return a <= b;
  });

  // 注册 gte (大于等于) helper
  hbs.registerHelper('gte', function(a: any, b: any) {
    return a >= b;
  });

  // 注册 and helper
  hbs.registerHelper('and', function(a: any, b: any) {
    return a && b;
  });

  // 注册 or helper
  hbs.registerHelper('or', function(a: any, b: any) {
    return a || b;
  });

  // 注册 json helper (用于将对象转换为 JSON 字符串)
  hbs.registerHelper('json', function(context: any) {
    return JSON.stringify(context);
  });

  // 注册 formatDate helper (格式化日期)
  hbs.registerHelper('formatDate', function(date: Date | string) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  // 注册 includes helper (检查数组或字符串是否包含某个值)
  hbs.registerHelper('includes', function(arr: any[] | string, value: any) {
    if (Array.isArray(arr)) {
      return arr.includes(value);
    }
    if (typeof arr === 'string') {
      return arr.includes(value);
    }
    return false;
  });

  // 注册 unless_eq helper (如果不等于)
  hbs.registerHelper('unless_eq', function(a: any, b: any, options: any) {
    if (a !== b) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  // 注册 substring helper (字符串截取)
  hbs.registerHelper('substring', function(str: string, start: number, end?: number) {
    if (!str || typeof str !== 'string') return '';
    if (end !== undefined) {
      return str.substring(start, end);
    }
    return str.substring(start);
  });

  // 注册 capitalize helper (首字母大写)
  hbs.registerHelper('capitalize', function(str: string) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  // 注册 upper helper (转大写)
  hbs.registerHelper('upper', function(str: string) {
    if (!str || typeof str !== 'string') return '';
    return str.toUpperCase();
  });

  // 注册 lower helper (转小写)
  hbs.registerHelper('lower', function(str: string) {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase();
  });

  console.log('✅ Handlebars helpers registered successfully');
}