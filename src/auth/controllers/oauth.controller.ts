import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  Body,
  HttpStatus,
  Logger,
  Delete,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../services/oauth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GetUser } from '../decorators/get-user.decorator';
import { OAuthCallbackDto, OAuthLinkAccountDto, OAuthUnlinkAccountDto } from '../dto/oauth.dto';
import { TokenResponseDto } from '../dto/auth.dto';

@ApiTags('OAuth Authentication')
@Controller('auth/oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('github/authorize')
  @ApiOperation({ summary: '获取GitHub OAuth授权URL' })
  @ApiQuery({ name: 'tenant_id', required: false, description: '租户ID' })
  @ApiResponse({ status: 200, description: '返回授权URL' })
  getGitHubAuthUrl(@Query('tenant_id') tenantId?: string, @Res() res?: Response) {
    try {
      const authUrl = this.oauthService.getOAuthAuthorizationUrl('github', tenantId);
      
      if (res) {
        // 重定向到GitHub授权页面
        return res.redirect(authUrl);
      }
      
      return { authUrl };
    } catch (error) {
      this.logger.error('生成GitHub授权URL失败', error.stack);
      throw error;
    }
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth回调处理' })
  @ApiResponse({ status: 200, description: '登录成功', type: TokenResponseDto })
  async githubCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: OAuthCallbackDto,
  ) {
    try {
      this.logger.log('处理GitHub OAuth回调');

      // 检查是否有错误
      if (query.error) {
        this.logger.warn(`GitHub OAuth错误: ${query.error} - ${query.error_description}`);
        const frontendUrl = this.configService.get<string>('app.frontendUrl');
        return res.redirect(`${frontendUrl}/auth/error?error=${query.error}`);
      }

      // 从passport中获取用户信息
      const githubUser = req.user as any;
      if (!githubUser) {
        this.logger.error('GitHub OAuth用户信息为空');
        const frontendUrl = this.configService.get<string>('app.frontendUrl');
        return res.redirect(`${frontendUrl}/auth/error?error=no_user_data`);
      }

      // 解析state获取租户信息
      let tenantId: string | undefined;
      if (query.state) {
        try {
          const stateData = this.oauthService.parseState(query.state);
          tenantId = stateData.tenantId;
        } catch (error) {
          this.logger.warn('无效的state参数', error.message);
        }
      }

      // 转换为标准OAuth用户格式
      const oauthUser = {
        providerId: githubUser.githubId,
        username: githubUser.username,
        email: githubUser.email,
        firstName: githubUser.firstName,
        lastName: githubUser.lastName,
        avatar: githubUser.avatar,
        provider: 'github',
        accessToken: githubUser.accessToken,
        refreshToken: githubUser.refreshToken,
      };

      // 处理OAuth登录
      const tokens = await this.oauthService.handleOAuthLogin(oauthUser, tenantId);

      // 重定向到前端并携带token
      const frontendUrl = this.configService.get<string>('app.frontendUrl');
      const redirectUrl = `${frontendUrl}/auth/callback?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}`;
      
      return res.redirect(redirectUrl);
    } catch (error) {
      this.logger.error('GitHub OAuth回调处理失败', error.stack);
      const frontendUrl = this.configService.get<string>('app.frontendUrl');
      return res.redirect(`${frontendUrl}/auth/error?error=oauth_callback_failed`);
    }
  }

  @Get('google/authorize')
  @ApiOperation({ summary: '获取Google OAuth授权URL' })
  @ApiQuery({ name: 'tenant_id', required: false, description: '租户ID' })
  @ApiResponse({ status: 200, description: '返回授权URL' })
  getGoogleAuthUrl(@Query('tenant_id') tenantId?: string, @Res() res?: Response) {
    try {
      const authUrl = this.oauthService.getOAuthAuthorizationUrl('google', tenantId);
      
      if (res) {
        // 重定向到Google授权页面
        return res.redirect(authUrl);
      }
      
      return { authUrl };
    } catch (error) {
      this.logger.error('生成Google授权URL失败', error.stack);
      throw error;
    }
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth回调处理' })
  @ApiResponse({ status: 200, description: '登录成功', type: TokenResponseDto })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: OAuthCallbackDto,
  ) {
    try {
      this.logger.log('处理Google OAuth回调');

      // 检查是否有错误
      if (query.error) {
        this.logger.warn(`Google OAuth错误: ${query.error} - ${query.error_description}`);
        const frontendUrl = this.configService.get<string>('app.frontendUrl');
        return res.redirect(`${frontendUrl}/auth/error?error=${query.error}`);
      }

      // 从passport中获取用户信息
      const googleUser = req.user as any;
      if (!googleUser) {
        this.logger.error('Google OAuth用户信息为空');
        const frontendUrl = this.configService.get<string>('app.frontendUrl');
        return res.redirect(`${frontendUrl}/auth/error?error=no_user_data`);
      }

      // 解析state获取租户信息
      let tenantId: string | undefined;
      if (query.state) {
        try {
          const stateData = this.oauthService.parseState(query.state);
          tenantId = stateData.tenantId;
        } catch (error) {
          this.logger.warn('无效的state参数', error.message);
        }
      }

      // 转换为标准OAuth用户格式
      const oauthUser = {
        providerId: googleUser.googleId,
        username: googleUser.username || googleUser.email.split('@')[0],
        email: googleUser.email,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        avatar: googleUser.avatar,
        provider: 'google',
        accessToken: googleUser.accessToken,
        refreshToken: googleUser.refreshToken,
      };

      // 处理OAuth登录
      const tokens = await this.oauthService.handleOAuthLogin(oauthUser, tenantId);

      // 重定向到前端并携带token
      const frontendUrl = this.configService.get<string>('app.frontendUrl');
      const redirectUrl = `${frontendUrl}/auth/callback?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}`;
      
      return res.redirect(redirectUrl);
    } catch (error) {
      this.logger.error('Google OAuth回调处理失败', error.stack);
      const frontendUrl = this.configService.get<string>('app.frontendUrl');
      return res.redirect(`${frontendUrl}/auth/error?error=oauth_callback_failed`);
    }
  }

  @Get('accounts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户关联的OAuth账户列表' })
  @ApiResponse({ status: 200, description: '返回OAuth账户列表' })
  async getUserOAuthAccounts(@GetUser() user: any) {
    return await this.oauthService.getUserOAuthAccounts(user.userId);
  }

  @Post('link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '关联OAuth账户到当前用户' })
  @ApiResponse({ status: 201, description: '关联成功' })
  async linkOAuthAccount(
    @GetUser() user: any,
    @Body() linkData: OAuthLinkAccountDto,
  ) {
    await this.oauthService.linkOAuthAccount(user.userId, linkData);
    return { message: `成功关联${linkData.provider}账户` };
  }

  @Delete('unlink/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '取消OAuth账户关联' })
  @ApiResponse({ status: 200, description: '取消关联成功' })
  async unlinkOAuthAccount(
    @GetUser() user: any,
    @Param('provider') provider: string,
  ) {
    await this.oauthService.unlinkOAuthAccount(user.userId, provider);
    return { message: `成功取消关联${provider}账户` };
  }
}