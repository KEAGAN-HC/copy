import { IsUUID, IsOptional, IsDateString } from 'class-validator';

export class AssignPlanDto {
  @IsUUID()
  planId: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}