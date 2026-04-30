import { colours } from '../theme';
import type { TrainingSession } from './domain';

export type { TrackPoint, TrainingSession } from './domain';

export type SquadMember = {
  id: string;
  name: string;
  gymName?: string;
  email?: string;
  groupId: string;
  readiness: number;
  compliance: number;
  risk: 'Low' | 'Medium' | 'High';
  load: number;
  inviteStatus?: 'Manual' | 'Invited' | 'Joined';
  assignment?: string;
  pinnedExerciseIds?: string[];
  ghostMode?: boolean;
  streakDays?: number;
  weeklyVolume?: number;
  lastWorkoutTitle?: string;
  lastWorkoutAt?: string;
  lastWorkoutNote?: string;
  hypeCount?: number;
  deviceSyncProvider?: 'Apple Health';
  deviceSyncStatus?: 'Disconnected' | 'Ready' | 'Connected' | 'Unsupported';
  deviceConnectedAt?: string;
  deviceLastSyncAt?: string;
  importedSleepHours?: number;
  importedRestingHR?: number;
  importedHrv?: number;
  assignmentSession?: MemberAssignment;
  updatedAt?: string;
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
  { id: '1', type: 'Ruck', title: 'Loaded Intervals', score: 88, durationMinutes: 45, rpe: 7, loadKg: 18, completedAt: '2026-04-28T08:30:00.000Z' },
  { id: '2', type: 'Strength', title: 'Lower Body Strength', score: 81, durationMinutes: 52, rpe: 8, completedAt: '2026-04-26T17:15:00.000Z' },
  { id: '3', type: 'Run', title: 'Zone 2 Run', score: 76, durationMinutes: 38, rpe: 5, completedAt: '2026-04-24T07:45:00.000Z' },
];

export const squadMembers: SquadMember[] = [
  { id: '1', groupId: 'alpha', name: 'Cpl Ryan', gymName: 'Ryan', email: 'ryan@example.com', readiness: 86, compliance: 92, risk: 'Low', load: 72, inviteStatus: 'Joined', assignment: 'Strength Training', streakDays: 4, weeklyVolume: 820, lastWorkoutTitle: 'Strength Training', lastWorkoutAt: '2026-04-28T08:30:00.000Z', hypeCount: 6, assignmentSession: { id: 'assign-1', title: 'Strength Training', type: 'Strength', status: 'assigned', assignedAt: '2026-04-29T06:45:00.000Z', coachNote: 'Stay crisp on the first three lifts, then finish with carries.', exercises: [{ exerciseId: 'trap-bar-deadlift', name: 'Trap-bar deadlift', dose: '5 x 5', coachPinned: true, prescribed: { sets: 5, reps: 5, load: 140, loadUnit: 'kg' }, status: 'assigned' }, { exerciseId: 'pull-up', name: 'Pull-up', dose: '5 x max clean', coachPinned: true, prescribed: { sets: 5, reps: 6 }, status: 'assigned' }, { exerciseId: 'front-squat', name: 'Front squat', dose: '4 x 5', prescribed: { sets: 4, reps: 5, load: 95, loadUnit: 'kg' }, status: 'assigned' }, { exerciseId: 'farmer-carry', name: 'Farmer carry', dose: '6 x 40m', prescribed: { sets: 6, durationMinutes: 12 }, status: 'assigned' }] } },
  { id: '2', groupId: 'alpha', name: 'Pte Doyle', gymName: 'Doyle', email: 'doyle@example.com', readiness: 61, compliance: 67, risk: 'Medium', load: 84, inviteStatus: 'Joined', assignment: 'Mobility Reset', streakDays: 2, weeklyVolume: 360, lastWorkoutTitle: 'Mobility Reset', lastWorkoutAt: '2026-04-27T18:00:00.000Z', hypeCount: 3 },
  { id: '3', groupId: 'bravo', name: 'Pte Walsh', gymName: 'Walsh', email: 'walsh@example.com', readiness: 44, compliance: 58, risk: 'High', load: 91, inviteStatus: 'Joined', assignment: 'Recovery Walk', streakDays: 1, weeklyVolume: 240, lastWorkoutTitle: 'Recovery Walk', lastWorkoutAt: '2026-04-26T12:00:00.000Z', hypeCount: 2 },
  { id: '4', groupId: 'bravo', name: 'Sgt Murphy', gymName: 'Murphy', email: 'murphy@example.com', readiness: 79, compliance: 84, risk: 'Low', load: 68, inviteStatus: 'Joined', assignment: 'Ruck Intervals', streakDays: 5, weeklyVolume: 910, lastWorkoutTitle: 'Ruck Intervals', lastWorkoutAt: '2026-04-28T07:15:00.000Z', hypeCount: 7 },
  { id: '5', groupId: 'charlie', name: 'Pte Byrne', gymName: 'Byrne', email: 'byrne@example.com', readiness: 74, compliance: 78, risk: 'Low', load: 70, inviteStatus: 'Joined', assignment: 'Zone 2 Run', streakDays: 3, weeklyVolume: 640, lastWorkoutTitle: 'Zone 2 Run', lastWorkoutAt: '2026-04-27T09:20:00.000Z', hypeCount: 5 },
  { id: '6', groupId: 'charlie', name: 'Cpl Nolan', gymName: 'Nolan', email: 'nolan@example.com', readiness: 69, compliance: 81, risk: 'Medium', load: 77, inviteStatus: 'Joined', assignment: 'Resistance Training', streakDays: 2, weeklyVolume: 520, lastWorkoutTitle: 'Resistance Training', lastWorkoutAt: '2026-04-26T16:45:00.000Z', hypeCount: 4 },
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

export type ExerciseCategory = 'Strength' | 'Resistance' | 'Cardio' | 'Workout' | 'Mobility';
export type MovementPattern = 'Push' | 'Pull' | 'Legs' | 'Carry' | 'Core' | 'Conditioning' | 'Mobility';
export type TrainingModeIcon = 'barbell' | 'git-branch' | 'heart' | 'fitness' | 'skull';

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  pattern?: MovementPattern;
  dose: string;
  guidance: string;
  cues: string[];
};

