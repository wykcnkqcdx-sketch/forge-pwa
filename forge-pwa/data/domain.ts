export type TrackPoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number;
};

export type TrainingSession = {
  id: string;
  type: 'Ruck' | 'Strength' | 'Resistance' | 'Cardio' | 'Workout' | 'Run' | 'Mobility' | 'Assessment';
  title: string;
  score: number;
  durationMinutes: number;
  rpe: number;
  loadKg?: number;
  routePoints?: TrackPoint[];
  completedAt?: string;
  notes?: string;
  weather?: 'Hot' | 'Mild' | 'Cold' | 'Wet';
  terrain?: 'Flat' | 'Hilly' | 'Mixed' | 'Urban';
};

export type AssessmentRecord = {
  id: string;
  date: string;
  type: '3RM_TrapBar' | 'PushUps_2Min' | 'Plank_Max' | 'Run_2Mile' | 'PullUps_Max' | 'Ruck_12Mile';
  score: number;
  unit: 'kg' | 'reps' | 'seconds' | 'minutes';
};

export type ReadinessLog = {
  id: string;
  date: string;
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  soreness: 1 | 2 | 3 | 4 | 5;
  stress: 1 | 2 | 3 | 4 | 5;
  hydration: 'Poor' | 'Adequate' | 'Optimal';
  restingHR?: number;
  hrv?: number;
};