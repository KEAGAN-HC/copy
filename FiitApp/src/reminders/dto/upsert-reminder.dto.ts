import { IsBoolean, IsInt, IsOptional, IsString, IsIn, IsDateString, Matches } from 'class-validator';

export type ReminderType = 'workout' | 'water' | 'nutrition' | 'custom';

export class UpsertReminderDto {
  @IsIn(['workout', 'water', 'nutrition', 'custom'])
  reminderType: ReminderType;

  @IsString()
  message: string;

  // 'HH:mm' 24h
  @Matches(/^\d{2}:\d{2}$/)
  scheduledTime: string;

  /** Bitmask 0..127 (bit0=Dom, bit1=Lun, ... bit6=Sáb). Requerido si isRecurring */
  @IsOptional()
  @IsInt()
  daysOfWeek?: number;

  @IsBoolean()
  isRecurring: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string; // YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string; // IANA TZ

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListRemindersQuery {
  @IsOptional() @IsString() status?: 'active' | 'inactive';
  @IsOptional() @IsString() type?: ReminderType;
  @IsOptional() @IsInt()  limit?: number;
  @IsOptional() @IsInt()  offset?: number;
}
