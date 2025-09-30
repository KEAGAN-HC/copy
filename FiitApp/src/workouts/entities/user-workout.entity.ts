import { Exercise } from './exercise.entity';

export class UserWorkout {
  id: string;
  userId: string;
  planId?: string;
  name: string;
  weekNumber: number;
  isCustom: boolean;
  currentDay: number;
  currentExerciseIndex: number;
  completed: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class UserWorkoutExercise {
  id: string;
  userWorkoutId: string;
  exerciseId: string;
  dayNumber: number;
  exerciseOrder: number;
  sets: number;
  reps?: number;
  durationSeconds?: number;
  restSeconds: number;
  targetWeight?: number;
  completedWeight?: number;
  completedReps?: number;
  completedSets?: number;
  completedAt?: Date;
  isCompleted: boolean;
  notes?: string;
  exercise?: Exercise; // Para joins
}