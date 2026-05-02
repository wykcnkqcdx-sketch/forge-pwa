import { z } from 'zod';
import { SquadMember, TrainingSession } from '../data/mockData';
import type { ReadinessLog, TrackPoint, WorkoutCompletion } from '../data/domain';
import { supabase } from './supabase';

const MAX_SYNCED_ROUTE_POINTS = 180;
const MAX_SYNCED_ROUTE_ACCURACY_METERS = 35;
const MIN_SYNCED_ROUTE_DISTANCE_METERS = 8;
const MIN_SYNCED_ROUTE_INTERVAL_MS = 5000;
const ROUTE_SIMPLIFICATION_TOLERANCE_METERS = 10;

// ── Zod schemas — single source of truth for Supabase row shapes ──────────────
// Catches schema drift (renamed columns, type changes) at the API boundary
// before it can silently corrupt local state.

const TrackPointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().nullable(),
  accuracy: z.number().nullable(),
  timestamp: z.number(),
});

const RemoteSessionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  type: z.enum(['Ruck', 'Strength', 'Resistance', 'Cardio', 'Workout', 'Run', 'Mobility']),
  title: z.string(),
  score: z.number(),
  duration_minutes: z.number(),
  rpe: z.number(),
  load_kg: z.number().nullable(),
  route_points: z.array(TrackPointSchema).nullable(),
  completed_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});
type RemoteTrainingSessionRow = z.infer<typeof RemoteSessionSchema>;

const RemoteMemberSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  gym_name: z.string().nullable(),
  email: z.string().nullable(),
  group_id: z.string(),
  readiness: z.number(),
  compliance: z.number(),
  risk: z.enum(['Low', 'Medium', 'High']),
  load: z.number(),
  invite_status: z.enum(['Manual', 'Invited', 'Joined']).nullable(),
  assignment: z.string().nullable(),
  pinned_exercise_ids: z.array(z.string()).nullable(),
  ghost_mode: z.boolean().nullable(),
  streak_days: z.number().nullable(),
  weekly_volume: z.number().nullable(),
  last_workout_title: z.string().nullable(),
  last_workout_at: z.string().nullable(),
  last_workout_note: z.string().nullable(),
  hype_count: z.number().nullable(),
  device_sync_provider: z.enum(['Apple Health']).nullable(),
  device_sync_status: z.enum(['Disconnected', 'Ready', 'Connected', 'Unsupported']).nullable(),
  device_connected_at: z.string().nullable(),
  device_last_sync_at: z.string().nullable(),
  imported_sleep_hours: z.number().nullable(),
  imported_resting_hr: z.number().nullable(),
  imported_hrv: z.number().nullable(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assignment_session: z.any(),
  updated_at: z.string().nullable(),
});
type RemoteSquadMemberRow = z.infer<typeof RemoteMemberSchema>;

const RemoteCompletionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  member_id: z.string(),
  member_name: z.string(),
  group_id: z.string(),
  completion_type: z.enum(['assigned', 'quick_log', 'ad_hoc']),
  session_kind: z.enum(['Ruck', 'Strength', 'Resistance', 'Cardio', 'Workout', 'Run', 'Mobility']),
  assignment: z.string(),
  effort: z.enum(['Too Easy', 'About Right', 'Too Hard']),
  duration_minutes: z.number(),
  note: z.string().nullable(),
  volume: z.number(),
  exercises: z.array(z.object({
    name: z.string(),
    sets: z.number().optional(),
    reps: z.number().optional(),
    loadKg: z.number().optional(),
  })).nullable(),
  completed_at: z.string(),
  updated_at: z.string().nullable(),
});
type RemoteWorkoutCompletionRow = z.infer<typeof RemoteCompletionSchema>;

const RemoteReadinessSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  member_id: z.string().nullable(),
  member_name: z.string().nullable(),
  group_id: z.string().nullable(),
  logged_at: z.string(),
  sleep_hours: z.number().nullable(),
  sleep_quality: z.number(),
  soreness: z.number(),
  stress: z.number().nullable(),
  pain: z.number().nullable(),
  hydration: z.enum(['Poor', 'Adequate', 'Optimal']),
  mood: z.number().nullable(),
  illness: z.number().nullable(),
  pain_area: z.enum(['Knee', 'Back', 'Shoulder', 'Hip', 'Ankle', 'Other']).nullable(),
  limits_training: z.boolean().nullable(),
  resting_hr: z.number().nullable(),
  hrv: z.number().nullable(),
  updated_at: z.string().nullable(),
});
type RemoteReadinessLogRow = z.infer<typeof RemoteReadinessSchema>;

type CloudSnapshot = {
  sessions: TrainingSession[];
  members: SquadMember[];
  workoutCompletions: WorkoutCompletion[];
  readinessLogs: ReadinessLog[];
};

export type CloudMutation =
  | { type: 'upsert_session'; payload: TrainingSession }
  | { type: 'update_session'; payload: { id: string; updates: Partial<TrainingSession> } }
  | { type: 'delete_session'; payload: { id: string } }
  | { type: 'upsert_member'; payload: SquadMember }
  | { type: 'update_member'; payload: { id: string; updates: Partial<SquadMember> } }
  | { type: 'delete_member'; payload: { id: string } }
  | { type: 'upsert_readiness_log'; payload: ReadinessLog }
  | { type: 'upsert_workout_completion'; payload: WorkoutCompletion };

function ensureSupabase() {
  if (!supabase) throw new Error('Supabase client is not configured.');
  return supabase;
}

function toInFilter(ids: string[]) {
  return `(${ids.join(',')})`;
}

function resolveUpdatedAt(value: string | undefined, fallback?: string) {
  return value ?? fallback ?? new Date().toISOString();
}

function isRemoteNewer(remoteUpdatedAt: string | null | undefined, localUpdatedAt: string) {
  return Boolean(remoteUpdatedAt && new Date(remoteUpdatedAt).getTime() > new Date(localUpdatedAt).getTime());
}

function distanceMeters(a: Pick<TrackPoint, 'latitude' | 'longitude'>, b: Pick<TrackPoint, 'latitude' | 'longitude'>) {
  const p = Math.PI / 180;
  const lat1 = a.latitude * p;
  const lat2 = b.latitude * p;
  const deltaLat = (b.latitude - a.latitude) * p;
  const deltaLon = (b.longitude - a.longitude) * p;
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function projectPoint(point: Pick<TrackPoint, 'latitude' | 'longitude'>, origin: Pick<TrackPoint, 'latitude' | 'longitude'>) {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = metersPerDegreeLat * Math.cos(origin.latitude * (Math.PI / 180));

  return {
    x: (point.longitude - origin.longitude) * metersPerDegreeLon,
    y: (point.latitude - origin.latitude) * metersPerDegreeLat,
  };
}

function perpendicularDistanceMeters(point: TrackPoint, start: TrackPoint, end: TrackPoint) {
  const projectedPoint = projectPoint(point, start);
  const projectedEnd = projectPoint(end, start);
  const segmentLengthSquared = projectedEnd.x ** 2 + projectedEnd.y ** 2;

  if (segmentLengthSquared === 0) return distanceMeters(point, start);

  const t = Math.max(
    0,
    Math.min(1, (projectedPoint.x * projectedEnd.x + projectedPoint.y * projectedEnd.y) / segmentLengthSquared)
  );
  const closest = {
    x: t * projectedEnd.x,
    y: t * projectedEnd.y,
  };

  return Math.hypot(projectedPoint.x - closest.x, projectedPoint.y - closest.y);
}

function simplifyRoute(points: TrackPoint[], toleranceMeters: number): TrackPoint[] {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let splitIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistanceMeters(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = i;
    }
  }

  if (maxDistance <= toleranceMeters) return [start, end];

  const beforeSplit = simplifyRoute(points.slice(0, splitIndex + 1), toleranceMeters);
  const afterSplit = simplifyRoute(points.slice(splitIndex), toleranceMeters);
  return [...beforeSplit.slice(0, -1), ...afterSplit];
}

