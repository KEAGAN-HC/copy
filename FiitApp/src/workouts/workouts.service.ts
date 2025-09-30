import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { GenerateWorkoutDto } from './dto/generate-workout.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { WorkoutFiltersDto } from './dto/workout-filters.dto';

// Interfaces para tipado
interface PlanExercise {
  exercise_id: string;
  day_number: number;
  exercise_order: number;
  sets: number;
  reps?: number;
  duration_seconds?: number;
  rest_seconds: number;
  exercise_name?: string;
}

interface ExerciseFromJson {
  name: string;
  sets: number;
  reps?: number;
  duration_seconds?: number;
  rest_seconds?: number;
}

interface DayExercises {
  day?: number;
  exercises: ExerciseFromJson[];
}

@Injectable()
export class WorkoutsService {
  constructor(private supabaseService: SupabaseService) {}

  async getAllPlans(filters?: WorkoutFiltersDto) {
    try {
      let query = this.supabaseService.client
        .from('workout_plans')
        .select('*');

      if (filters?.difficultyLevel) {
        query = query.eq('difficulty_level', filters.difficultyLevel);
      }
      if (filters?.focusArea) {
        query = query.eq('focus_area', filters.focusArea);
      }
      if (filters?.daysPerWeek) {
        query = query.eq('days_per_week', filters.daysPerWeek);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Error obteniendo planes: ${error.message}`);
      }

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      throw new BadRequestException(`Error obteniendo planes: ${error.message}`);
    }
  }

  async getPlanById(planId: string) {
    try {
      const { data: plan, error: planError } = await this.supabaseService.client
        .from('workout_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (planError) {
        throw new NotFoundException(`Plan no encontrado: ${planError.message}`);
      }

      const { data: rawExercises, error: rawError } = await this.supabaseService.client
        .from('plan_exercises')
        .select('*')
        .eq('plan_id', planId)
        .order('day_number, exercise_order');

      if (rawError) {
        console.error('Error obteniendo ejercicios:', rawError);
        return {
          success: true,
          data: { ...plan, plan_exercises: [] }
        };
      }

      const exerciseIds = rawExercises?.map(pe => pe.exercise_id) || [];
      const { data: exercises, error: exError } = await this.supabaseService.client
        .from('exercises')
        .select('*')
        .in('id', exerciseIds);

      const planExercises = rawExercises?.map(pe => ({
        ...pe,
        exercises: exercises?.find(e => e.id === pe.exercise_id) || null
      })) || [];

      return {
        success: true,
        data: { ...plan, plan_exercises: planExercises }
      };
    } catch (error) {
      throw new NotFoundException(`Plan no encontrado: ${error.message}`);
    }
  }

  async assignPlanToUser(userId: string, assignPlanDto: AssignPlanDto) {
    try {
      const { planId, startDate } = assignPlanDto;
      console.log(`Asignando plan ${planId} a usuario ${userId}`);

      // 1. Obtener información del plan
      const { data: plan, error: planInfoError } = 
        await this.supabaseService.client
          .from('workout_plans')
          .select('*')
          .eq('id', planId)
          .single();

      if (planInfoError || !plan) {
        throw new Error(`Plan no encontrado: ${planInfoError?.message}`);
      }

      console.log(`Plan encontrado: ${plan.name}`);

      // 2. Intentar obtener ejercicios desde plan_exercises
      const { data: planExercises, error: planError } = 
        await this.supabaseService.client
          .from('plan_exercises')
          .select('*')
          .eq('plan_id', planId);

      console.log(`Plan exercises encontrados: ${planExercises?.length || 0}`);

      // 3. Si no hay ejercicios en plan_exercises, usar datos del JSON del plan
      let exercisesToAssign: PlanExercise[] = [];

      if (!planExercises || planExercises.length === 0) {
        console.log('No hay plan_exercises, extrayendo del JSON del plan');
        
        const exercisesJson = plan.exercises as DayExercises[] || [];
        
        if (!Array.isArray(exercisesJson) || exercisesJson.length === 0) {
          throw new Error('Este plan no tiene ejercicios configurados');
        }

        // IMPORTANTE: Ahora usa await para la búsqueda dinámica
        exercisesToAssign = await this.extractExercisesFromPlanJson(exercisesJson);
        console.log(`Extraidos ${exercisesToAssign.length} ejercicios del JSON`);
      } else {
        exercisesToAssign = planExercises as PlanExercise[];
        console.log(`Usando ${exercisesToAssign.length} ejercicios de plan_exercises`);
      }

      if (exercisesToAssign.length === 0) {
        throw new Error('No se pudieron obtener ejercicios para este plan');
      }

      // 4. Crear la rutina del usuario
      const { data: userWorkout, error: workoutError } = 
        await this.supabaseService.client
          .from('user_workouts')
          .insert({
            user_id: userId,
            plan_id: planId,
            name: plan.name,
            week_number: 1,
            is_custom: false,
            current_day: 1,
            current_exercise_index: 0,
            completed: false,
            start_date: startDate || new Date().toISOString(),
            created_at: new Date().toISOString()
          })
          .select()
          .single();

      if (workoutError) {
        throw new Error(`Error creando rutina: ${workoutError.message}`);
      }

      console.log(`User workout creado: ${userWorkout.id}`);

      // 5. Crear ejercicios del usuario
      const userExercises = exercisesToAssign.map(ex => ({
        user_workout_id: userWorkout.id,
        exercise_id: ex.exercise_id,
        day_number: ex.day_number || 1,
        exercise_order: ex.exercise_order || 1,
        sets: ex.sets || 3,
        reps: ex.reps,
        duration_seconds: ex.duration_seconds,
        rest_seconds: ex.rest_seconds || 60,
        is_completed: false
      }));

      console.log(`Insertando ${userExercises.length} ejercicios de usuario`);

      const { error: insertError } = await this.supabaseService.client
        .from('user_workout_exercises')
        .insert(userExercises);

      if (insertError) {
        console.log('Error insertando ejercicios:', insertError);
        throw new Error(`Error asignando ejercicios: ${insertError.message}`);
      }

      console.log('Plan asignado exitosamente');

      return {
        success: true,
        message: 'Plan asignado exitosamente',
        data: {
          ...userWorkout,
          exercises_count: userExercises.length
        }
      };

    } catch (error) {
      console.log('Error en assignPlanToUser:', error);
      throw new BadRequestException(`Error asignando plan: ${error.message}`);
    }
  }

  // Método refactorizado para extraer ejercicios del JSON de manera dinámica
  private async extractExercisesFromPlanJson(exercisesJson: DayExercises[]): Promise<PlanExercise[]> {
    const exercises: PlanExercise[] = [];
    
    for (const dayData of exercisesJson) {
      if (dayData.exercises && Array.isArray(dayData.exercises)) {
        for (let exerciseIndex = 0; exerciseIndex < dayData.exercises.length; exerciseIndex++) {
          const exercise = dayData.exercises[exerciseIndex];
          
          // Buscar el ejercicio real por nombre en la base de datos
          const exerciseId = await this.findExerciseByName(exercise.name);
          
          exercises.push({
            exercise_id: exerciseId,
            day_number: dayData.day || (exercisesJson.indexOf(dayData) + 1),
            exercise_order: exerciseIndex + 1,
            sets: exercise.sets || 3,
            reps: exercise.reps,
            duration_seconds: exercise.duration_seconds,
            rest_seconds: exercise.rest_seconds || 60,
            exercise_name: exercise.name
          });
        }
      }
    }
    
    return exercises;
  }

  // Nuevo método para buscar ejercicios dinámicamente por nombre
  private async findExerciseByName(exerciseName: string): Promise<string> {
    try {
      console.log(`Buscando ejercicio por nombre: "${exerciseName}"`);
      
      // Buscar ejercicio exacto por nombre
      let { data: exercise, error } = await this.supabaseService.client
        .from('exercises')
        .select('id, name')
        .eq('name', exerciseName)
        .single();

      if (!error && exercise) {
        console.log(`Ejercicio encontrado: ${exercise.name} -> ${exercise.id}`);
        return exercise.id;
      }

      // Si no se encuentra exacto, buscar por nombre similar (case insensitive)
      const { data: similarExercises, error: similarError } = await this.supabaseService.client
        .from('exercises')
        .select('id, name')
        .ilike('name', `%${exerciseName}%`);

      if (!similarError && similarExercises && similarExercises.length > 0) {
        console.log(`Ejercicio similar encontrado: ${similarExercises[0].name} -> ${similarExercises[0].id}`);
        return similarExercises[0].id;
      }

      // Si no existe, crear un ejercicio básico automáticamente
      console.log(`Ejercicio "${exerciseName}" no encontrado, creando uno nuevo`);
      return await this.createMissingExercise(exerciseName);

    } catch (error) {
      console.log(`Error buscando ejercicio "${exerciseName}":`, error);
      return await this.createMissingExercise(exerciseName);
    }
  }

  // Método para crear ejercicios faltantes automáticamente
  private async createMissingExercise(exerciseName: string): Promise<string> {
    try {
      const newExercise = {
        name: exerciseName,
        description: `Ejercicio de ${exerciseName}`,
        muscle_groups: ['general'], // Grupo muscular genérico
        equipment: 'peso_corporal',
        difficulty_level: 'beginner',
        instructions: `Realizar ${exerciseName} según las especificaciones del plan`,
        calories_per_minute: 5.0
      };

      const { data, error } = await this.supabaseService.client
        .from('exercises')
        .insert(newExercise)
        .select('id')
        .single();

      if (error) {
        console.log(`Error creando ejercicio "${exerciseName}":`, error);
        // Fallback: generar ID temporal
        return `temp-${exerciseName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      }

      console.log(`Ejercicio "${exerciseName}" creado exitosamente con ID: ${data.id}`);
      return data.id;

    } catch (error) {
      console.log(`Error creando ejercicio "${exerciseName}":`, error);
      return `temp-${exerciseName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    }
  }

  async getUserWorkouts(userId: string) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('user_workouts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error obteniendo rutinas: ${error.message}`);
      }

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      throw new BadRequestException(`Error obteniendo rutinas: ${error.message}`);
    }
  }

  async getTodayWorkout(userId: string, workoutId: string) {
    try {
      const { data: workout, error: workoutError } = 
        await this.supabaseService.client
          .from('user_workouts')
          .select('*')
          .eq('id', workoutId)
          .eq('user_id', userId)
          .single();

      if (workoutError) {
        throw new NotFoundException('Rutina no encontrada');
      }

      const { data: exercises, error: exercisesError } = 
        await this.supabaseService.client
          .from('user_workout_exercises')
          .select(`
            *,
            exercises (
              name,
              muscle_groups,
              instructions,
              demo_video_url
            )
          `)
          .eq('user_workout_id', workoutId)
          .eq('day_number', workout.current_day)
          .order('exercise_order');

      if (exercisesError) {
        throw new Error(`Error obteniendo ejercicios: ${exercisesError.message}`);
      }

      return {
        success: true,
        data: {
          workout,
          exercises: exercises || []
        }
      };
    } catch (error) {
      throw new BadRequestException(`Error obteniendo rutina del día: ${error.message}`);
    }
  }