export type AssignedExerciseBlock = {
  exerciseId: string;
  name: string;
  dose: string;
  coachPinned?: boolean;
  prescribed?: {
    sets?: number;
    reps?: number;
    load?: number;
    loadUnit?: 'kg' | 'lbs';
    durationMinutes?: number;
    restSeconds?: number;
  };
  actual?: {
    sets?: number;
    reps?: number;
    load?: number;
    durationMinutes?: number;
  };
  status?: 'assigned' | 'hit' | 'modified' | 'skipped';
};

export type MemberAssignment = {
  id: string;
  title: string;
  type: TrainingSession['type'];
  status: 'assigned' | 'viewed' | 'completed';
  assignedAt: string;
  coachNote?: string;
  exercises: AssignedExerciseBlock[];
};

export type ProgrammeTemplate = {
  id: string;
  name: string;
  assignmentTitle: string;
  type: TrainingSession['type'];
  evidenceLabel?: string;
  evidenceUpdatedAt?: string;
  evidenceSummary?: string;
  evidenceSources?: Array<{
    title: string;
    url: string;
  }>;
  coachNote?: string;
  summary?: string;
  weeklyVolume?: string;
  intensity?: string;
  weeklyStructure?: string[];
  scienceNotes?: string[];
  exercises: AssignedExerciseBlock[];
  createdAt: string;
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
  coachPinnedExerciseIds?: string[];
  unlockLevel?: number;
};

