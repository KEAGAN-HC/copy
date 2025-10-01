// src/nutrition/nutrition.service.ts
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { CreateFoodLogDto } from './dto/create-food.log.dto';
import { NutritionRecommendationDto } from './dto/nutrition-recommendation.dto';
import type { User } from '@supabase/supabase-js';

@Injectable()
export class NutritionService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async createFoodLog(user: User, dto: CreateFoodLogDto) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('food_logs')
        .insert([
          {
            user_id: user.id,
            food_name: dto.foodName,
            meal_type: dto.mealType,
            calories: dto.calories,
            protein: dto.protein,
            carbs: dto.carbs,
            fat: dto.fat,
            log_date: dto.logDate,
          },
        ])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (error) {
      throw new Error(`Error al registrar comida: ${error.message}`);
    }
  }

  async getDailyLogs(user: User, date: string) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('log_date', date)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);

      const summary = data.reduce(
        (acc, log) => ({
          totalCalories: acc.totalCalories + log.calories,
          totalProtein: acc.totalProtein + log.protein,
          totalCarbs: acc.totalCarbs + log.carbs,
          totalFat: acc.totalFat + log.fat,
        }),
        { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
      );

      return { logs: data, summary };
    } catch (error) {
      throw new Error(`Error al obtener logs diarios: ${error.message}`);
    }
  }

  async getWeeklySummary(user: User, startDate: string) {
    try {
      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const { data, error } = await this.supabaseService.client
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('log_date', start.toISOString().split('T')[0])
        .lte('log_date', end.toISOString().split('T')[0]);

      if (error) throw new Error(error.message);

      const dailyData = data.reduce((acc, log) => {
        const date = log.log_date;
        if (!acc[date]) {
          acc[date] = { date, calories: 0, protein: 0, carbs: 0, fat: 0 };
        }
        acc[date].calories += log.calories;
        acc[date].protein += log.protein;
        acc[date].carbs += log.carbs;
        acc[date].fat += log.fat;
        return acc;
      }, {});

      return Object.values(dailyData);
    } catch (error) {
      throw new Error(`Error al obtener resumen semanal: ${error.message}`);
    }
  }

  async deleteFoodLog(user: User, logId: string) {
    try {
      const { error } = await this.supabaseService.client
        .from('food_logs')
        .delete()
        .eq('id', logId)
        .eq('user_id', user.id);

      if (error) throw new Error(error.message);
      return { message: 'Registro eliminado exitosamente' };
    } catch (error) {
      throw new Error(`Error al eliminar registro: ${error.message}`);
    }
  }

  async calculateRecommendation(user: User, dto: NutritionRecommendationDto) {
    try {
      const bmr = this.calculateBMR(dto);
      const tdee = this.calculateTDEE(bmr, dto.activityLevel);
      const adjustedCalories = this.adjustCaloriesForGoal(tdee, dto.goal);
      const macros = this.calculateMacros(adjustedCalories, dto.goal);

      const recommendation = {
        user_id: user.id,
        daily_calories: Math.round(adjustedCalories),
        daily_protein: Math.round(macros.protein),
        daily_carbs: Math.round(macros.carbs),
        daily_fat: Math.round(macros.fat),
        water_ml: 2000,
        effective_date: new Date().toISOString().split('T')[0],
      };

      const { data, error } = await this.supabaseService.client
        .from('nutrition_recommendations')
        .insert([recommendation])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (error) {
      throw new Error(`Error al calcular recomendación: ${error.message}`);
    }
  }

  private calculateBMR(dto: NutritionRecommendationDto): number {
    if (dto.gender.toLowerCase() === 'male') {
      return 10 * dto.weight + 6.25 * dto.height - 5 * dto.age + 5;
    } else {
      return 10 * dto.weight + 6.25 * dto.height - 5 * dto.age - 161;
    }
  }

  private calculateTDEE(bmr: number, activityLevel: string): number {
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    };
    return bmr * (activityMultipliers[activityLevel] || 1.2);
  }

  private adjustCaloriesForGoal(tdee: number, goal: string): number {
    switch (goal) {
      case 'lose_weight':
        return tdee - 500;
      case 'gain_weight':
        return tdee + 500;
      case 'maintain':
      default:
        return tdee;
    }
  }

  private calculateMacros(calories: number, goal: string) {
    let proteinRatio = 0.3;
    let carbsRatio = 0.4;
    let fatRatio = 0.3;

    if (goal === 'gain_weight') {
      proteinRatio = 0.35;
      carbsRatio = 0.45;
      fatRatio = 0.2;
    } else if (goal === 'lose_weight') {
      proteinRatio = 0.4;
      carbsRatio = 0.3;
      fatRatio = 0.3;
    }

    return {
      protein: (calories * proteinRatio) / 4,
      carbs: (calories * carbsRatio) / 4,
      fat: (calories * fatRatio) / 9,
    };
  }

  async getCurrentRecommendation(user: User) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('nutrition_recommendations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw new Error(error.message);
      return data;
    } catch (error) {
      throw new Error(`Error al obtener recomendación: ${error.message}`);
    }
  }
}