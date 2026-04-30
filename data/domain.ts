export type TrackPoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number;
};

export type TrainingSession = {
  id: string;
  type: 'Ruck' | 'Strength' | 'Resistance' | 'Cardio' | 'Workout' | 'Run' | 'Mobility';
  title: string;
  score: number;
  durationMinutes: number;
  rpe: number;
  loadKg?: number;
  routePoints?: TrackPoint[];
  completedAt?: string;
  updatedAt?: string;
};

export type ReadinessLog = {
  id: string;
  date: string;
  memberId?: string;
  memberName?: string;
  groupId?: string;
  sleepHours?: number;
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  soreness: 1 | 2 | 3 | 4 | 5;
  stress?: 1 | 2 | 3 | 4 | 5;
  pain?: 1 | 2 | 3 | 4 | 5;
  hydration: 'Poor' | 'Adequate' | 'Optimal';
  mood?: 1 | 2 | 3 | 4 | 5;
  illness?: 1 | 2 | 3 | 4 | 5;
  painArea?: 'Knee' | 'Back' | 'Shoulder' | 'Hip' | 'Ankle' | 'Other';
  limitsTraining?: boolean;
  restingHR?: number;
  hrv?: number;
  updatedAt?: string;
};

export type FuelLog = {
  id: string;
  date: string;
  caloriesKcal: number;
  proteinG: number;
  hydrationMl: number;
  calorieTarget: number;
  proteinTarget: number;
  hydrationTargetMl: number;
};

export type WorkoutCompletionType = 'assigned' | 'quick_log' | 'ad_hoc';

export type LoggedExercise = {
  name: string;
  sets?: number;
  reps?: number;
  loadKg?: number;
};

export type WorkoutCompletion = {
  id: string;
  memberId: string;
  memberName: string;
  groupId: string;
  completionType: WorkoutCompletionType;
  sessionKind: TrainingSession['type'];
  assignment: string;
  effort: 'Too Easy' | 'About Right' | 'Too Hard';
  durationMinutes: number;
  note?: string;
  volume: number;
  exercises?: LoggedExercise[];
  completedAt: string;
  updatedAt?: string;
};
