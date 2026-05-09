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
