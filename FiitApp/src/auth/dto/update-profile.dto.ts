import { IsOptional, IsNumber, IsString, IsIn, IsArray, Min, Max } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  age?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(300)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(250)
  height?: number;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  fitnessLevel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goals?: string[];

  @IsOptional()
  @IsIn(['male', 'female', 'other', 'prefer_not_to_say'])
  gender?: string;
}