async generateCustomWorkout(userId: string, generateDto: GenerateWorkoutDto) {
  try {
    console.log('=== INICIO generateCustomWorkout ===');
    console.log('userId recibido:', userId);
    console.log('Tipo de userId:', typeof userId);
    console.log('generateDto:', generateDto);

    // IMPORTANTE: Verificar que realmente esté usando 'users'
    console.log('Consultando tabla USERS (no profiles)...');
    
    const { data: user, error: userError } = await this.supabaseService.client
      .from('users')  // ← Verifica que diga 'users' aquí
      .select('*')
      .eq('id', userId)
      .single();

    console.log('Resultado query USERS:');
    console.log('- user:', JSON.stringify(user, null, 2));
    console.log('- error:', JSON.stringify(userError, null, 2));

    if (userError || !user) {
      console.error('Usuario no encontrado en USERS');
      console.error('Error completo:', userError);
      throw new NotFoundException('Usuario no encontrado');
    }
 
    console.log(`Usuario encontrado: ${user.email || userId}`);
    console.log(`Datos: weight=${user.weight}, height=${user.height}, age=${user.age}`);

    // 2. Calcular IMC si existe peso y altura
    let bmi = 0;
    let bmiCategory = 'unknown';
    let bmiRecommendations: any = null;

    if (user.weight && user.height) {
      bmi = user.bmi || this.calculateBMI(user.weight, user.height);
      bmiCategory = this.getBMICategory(bmi);
      bmiRecommendations = this.getBMIRecommendations(bmiCategory);
      
      console.log(`IMC del usuario: ${bmi} (${bmiCategory})`);
      console.log(`Aplicando modificadores:`, bmiRecommendations);
    } else {
      console.log('Usuario sin datos de peso/altura, generando rutina estándar');
    }

    // 3. Construir plan personalizado
    const workoutPlan = this.buildCustomWorkoutPlan(user, generateDto, bmiRecommendations);
    
    // 4. Crear nombre descriptivo
    const fitnessLevel = generateDto.fitnessLevel || user.fitness_level || 'beginner';
    const workoutName = `Rutina Personalizada ${this.translateLevel(fitnessLevel)}`;
    const startDate = new Date().toISOString().split('T')[0];
    
    console.log(`Plan construido: ${workoutPlan.length} días`);

    // 5. Insertar en user_workouts
    const { data: userWorkout, error: workoutError } = await this.supabaseService.client
      .from('user_workouts')
      .insert({
        user_id: userId,
        plan_id: null,
        name: workoutName,
        week_number: 1,
        is_custom: true,
        current_day: 1,
        current_exercise_index: 0,
        completed: false,
        start_date: startDate,
        end_date: null
      })
      .select()
      .single();

    if (workoutError) {
      console.error('Error insertando workout:', workoutError);
      throw new BadRequestException(`Error creando rutina: ${workoutError.message}`);
    }

    console.log(`Rutina creada: ${userWorkout.id}`);

    // 6. Crear ejercicios individuales
    await this.createWorkoutExercises(userWorkout.id, workoutPlan);

    // 7. Auditoría con info de IMC
    const auditDetails: Record<string, any> = {
      fitness_level: fitnessLevel,
      goals: user.goals || [],
      days_per_week: generateDto.daysPerWeek || 3,
      focus_area: generateDto.focusArea || 'full_body'
    };

    if (bmi > 0) {
      auditDetails.bmi = bmi;
      auditDetails.bmi_category = bmiCategory;
      auditDetails.bmi_advice = bmiRecommendations?.advice;
    }

    await this.supabaseService.client
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: 'CREATE_CUSTOM_WORKOUT',
        entity_type: 'user_workouts',
        entity_id: userWorkout.id,
        details: auditDetails
      });

    console.log('Rutina personalizada generada exitosamente');
    console.log('=== FIN generateCustomWorkout ===');

    // 8. Respuesta con info de IMC si existe
    const response: any = {
      success: true,
      message: 'Rutina personalizada generada exitosamente',
      data: userWorkout
    };

    if (bmi > 0) {
      response.data.bmi_info = {
        bmi: bmi,
        category: bmiCategory,
        advice: bmiRecommendations?.advice
      };
    }

    return response;

  } catch (error) {
    console.error('=== ERROR en generateCustomWorkout ===');
    console.error('Tipo de error:', error.constructor.name);
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack);
    throw new BadRequestException(`Error generando rutina: ${error.message}`);
  }
}

  async updateProgress(userId: string, workoutId: string, progressDto: UpdateProgressDto) {
    try {
      const { data: workout, error: workoutError } = 
        await this.supabaseService.client
          .from('user_workouts')
          .select('*')
          .eq('id', workoutId)
          .eq('user_id', userId)
          .single();

      if (workoutError || !workout) {
        throw new NotFoundException('Rutina no encontrada o no pertenece al usuario');
      }

      for (const exerciseProgress of progressDto.exercises) {
        const updateData: any = {
          completed_at: new Date().toISOString(),
          is_completed: exerciseProgress.isCompleted
        };

        if (exerciseProgress.completedSets !== undefined) {
          updateData.completed_sets = exerciseProgress.completedSets;
        }
        if (exerciseProgress.completedReps !== undefined) {
          updateData.completed_reps = exerciseProgress.completedReps;
        }
        if (exerciseProgress.completedWeight !== undefined) {
          updateData.completed_weight = exerciseProgress.completedWeight;
        }
        if (exerciseProgress.notes) {
          updateData.notes = exerciseProgress.notes;
        }

        const { error: updateError } = await this.supabaseService.client
          .from('user_workout_exercises')
          .update(updateData)
          .eq('user_workout_id', workoutId)
          .eq('exercise_id', exerciseProgress.exerciseId)
          .eq('day_number', progressDto.dayNumber);

        if (updateError) {
          throw new Error(`Error actualizando ejercicio: ${updateError.message}`);
        }
      }

      const { data: dayExercises, error: dayError } = 
        await this.supabaseService.client
          .from('user_workout_exercises')
          .select('is_completed')
          .eq('user_workout_id', workoutId)
          .eq('day_number', progressDto.dayNumber);

      if (dayError) {
        throw new Error(`Error verificando progreso del día: ${dayError.message}`);
      }

      const allCompleted = dayExercises?.every(ex => ex.is_completed) || false;

      if (allCompleted) {
        const nextDay = progressDto.dayNumber + 1;
        
        const { data: nextDayExercises } = await this.supabaseService.client
          .from('user_workout_exercises')
          .select('id')
          .eq('user_workout_id', workoutId)
          .eq('day_number', nextDay)
          .limit(1);

        const currentDay = nextDayExercises && nextDayExercises.length > 0 ? nextDay : workout.current_day;

        const { error: advanceError } = await this.supabaseService.client
          .from('user_workouts')
          .update({ 
            current_day: currentDay,
            updated_at: new Date().toISOString()
          })
          .eq('id', workoutId);

        if (advanceError) {
          throw new Error(`Error avanzando día: ${advanceError.message}`);
        }
      }

      const { error: logError } = await this.supabaseService.client
        .from('workout_logs')
        .insert({
          user_id: userId,
          workout_id: workoutId,
          completed_date: new Date().toISOString().split('T')[0], 
          performance_metrics: {
            day_number: progressDto.dayNumber,
            exercises_completed: progressDto.exercises.filter(e => e.isCompleted).length,
            total_exercises: progressDto.exercises.length,
            session_notes: progressDto.sessionNotes
          },
          notes: progressDto.sessionNotes
        });

      if (logError) {
        console.warn('Error creando log de workout:', logError.message);
      }

      return {
        success: true,
        message: 'Progreso actualizado exitosamente',
        data: {
          dayCompleted: allCompleted,
          exercisesCompleted: progressDto.exercises.filter(e => e.isCompleted).length,
          totalExercises: progressDto.exercises.length
        }
      };

    } catch (error) {
      throw new BadRequestException(`Error actualizando progreso: ${error.message}`);
    }
  }

  async getWorkoutSession(userId: string, workoutId: string, dayNumber?: number) {
    try {
      console.log(`Obteniendo sesión para usuario: ${userId}, workout: ${workoutId}, día: ${dayNumber}`);

      const { data: workout, error: workoutError } = 
        await this.supabaseService.client
          .from('user_workouts')
          .select('*')
          .eq('id', workoutId)
          .eq('user_id', userId)
          .single();

      if (workoutError || !workout) {
        console.log('Error workout:', workoutError);
        throw new NotFoundException('Rutina no encontrada o no pertenece al usuario');
      }

      console.log('Workout encontrado:', workout.name);

      const currentDay = dayNumber || workout.current_day;
      console.log(`Día a obtener: ${currentDay}`);

      const { data: userExercises, error: exercisesError } = 
        await this.supabaseService.client
          .from('user_workout_exercises')
          .select('*')
          .eq('user_workout_id', workoutId)
          .eq('day_number', currentDay)
          .order('exercise_order');

      if (exercisesError) {
        console.log('Error user exercises:', exercisesError);
        throw new Error(`Error obteniendo ejercicios del usuario: ${exercisesError.message}`);
      }

      if (!userExercises || userExercises.length === 0) {
        console.log(`No hay ejercicios para el día ${currentDay}`);
        throw new NotFoundException(`No hay ejercicios para el día ${currentDay}`);
      }

      console.log(`${userExercises.length} ejercicios encontrados para el día`);

      const exerciseIds = userExercises.map(ex => ex.exercise_id).filter(id => id);
      console.log('IDs de ejercicios:', exerciseIds);

      if (exerciseIds.length === 0) {
        console.log('No hay IDs de ejercicios válidos');
        return this.createDummySession(workout, userExercises, currentDay);
      }

      const { data: exercisesInfo, error: exercisesInfoError } = 
        await this.supabaseService.client
          .from('exercises')
          .select('*')
          .in('id', exerciseIds);

      console.log('Exercises info error:', exercisesInfoError);
      console.log('Exercises info data:', exercisesInfo?.length || 0, 'elementos');

      if (exercisesInfoError || !exercisesInfo || exercisesInfo.length === 0) {
        console.log('Tabla exercises vacía o error, creando datos dummy');
        return this.createDummySession(workout, userExercises, currentDay);
      }

      console.log('Construyendo respuesta con datos reales');
      return this.buildRealSession(workout, userExercises, exercisesInfo, currentDay);

    } catch (error) {
      console.log('Error en getWorkoutSession:', error);
      throw new BadRequestException(`Error obteniendo sesión: ${error.message}`);
    }
  }

  // Método para crear sesión con datos dummy (fallback seguro)
  private createDummySession(workout: any, userExercises: any[], currentDay: number) {
    console.log('Creando sesión con datos dummy');
    
    const totalExercises = userExercises.length;
    const completedExercises = userExercises.filter(ex => ex.is_completed).length;

    const sessionExercises = userExercises.map((ex, index) => ({
      id: ex.exercise_id || `dummy-${index}`,
      exerciseOrder: ex.exercise_order,
      name: `Ejercicio ${ex.exercise_order}`,
      sets: ex.sets || 3,
      reps: ex.reps || 12,
      durationSeconds: ex.duration_seconds || null,
      restSeconds: ex.rest_seconds || 60,
      instructions: 'Instrucciones por definir en la base de datos',
      demoVideoUrl: null,
      muscleGroups: ['general'],
      equipment: 'peso_corporal',
      caloriesPerMinute: 5,
      completed: ex.is_completed || false,
      completedSets: ex.completed_sets || 0,
      completedReps: ex.completed_reps || 0,
      completedWeight: ex.completed_weight || 0,
      notes: ex.notes || '',
      isCurrentExercise: index === 0 && !ex.is_completed
    }));

    return {
      success: true,
      data: {
        session: {
          workoutId: workout.id,
          workoutName: workout.name,
          dayNumber: currentDay,
          weekNumber: workout.week_number,
          totalExercises,
          completedExercises,
          estimatedDurationMinutes: totalExercises * 8,
          currentExerciseIndex: 0,
          status: completedExercises === 0 ? 'ready' : 'in_progress',
          progress: Math.round((completedExercises / totalExercises) * 100)
        },
        exercises: sessionExercises
      }
    };
  }

  // Método para construir sesión con datos reales
  private buildRealSession(workout: any, userExercises: any[], exercisesInfo: any[], currentDay: number) {
    console.log('Construyendo sesión con datos reales');
    
    const totalExercises = userExercises.length;
    const completedExercises = userExercises.filter(ex => ex.is_completed).length;
    
    const nextExerciseIndex = userExercises.findIndex(ex => !ex.is_completed);
    const currentExerciseIndex = nextExerciseIndex !== -1 ? nextExerciseIndex : 0;

    const sessionExercises = userExercises.map((ex, index) => {
      const exerciseInfo = exercisesInfo.find(e => e.id === ex.exercise_id);
      
      if (!exerciseInfo) {
        console.log(`No se encontró info para ejercicio ${ex.exercise_id}`);
      }

      return {
        id: ex.exercise_id,
        exerciseOrder: ex.exercise_order,
        name: exerciseInfo?.name || `Ejercicio ${ex.exercise_order}`,
        sets: ex.sets,
        reps: ex.reps,
        durationSeconds: ex.duration_seconds,
        restSeconds: ex.rest_seconds,
        instructions: exerciseInfo?.instructions || 'Instrucciones por definir',
        demoVideoUrl: exerciseInfo?.demo_video_url || null,
        muscleGroups: exerciseInfo?.muscle_groups || ['general'],
        equipment: exerciseInfo?.equipment || 'peso_corporal',
        caloriesPerMinute: exerciseInfo?.calories_per_minute || 5,
        completed: ex.is_completed,
        completedSets: ex.completed_sets || 0,
        completedReps: ex.completed_reps || 0,
        completedWeight: ex.completed_weight || 0,
        notes: ex.notes || '',
        isCurrentExercise: index === currentExerciseIndex
      };
    });

    const estimatedDuration = userExercises.reduce((total, ex) => {
      const exerciseTime = (ex.sets * (ex.reps ? 1 : (ex.duration_seconds || 30) / 60)) + 
                          (ex.sets * (ex.rest_seconds || 60) / 60);
      return total + exerciseTime;
    }, 0);

    return {
      success: true,
      data: {
        session: {
          workoutId: workout.id,
          workoutName: workout.name,
          dayNumber: currentDay,
          weekNumber: workout.week_number,
          totalExercises,
          completedExercises,
          estimatedDurationMinutes: Math.round(estimatedDuration),
          currentExerciseIndex,
          status: completedExercises === 0 ? 'ready' : 
                  completedExercises === totalExercises ? 'completed' : 'in_progress',
          progress: Math.round((completedExercises / totalExercises) * 100)
        },
        exercises: sessionExercises
      }
    };
  }

  // ============================================
