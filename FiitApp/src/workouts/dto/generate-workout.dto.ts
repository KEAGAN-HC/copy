import { IsArray, IsOptional, IsIn, IsNumber, Min, Max } from 'class-validator';

export class GenerateWorkoutDto {
  @IsOptional()
  @IsArray()
  @IsIn(['lose_weight', 'build_muscle', 'improve_endurance', 'get_stronger', 'tone_muscle'], { each: true })
  goals?: string[];

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  fitnessLevel?: string;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(7)
  daysPerWeek?: number;

  @IsOptional()
  @IsIn(['full_body', 'upper_body', 'lower_body'])
  focusArea?: string;

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(120)
  sessionDurationMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsIn(['pecho', 'espalda', 'piernas', 'brazos', 'hombros', 'core', 'gluteos'], { each: true })
  muscleGroupsToFocus?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(['peso_corporal', 'mancuernas', 'barra', 'maquina'], { each: true })
  availableEquipment?: string[];
}