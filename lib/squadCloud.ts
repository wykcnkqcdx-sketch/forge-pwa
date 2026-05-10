import { z } from 'zod';
import type { AssignedExerciseBlock, MemberAssignment, SquadMember } from '../data/mockData';
import type { AssignmentDeployment, WorkoutCompletion } from '../data/domain';
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

export type CloudTeamActivity = {
  id: string;
  squadId: string;
  actorMembershipId: string | null;
  type: RemoteTeamActivityRow['activity_type'];
  title: string;
  body?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CloudInvite = {
  id: string;
  squadId: string;
  email?: string;
  displayName?: string;
  gymName?: string;
  role: RemoteMemberInviteRow['role'];
  status: RemoteMemberInviteRow['status'];
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  createdAt: string;
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
  options: { ghostMode?: boolean } = {},
): Omit<RemoteTeamActivityRow, 'id' | 'created_at'> {
  const actorName = options.ghostMode ? 'A teammate' : completion.memberName;
  return {
    squad_id: squadId,
    actor_membership_id: actorMembershipId ?? null,
    activity_type: 'workout_completed',
    title: `${actorName} completed ${completion.assignment}`,
    body: options.ghostMode ? null : completion.note ?? null,
    metadata: {
      completionId: completion.id,
      effort: completion.effort,
      durationMinutes: completion.durationMinutes,
      volume: completion.volume,
      ghostMode: options.ghostMode ?? false,
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

export function fromRemoteTeamActivity(row: RemoteTeamActivityRow): CloudTeamActivity {
  return {
    id: row.id,
    squadId: row.squad_id,
    actorMembershipId: row.actor_membership_id,
    type: row.activity_type,
    title: row.title,
    body: row.body ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export function fromRemoteMemberInvite(row: RemoteMemberInviteRow): CloudInvite {
  return {
    id: row.id,
    squadId: row.squad_id,
    email: row.email ?? undefined,
    displayName: row.display_name ?? undefined,
    gymName: row.gym_name ?? undefined,
    role: row.role,
    status: row.status,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    createdAt: row.created_at,
  };
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
  const membershipQuery = client
    .from('squad_memberships')
    .select('*')
    .eq('squad_id', squadId)
    .eq('status', 'active');
  const memberships = await membershipQuery;
  if (memberships.error) throw memberships.error;
  const parsedMemberships = z.array(RemoteSquadMembershipSchema).parse(memberships.data);
  const assignee = parsedMemberships.find((item) => item.id === member.cloudMembershipId)
    ?? parsedMemberships.find((item) => (
      (member.email && item.email?.toLowerCase() === member.email.toLowerCase())
    || item.id === member.id
    || item.display_name.toLowerCase() === member.name.toLowerCase()
    || item.gym_name?.toLowerCase() === member.gymName?.toLowerCase()
    ));
  const assignment = {
    ...toRemoteAssignment(squadId, assignedBy, member.assignmentSession, assignee?.id ?? null),
    group_id: member.groupId,
  };

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

export async function syncSquadWorkoutCompletion(
  squadId: string,
  userId: string,
  completion: WorkoutCompletion,
  options: { ghostMode?: boolean } = {},
) {
  const client = ensureSupabase();
  const assignmentId = completion.assignmentId && uuidPattern.test(completion.assignmentId)
    ? completion.assignmentId
    : null;
  const membershipId = completion.membershipId && uuidPattern.test(completion.membershipId)
    ? completion.membershipId
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
      membership_id: membershipId,
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
    .insert(toRemoteTeamActivity(squadId, completion, membershipId, options));
  if (activity.error) throw activity.error;
}

export async function syncAssignmentDeploymentActivity(squadId: string, deployment: AssignmentDeployment) {
  const client = ensureSupabase();
  const response = await client
    .from('team_activity')
    .insert({
      squad_id: squadId,
      actor_membership_id: null,
      activity_type: 'assignment_created',
      title: `${deployment.title} deployed`,
      body: `${deployment.targetMemberIds.length} target${deployment.targetMemberIds.length === 1 ? '' : 's'}, ${deployment.cloudReadyMemberIds.length} cloud-ready.`,
      metadata: {
        deploymentId: deployment.id,
        scope: deployment.scope,
        groupId: deployment.groupId ?? null,
        groupName: deployment.groupName ?? null,
        targetMemberIds: deployment.targetMemberIds,
        targetNames: deployment.targetNames,
        cloudReadyMemberIds: deployment.cloudReadyMemberIds,
        exerciseCount: deployment.exerciseCount,
        assignedAt: deployment.assignedAt,
        coachNote: deployment.coachNote ?? null,
      },
      created_at: deployment.assignedAt,
    });

  if (response.error) throw response.error;
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

export async function fetchCloudTeamActivity(squadId: string, limit = 30): Promise<CloudTeamActivity[]> {
  const client = ensureSupabase();
  const response = await client
    .from('team_activity')
    .select('*')
    .eq('squad_id', squadId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (response.error) throw response.error;
  return z.array(RemoteTeamActivitySchema).parse(response.data).map(fromRemoteTeamActivity);
}

export async function fetchCloudInvites(squadId: string, limit = 50): Promise<CloudInvite[]> {
  const client = ensureSupabase();
  const response = await client
    .from('member_invites')
    .select('*')
    .eq('squad_id', squadId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (response.error) throw response.error;
  return z.array(RemoteMemberInviteSchema).parse(response.data).map(fromRemoteMemberInvite);
}

export async function revokeCloudInvite(inviteId: string): Promise<CloudInvite> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc('revoke_member_invite', { p_invite_id: inviteId });
  if (error) throw error;
  return fromRemoteMemberInvite(RemoteMemberInviteSchema.parse(data));
}

function fromRemoteMemberAssignment(assignment: RemoteAssignmentRow, exercises: RemoteAssignmentExerciseRow[]): MemberAssignment {
  return {
    id: assignment.id,
    title: assignment.title,
    type: assignment.session_kind,
    status: assignment.status === 'completed' ? 'completed' : 'assigned',
    assignedAt: assignment.created_at,
    coachNote: assignment.coach_note ?? undefined,
    exercises: exercises
      .sort((a, b) => a.order_index - b.order_index)
      .map((exercise) => ({
        exerciseId: exercise.exercise_id ?? exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: exercise.name,
        dose: exercise.dose,
        coachPinned: exercise.coach_pinned,
        prescribed: exercise.prescribed ?? undefined,
        status: 'assigned',
      })),
  };
}

export async function fetchCloudMemberAssignments(userId: string): Promise<SquadMember[]> {
  const client = ensureSupabase();
  const membershipResponse = await client
    .from('squad_memberships')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (membershipResponse.error) throw membershipResponse.error;
  const memberships = z.array(RemoteSquadMembershipSchema).parse(membershipResponse.data)
    .filter((membership) => membership.role === 'member');
  if (memberships.length === 0) return [];

  const membershipIds = memberships.map((membership) => membership.id);
  const assignmentResponse = await client
    .from('assignments')
    .select('*')
    .in('assignee_membership_id', membershipIds)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  if (assignmentResponse.error) throw assignmentResponse.error;
  const assignments = z.array(RemoteAssignmentSchema).parse(assignmentResponse.data);
  const assignmentIds = assignments.map((assignment) => assignment.id);

  let exercises: RemoteAssignmentExerciseRow[] = [];
  if (assignmentIds.length > 0) {
    const exerciseResponse = await client
      .from('assignment_exercises')
      .select('*')
      .in('assignment_id', assignmentIds)
      .order('order_index', { ascending: true });
    if (exerciseResponse.error) throw exerciseResponse.error;
    exercises = z.array(RemoteAssignmentExerciseSchema).parse(exerciseResponse.data);
  }

  return memberships.map((membership) => {
    const assignment = assignments.find((item) => item.assignee_membership_id === membership.id);
    const assignmentExercises = assignment ? exercises.filter((exercise) => exercise.assignment_id === assignment.id) : [];
    const assignmentSession = assignment ? fromRemoteMemberAssignment(assignment, assignmentExercises) : undefined;

    return {
      id: membership.id,
      cloudMembershipId: membership.id,
      groupId: assignment?.group_id ?? membership.squad_id,
      name: membership.display_name,
      gymName: membership.gym_name ?? membership.display_name,
      email: membership.email ?? undefined,
      readiness: 72,
      compliance: assignment ? 80 : 0,
      risk: 'Low',
      load: 65,
      inviteStatus: 'Joined',
      assignment: assignment?.title,
      pinnedExerciseIds: assignmentExercises.filter((exercise) => exercise.coach_pinned).map((exercise) => exercise.exercise_id ?? exercise.name),
      ghostMode: false,
      streakDays: 0,
      weeklyVolume: 0,
      hypeCount: 0,
      assignmentSession,
      updatedAt: assignment?.updated_at ?? membership.updated_at,
    };
  });
}

export async function fetchCloudSquadMembershipTargets(squadId: string): Promise<RemoteSquadMembershipRow[]> {
  const client = ensureSupabase();
  const response = await client
    .from('squad_memberships')
    .select('*')
    .eq('squad_id', squadId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (response.error) throw response.error;
  return z.array(RemoteSquadMembershipSchema).parse(response.data);
}

const AssignmentDeploymentMetadataSchema = z.object({
  deploymentId: z.string().optional(),
  scope: z.enum(['member', 'group', 'squad']).optional(),
  groupId: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  targetMemberIds: z.array(z.string()).optional(),
  targetNames: z.array(z.string()).optional(),
  cloudReadyMemberIds: z.array(z.string()).optional(),
  exerciseCount: z.number().optional(),
  assignedAt: z.string().optional(),
  coachNote: z.string().nullable().optional(),
});

const CloudDeploymentCompletionSchema = z.object({
  id: z.string(),
  member_id: z.string(),
  member_name: z.string(),
  assignment: z.string(),
  effort: z.enum(['Too Easy', 'About Right', 'Too Hard']),
  note: z.string().nullable(),
  completed_at: z.string(),
});

export async function fetchCloudAssignmentDeployments(squadId: string): Promise<AssignmentDeployment[]> {
  const client = ensureSupabase();
  const response = await client
    .from('team_activity')
    .select('*')
    .eq('squad_id', squadId)
    .eq('activity_type', 'assignment_created')
    .order('created_at', { ascending: false })
    .limit(50);

  if (response.error) throw response.error;

  const activities = z.array(RemoteTeamActivitySchema).parse(response.data);
  if (!activities.length) return [];
  const oldestActivityAt = activities.reduce((oldest, activity) => (
    new Date(activity.created_at).getTime() < new Date(oldest).getTime() ? activity.created_at : oldest
  ), activities[0].created_at);
  const completionResponse = await client
    .from('workout_completions')
    .select('id, member_id, member_name, assignment, effort, note, completed_at')
    .eq('squad_id', squadId)
    .gte('completed_at', oldestActivityAt);

  if (completionResponse.error) throw completionResponse.error;
  const completions = z.array(CloudDeploymentCompletionSchema).parse(completionResponse.data);

  return activities.map((activity) => {
    const metadata = AssignmentDeploymentMetadataSchema.safeParse(activity.metadata ?? {}).data;
    const title = activity.title.replace(/\s+deployed$/, '');
    const assignedAt = metadata?.assignedAt ?? activity.created_at;
    const targetMemberIds = metadata?.targetMemberIds ?? [];
    const matchingCompletions = completions
      .filter((completion) => (
        targetMemberIds.includes(completion.member_id)
        && completion.assignment === title
        && new Date(completion.completed_at).getTime() >= new Date(assignedAt).getTime()
      ))
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
    const completedMemberIds = [...new Set(matchingCompletions.map((completion) => completion.member_id))];
    const latest = matchingCompletions.find((completion) => completion.note?.trim()) ?? matchingCompletions[0];

    return {
      id: metadata?.deploymentId ?? activity.id,
      title,
      scope: metadata?.scope ?? 'member',
      groupId: metadata?.groupId ?? undefined,
      groupName: metadata?.groupName ?? undefined,
      targetMemberIds,
      targetNames: metadata?.targetNames ?? [],
      cloudReadyMemberIds: metadata?.cloudReadyMemberIds ?? [],
      exerciseCount: metadata?.exerciseCount ?? 0,
      assignedAt,
      coachNote: metadata?.coachNote ?? undefined,
      completedMemberIds,
      effortCounts: {
        tooEasy: matchingCompletions.filter((completion) => completion.effort === 'Too Easy').length,
        aboutRight: matchingCompletions.filter((completion) => completion.effort === 'About Right').length,
        tooHard: matchingCompletions.filter((completion) => completion.effort === 'Too Hard').length,
      },
      latestFeedback: latest
        ? {
          memberName: latest.member_name,
          effort: latest.effort,
          note: latest.note ?? undefined,
          completedAt: latest.completed_at,
        }
        : undefined,
    };
  });
}