// MÉTODOS PARA RUTINAS PERSONALIZADAS CON IMC
// ============================================



private translateLevel(level: string): string {
  const translations = {
    'beginner': 'Principiante',
    'intermediate': 'Intermedio',
    'advanced': 'Avanzado'
  };
  return translations[level] || 'Principiante';
}

private buildCustomWorkoutPlan(user: any, generateDto: GenerateWorkoutDto, bmiRecommendations?: any): any[] {
  const fitnessLevel = generateDto.fitnessLevel || user.fitness_level || 'beginner';
  const daysPerWeek = generateDto.daysPerWeek || 3;
  const focusArea = generateDto.focusArea || 'full_body';

  console.log(`Plan: nivel=${fitnessLevel}, días=${daysPerWeek}, enfoque=${focusArea}`);

  const exerciseTemplates = this.getExerciseTemplates(fitnessLevel, focusArea);
  const workoutPlan: any[] = [];

  for (let day = 1; day <= daysPerWeek; day++) {
    const dayName = this.getDayName(day, focusArea);
    const dayExercises = this.selectExercisesForDay(
      day, 
      exerciseTemplates, 
      fitnessLevel, 
      focusArea,
      bmiRecommendations
    );

    const dayPlan: any = {
      day,
      name: dayName,
      exercises: dayExercises
    };

    if (day === 1 && bmiRecommendations && bmiRecommendations.advice) {
      dayPlan.bmiAdvice = bmiRecommendations.advice;
    }

    workoutPlan.push(dayPlan);
  }

  return workoutPlan;
}

