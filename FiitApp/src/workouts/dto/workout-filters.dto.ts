import { IsOptional, IsIn, IsArray } from 'class-validator';

export class WorkoutFiltersDto {
  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  difficultyLevel?: string;

  @IsOptional()
  @IsIn(['strength', 'cardio', 'flexibility', 'full_body', 'weight_loss'])
  focusArea?: string;

  @IsOptional()
  @IsArray()
  @IsIn(['peso_corporal', 'mancuernas', 'barra', 'maquina'], { each: true })
  equipment?: string[];

  @IsOptional()
  @IsIn([2, 3, 4, 5, 6, 7])
  daysPerWeek?: number;

  @IsOptional()
  @IsArray()
  muscleGroups?: string[];
}