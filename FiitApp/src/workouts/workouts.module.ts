import { Module } from '@nestjs/common';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { SupabaseService } from '../config/supabase.config';

@Module({
  controllers: [WorkoutsController],
  providers: [WorkoutsService, SupabaseService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}