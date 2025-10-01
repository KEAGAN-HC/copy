// src/nutrition/dto/nutrition-recommendation.dto.ts
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class NutritionRecommendationDto {
  @IsNumber()
  @Min(0)
  weight: number;

  @IsNumber()
  @Min(0)
  height: number;

  @IsNumber()
  @Min(0)
  age: number;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsString()
  @IsNotEmpty()
  activityLevel: string;

  @IsString()
  @IsNotEmpty()
  goal: string;
}