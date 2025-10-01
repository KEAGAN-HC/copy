import { IsNotEmpty, IsString, IsNumber, IsEnum, IsDateString, Min } from 'class-validator';

export enum MealType {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  SNACK = 'snack'
}

export class CreateFoodLogDto {
  @IsString()
  @IsNotEmpty()
  foodName: string;

  @IsEnum(MealType)
  @IsNotEmpty()
  mealType: MealType;

  @IsNumber()
  @Min(0)
  calories: number;

  @IsNumber()
  @Min(0)
  protein: number;

  @IsNumber()
  @Min(0)
  carbs: number;

  @IsNumber()
  @Min(0)
  fat: number;

  @IsDateString()
  logDate: string;
}