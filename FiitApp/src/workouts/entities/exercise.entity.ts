export class Exercise {
  id: string;
  name: string;
  description?: string;
  muscleGroups: string[];
  equipment: string;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  instructions?: string;
  demoVideoUrl?: string;
  caloriesPerMinute: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}