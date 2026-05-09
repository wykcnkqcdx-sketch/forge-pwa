import { z } from 'zod';
import type { AssignedExerciseBlock, SquadMember } from '../data/mockData';
import type { WorkoutCompletion } from '../data/domain';
import { supabase } from './supabase';

export const RemoteSquadSchema = z.object({
  id: z.string(),
  owner_user_id: z.string(),
  name: z.string(),
  focus: z.string().nullable(),
  target_readiness: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const RemoteSquadMembershipSchema = z.object({
  id: z.string(),
  squad_id: z.string(),
  user_id: z.string().nullable(),
  display_name: z.string(),
  gym_name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.enum(['owner', 'coach', 'member']),
  status: z.enum(['invited', 'active', 'removed']),
  joined_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const RemoteMemberInviteSchema = z.object({
  id: z.string(),
  squad_id: z.string(),
  created_by: z.string(),
  token_hash: z.string(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  gym_name: z.string().nullable(),
  role: z.enum(['coach', 'member']),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  expires_at: z.string(),
  accepted_by: z.string().nullable(),
  accepted_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const RemoteAssignmentSchema = z.object({
  id: z.string(),
  squad_id: z.string(),
  assigned_by: z.string(),
  assignee_membership_id: z.string().nullable(),
  group_id: z.string().nullable(),
  title: z.string(),
  session_kind: z.enum(['Ruck', 'Strength', 'Resistance', 'Cardio', 'Workout', 'Run', 'Mobility']),
  coach_note: z.string().nullable(),
  status: z.enum(['draft', 'assigned', 'completed', 'archived']),
  due_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const RemoteAssignmentExerciseSchema = z.object({
  id: z.string(),
  assignment_id: z.string(),
  exercise_id: z.string().nullable(),
  name: z.string(),
  dose: z.string(),
  coach_pinned: z.boolean(),
  prescribed: z.object({
    sets: z.number().optional(),
    reps: z.number().optional(),
    load: z.number().optional(),
    loadUnit: z.enum(['kg', 'lbs']).optional(),
    durationMinutes: z.number().optional(),
    restSeconds: z.number().optional(),
  }).nullable(),
  order_index: z.number(),
  created_at: z.string(),
});

export const RemoteTeamActivitySchema = z.object({
  id: z.string(),
  squad_id: z.string(),
  actor_membership_id: z.string().nullable(),
  activity_type: z.enum(['assignment_created', 'workout_completed', 'readiness_logged', 'note_added', 'privacy_changed']),
  title: z.string(),
  body: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
});

export const RemoteMemberPrivacySettingsSchema = z.object({
  membership_id: z.string(),
  ghost_mode: z.boolean(),
  show_readiness_to_team: z.boolean(),
  show_activity_to_team: z.boolean(),
  share_location_during_ruck: z.boolean(),
  updated_at: z.string(),
});

export type RemoteSquadRow = z.infer<typeof RemoteSquadSchema>;
export type RemoteSquadMembershipRow = z.infer<typeof RemoteSquadMembershipSchema>;
export type RemoteMemberInviteRow = z.infer<typeof RemoteMemberInviteSchema>;
export type RemoteAssignmentRow = z.infer<typeof RemoteAssignmentSchema>;
export type RemoteAssignmentExerciseRow = z.infer<typeof RemoteAssignmentExerciseSchema>;
export type RemoteTeamActivityRow = z.infer<typeof RemoteTeamActivitySchema>;
export type RemoteMemberPrivacySettingsRow = z.infer<typeof RemoteMemberPrivacySettingsSchema>;

export type CloudTeamPulse = {
  source: 'cloud';
  weeklyVolume: number;
  weeklyGoal: number;
  goalPercent: number;
  completionsThisWeek: number;
  assignedCompletionsThisWeek: number;
  assignedThisWeek: number;
  completionRate: number;
  updatedAt: string;
};

export type SquadCloudSnapshot = {
  squads: RemoteSquadRow[];
  memberships: RemoteSquadMembershipRow[];
  invites: RemoteMemberInviteRow[];
  assignments: RemoteAssignmentRow[];
  assignmentExercises: RemoteAssignmentExerciseRow[];
  teamActivity: RemoteTeamActivityRow[];
  privacySettings: RemoteMemberPrivacySettingsRow[];
};

export function toRemoteSquad(input: {
  id: string;
  ownerUserId: string;
  name: string;
  focus?: string;
  targetReadiness?: number;
}): Omit<RemoteSquadRow, 'created_at' | 'updated_at'> {
  return {
    id: input.id,
    owner_user_id: input.ownerUserId,
    name: input.name,
    focus: input.focus ?? null,
    target_readiness: input.targetReadiness ?? 75,
  };
}

export function toRemoteMembership(squadId: string, member: SquadMember): Omit<RemoteSquadMembershipRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    squad_id: squadId,
    user_id: null,
    display_name: member.name,
    gym_name: member.gymName ?? null,
    email: member.email ?? null,
    role: 'member',
    status: member.inviteStatus === 'Invited' ? 'invited' : 'active',
    joined_at: member.inviteStatus === 'Joined' ? new Date().toISOString() : null,
  };
}

export function toRemoteAssignment(
  squadId: string,
  assignedBy: string,
  assignment: NonNullable<SquadMember['assignmentSession']>,
  assigneeMembershipId?: string | null,
): Omit<RemoteAssignmentRow, 'created_at' | 'updated_at'> {
  return {
    id: assignment.id,
    squad_id: squadId,
    assigned_by: assignedBy,
    assignee_membership_id: assigneeMembershipId ?? null,
    group_id: null,
    title: assignment.title,
    session_kind: assignment.type,
    coach_note: assignment.coachNote ?? null,
    status: assignment.status === 'completed' ? 'completed' : 'assigned',
    due_at: null,
  };
}

export function toRemoteAssignmentExercise(
  assignmentId: string,
  exercise: AssignedExerciseBlock,
  index: number,
): Omit<RemoteAssignmentExerciseRow, 'id' | 'created_at'> {
  return {
    assignment_id: assignmentId,
    exercise_id: exercise.exerciseId,
    name: exercise.name,
    dose: exercise.dose,
    coach_pinned: exercise.coachPinned ?? false,
    prescribed: exercise.prescribed ?? null,
    order_index: index,
  };
}

export function toRemoteTeamActivity(
  squadId: string,
  completion: WorkoutCompletion,
  actorMembershipId?: string | null,
): Omit<RemoteTeamActivityRow, 'id' | 'created_at'> {
  return {
    squad_id: squadId,
    actor_membership_id: actorMembershipId ?? null,
    activity_type: 'workout_completed',
    title: `${completion.memberName} completed ${completion.assignment}`,
    body: completion.note ?? null,
    metadata: {
      completionId: completion.id,
      effort: completion.effort,
      durationMinutes: completion.durationMinutes,
      volume: completion.volume,
    },
  };
}

export function buildInviteUrl(appBaseUrl: string, rawToken: string) {
  const url = new URL(appBaseUrl);
  url.searchParams.set('invite', rawToken);
  return url.toString();
}

export function isInviteClaimable(invite: Pick<RemoteMemberInviteRow, 'status' | 'expires_at'>, now = new Date()) {
  return invite.status === 'pending' && new Date(invite.expires_at).getTime() > now.getTime();
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ensureSupabase() {
  if (!supabase) throw new Error('Supabase client is not configured.');
  return supabase;
}

export async function ensureDefaultCloudSquad(userId: string, email?: string | null) {
  const client = ensureSupabase();

  const owned = await client
    .from('squads')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (owned.error) throw owned.error;
  const existing = z.array(RemoteSquadSchema).parse(owned.data)[0];
  if (existing) return existing;

  const created = await client
    .from('squads')
    .insert({
      owner_user_id: userId,
      name: 'FORGE Squad',
      focus: 'Ruck readiness',
      target_readiness: 75,
    })
    .select('*')
    .single();

  if (created.error) throw created.error;
  const squad = RemoteSquadSchema.parse(created.data);

  const membership = await client
    .from('squad_memberships')
    .insert({
      squad_id: squad.id,
      user_id: userId,
      display_name: 'Coach',
      gym_name: 'Coach',
      email: email ?? null,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    });

  if (membership.error) throw membership.error;
  return squad;
}

export async function syncSquadAssignment(squadId: string, assignedBy: string, member: SquadMember) {
  if (!member.assignmentSession || !uuidPattern.test(member.assignmentSession.id)) return;
  const client = ensureSupabase();
  const assignment = toRemoteAssignment(squadId, assignedBy, member.assignmentSession);

  const upserted = await client
    .from('assignments')
    .upsert(assignment, { onConflict: 'id' });
  if (upserted.error) throw upserted.error;

  const removedExercises = await client
    .from('assignment_exercises')
    .delete()
    .eq('assignment_id', assignment.id);
  if (removedExercises.error) throw removedExercises.error;

  const exercises = member.assignmentSession.exercises.map((exercise, index) => toRemoteAssignmentExercise(assignment.id, exercise, index));
  if (exercises.length > 0) {
    const insertedExercises = await client
      .from('assignment_exercises')
      .insert(exercises);
    if (insertedExercises.error) throw insertedExercises.error;
  }
}

export async function syncSquadWorkoutCompletion(squadId: string, userId: string, completion: WorkoutCompletion) {
  const client = ensureSupabase();
  const assignmentId = completion.assignmentId && uuidPattern.test(completion.assignmentId)
    ? completion.assignmentId
    : null;

  const upserted = await client
    .from('workout_completions')
    .upsert({
      user_id: userId,
      id: completion.id,
      member_id: completion.memberId,
      member_name: completion.memberName,
      group_id: completion.groupId,
      squad_id: squadId,
      assignment_id: assignmentId,
      membership_id: null,
      completion_type: completion.completionType,
      session_kind: completion.sessionKind,
      assignment: completion.assignment,
      effort: completion.effort,
      duration_minutes: completion.durationMinutes,
      note: completion.note ?? null,
      volume: completion.volume,
      exercises: completion.exercises ?? null,
      completed_at: completion.completedAt,
      updated_at: completion.updatedAt ?? completion.completedAt,
    }, { onConflict: 'user_id,id' });
  if (upserted.error) throw upserted.error;

  const activity = await client
    .from('team_activity')
    .insert(toRemoteTeamActivity(squadId, completion));
  if (activity.error) throw activity.error;
}

export async function fetchCloudTeamPulse(squadId: string, memberCount = 0): Promise<CloudTeamPulse> {
  const client = ensureSupabase();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [completionResponse, assignmentResponse, membershipResponse] = await Promise.all([
    client
      .from('workout_completions')
      .select('id, completion_type, volume, completed_at')
      .eq('squad_id', squadId)
      .gte('completed_at', weekAgo),
    client
      .from('assignments')
      .select('id, status, created_at')
      .eq('squad_id', squadId)
      .gte('created_at', weekAgo),
    client
      .from('squad_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('squad_id', squadId)
      .eq('status', 'active'),
  ]);

  if (completionResponse.error) throw completionResponse.error;
  if (assignmentResponse.error) throw assignmentResponse.error;
  if (membershipResponse.error) throw membershipResponse.error;

  const completions = z.array(z.object({
    id: z.string(),
    completion_type: z.enum(['assigned', 'quick_log', 'ad_hoc']),
    volume: z.number().nullable(),
    completed_at: z.string(),
  })).parse(completionResponse.data);
  const assignments = z.array(z.object({
    id: z.string(),
    status: z.enum(['draft', 'assigned', 'completed', 'archived']),
    created_at: z.string(),
  })).parse(assignmentResponse.data);

  const activeMembers = membershipResponse.count ?? memberCount;
  const assignedThisWeek = assignments.filter((assignment) => assignment.status !== 'draft' && assignment.status !== 'archived').length;
  const assignedCompletionsThisWeek = completions.filter((completion) => completion.completion_type === 'assigned').length;
  const completionsThisWeek = completions.length;
  const weeklyVolume = completions.reduce((sum, completion) => sum + (completion.volume ?? 0), 0);
  const weeklyGoal = Math.max(1000, activeMembers * 500);
  const completionRate = assignedThisWeek > 0
    ? Math.min(100, Math.round((assignedCompletionsThisWeek / assignedThisWeek) * 100))
    : (completionsThisWeek > 0 ? 100 : 0);
  const goalPercent = Math.min(100, Math.round((weeklyVolume / weeklyGoal) * 100));

  return {
    source: 'cloud',
    weeklyVolume,
    weeklyGoal,
    goalPercent,
    completionsThisWeek,
    assignedCompletionsThisWeek,
    assignedThisWeek,
    completionRate,
    updatedAt: new Date().toISOString(),
  };
}
