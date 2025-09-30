import { Exercise } from './exercise.entity'; 

export class WorkoutPlan {
  id: string;
  name: string;
  description?: string;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks: number;
  daysPerWeek: number;
  focusArea: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PlanExercise {
  id: string;
  planId: string;
  exerciseId: string;
  dayNumber: number;
  exerciseOrder: number;
  sets: number;
  reps?: number;
  durationSeconds?: number;
  restSeconds: number;
  weightPercentage?: number;
  notes?: string;
  exercise?: Exercise; // Para joins
}