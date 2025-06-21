import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GitHubStrategy.name);

  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('oauth.github.clientId'),
      clientSecret: configService.get<string>('oauth.github.clientSecret'),
      callbackURL: configService.get<string>('oauth.github.callbackUrl'),
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (error: any, user?: any) => void,
  ): Promise<any> {
    try {
      this.logger.log(`GitHub OAuth用户验证: ${profile.username}`);

      // 提取用户信息
      const { id, username, displayName, emails, photos } = profile;
      const email = emails?.[0]?.value;
      const avatar = photos?.[0]?.value;

      if (!email) {
        this.logger.warn(`GitHub用户${username}没有公开邮箱`);
        return done(new Error('GitHub账户必须有公开的邮箱地址'), null);
      }

      // 构建用户数据
      const githubUser = {
        githubId: id,
        username,
        email: email.toLowerCase(),
        firstName: displayName?.split(' ')[0] || username,
        lastName: displayName?.split(' ').slice(1).join(' ') || '',
        avatar,
        provider: 'github',
        accessToken,
        refreshToken,
      };

      this.logger.log(`GitHub用户信息提取成功: ${email}`);
      return done(null, githubUser);
    } catch (error) {
      this.logger.error('GitHub OAuth验证失败', error.stack);
      return done(error, null);
    }
  }
}