function limitRoutePoints(points: TrackPoint[], maxPoints: number) {
  if (points.length <= maxPoints) return points;

  const stride = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * stride)]);
}

function roundSyncedRoutePoint(point: TrackPoint): TrackPoint {
  return {
    latitude: Number(point.latitude.toFixed(5)),
    longitude: Number(point.longitude.toFixed(5)),
    altitude: point.altitude == null ? null : Math.round(point.altitude),
    accuracy: point.accuracy == null ? null : Math.round(point.accuracy),
    timestamp: point.timestamp,
  };
}

function compressRoutePointsForSync(points: TrackPoint[] | undefined): TrackPoint[] | null {
  if (!points || points.length === 0) return null;
  if (points.length <= 2) return points.map(roundSyncedRoutePoint);

  const filtered = points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return true;
    if (point.accuracy != null && point.accuracy > MAX_SYNCED_ROUTE_ACCURACY_METERS) return false;

    const previous = points[index - 1];
    const movedFarEnough = distanceMeters(previous, point) >= MIN_SYNCED_ROUTE_DISTANCE_METERS;
    const waitedLongEnough = point.timestamp - previous.timestamp >= MIN_SYNCED_ROUTE_INTERVAL_MS;

    return movedFarEnough || waitedLongEnough;
  });

  const simplified = simplifyRoute(filtered, ROUTE_SIMPLIFICATION_TOLERANCE_METERS);
  return limitRoutePoints(simplified, MAX_SYNCED_ROUTE_POINTS).map(roundSyncedRoutePoint);
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
    route_points: compressRoutePointsForSync(session.routePoints),
    completed_at: session.completedAt ?? null,
    updated_at: resolveUpdatedAt(session.updatedAt, session.completedAt),
  };
}

function toRemoteSessionUpdates(updates: Partial<TrainingSession>) {
  const row: Partial<RemoteTrainingSessionRow> = {};
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.score !== undefined) row.score = updates.score;
  if (updates.durationMinutes !== undefined) row.duration_minutes = updates.durationMinutes;
  if (updates.rpe !== undefined) row.rpe = updates.rpe;
  if (updates.loadKg !== undefined) row.load_kg = updates.loadKg ?? null;
  if (updates.routePoints !== undefined) row.route_points = compressRoutePointsForSync(updates.routePoints);
  if (updates.completedAt !== undefined) row.completed_at = updates.completedAt ?? null;
  if (updates.updatedAt !== undefined) row.updated_at = updates.updatedAt ?? null;
  return row;
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
    device_sync_provider: member.deviceSyncProvider ?? null,
    device_sync_status: member.deviceSyncStatus ?? null,
    device_connected_at: member.deviceConnectedAt ?? null,
    device_last_sync_at: member.deviceLastSyncAt ?? null,
    imported_sleep_hours: member.importedSleepHours ?? null,
    imported_resting_hr: member.importedRestingHR ?? null,
    imported_hrv: member.importedHrv ?? null,
    assignment_session: member.assignmentSession ?? null,
    updated_at: resolveUpdatedAt(member.updatedAt),
  };
}

