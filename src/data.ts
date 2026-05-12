export type TabId = 'home' | 'train' | 'tactical' | 'recovery' | 'team' | 'profile';

export type Metric = {
  label: string;
  value: string;
  detail: string;
  tone?: 'good' | 'warn' | 'danger';
};

export const tabs: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'train', label: 'Train', icon: '▰' },
  { id: 'tactical', label: 'Tactical', icon: '⌖' },
  { id: 'recovery', label: 'Recovery', icon: '◌' },
  { id: 'team', label: 'Team', icon: '▥' },
  { id: 'profile', label: 'Profile', icon: '◇' },
];

export const readiness = {
  score: 87,
  status: 'Mission capable',
  delta: '+6 from yesterday',
  hrv: '68 ms',
  sleep: '7h 42m',
  strain: '13.8',
};

export const dailyMission = {
  title: 'Ruck Intervals / Zone 3 Sustainment',
  location: 'Ridgeline Loop',
  window: '18:30-19:45',
  brief: '45 lb load, 6 x 4 min uphill efforts. Keep descent controlled and stop at CP-03 for hydration.',
};

export const recentActivity = [
  { type: 'Strength', title: 'Lower chassis power', result: '5x5 trap bar / 91% compliance', time: 'Yesterday' },
  { type: 'Route', title: 'Canal tempo run', result: '6.4 km / 4:48 pace', time: 'Mon' },
  { type: 'Mobility', title: 'Hip and ankle reset', result: '18 min / soreness down', time: 'Sun' },
];

export const trainingBlocks = [
  { name: 'Start workout', detail: 'Strength, run, ruck, mobility', action: 'Begin' },
  { name: 'AI plan', detail: '4-week load progression', action: 'Review' },
  { name: 'Log strength', detail: 'Squat, hinge, push, carry', action: 'Log' },
  { name: 'Record run', detail: 'GPS, pace, HR zones', action: 'Record' },
];

export const trendMetrics: Metric[] = [
  { label: 'Weekly load', value: '384', detail: 'AU, balanced', tone: 'good' },
  { label: 'Run pace', value: '4:52', detail: '/km, -11 sec', tone: 'good' },
  { label: 'Ruck load', value: '45 lb', detail: 'next mission' },
  { label: 'Power index', value: '92', detail: '+4 this block' },
];

export const route = {
  title: 'Checkpoint route',
  distance: '8.2 km',
  pace: '5:38 /km',
  elevation: '+286 m',
  checkpoints: [
    { label: 'SP', status: 'Clear', eta: '00:00' },
    { label: 'CP-01', status: 'Reached', eta: '14:20' },
    { label: 'CP-02', status: 'Active', eta: '27:45' },
    { label: 'CP-03', status: 'Pending', eta: '42:10' },
  ],
};

export const recoveryMetrics: Metric[] = [
  { label: 'Sleep', value: '86%', detail: 'Deep sleep above baseline', tone: 'good' },
  { label: 'HRV', value: '68 ms', detail: '+9 vs 7-day avg', tone: 'good' },
  { label: 'Fatigue', value: 'Low', detail: 'CNS load controlled' },
  { label: 'Soreness', value: '3/10', detail: 'Calves and hip flexors', tone: 'warn' },
];

export const recoveryActions = [
  '20 min nasal-zone walk',
  'Ankles, calves, adductors mobility',
  'Protein target: 178 g',
  'Lights out by 22:20',
];

export const squad = [
  { name: 'Ares Squad', score: 91, trend: '+8', mission: 'Ruck standard' },
  { name: 'Valkyrie Cell', score: 87, trend: '+3', mission: 'Zone 2 base' },
  { name: 'Forge Reserve', score: 79, trend: '-2', mission: 'Recovery week' },
];

export const challenges = [
  { title: '14-day operational streak', progress: 78 },
  { title: 'Sub-50 10K patrol standard', progress: 62 },
  { title: 'Load carriage badge', progress: 91 },
];

export const profile = {
  name: 'Operator Riley Stone',
  rank: 'Sustainment III',
  streak: '23 days',
  missions: 148,
  nextRank: 74,
  badges: ['Mountain Load', 'Cold Weather', 'Night Nav', 'Recovery Lead'],
  records: [
    { label: '5K', value: '21:18' },
    { label: 'Ruck 12 mi', value: '2:41' },
    { label: 'Deadlift', value: '205 kg' },
  ],
};
