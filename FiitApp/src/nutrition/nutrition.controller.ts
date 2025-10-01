// src/nutrition/nutrition.controller.ts
import { Controller, Post, Get, Delete, Body, Query, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { NutritionService } from './nutrition.service';
import { CreateFoodLogDto } from './dto/create-food.log.dto';
import { NutritionRecommendationDto } from './dto/nutrition-recommendation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('nutrition')
@UseGuards(JwtAuthGuard)
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Post('food-logs')
  async createFoodLog(@Req() req: RequestWithUser, @Body() dto: CreateFoodLogDto) {
    try {
      if (!req.user) {
        throw new UnauthorizedException('Usuario no autenticado');
      }
      const data = await this.nutritionService.createFoodLog(req.user, dto);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Get('food-logs/daily')
  async getDailyLogs(@Req() req: RequestWithUser, @Query('date') date: string) {
    try {
      if (!req.user) {
        throw new UnauthorizedException('Usuario no autenticado');
      }
      const data = await this.nutritionService.getDailyLogs(req.user, date);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Get('food-logs/weekly')
  async getWeeklySummary(@Req() req: RequestWithUser, @Query('startDate') startDate: string) {
    try {
      if (!req.user) {
        throw new UnauthorizedException('Usuario no autenticado');
      }
      const data = await this.nutritionService.getWeeklySummary(req.user, startDate);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Delete('food-logs/:id')
  async deleteFoodLog(@Req() req: RequestWithUser, @Param('id') id: string) {
    try {
      if (!req.user) {
        throw new UnauthorizedException('Usuario no autenticado');
      }
      const data = await this.nutritionService.deleteFoodLog(req.user, id);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Post('recommendations')
  async calculateRecommendation(@Req() req: RequestWithUser, @Body() dto: NutritionRecommendationDto) {
    try {
      if (!req.user) {
        throw new UnauthorizedException('Usuario no autenticado');
      }
      const data = await this.nutritionService.calculateRecommendation(req.user, dto);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Get('recommendations/current')
  async getCurrentRecommendation(@Req() req: RequestWithUser) {
    try {
      if (!req.user) {
        throw new UnauthorizedException('Usuario no autenticado');
      }
      const data = await this.nutritionService.getCurrentRecommendation(req.user);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}