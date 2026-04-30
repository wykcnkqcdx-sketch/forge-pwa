import { SquadMember, TrainingSession } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';
import { supabase } from './supabase';

type RemoteTrainingSessionRow = {
  id: string;
  user_id: string;
  type: TrainingSession['type'];
  title: string;
  score: number;
  duration_minutes: number;
  rpe: number;
  load_kg: number | null;
  route_points: TrainingSession['routePoints'] | null;
  completed_at: string | null;
};

type RemoteSquadMemberRow = {
  id: string;
  user_id: string;
  name: string;
  gym_name: string | null;
  email: string | null;
  group_id: string;
  readiness: number;
  compliance: number;
  risk: SquadMember['risk'];
  load: number;
  invite_status: SquadMember['inviteStatus'] | null;
  assignment: string | null;
  pinned_exercise_ids: string[] | null;
  ghost_mode: boolean | null;
  streak_days: number | null;
  weekly_volume: number | null;
  last_workout_title: string | null;
  last_workout_at: string | null;
  last_workout_note: string | null;
  hype_count: number | null;
};

type RemoteWorkoutCompletionRow = {
  id: string;
  user_id: string;
  member_id: string;
  member_name: string;
  group_id: string;
  completion_type: WorkoutCompletion['completionType'];
  session_kind: WorkoutCompletion['sessionKind'];
  assignment: string;
  effort: WorkoutCompletion['effort'];
  duration_minutes: number;
  note: string | null;
  volume: number;
  exercises: WorkoutCompletion['exercises'] | null;
  completed_at: string;
};

type RemoteReadinessLogRow = {
  id: string;
  user_id: string;
  member_id: string | null;
  member_name: string | null;
  group_id: string | null;
  logged_at: string;
  sleep_hours: number | null;
  sleep_quality: number;
  soreness: number;
  stress: number | null;
  pain: number | null;
  hydration: ReadinessLog['hydration'];
  mood: number | null;
  illness: number | null;
  pain_area: ReadinessLog['painArea'] | null;
  limits_training: boolean | null;
  resting_hr: number | null;
  hrv: number | null;
};

type CloudSnapshot = {
  sessions: TrainingSession[];
  members: SquadMember[];
  workoutCompletions: WorkoutCompletion[];
  readinessLogs: ReadinessLog[];
};

function ensureSupabase() {
  if (!supabase) throw new Error('Supabase client is not configured.');
  return supabase;
}

function toInFilter(ids: string[]) {
  return `(${ids.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',')})`;
}

function toRemoteSession(userId: string, session: TrainingSession): RemoteTrainingSessionRow {
  return {
    id: session.id,
    user_id: userId,
    type: session.type,
    title: session.title,
    score: session.score,
    duration_minutes: session.durationMinutes,
    rpe: session.rpe,
    load_kg: session.loadKg ?? null,
    route_points: session.routePoints ?? null,
    completed_at: session.completedAt ?? null,
  };
}

function toRemoteMember(userId: string, member: SquadMember): RemoteSquadMemberRow {
  return {
    id: member.id,
    user_id: userId,
    name: member.name,
    gym_name: member.gymName ?? null,
    email: member.email ?? null,
    group_id: member.groupId,
    readiness: member.readiness,
    compliance: member.compliance,
    risk: member.risk,
    load: member.load,
    invite_status: member.inviteStatus ?? null,
    assignment: member.assignment ?? null,
    pinned_exercise_ids: member.pinnedExerciseIds ?? null,
    ghost_mode: member.ghostMode ?? false,
    streak_days: member.streakDays ?? 0,
    weekly_volume: member.weeklyVolume ?? 0,
    last_workout_title: member.lastWorkoutTitle ?? null,
    last_workout_at: member.lastWorkoutAt ?? null,
    last_workout_note: member.lastWorkoutNote ?? null,
    hype_count: member.hypeCount ?? 0,
  };
}

