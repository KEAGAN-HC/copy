import { SupabaseModule } from './../shared/supabase/supabase.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { RemindersScheduler } from './reminders.scheduler';


@Module({
  imports: [ScheduleModule.forRoot(), SupabaseModule],
  controllers: [RemindersController],
  providers: [RemindersService,  RemindersScheduler],
})
export class RemindersModule {}
