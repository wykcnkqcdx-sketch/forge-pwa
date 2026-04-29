import { SquadMember, TrainingSession } from '../data/mockData';
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
  email: string | null;
  group_id: string;
  readiness: number;
  compliance: number;
  risk: SquadMember['risk'];
  load: number;
  invite_status: SquadMember['inviteStatus'] | null;
  assignment: string | null;
};

type CloudSnapshot = {
  sessions: TrainingSession[];
  members: SquadMember[];
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
    email: member.email ?? null,
    group_id: member.groupId,
    readiness: member.readiness,
    compliance: member.compliance,
    risk: member.risk,
    load: member.load,
    invite_status: member.inviteStatus ?? null,
    assignment: member.assignment ?? null,
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
    email: row.email ?? undefined,
    groupId: row.group_id,
    readiness: row.readiness,
    compliance: row.compliance,
    risk: row.risk,
    load: row.load,
    inviteStatus: row.invite_status ?? undefined,
    assignment: row.assignment ?? undefined,
  };
}

export async function fetchCloudSnapshot(userId: string): Promise<CloudSnapshot> {
  const client = ensureSupabase();
  const [sessionResponse, memberResponse] = await Promise.all([
    client.from('training_sessions').select('*').eq('user_id', userId).order('completed_at', { ascending: false, nullsFirst: false }),
    client.from('squad_members').select('*').eq('user_id', userId).order('name', { ascending: true }),
  ]);

  if (sessionResponse.error) throw sessionResponse.error;
  if (memberResponse.error) throw memberResponse.error;

  return {
    sessions: (sessionResponse.data as RemoteTrainingSessionRow[]).map(fromRemoteSession),
    members: (memberResponse.data as RemoteSquadMemberRow[]).map(fromRemoteMember),
  };
}

export async function pushCloudSnapshot(userId: string, sessions: TrainingSession[], members: SquadMember[]) {
  const client = ensureSupabase();
  const remoteSessions = sessions.map((session) => toRemoteSession(userId, session));
  const remoteMembers = members.map((member) => toRemoteMember(userId, member));

  if (remoteSessions.length > 0) {
    const { error } = await client.from('training_sessions').upsert(remoteSessions, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  if (remoteMembers.length > 0) {
    const { error } = await client.from('squad_members').upsert(remoteMembers, { onConflict: 'user_id,id' });
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
}