function toRemoteCompletion(userId: string, completion: WorkoutCompletion): RemoteWorkoutCompletionRow {
  return {
    id: completion.id,
    user_id: userId,
    member_id: completion.memberId,
    member_name: completion.memberName,
    group_id: completion.groupId,
    completion_type: completion.completionType,
    session_kind: completion.sessionKind,
    assignment: completion.assignment,
    effort: completion.effort,
    duration_minutes: completion.durationMinutes,
    note: completion.note ?? null,
    volume: completion.volume,
    exercises: completion.exercises ?? null,
    completed_at: completion.completedAt,
  };
}

function toRemoteReadiness(userId: string, log: ReadinessLog): RemoteReadinessLogRow {
  return {
    id: log.id,
    user_id: userId,
    member_id: log.memberId ?? null,
    member_name: log.memberName ?? null,
    group_id: log.groupId ?? null,
    logged_at: log.date,
    sleep_hours: log.sleepHours ?? null,
    sleep_quality: log.sleepQuality,
    soreness: log.soreness,
    stress: log.stress ?? null,
    pain: log.pain ?? null,
    hydration: log.hydration,
    mood: log.mood ?? null,
    illness: log.illness ?? null,
    pain_area: log.painArea ?? null,
    limits_training: log.limitsTraining ?? null,
    resting_hr: log.restingHR ?? null,
    hrv: log.hrv ?? null,
  };
}

function fromRemoteSession(row: RemoteTrainingSessionRow): TrainingSession {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    score: row.score,
    durationMinutes: row.duration_minutes,
    rpe: row.rpe,
    loadKg: row.load_kg ?? undefined,
    routePoints: row.route_points ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

function fromRemoteMember(row: RemoteSquadMemberRow): SquadMember {
  return {
    id: row.id,
    name: row.name,
    gymName: row.gym_name ?? undefined,
    email: row.email ?? undefined,
    groupId: row.group_id,
    readiness: row.readiness,
    compliance: row.compliance,
    risk: row.risk,
    load: row.load,
    inviteStatus: row.invite_status ?? undefined,
    assignment: row.assignment ?? undefined,
    pinnedExerciseIds: row.pinned_exercise_ids ?? undefined,
    ghostMode: row.ghost_mode ?? undefined,
    streakDays: row.streak_days ?? undefined,
    weeklyVolume: row.weekly_volume ?? undefined,
    lastWorkoutTitle: row.last_workout_title ?? undefined,
    lastWorkoutAt: row.last_workout_at ?? undefined,
    lastWorkoutNote: row.last_workout_note ?? undefined,
    hypeCount: row.hype_count ?? undefined,
  };
}

function fromRemoteCompletion(row: RemoteWorkoutCompletionRow): WorkoutCompletion {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name,
    groupId: row.group_id,
    completionType: row.completion_type,
    sessionKind: row.session_kind,
    assignment: row.assignment,
    effort: row.effort,
    durationMinutes: row.duration_minutes,
    note: row.note ?? undefined,
    volume: row.volume,
    exercises: row.exercises ?? undefined,
    completedAt: row.completed_at,
  };
}

function fromRemoteReadiness(row: RemoteReadinessLogRow): ReadinessLog {
  return {
    id: row.id,
    date: row.logged_at,
    memberId: row.member_id ?? undefined,
    memberName: row.member_name ?? undefined,
    groupId: row.group_id ?? undefined,
    sleepHours: row.sleep_hours ?? undefined,
    sleepQuality: row.sleep_quality as ReadinessLog['sleepQuality'],
    soreness: row.soreness as ReadinessLog['soreness'],
    stress: row.stress as ReadinessLog['stress'],
    pain: row.pain as ReadinessLog['pain'],
    hydration: row.hydration,
    mood: row.mood as ReadinessLog['mood'],
    illness: row.illness as ReadinessLog['illness'],
    painArea: row.pain_area ?? undefined,
    limitsTraining: row.limits_training ?? undefined,
    restingHR: row.resting_hr ?? undefined,
    hrv: row.hrv ?? undefined,
  };
}