private getExerciseTemplates(fitnessLevel: string, focusArea: string): any {
  const templates = {
    beginner: {
      full_body: [
        { name: 'Sentadillas con soporte', sets: 3, reps: 10, rest: 60 },
        { name: 'Flexiones de rodillas', sets: 3, reps: 8, rest: 45 },
        { name: 'Plancha', sets: 3, duration: 20, rest: 45 },
        { name: 'Desplantes alternos', sets: 3, reps: 8, rest: 45 },
        { name: 'Remo con banda', sets: 3, reps: 10, rest: 45 },
        { name: 'Puente de glúteos', sets: 3, reps: 12, rest: 45 }
      ],
      upper_body: [
        { name: 'Flexiones de pared', sets: 3, reps: 10, rest: 45 },
        { name: 'Elevaciones laterales ligeras', sets: 3, reps: 10, rest: 45 },
        { name: 'Curl de bíceps con banda', sets: 3, reps: 10, rest: 45 },
        { name: 'Extensión de tríceps', sets: 3, reps: 10, rest: 45 },
        { name: 'Plancha alta', sets: 3, duration: 20, rest: 45 }
      ],
      lower_body: [
        { name: 'Sentadillas asistidas', sets: 3, reps: 10, rest: 60 },
        { name: 'Desplantes estáticos', sets: 3, reps: 8, rest: 45 },
        { name: 'Elevación de talones', sets: 3, reps: 15, rest: 30 },
        { name: 'Puente de glúteos', sets: 3, reps: 12, rest: 45 },
        { name: 'Aductores con banda', sets: 3, reps: 12, rest: 45 }
      ]
    },
    intermediate: {
      full_body: [
        { name: 'Sentadillas', sets: 4, reps: 10, rest: 75 },
        { name: 'Flexiones', sets: 4, reps: 12, rest: 60 },
        { name: 'Peso muerto rumano', sets: 4, reps: 10, rest: 75 },
        { name: 'Dominadas asistidas', sets: 3, reps: 8, rest: 60 },
        { name: 'Press militar con mancuernas', sets: 3, reps: 10, rest: 60 },
        { name: 'Plancha lateral', sets: 3, duration: 30, rest: 45 }
      ],
      upper_body: [
        { name: 'Press de banca con mancuernas', sets: 4, reps: 10, rest: 75 },
        { name: 'Remo con mancuernas', sets: 4, reps: 10, rest: 60 },
        { name: 'Press militar sentado', sets: 3, reps: 10, rest: 60 },
        { name: 'Curl de bíceps alterno', sets: 3, reps: 10, rest: 45 },
        { name: 'Fondos en banco', sets: 3, reps: 10, rest: 45 },
        { name: 'Elevaciones frontales', sets: 3, reps: 10, rest: 45 }
      ],
      lower_body: [
        { name: 'Sentadillas con barra', sets: 4, reps: 10, rest: 90 },
        { name: 'Peso muerto', sets: 4, reps: 8, rest: 90 },
        { name: 'Prensa de piernas', sets: 4, reps: 12, rest: 75 },
        { name: 'Zancadas con mancuernas', sets: 3, reps: 10, rest: 60 },
        { name: 'Curl femoral', sets: 3, reps: 12, rest: 60 },
        { name: 'Elevación de talones sentado', sets: 4, reps: 15, rest: 45 }
      ]
    },
    advanced: {
      full_body: [
        { name: 'Sentadillas traseras', sets: 5, reps: 5, rest: 120 },
        { name: 'Peso muerto convencional', sets: 5, reps: 5, rest: 120 },
        { name: 'Press de banca', sets: 4, reps: 6, rest: 90 },
        { name: 'Dominadas lastradas', sets: 4, reps: 8, rest: 90 },
        { name: 'Press militar de pie', sets: 4, reps: 6, rest: 75 },
        { name: 'L-sit', sets: 3, duration: 45, rest: 60 }
      ],
      upper_body: [
        { name: 'Press de banca inclinado', sets: 5, reps: 6, rest: 120 },
        { name: 'Dominadas pesadas', sets: 4, reps: 6, rest: 90 },
        { name: 'Press militar con barra', sets: 4, reps: 6, rest: 90 },
        { name: 'Remo con barra', sets: 4, reps: 8, rest: 75 },
        { name: 'Fondos en paralelas lastrados', sets: 3, reps: 8, rest: 75 },
        { name: 'Face pulls', sets: 3, reps: 15, rest: 60 }
      ],
      lower_body: [
        { name: 'Sentadillas frontales', sets: 5, reps: 5, rest: 120 },
        { name: 'Peso muerto rumano', sets: 4, reps: 6, rest: 90 },
        { name: 'Sentadilla búlgara', sets: 4, reps: 8, rest: 75 },
        { name: 'Hip thrust con barra', sets: 4, reps: 10, rest: 75 },
        { name: 'Curl nórdico', sets: 3, reps: 6, rest: 90 },
        { name: 'Elevación de talones de pie', sets: 4, reps: 20, rest: 60 }
      ]
    }
  };

  return templates[fitnessLevel]?.[focusArea] || templates.beginner.full_body;
}

