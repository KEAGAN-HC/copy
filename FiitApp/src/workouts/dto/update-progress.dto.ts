// En update-progress.dto.ts
import { IsNumber, IsOptional, IsBoolean, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ExerciseProgressDto {
  @IsString()
  exerciseId: string;

  @IsOptional()
  @IsNumber()
  completedSets?: number;

  @IsOptional()
  @IsNumber()
  completedReps?: number;

  @IsOptional()
  @IsNumber()
  completedWeight?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsBoolean()
  isCompleted: boolean;
}

export class UpdateProgressDto {
  @IsNumber()
  dayNumber: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExerciseProgressDto)
  exercises: ExerciseProgressDto[];

  @IsOptional()
  @IsString()
  sessionNotes?: string;
}