export const exerciseLibrary: Exercise[] = [
  { id: 'trap-bar-deadlift', name: 'Trap-bar deadlift', category: 'Strength', pattern: 'Legs', dose: '5 x 5', guidance: 'Build full-body force with a neutral grip and strong brace.', cues: ['Feet midline inside handles', 'Brace before pulling', 'Drive the floor away'] },
  { id: 'front-squat', name: 'Front squat', category: 'Strength', pattern: 'Legs', dose: '4 x 5', guidance: 'Train upright squatting strength and trunk stiffness.', cues: ['Elbows high', 'Knees track toes', 'Pause if depth collapses'] },
  { id: 'push-press', name: 'Push press', category: 'Strength', pattern: 'Push', dose: '5 x 3', guidance: 'Develop power transfer from legs into overhead pressing.', cues: ['Dip vertical', 'Drive fast', 'Lock ribs down'] },
  { id: 'pull-up', name: 'Pull-up', category: 'Strength', pattern: 'Pull', dose: '5 x max clean', guidance: 'Build pulling strength for climbing, carries, and load carriage.', cues: ['Start from active shoulders', 'Chest to bar path', 'No swinging reps'] },
  { id: 'farmer-carry', name: 'Farmer carry', category: 'Strength', pattern: 'Carry', dose: '6 x 40m', guidance: 'Train grip, posture, and loaded gait under fatigue.', cues: ['Tall posture', 'Short fast steps', 'Do not lean back'] },
  { id: 'walking-lunge', name: 'Walking lunge', category: 'Strength', pattern: 'Legs', dose: '4 x 20m', guidance: 'Strengthen single-leg control and loaded movement.', cues: ['Long enough stride', 'Soft back knee', 'Push through front foot'] },
  { id: 'band-row', name: 'Band row', category: 'Resistance', pattern: 'Pull', dose: '4 x 15', guidance: 'Use controlled pulling volume without heavy joint stress.', cues: ['Squeeze shoulder blades', 'Pause at ribs', 'Slow return'] },
  { id: 'goblet-squat', name: 'Goblet squat', category: 'Resistance', pattern: 'Legs', dose: '4 x 12', guidance: 'Groove squat mechanics with moderate load.', cues: ['Hold weight tight', 'Sit between hips', 'Keep chest proud'] },
  { id: 'suspension-press', name: 'Suspension press', category: 'Resistance', pattern: 'Push', dose: '4 x 10', guidance: 'Build pressing control with adjustable body angle.', cues: ['Body straight', 'Hands under shoulders', 'Control depth'] },
  { id: 'hamstring-bridge', name: 'Hamstring bridge', category: 'Resistance', pattern: 'Legs', dose: '3 x 14', guidance: 'Target posterior chain endurance and hip extension.', cues: ['Ribs down', 'Squeeze glutes', 'Slow lower'] },
  { id: 'anti-rotation', name: 'Anti-rotation press', category: 'Resistance', pattern: 'Core', dose: '3 x 30s', guidance: 'Train trunk control against twisting forces.', cues: ['Square shoulders', 'Exhale on press', 'No torso drift'] },
  { id: 'band-face-pull', name: 'Band face pull', category: 'Resistance', pattern: 'Pull', dose: '3 x 18', guidance: 'Build upper-back resilience for posture and shoulder health.', cues: ['Pull to eyebrows', 'Elbows high', 'Slow return'] },
  { id: 'zone-2-run', name: 'Zone 2 run', category: 'Cardio', pattern: 'Conditioning', dose: '24 mins', guidance: 'Build aerobic base at a conversational pace.', cues: ['Nasal or easy breathing', 'Stay relaxed', 'Finish fresher than you started'] },
  { id: 'tempo-run', name: 'Tempo run', category: 'Cardio', pattern: 'Conditioning', dose: '3 x 8 mins', guidance: 'Improve threshold pace without sprinting.', cues: ['Hard but controlled', 'Even splits', 'Recover fully between reps'] },
  { id: 'bike-intervals', name: 'Bike intervals', category: 'Cardio', pattern: 'Conditioning', dose: '8 x 60s', guidance: 'Develop low-impact conditioning and repeat power.', cues: ['Fast cadence', 'Recover easy', 'Keep hips still'] },
  { id: 'rower-base', name: 'Rower base', category: 'Cardio', pattern: 'Conditioning', dose: '20 mins', guidance: 'Build engine capacity with full-body rhythm.', cues: ['Legs then body then arms', 'Smooth recovery', 'Consistent split'] },
  { id: 'strides', name: 'Strides', category: 'Cardio', pattern: 'Conditioning', dose: '6 x 20s', guidance: 'Touch speed while staying relaxed and technically clean.', cues: ['Tall posture', 'Fast feet', 'Walk back recovery'] },
  { id: 'shuttle-run', name: 'Shuttle run', category: 'Workout', pattern: 'Conditioning', dose: '6 x 60m', guidance: 'Train acceleration, deceleration, and change of direction.', cues: ['Sink hips before turn', 'Touch line under control', 'Accelerate cleanly'] },
  { id: 'sandbag-clean', name: 'Sandbag clean', category: 'Workout', pattern: 'Legs', dose: '5 x 6', guidance: 'Build awkward-object power for field work.', cues: ['Lap the bag', 'Hips through', 'Do not curl with arms'] },
  { id: 'push-up-ladder', name: 'Push-up ladder', category: 'Workout', pattern: 'Push', dose: '10-8-6-4-2', guidance: 'Accumulate pressing volume under fatigue.', cues: ['Straight body line', 'Chest to floor', 'Stop before sagging'] },
  { id: 'bear-crawl', name: 'Bear crawl', category: 'Workout', pattern: 'Core', dose: '5 x 20m', guidance: 'Train shoulder stability, trunk control, and coordination.', cues: ['Knees low', 'Opposite hand and foot', 'Quiet hips'] },
  { id: 'burpee', name: 'Burpee', category: 'Workout', pattern: 'Conditioning', dose: '5 x 10', guidance: 'Use as a high-output conditioning tool.', cues: ['Step down if needed', 'Land soft', 'Keep reps consistent'] },
  { id: 'mobility-reset', name: 'Mobility reset', category: 'Mobility', pattern: 'Mobility', dose: '8 mins', guidance: 'Downshift after training and restore usable range.', cues: ['Move slowly', 'Breathe through positions', 'Avoid pain'] },
  { id: 'hip-airplane', name: 'Hip airplane', category: 'Mobility', pattern: 'Mobility', dose: '3 x 5 each', guidance: 'Improve hip control for running, rucking, and squatting.', cues: ['Hold support', 'Rotate from hip', 'Move in control'] },
  { id: 'thoracic-rotation', name: 'Thoracic rotation', category: 'Mobility', pattern: 'Mobility', dose: '2 x 8 each', guidance: 'Restore upper-back rotation and shoulder position.', cues: ['Keep hips stacked', 'Reach long', 'Exhale into rotation'] },
  { id: 'calf-ankle-rock', name: 'Calf ankle rock', category: 'Mobility', pattern: 'Mobility', dose: '2 x 12 each', guidance: 'Prepare ankles for running, loaded walking, and squatting.', cues: ['Heel stays down', 'Knee tracks toes', 'Pause at end range'] },
];

