import { Module } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.config';

@Module({
  providers: [SupabaseService],
  exports: [SupabaseService], 
})
export class SupabaseModule {}