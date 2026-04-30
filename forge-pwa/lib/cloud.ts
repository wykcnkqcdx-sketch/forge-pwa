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
    client.from('training_sessions').select('*').eq('user_id', userId).order('id', { ascending: false }),
    client.from('squad_members').select('*').eq('user_id', userId).order('name', { ascending: true }),
  ]);

  if (sessionResponse.error) throw sessionResponse.error;
  if (memberResponse.error) throw memberResponse.error;

  return {
    sessions: (sessionResponse.data as RemoteTrainingSessionRow[]).map(fromRemoteSession),
    members: (memberResponse.data as RemoteSquadMemberRow[]).map(fromRemoteMember),
  };
}

export async function pushSession(userId: string, session: TrainingSession) {
  const client = ensureSupabase();
  const remoteSession = toRemoteSession(userId, session);
  
  const { error } = await client.from('training_sessions').upsert(remoteSession, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function removeSession(userId: string, sessionId: string) {
  const client = ensureSupabase();
  const { error } = await client.from('training_sessions').delete().eq('user_id', userId).eq('id', sessionId);
  if (error) throw error;
}

export async function pushMember(userId: string, member: SquadMember) {
  const client = ensureSupabase();
  const remoteMember = toRemoteMember(userId, member);

  const { error } = await client.from('squad_members').upsert(remoteMember, { onConflict: 'user_id,id' });
  if (error) throw error;
}

export async function removeMember(userId: string, memberId: string) {
  const client = ensureSupabase();
  const { error } = await client.from('squad_members').delete().eq('user_id', userId).eq('id', memberId);
  if (error) throw error;
}
