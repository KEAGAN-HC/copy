import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { GenerateWorkoutDto } from './dto/generate-workout.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { WorkoutFiltersDto } from './dto/workout-filters.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Get('plans')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async getAllPlans(@Query() filters: WorkoutFiltersDto) {
    try {
      return await this.workoutsService.getAllPlans(filters);
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Get('plans/:id')
  async getPlanById(@Param('id') planId: string) {
    try {
      return await this.workoutsService.getPlanById(planId);
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Post('plans/:planId/assign')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async assignPlanDirect(
    @Req() request: RequestWithUser,
    @Param('planId') planId: string,
    @Body() body?: { startDate?: string }
  ) {
    try {
      if (!request.user) {
        throw new Error('Usuario no autenticado');
      }

      const assignPlanDto: AssignPlanDto = {
        planId,
        startDate: body?.startDate || new Date().toISOString()
      };

      return await this.workoutsService.assignPlanToUser(request.user.id, assignPlanDto);
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }


  @Post('plans/assign')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async assignPlan(
    @Req() request: RequestWithUser,
    @Body() assignPlanDto: AssignPlanDto
  ) {
    try {
      if (!request.user) {
        throw new Error('Usuario no autenticado');
      }

      return await this.workoutsService.assignPlanToUser(request.user.id, assignPlanDto);
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Get('my-workouts')
  @UseGuards(JwtAuthGuard)
  async getUserWorkouts(@Req() request: RequestWithUser) {
    try {
      if (!request.user) {
        throw new Error('Usuario no autenticado');
      }

      return await this.workoutsService.getUserWorkouts(request.user.id);
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Get(':id/today')
  @UseGuards(JwtAuthGuard)
  async getTodayWorkout(
    @Req() request: RequestWithUser,
    @Param('id') workoutId: string
  ) {
    try {
      if (!request.user) {
        throw new Error('Usuario no autenticado');
      }

      return await this.workoutsService.getTodayWorkout(request.user.id, workoutId);
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async generateWorkout(
    @Req() request: RequestWithUser,
    @Body() generateDto: GenerateWorkoutDto
  ) {
    try {
      if (!request.user) {
        throw new Error('Usuario no autenticado');
      }

      return await this.workoutsService.generateCustomWorkout(request.user.id, generateDto);
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Put(':id/progress')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateProgress(
    @Req() request: RequestWithUser,
    @Param('id') workoutId: string,
    @Body() progressDto: UpdateProgressDto
  ) {
    try {
      if (!request.user) {
        throw new Error('Usuario no autenticado');
      }

      return await this.workoutsService.updateProgress(request.user.id, workoutId, progressDto);
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

@Get(':id/session/:day')
@UseGuards(JwtAuthGuard)
async getWorkoutSession(
  @Req() request: RequestWithUser,
  @Param('id') workoutId: string,
  @Param('day') day: string
) {
  try {
    if (!request.user) {
      throw new Error('Usuario no autenticado');
    }

    const dayNumber = parseInt(day);
    return await this.workoutsService.getWorkoutSession(request.user.id, workoutId, dayNumber);
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

@Get(':id/session')
@UseGuards(JwtAuthGuard)
async getWorkoutSessionCurrent(
  @Req() request: RequestWithUser,
  @Param('id') workoutId: string
) {
  try {
    if (!request.user) {
      throw new Error('Usuario no autenticado');
    }

    return await this.workoutsService.getWorkoutSession(request.user.id, workoutId);
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}
}