function toRemoteMemberUpdates(updates: Partial<SquadMember>) {
  const row: Partial<RemoteSquadMemberRow> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.gymName !== undefined) row.gym_name = updates.gymName ?? null;
  if (updates.email !== undefined) row.email = updates.email ?? null;
  if (updates.groupId !== undefined) row.group_id = updates.groupId;
  if (updates.readiness !== undefined) row.readiness = updates.readiness;
  if (updates.compliance !== undefined) row.compliance = updates.compliance;
  if (updates.risk !== undefined) row.risk = updates.risk;
  if (updates.load !== undefined) row.load = updates.load;
  if (updates.inviteStatus !== undefined) row.invite_status = updates.inviteStatus ?? null;
  if (updates.assignment !== undefined) row.assignment = updates.assignment ?? null;
  if (updates.pinnedExerciseIds !== undefined) row.pinned_exercise_ids = updates.pinnedExerciseIds ?? null;
  if (updates.ghostMode !== undefined) row.ghost_mode = updates.ghostMode ?? false;
  if (updates.streakDays !== undefined) row.streak_days = updates.streakDays ?? 0;
  if (updates.weeklyVolume !== undefined) row.weekly_volume = updates.weeklyVolume ?? 0;
  if (updates.lastWorkoutTitle !== undefined) row.last_workout_title = updates.lastWorkoutTitle ?? null;
  if (updates.lastWorkoutAt !== undefined) row.last_workout_at = updates.lastWorkoutAt ?? null;
  if (updates.lastWorkoutNote !== undefined) row.last_workout_note = updates.lastWorkoutNote ?? null;
  if (updates.hypeCount !== undefined) row.hype_count = updates.hypeCount ?? 0;
  if (updates.deviceSyncProvider !== undefined) row.device_sync_provider = updates.deviceSyncProvider ?? null;
  if (updates.deviceSyncStatus !== undefined) row.device_sync_status = updates.deviceSyncStatus ?? null;
  if (updates.deviceConnectedAt !== undefined) row.device_connected_at = updates.deviceConnectedAt ?? null;
  if (updates.deviceLastSyncAt !== undefined) row.device_last_sync_at = updates.deviceLastSyncAt ?? null;
  if (updates.importedSleepHours !== undefined) row.imported_sleep_hours = updates.importedSleepHours ?? null;
  if (updates.importedRestingHR !== undefined) row.imported_resting_hr = updates.importedRestingHR ?? null;
  if (updates.importedHrv !== undefined) row.imported_hrv = updates.importedHrv ?? null;
  if (updates.assignmentSession !== undefined) row.assignment_session = updates.assignmentSession ?? null;
  if (updates.updatedAt !== undefined) row.updated_at = updates.updatedAt ?? null;
  return row;
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
    updated_at: resolveUpdatedAt(completion.updatedAt, completion.completedAt),
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
    updated_at: resolveUpdatedAt(log.updatedAt, log.date),
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
    updatedAt: row.updated_at ?? undefined,
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
    deviceSyncProvider: row.device_sync_provider ?? undefined,
    deviceSyncStatus: row.device_sync_status ?? undefined,
    deviceConnectedAt: row.device_connected_at ?? undefined,
    deviceLastSyncAt: row.device_last_sync_at ?? undefined,
    importedSleepHours: row.imported_sleep_hours ?? undefined,
    importedRestingHR: row.imported_resting_hr ?? undefined,
    importedHrv: row.imported_hrv ?? undefined,
    assignmentSession: row.assignment_session ?? undefined,
    updatedAt: row.updated_at ?? undefined,
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
    updatedAt: row.updated_at ?? undefined,
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
    updatedAt: row.updated_at ?? undefined,
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
    sessions: z.array(RemoteSessionSchema).parse(sessionResponse.data).map(fromRemoteSession),
    members: z.array(RemoteMemberSchema).parse(memberResponse.data).map(fromRemoteMember),
    workoutCompletions: z.array(RemoteCompletionSchema).parse(completionResponse.data).map(fromRemoteCompletion),
    readinessLogs: z.array(RemoteReadinessSchema).parse(readinessResponse.data).map(fromRemoteReadiness),
  };
}

async function getRemoteUpdatedAt(
  client: ReturnType<typeof ensureSupabase>,
  table: 'training_sessions' | 'squad_members' | 'workout_completions' | 'readiness_logs',
  userId: string,
  id: string
) {
  const { data, error } = await client
    .from(table)
    .select('updated_at')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as { updated_at?: string | null } | null)?.updated_at ?? null;
}

