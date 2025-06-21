import { Module, forwardRef } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { FeatureFlagInterceptor } from './interceptors/feature-flag.interceptor';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    AuditModule,
    forwardRef(() => AuthModule),
  ],
  providers: [
    FeatureFlagsService,
    FeatureFlagGuard,
    FeatureFlagInterceptor,
  ],
  controllers: [FeatureFlagsController],
  exports: [
    FeatureFlagsService,
    FeatureFlagGuard,
    FeatureFlagInterceptor,
  ],
})
export class FeatureFlagsModule {}