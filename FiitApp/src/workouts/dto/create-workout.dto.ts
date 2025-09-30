import { IsString, IsOptional, IsIn, IsNumber, Min, Max, IsArray } from 'class-validator';

export class CreateWorkoutDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  difficultyLevel?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  durationWeeks?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(7)
  daysPerWeek?: number;

  @IsOptional()
  @IsString()
  focusArea?: string;

  @IsOptional()
  @IsArray()
  goals?: string[];

  @IsOptional()
  @IsArray()
  availableEquipment?: string[];
}