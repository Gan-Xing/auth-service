import { Module, forwardRef } from '@nestjs/common';
import { CachingService } from './caching.service';
import { DatabaseOptimizationService } from './database-optimization.service';
import { ConcurrencyService } from './concurrency.service';
import { PerformanceController } from './performance.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    MonitoringModule,
    FeatureFlagsModule,
    forwardRef(() => AuthModule),
  ],
  providers: [
    CachingService,
    DatabaseOptimizationService,
    ConcurrencyService,
  ],
  controllers: [PerformanceController],
  exports: [
    CachingService,
    DatabaseOptimizationService,
    ConcurrencyService,
  ],
})
export class PerformanceModule {}