import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as crypto from 'crypto';

interface JWKSResponse {
  keys: Array<{
    kty: string;
    use: string;
    kid: string;
    alg: string;
    n?: string;
    e?: string;
    k?: string;
  }>;
}

@ApiTags('jwks')
@Controller('.well-known')
export class JwksController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * JWKS (JSON Web Key Set) 端点
   * 提供用于验证 JWT 的公钥信息
   */
  @Get('jwks.json')
  @ApiOperation({ 
    summary: 'JWKS 公钥端点',
    description: '返回用于验证 JWT Token 的公钥集合，供其他服务验证 JWT 签名使用'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'JWKS 公钥信息',
    schema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kty: { type: 'string', description: '密钥类型' },
              use: { type: 'string', description: '密钥用途' },
              kid: { type: 'string', description: '密钥ID' },
              alg: { type: 'string', description: '算法' },
              k: { type: 'string', description: '对称密钥（Base64 编码）' }
            }
          }
        }
      }
    }
  })
  async getJwks(): Promise<JWKSResponse> {
    const accessSecret = this.configService.get<string>('jwt.accessSecret');
    
    // 对于 HMAC (HS256) 算法，我们返回对称密钥的 JWKS
    // 注意：在生产环境中，建议使用 RS256 (RSA) 非对称加密
    const jwks: JWKSResponse = {
      keys: [
        {
          kty: 'oct', // 对称密钥类型
          use: 'sig', // 用于签名
          kid: 'auth-service-key-1', // 密钥 ID
          alg: 'HS256', // HMAC SHA-256 算法
          k: Buffer.from(accessSecret).toString('base64url'), // Base64URL 编码的密钥
        }
      ]
    };

    return jwks;
  }

  /**
   * OpenID Connect Discovery 端点（可选）
   * 提供认证服务的元数据信息
   */
  @Get('openid_configuration')
  @ApiOperation({ 
    summary: 'OpenID Connect Discovery',
    description: '返回 OpenID Connect 服务发现信息'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'OpenID Connect 配置信息'
  })
  async getOpenIdConfiguration(): Promise<any> {
    const baseUrl = this.getBaseUrl();
    
    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/login`,
      token_endpoint: `${baseUrl}/auth/login`,
      userinfo_endpoint: `${baseUrl}/auth/profile`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      registration_endpoint: `${baseUrl}/register`,
      scopes_supported: ['openid', 'profile', 'email'],
      response_types_supported: ['code', 'token', 'id_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['HS256'],
      claims_supported: [
        'sub',
        'name',
        'email',
        'email_verified',
        'iat',
        'exp'
      ]
    };
  }

  /**
   * 获取服务的基础 URL
   */
  private getBaseUrl(): string {
    // 在生产环境中，这应该从配置中读取
    const port = this.configService.get<number>('port', 3001);
    return process.env.BASE_URL || `http://localhost:${port}`;
  }
}