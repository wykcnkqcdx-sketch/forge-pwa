export type TrainingSession = {
  id: string;
  type: 'Ruck' | 'Strength' | 'Resistance' | 'Cardio' | 'Workout' | 'Run' | 'Mobility';
  title: string;
  score: number;
  durationMinutes: number;
  rpe: number;
  loadKg?: number;
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

export const initialSessions: TrainingSession[] = [
  { id: '1', type: 'Ruck', title: 'Loaded Intervals', score: 88, durationMinutes: 45, rpe: 7, loadKg: 18 },
  { id: '2', type: 'Strength', title: 'Lower Body Strength', score: 81, durationMinutes: 52, rpe: 8 },
  { id: '3', type: 'Run', title: 'Zone 2 Run', score: 76, durationMinutes: 38, rpe: 5 },
];

export const squadMembers: SquadMember[] = [
  { id: '1', groupId: 'alpha', name: 'Cpl Ryan', email: 'ryan@example.com', readiness: 86, compliance: 92, risk: 'Low', load: 72, inviteStatus: 'Joined' },
  { id: '2', groupId: 'alpha', name: 'Pte Doyle', email: 'doyle@example.com', readiness: 61, compliance: 67, risk: 'Medium', load: 84, inviteStatus: 'Joined' },
  { id: '3', groupId: 'bravo', name: 'Pte Walsh', email: 'walsh@example.com', readiness: 44, compliance: 58, risk: 'High', load: 91, inviteStatus: 'Joined' },
  { id: '4', groupId: 'bravo', name: 'Sgt Murphy', email: 'murphy@example.com', readiness: 79, compliance: 84, risk: 'Low', load: 68, inviteStatus: 'Joined' },
  { id: '5', groupId: 'charlie', name: 'Pte Byrne', email: 'byrne@example.com', readiness: 74, compliance: 78, risk: 'Low', load: 70, inviteStatus: 'Joined' },
  { id: '6', groupId: 'charlie', name: 'Cpl Nolan', email: 'nolan@example.com', readiness: 69, compliance: 81, risk: 'Medium', load: 77, inviteStatus: 'Joined' },
];

export const trainingGroups: TrainingGroup[] = [
  { id: 'alpha', name: 'Alpha', focus: 'Strength endurance', targetScore: 82 },
  { id: 'bravo', name: 'Bravo', focus: 'Ruck readiness', targetScore: 76 },
  { id: 'charlie', name: 'Charlie', focus: 'Cardio base', targetScore: 80 },
];

export const wearableConnections: WearableConnection[] = [
  { id: 'apple-health', name: 'Apple Health', status: 'Ready', signal: 'HR, sleep, steps', lastSync: 'Connect on iOS' },
  { id: 'garmin', name: 'Garmin', status: 'Planned', signal: 'HRV, GPS, training load', lastSync: 'OAuth needed' },
  { id: 'fitbit', name: 'Fitbit', status: 'Planned', signal: 'Sleep, resting HR', lastSync: 'OAuth needed' },
  { id: 'strava', name: 'Strava', status: 'Ready', signal: 'Runs, rides, routes', lastSync: 'Manual export ready' },
];

export const fuelProfile: FuelProfile = {
  bodyWeightKg: 82,
  heightCm: 180,
  age: 32,
  skinfoldMm: 42,
  sleepScore: 78,
  hydrationLoggedMl: 1200,
};

export const teamMessages: TeamMessage[] = [
  { id: '1', author: 'Coach', group: 'Alpha', message: 'Hydrate before loaded work. Add electrolytes if ruck is over 60 min.', time: '08:10' },
  { id: '2', author: 'Cpl Ryan', group: 'Alpha', message: 'Strength block complete. RPE felt like 7.', time: '09:25' },
  { id: '3', author: 'Pte Byrne', group: 'Charlie', message: 'Zone 2 done. Sleep was rough, keeping intensity down.', time: '10:05' },
];