private selectExercisesForDay(
  day: number, 
  templates: any[], 
  fitnessLevel: string, 
  focusArea: string,
  bmiRecommendations?: any
): any[] {
  const baseExercisesPerDay = fitnessLevel === 'beginner' ? 4 : 
                              fitnessLevel === 'intermediate' ? 5 : 6;
  
  // Aplicar modificador de volumen según IMC (si existe)
  const volumeModifier = bmiRecommendations?.volumeModifier || 1.0;
  const exercisesPerDay = Math.round(baseExercisesPerDay * volumeModifier);
  
  const startIndex = ((day - 1) * exercisesPerDay) % templates.length;
  const selectedExercises: any[] = [];

  for (let i = 0; i < exercisesPerDay; i++) {
    const templateIndex = (startIndex + i) % templates.length;
    const template = templates[templateIndex];
    
    // Aplicar modificadores de IMC (si existen)
    const intensityModifier = bmiRecommendations?.intensityModifier || 1.0;
    const restModifier = bmiRecommendations?.restModifier || 1.0;

    const exercise: any = {
      name: template.name,
      sets: template.sets,
      rest_seconds: Math.round(template.rest * restModifier)
    };

    if (template.reps) {
      exercise.reps = Math.max(5, Math.round(template.reps * intensityModifier));
    }
    if (template.duration) {
      exercise.duration_seconds = Math.round(template.duration * intensityModifier);
    }

    selectedExercises.push(exercise);
  }

  return selectedExercises;
}

