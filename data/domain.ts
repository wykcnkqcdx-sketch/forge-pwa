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

export type WorkoutCompletion = {
  id: string;
  memberId: string;
  memberName: string;
  groupId: string;
  assignment: string;
  effort: 'Too Easy' | 'About Right' | 'Too Hard';
  note?: string;
  volume: number;
  completedAt: string;
};
