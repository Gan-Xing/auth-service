import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { TenantController } from './controllers/tenant.controller';
import { PagesController } from './controllers/pages.controller';
import { JwksController } from './controllers/jwks.controller';
import { AdminController } from './controllers/admin.controller';
import { OAuthController } from './controllers/oauth.controller';
import { AuthService } from './auth.service';
import { TenantService } from './services/tenant.service';
import { PasswordService } from './services/password.service';
import { VerificationService } from './services/verification.service';
import { UsersService } from './services/users.service';
import { AdminService } from './services/admin.service';
import { OAuthService } from './services/oauth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { ApiKeyGuard } from './guards/api-key.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { DatabaseModule } from '../database/database.module';
import { EmailService } from '../email/email.service';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.accessSecret'),
        signOptions: {
          expiresIn: configService.get('jwt.accessExpiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, TenantController, PagesController, JwksController, AdminController, OAuthController],
  providers: [
    AuthService,
    TenantService,
    PasswordService,
    VerificationService,
    UsersService,
    AdminService,
    OAuthService,
    JwtStrategy,
    GitHubStrategy,
    GoogleStrategy,
    ApiKeyGuard,
    JwtAuthGuard,
    AdminGuard,
    EmailService,
  ],
  exports: [AuthService, TenantService, ApiKeyGuard],
})
export class AuthModule {}
