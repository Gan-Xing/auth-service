import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('oauth.google.clientId'),
      clientSecret: configService.get<string>('oauth.google.clientSecret'),
      callbackURL: configService.get<string>('oauth.google.callbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (error: any, user?: any) => void,
  ): Promise<any> {
    try {
      this.logger.log(`Google OAuth用户验证: ${profile.displayName}`);

      // 提取用户信息
      const { id, displayName, emails, photos } = profile;
      const email = emails?.[0]?.value;
      const avatar = photos?.[0]?.value;

      if (!email) {
        this.logger.warn(`Google用户${displayName}没有邮箱信息`);
        return done(new Error('Google账户必须有邮箱地址'), null);
      }

      // 构建用户数据
      const googleUser = {
        googleId: id,
        username: email.split('@')[0], // 使用邮箱用户名部分
        email: email.toLowerCase(),
        firstName: profile.name?.givenName || displayName?.split(' ')[0] || 'User',
        lastName: profile.name?.familyName || displayName?.split(' ').slice(1).join(' ') || '',
        avatar,
        provider: 'google',
        accessToken,
        refreshToken,
      };

      this.logger.log(`Google用户信息提取成功: ${email}`);
      return done(null, googleUser);
    } catch (error) {
      this.logger.error('Google OAuth验证失败', error.stack);
      return done(error, null);
    }
  }
}