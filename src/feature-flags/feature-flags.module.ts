import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { FeatureFlagInterceptor } from './interceptors/feature-flag.interceptor';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    AuditModule,
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