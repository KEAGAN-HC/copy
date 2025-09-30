import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SupabaseModule } from '../shared/supabase/supabase.module';
import { JwtAuthGuard } from './guards/jwt.guard';

@Module({
  imports: [SupabaseModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard, 
  ],
  exports: [
    JwtAuthGuard, 
    AuthService,
  ],
})
export class AuthModule {}