export async function pushCloudMutation(userId: string, mutation: CloudMutation, mutationCreatedAt = new Date().toISOString()) {
  const client = ensureSupabase();

  switch (mutation.type) {
    case 'upsert_session': {
      const updatedAt = resolveUpdatedAt(mutation.payload.updatedAt, mutationCreatedAt);
      const remoteUpdatedAt = await getRemoteUpdatedAt(client, 'training_sessions', userId, mutation.payload.id);
      if (isRemoteNewer(remoteUpdatedAt, updatedAt)) return;

      const { error } = await client
        .from('training_sessions')
        .upsert(toRemoteSession(userId, { ...mutation.payload, updatedAt }), { onConflict: 'user_id,id' });
      if (error) throw error;
      return;
    }

    case 'update_session': {
      const updatedAt = resolveUpdatedAt(mutation.payload.updates.updatedAt, mutationCreatedAt);
      const remoteUpdatedAt = await getRemoteUpdatedAt(client, 'training_sessions', userId, mutation.payload.id);
      if (isRemoteNewer(remoteUpdatedAt, updatedAt)) return;

      const { error } = await client
        .from('training_sessions')
        .update(toRemoteSessionUpdates({ ...mutation.payload.updates, updatedAt }))
        .eq('user_id', userId)
        .eq('id', mutation.payload.id);
      if (error) throw error;
      return;
    }

    case 'delete_session': {
      const remoteUpdatedAt = await getRemoteUpdatedAt(client, 'training_sessions', userId, mutation.payload.id);
      if (isRemoteNewer(remoteUpdatedAt, mutationCreatedAt)) return;

      const { error } = await client.from('training_sessions').delete().eq('user_id', userId).eq('id', mutation.payload.id);
      if (error) throw error;
      return;
    }

    case 'upsert_member': {
      const updatedAt = resolveUpdatedAt(mutation.payload.updatedAt, mutationCreatedAt);
      const remoteUpdatedAt = await getRemoteUpdatedAt(client, 'squad_members', userId, mutation.payload.id);
      if (isRemoteNewer(remoteUpdatedAt, updatedAt)) return;

      const { error } = await client
        .from('squad_members')
        .upsert(toRemoteMember(userId, { ...mutation.payload, updatedAt }), { onConflict: 'user_id,id' });
      if (error) throw error;
      return;
    }

    case 'update_member': {
      const updatedAt = resolveUpdatedAt(mutation.payload.updates.updatedAt, mutationCreatedAt);
      const remoteUpdatedAt = await getRemoteUpdatedAt(client, 'squad_members', userId, mutation.payload.id);
      if (isRemoteNewer(remoteUpdatedAt, updatedAt)) return;

      const { error } = await client
        .from('squad_members')
        .update(toRemoteMemberUpdates({ ...mutation.payload.updates, updatedAt }))
        .eq('user_id', userId)
        .eq('id', mutation.payload.id);
      if (error) throw error;
      return;
    }

    case 'delete_member': {
      const remoteUpdatedAt = await getRemoteUpdatedAt(client, 'squad_members', userId, mutation.payload.id);
      if (isRemoteNewer(remoteUpdatedAt, mutationCreatedAt)) return;

      const { error } = await client.from('squad_members').delete().eq('user_id', userId).eq('id', mutation.payload.id);
      if (error) throw error;
      return;
    }

    case 'upsert_readiness_log': {
      const updatedAt = resolveUpdatedAt(mutation.payload.updatedAt, mutationCreatedAt);
      const remoteUpdatedAt = await getRemoteUpdatedAt(client, 'readiness_logs', userId, mutation.payload.id);
      if (isRemoteNewer(remoteUpdatedAt, updatedAt)) return;

      const { error } = await client
        .from('readiness_logs')
        .upsert(toRemoteReadiness(userId, { ...mutation.payload, updatedAt }), { onConflict: 'user_id,id' });
      if (error) throw error;
      return;
    }

    case 'upsert_workout_completion': {
      const updatedAt = resolveUpdatedAt(mutation.payload.updatedAt, mutationCreatedAt);
      const remoteUpdatedAt = await getRemoteUpdatedAt(client, 'workout_completions', userId, mutation.payload.id);
      if (isRemoteNewer(remoteUpdatedAt, updatedAt)) return;

      const { error } = await client
        .from('workout_completions')
        .upsert(toRemoteCompletion(userId, { ...mutation.payload, updatedAt }), { onConflict: 'user_id,id' });
      if (error) throw error;
      return;
    }
  }
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