private getDayName(day: number, focusArea: string): string {
  if (focusArea === 'full_body') {
    return `Día ${day} - Full Body`;
  } else if (focusArea === 'upper_body') {
    return `Día ${day} - Tren Superior`;
  } else if (focusArea === 'lower_body') {
    return `Día ${day} - Tren Inferior`;
  }
  return `Día ${day}`;
}

private async createWorkoutExercises(userWorkoutId: string, workoutPlan: any[]) {
  const exercisesToInsert: any[] = [];


  for (const dayPlan of workoutPlan) {
    for (let i = 0; i < dayPlan.exercises.length; i++) {
      const exercise = dayPlan.exercises[i];
      const exerciseId = await this.findExerciseByName(exercise.name);

      exercisesToInsert.push({
        user_workout_id: userWorkoutId,
        exercise_id: exerciseId,
        day_number: dayPlan.day,
        exercise_order: i + 1,
        sets: exercise.sets,
        reps: exercise.reps || null,
        duration_seconds: exercise.duration_seconds || null,
        rest_seconds: exercise.rest_seconds,
        is_completed: false
      });
    }
  }

  console.log(`Insertando ${exercisesToInsert.length} ejercicios`);

  const { error } = await this.supabaseService.client
    .from('user_workout_exercises')
    .insert(exercisesToInsert);

  if (error) {
    throw new Error(`Error insertando ejercicios: ${error.message}`);
  }

  console.log(`${exercisesToInsert.length} ejercicios insertados exitosamente`);
}

