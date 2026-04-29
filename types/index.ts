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
  completedAt?: string; // ISO date string
};

export type SquadMember = {
  id: string;
  name: string;
  email?: string;
  groupId: string;
  readiness: number;
  compliance: number;
  risk: 'Low' | 'Medium' | 'High';
  load: number;
  inviteStatus?: 'Manual' | 'Invited' | 'Joined';
};

export type TrainingGroup = {
  id: string;
  name: string;
  focus: string;
  targetScore: number;
};

export type WearableConnection = {
  id: string;
  name: string;
  status: 'Connected' | 'Ready' | 'Planned';
  signal: string;
  lastSync: string;
};

export type TeamMessage = {
  id: string;
  author: string;
  group: string;
  message: string;
  time: string;
};

export type FuelProfile = {
  bodyWeightKg: number;
  heightCm: number;
  age: number;
  skinfoldMm: number;
  sleepScore: number;
  hydrationLoggedMl: number;
};

export type ExerciseCategory = 'Strength' | 'Resistance' | 'Cardio' | 'Workout' | 'Mobility';
export type TrainingModeIcon = 'barbell' | 'git-branch' | 'heart' | 'fitness' | 'skull';

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  dose: string;
  guidance: string;
  cues: string[];
};

export type TrainingMode = {
  key: string;
  type: TrainingSession['type'];
  label: string;
  title: string;
  icon: TrainingModeIcon;
  tone: string;
  rpe: number;
  score: number;
  coach: string;
  defaultExerciseIds: string[];
  unlockLevel?: number;
};