export const trainingModes: TrainingMode[] = [
  {
    key: 'strength',
    type: 'Strength',
    label: 'Strength',
    title: 'Strength Training',
    icon: 'barbell',
    tone: colours.cyan,
    rpe: 7,
    score: 84,
    coach: 'Prioritise crisp heavy reps, longer rest, and clean technique.',
    defaultExerciseIds: ['trap-bar-deadlift', 'front-squat', 'push-press', 'pull-up', 'farmer-carry'],
    coachPinnedExerciseIds: ['trap-bar-deadlift', 'pull-up'],
  },
  {
    key: 'resistance',
    type: 'Resistance',
    label: 'Resistance',
    title: 'Resistance Training',
    icon: 'git-branch',
    tone: colours.violet,
    rpe: 6,
    score: 82,
    coach: 'Use controlled tempo and steady tension through the full range.',
    defaultExerciseIds: ['band-row', 'goblet-squat', 'suspension-press', 'hamstring-bridge', 'anti-rotation'],
    coachPinnedExerciseIds: ['band-row', 'goblet-squat'],
  },
  {
    key: 'cardio',
    type: 'Cardio',
    label: 'Cardio',
    title: 'Cardio Training',
    icon: 'heart',
    tone: colours.green,
    rpe: 5,
    score: 86,
    coach: 'Keep most work aerobic, then add small speed doses when fresh.',
    defaultExerciseIds: ['zone-2-run', 'tempo-run', 'bike-intervals', 'rower-base', 'strides'],
    coachPinnedExerciseIds: ['zone-2-run'],
  },
  {
    key: 'workout',
    type: 'Workout',
    label: 'Workout',
    title: 'Field Workout',
    icon: 'fitness',
    tone: colours.amber,
    rpe: 8,
    score: 79,
    coach: 'Move with intent, but cap intensity if form starts to break.',
    defaultExerciseIds: ['sandbag-clean', 'shuttle-run', 'push-up-ladder', 'bear-crawl', 'mobility-reset'],
    coachPinnedExerciseIds: ['sandbag-clean', 'shuttle-run'],
  },
  {
    key: 'elite',
    type: 'Workout',
    label: 'Elite',
    title: 'Tier 1 Operator',
    icon: 'skull',
    tone: colours.red,
    rpe: 10,
    score: 150,
    coach: 'You have unlocked the Elite block. Push beyond normal limits, but respect the recovery cost.',
    defaultExerciseIds: ['trap-bar-deadlift', 'front-squat', 'sandbag-clean', 'shuttle-run', 'burpee'],
    coachPinnedExerciseIds: ['trap-bar-deadlift', 'sandbag-clean'],
    unlockLevel: 10,
  },
];