private calculateBMI(weight: number, height: number): number {
  if (!weight || !height || height <= 0) return 0;
  const heightInMeters = height / 100;
  return Math.round((weight / (heightInMeters * heightInMeters)) * 100) / 100;
}

private getBMICategory(bmi: number): string {
  if (bmi === 0) return 'unknown';
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  if (bmi < 35) return 'obese_1';
  if (bmi < 40) return 'obese_2';
  return 'obese_3';
}

private getBMIRecommendations(bmiCategory: string): any {
  const recommendations = {
    unknown: {
      intensityModifier: 1.0,
      restModifier: 1.0,
      volumeModifier: 1.0,
      advice: 'Se recomienda completar datos de peso y altura en el perfil'
    },
    underweight: {
      intensityModifier: 0.8,
      restModifier: 1.2,
      volumeModifier: 0.9,
      advice: 'Enfoque en ganar masa muscular con ejercicios compuestos'
    },
    normal: {
      intensityModifier: 1.0,
      restModifier: 1.0,
      volumeModifier: 1.0,
      advice: 'Mantén un balance entre fuerza y resistencia'
    },
    overweight: {
      intensityModifier: 0.9,
      restModifier: 1.1,
      volumeModifier: 1.1,
      advice: 'Combina fuerza con mayor volumen para quemar calorías'
    },
    obese_1: {
      intensityModifier: 0.7,
      restModifier: 1.3,
      volumeModifier: 1.2,
      advice: 'Prioriza ejercicios de bajo impacto y progresión gradual'
    },
    obese_2: {
      intensityModifier: 0.6,
      restModifier: 1.4,
      volumeModifier: 1.2,
      advice: 'Ejercicios de muy bajo impacto, movimiento constante'
    },
    obese_3: {
      intensityModifier: 0.5,
      restModifier: 1.5,
      volumeModifier: 1.3,
      advice: 'Ejercicios sin impacto articular, consulta médico'
    }
  };

  return recommendations[bmiCategory] || recommendations.normal;
}
}