export async function fetchCloudSnapshot(userId: string): Promise<CloudSnapshot> {
  const client = ensureSupabase();
  const [sessionResponse, memberResponse, completionResponse, readinessResponse] = await Promise.all([
    client.from('training_sessions').select('*').eq('user_id', userId).order('completed_at', { ascending: false, nullsFirst: false }),
    client.from('squad_members').select('*').eq('user_id', userId).order('name', { ascending: true }),
    client.from('workout_completions').select('*').eq('user_id', userId).order('completed_at', { ascending: false }),
    client.from('readiness_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
  ]);

  if (sessionResponse.error) throw sessionResponse.error;
  if (memberResponse.error) throw memberResponse.error;
  if (completionResponse.error) throw completionResponse.error;
  if (readinessResponse.error) throw readinessResponse.error;

  return {
    sessions: (sessionResponse.data as RemoteTrainingSessionRow[]).map(fromRemoteSession),
    members: (memberResponse.data as RemoteSquadMemberRow[]).map(fromRemoteMember),
    workoutCompletions: (completionResponse.data as RemoteWorkoutCompletionRow[]).map(fromRemoteCompletion),
    readinessLogs: (readinessResponse.data as RemoteReadinessLogRow[]).map(fromRemoteReadiness),
  };
}

export async function pushCloudSnapshot(
  userId: string,
  sessions: TrainingSession[],
  members: SquadMember[],
  workoutCompletions: WorkoutCompletion[] = [],
  readinessLogs: ReadinessLog[] = []
) {
  const client = ensureSupabase();
  const remoteSessions = sessions.map((session) => toRemoteSession(userId, session));
  const remoteMembers = members.map((member) => toRemoteMember(userId, member));
  const remoteCompletions = workoutCompletions.map((completion) => toRemoteCompletion(userId, completion));
  const remoteReadinessLogs = readinessLogs.map((log) => toRemoteReadiness(userId, log));

  if (remoteSessions.length > 0) {
    const { error } = await client.from('training_sessions').upsert(remoteSessions, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  if (remoteMembers.length > 0) {
    const { error } = await client.from('squad_members').upsert(remoteMembers, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  if (remoteCompletions.length > 0) {
    const { error } = await client.from('workout_completions').upsert(remoteCompletions, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  if (remoteReadinessLogs.length > 0) {
    const { error } = await client.from('readiness_logs').upsert(remoteReadinessLogs, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  let sessionDelete = client.from('training_sessions').delete().eq('user_id', userId);
  if (sessions.length > 0) sessionDelete = sessionDelete.not('id', 'in', toInFilter(sessions.map((session) => session.id)));
  const { error: sessionDeleteError } = await sessionDelete;
  if (sessionDeleteError) throw sessionDeleteError;

  let memberDelete = client.from('squad_members').delete().eq('user_id', userId);
  if (members.length > 0) memberDelete = memberDelete.not('id', 'in', toInFilter(members.map((member) => member.id)));
  const { error: memberDeleteError } = await memberDelete;
  if (memberDeleteError) throw memberDeleteError;

  let completionDelete = client.from('workout_completions').delete().eq('user_id', userId);
  if (workoutCompletions.length > 0) completionDelete = completionDelete.not('id', 'in', toInFilter(workoutCompletions.map((completion) => completion.id)));
  const { error: completionDeleteError } = await completionDelete;
  if (completionDeleteError) throw completionDeleteError;

  let readinessDelete = client.from('readiness_logs').delete().eq('user_id', userId);
  if (readinessLogs.length > 0) readinessDelete = readinessDelete.not('id', 'in', toInFilter(readinessLogs.map((log) => log.id)));
  const { error: readinessDeleteError } = await readinessDelete;
  if (readinessDeleteError) throw readinessDeleteError;
}