export const programmeTemplates: ProgrammeTemplate[] = [
  {
    id: 'template-strength-base',
    name: 'Strength Base / Full Gym',
    assignmentTitle: 'Strength Training',
    type: 'Strength',
    evidenceLabel: 'FORGE Evidence v2026.04',
    evidenceUpdatedAt: '2026-04-30',
    evidenceSummary: 'Built from ACSM 2026 resistance training guidance with FORGE tactical session rules.',
    evidenceSources: [
      {
        title: 'ACSM 2026 Position Stand: Resistance Training Prescription',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/',
      },
      {
        title: 'Currier et al. 2023 Bayesian Meta-analysis',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/',
      },
    ],
    coachNote: 'Prioritise force production, then finish with carries.',
    summary: 'A lower-rep compound session built around high-force patterns and enough rest to keep quality high.',
    weeklyVolume: '10 to 14 hard sets per movement each week',
    intensity: 'Primary lifts at moderate-high effort with 2 to 4 min rest',
    weeklyStructure: [
      'Day 1: Heavy bilateral lower + pull',
      'Day 2: Upper push-pull + carries',
      'Day 3: Secondary lower strength + trunk stiffness',
    ],
    scienceNotes: [
      'Place the most technical heavy lift first.',
      'Keep weekly hard-set volume moderate so bar speed stays honest.',
      'Carries and pulls support grip and trunk resilience.',
    ],
    exercises: [
      { exerciseId: 'trap-bar-deadlift', name: 'Trap-bar deadlift', dose: '5 x 5', coachPinned: true, prescribed: { sets: 5, reps: 5, loadUnit: 'kg' }, status: 'assigned' },
      { exerciseId: 'front-squat', name: 'Front squat', dose: '4 x 5', prescribed: { sets: 4, reps: 5, loadUnit: 'kg' }, status: 'assigned' },
      { exerciseId: 'pull-up', name: 'Pull-up', dose: '5 x max clean', coachPinned: true, prescribed: { sets: 5, reps: 6 }, status: 'assigned' },
      { exerciseId: 'farmer-carry', name: 'Farmer carry', dose: '6 x 40m', prescribed: { sets: 6, durationMinutes: 12 }, status: 'assigned' },
    ],
    createdAt: '2026-04-30T08:00:00.000Z',
  },
];
