import { SquadMember, TrainingSession } from '../data/mockData';
import type { WorkoutCompletion } from '../data/domain';
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
  assignment: string;
  effort: WorkoutCompletion['effort'];
  note: string | null;
  volume: number;
  completed_at: string;
};

type CloudSnapshot = {
  sessions: TrainingSession[];
  members: SquadMember[];
  workoutCompletions: WorkoutCompletion[];
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
    assignment: completion.assignment,
    effort: completion.effort,
    note: completion.note ?? null,
    volume: completion.volume,
    completed_at: completion.completedAt,
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
    assignment: row.assignment,
    effort: row.effort,
    note: row.note ?? undefined,
    volume: row.volume,
    completedAt: row.completed_at,
  };
}

export async function fetchCloudSnapshot(userId: string): Promise<CloudSnapshot> {
  const client = ensureSupabase();
  const [sessionResponse, memberResponse, completionResponse] = await Promise.all([
    client.from('training_sessions').select('*').eq('user_id', userId).order('completed_at', { ascending: false, nullsFirst: false }),
    client.from('squad_members').select('*').eq('user_id', userId).order('name', { ascending: true }),
    client.from('workout_completions').select('*').eq('user_id', userId).order('completed_at', { ascending: false }),
  ]);

  if (sessionResponse.error) throw sessionResponse.error;
  if (memberResponse.error) throw memberResponse.error;
  if (completionResponse.error) throw completionResponse.error;

  return {
    sessions: (sessionResponse.data as RemoteTrainingSessionRow[]).map(fromRemoteSession),
    members: (memberResponse.data as RemoteSquadMemberRow[]).map(fromRemoteMember),
    workoutCompletions: (completionResponse.data as RemoteWorkoutCompletionRow[]).map(fromRemoteCompletion),
  };
}

export async function pushCloudSnapshot(userId: string, sessions: TrainingSession[], members: SquadMember[], workoutCompletions: WorkoutCompletion[] = []) {
  const client = ensureSupabase();
  const remoteSessions = sessions.map((session) => toRemoteSession(userId, session));
  const remoteMembers = members.map((member) => toRemoteMember(userId, member));
  const remoteCompletions = workoutCompletions.map((completion) => toRemoteCompletion(userId, completion));

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
}
