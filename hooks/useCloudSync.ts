import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { SquadMember, TrainingSession } from '../data/mockData';
import type { AssignmentDeployment, ReadinessLog, WorkoutCompletion } from '../data/domain';
import { fetchCloudSnapshot, pushCloudMutation, pushCloudSnapshot } from '../lib/cloud';
import { buildGoogleSheetsPayload, exportToGoogleSheets } from '../lib/googleSheets';
import { clearOfflineQueue, enqueueOfflineMutation, getPendingOfflineMutationCount, replayOfflineQueue } from '../lib/offlineQueue';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { ensureDefaultCloudSquad, fetchCloudAssignmentDeployments, fetchCloudMemberAssignments, fetchCloudSquadMembershipTargets, fetchCloudTeamActivity, fetchCloudTeamPulse, type CloudTeamActivity, type CloudTeamPulse } from '../lib/squadCloud';
import type { RemoteSquadMembershipRow } from '../lib/squadCloud';

type CloudMutation = Parameters<typeof enqueueOfflineMutation>[0];

type Snapshot = {
  sessions: TrainingSession[];
  members: SquadMember[];
  workoutCompletions: WorkoutCompletion[];
  readinessLogs: ReadinessLog[];
};

type Props = {
  sessions: TrainingSession[];
  members: SquadMember[];
  workoutCompletions: WorkoutCompletion[];
  assignmentDeployments: AssignmentDeployment[];
  readinessLogs: ReadinessLog[];
  setSessions: (v: TrainingSession[] | ((prev: TrainingSession[]) => TrainingSession[])) => void;
  setMembers: (v: SquadMember[] | ((prev: SquadMember[]) => SquadMember[])) => void;
  setWorkoutCompletions: (v: WorkoutCompletion[] | ((prev: WorkoutCompletion[]) => WorkoutCompletion[])) => void;
  setAssignmentDeployments: (v: AssignmentDeployment[] | ((prev: AssignmentDeployment[]) => AssignmentDeployment[])) => void;
  setReadinessLogs: (v: ReadinessLog[] | ((prev: ReadinessLog[]) => ReadinessLog[])) => void;
  setPendingSyncCount: (n: number) => void;
  showToast: (message: string) => void;
  isReady: boolean;
  googleSheetsEndpoint: string;
};

function normalizeRosterKey(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function membershipMatchesMember(member: SquadMember, target: RemoteSquadMembershipRow) {
  const memberEmail = normalizeRosterKey(member.email);
  const targetEmail = normalizeRosterKey(target.email);
  if (memberEmail && targetEmail) return memberEmail === targetEmail;

  if (target.id === member.id) return true;

  const memberGymName = normalizeRosterKey(member.gymName);
  const targetGymName = normalizeRosterKey(target.gym_name);
  if (memberGymName && targetGymName && memberGymName === targetGymName) return true;

  return normalizeRosterKey(member.name) === normalizeRosterKey(target.display_name);
}

export function reconcileCloudMembershipTargets(
  current: SquadMember[],
  targets: RemoteSquadMembershipRow[],
  now = new Date().toISOString(),
) {
  const memberTargets = targets.filter((target) => target.role === 'member' && target.status === 'active');

  return current.map((member) => {
    if (member.cloudMembershipId) return member;
    const target = memberTargets.find((item) => membershipMatchesMember(member, item));
    if (!target) return member;

    return {
      ...member,
      cloudMembershipId: target.id,
      inviteStatus: 'Joined' as const,
      groupId: member.groupId || target.squad_id,
      updatedAt: now,
    };
  });
}

export function useCloudSync({
  sessions, members, workoutCompletions, assignmentDeployments, readinessLogs,
  setSessions, setMembers, setWorkoutCompletions, setAssignmentDeployments, setReadinessLogs,
  setPendingSyncCount, showToast, isReady, googleSheetsEndpoint,
}: Props) {
  const [cloudSession, setCloudSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [cloudStatus, setCloudStatus] = useState<'local' | 'auth' | 'syncing' | 'synced' | 'error'>(
    isSupabaseConfigured ? 'auth' : 'local'
  );
  const [cloudSquadId, setCloudSquadId] = useState<string | null>(null);
  const [cloudTeamPulse, setCloudTeamPulse] = useState<CloudTeamPulse | null>(null);
  const [cloudTeamActivity, setCloudTeamActivity] = useState<CloudTeamActivity[]>([]);
  const [googleSheetsExporting, setGoogleSheetsExporting] = useState(false);
  const [googleSheetsMessage, setGoogleSheetsMessage] = useState('');

  const cloudHydrated = useRef(false);
  const skipNextRemotePush = useRef(false);
  const offlineSyncPending = useRef(false);
  const coachLandingPrimed = useRef(false);

  const isBrowserOffline = useCallback(() => (
    typeof navigator !== 'undefined' && navigator.onLine === false
  ), []);

  const refreshPendingSyncCount = useCallback(async () => {
    try {
      setPendingSyncCount(await getPendingOfflineMutationCount());
    } catch (error) {
      console.error('Failed to read pending offline queue count', error);
    }
  }, [setPendingSyncCount]);

  const applyCloudSnapshot = useCallback((snapshot: Snapshot) => {
    skipNextRemotePush.current = true;
    setSessions(snapshot.sessions);
    setMembers(snapshot.members);
    setWorkoutCompletions(snapshot.workoutCompletions);
    setReadinessLogs(snapshot.readinessLogs);
  }, [setSessions, setMembers, setWorkoutCompletions, setReadinessLogs]);

  const refreshCloudSnapshot = useCallback(async (userId: string) => {
    const snapshot = await fetchCloudSnapshot(userId);
    applyCloudSnapshot(snapshot);
    setCloudStatus('synced');
  }, [applyCloudSnapshot]);

  const refreshCloudTeamPulse = useCallback(async (squadId?: string | null) => {
    if (!squadId) return;
    const pulse = await fetchCloudTeamPulse(squadId, members.length);
    setCloudTeamPulse(pulse);
  }, [members.length]);

  const refreshCloudTeamActivity = useCallback(async (squadId?: string | null) => {
    if (!squadId) return;
    const activity = await fetchCloudTeamActivity(squadId);
    setCloudTeamActivity(activity);
  }, []);

  const refreshCloudMemberAssignments = useCallback(async (userId: string) => {
    const assignedMembers = await fetchCloudMemberAssignments(userId);
    if (assignedMembers.length === 0) return;
    setMembers((current) => {
      const next = [...current];
      assignedMembers.forEach((assignedMember) => {
        const index = next.findIndex((member) => member.id === assignedMember.id || (assignedMember.email && member.email === assignedMember.email));
        if (index >= 0) {
          next[index] = { ...next[index], ...assignedMember };
        } else {
          next.unshift(assignedMember);
        }
      });
      return next;
    });
  }, [setMembers]);

  const refreshCloudAssignmentDeployments = useCallback(async (squadId?: string | null) => {
    if (!squadId) return;
    const cloudDeployments = await fetchCloudAssignmentDeployments(squadId);
    if (cloudDeployments.length === 0) return;
    setAssignmentDeployments((current) => {
      const byId = new Map<string, AssignmentDeployment>();
      [...cloudDeployments, ...current].forEach((deployment) => byId.set(deployment.id, deployment));
      return Array.from(byId.values())
        .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime())
        .slice(0, 50);
    });
  }, [setAssignmentDeployments]);

  const refreshCloudMembershipTargets = useCallback(async (squadId?: string | null) => {
    if (!squadId) return;
    const targets = await fetchCloudSquadMembershipTargets(squadId);
    if (targets.length === 0) return;
    setMembers((current) => reconcileCloudMembershipTargets(current, targets));
  }, [setMembers]);

  const flushOfflineMutations = useCallback(async (userId: string) => {
    const replayed = await replayOfflineQueue((mutation, createdAt) => pushCloudMutation(userId, mutation, createdAt));
    await refreshPendingSyncCount();
    if (replayed > 0 && offlineSyncPending.current) {
      offlineSyncPending.current = false;
      showToast('Offline records have synced');
    }
    return replayed;
  }, [refreshPendingSyncCount, showToast]);

  const enqueueCloudMutation = useCallback(async (mutation: CloudMutation) => {
    if (!isSupabaseConfigured || !cloudSession?.user) return;
    try {
      await enqueueOfflineMutation(mutation);
      await refreshPendingSyncCount();
      if (isBrowserOffline()) offlineSyncPending.current = true;
    } catch (error) {
      console.error('Failed to enqueue offline mutation', error);
      showToast('Save failed — change may not sync');
    }
  }, [cloudSession?.user, isBrowserOffline, refreshPendingSyncCount, showToast]);

  // Auth session restoration
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.error('Failed to restore auth session', error);
        setAuthError(error.message);
      }
      setCloudSession(data.session ?? null);
      setAuthReady(true);
    }).catch((err) => {
      if (!mounted) return;
      console.error('getSession threw unexpectedly', err);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudSession(session ?? null);
      if (!session) {
        setCloudSquadId(null);
        setCloudTeamPulse(null);
        setCloudTeamActivity([]);
      }
      setAuthReady(true);
      setAuthError('');
      setCloudStatus(session ? 'syncing' : 'auth');
      cloudHydrated.current = false;
      if (!session) coachLandingPrimed.current = false;
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Initial cloud hydration
  useEffect(() => {
    if (!isSupabaseConfigured || !cloudSession?.user || !isReady) return;

    let cancelled = false;
    const userId = cloudSession.user.id;
    const userEmail = cloudSession.user.email;

    async function hydrateCloud() {
      try {
        setCloudStatus('syncing');
        const snapshot = await fetchCloudSnapshot(userId);
        if (cancelled) return;

        if (snapshot.sessions.length > 0 || snapshot.members.length > 0 || snapshot.workoutCompletions.length > 0) {
          applyCloudSnapshot({
            sessions: snapshot.sessions.length > 0 ? snapshot.sessions : sessions,
            members: snapshot.members.length > 0 ? snapshot.members : members,
            workoutCompletions: snapshot.workoutCompletions.length > 0 ? snapshot.workoutCompletions : workoutCompletions,
            readinessLogs: snapshot.readinessLogs.length > 0 ? snapshot.readinessLogs : readinessLogs,
          });
        } else {
          await flushOfflineMutations(userId);
          await pushCloudSnapshot(userId, sessions, members, workoutCompletions, readinessLogs);
        }

        if (!cancelled) {
          const squad = await ensureDefaultCloudSquad(userId, userEmail);
          if (!cancelled) {
            setCloudSquadId(squad.id);
            await refreshCloudTeamPulse(squad.id);
            await refreshCloudTeamActivity(squad.id);
            await refreshCloudAssignmentDeployments(squad.id);
            await refreshCloudMembershipTargets(squad.id);
            await refreshCloudMemberAssignments(userId);
          }
          cloudHydrated.current = true;
          setCloudStatus('synced');
        }
      } catch (error) {
        console.error('Failed to hydrate cloud data', error);
        if (!cancelled) {
          cloudHydrated.current = true;
          setCloudStatus('error');
          showToast('Cloud sync failed — working offline');
        }
      }
    }

    hydrateCloud();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudSession?.user?.id, isReady, flushOfflineMutations, refreshCloudAssignmentDeployments, refreshCloudMemberAssignments, refreshCloudMembershipTargets, refreshCloudTeamActivity, refreshCloudTeamPulse]);

  // Debounced push on data change
  useEffect(() => {
    if (!isSupabaseConfigured || !cloudSession?.user || !isReady || !cloudHydrated.current) return;
    const userId = cloudSession.user.id;

    if (skipNextRemotePush.current) {
      skipNextRemotePush.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCloudStatus('syncing');
        const replayed = await flushOfflineMutations(userId);
        if (replayed > 0) await refreshCloudSnapshot(userId);
        await refreshCloudTeamPulse(cloudSquadId);
        await refreshCloudTeamActivity(cloudSquadId);
        await refreshCloudAssignmentDeployments(cloudSquadId);
        await refreshCloudMembershipTargets(cloudSquadId);
        await refreshCloudMemberAssignments(userId);
        setCloudStatus('synced');
      } catch (error) {
        console.error('Failed to sync cloud data', error);
        if (isBrowserOffline()) offlineSyncPending.current = true;
        setCloudStatus('error');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [sessions, members, workoutCompletions, assignmentDeployments, readinessLogs, cloudSession?.user?.id, cloudSquadId, isReady, flushOfflineMutations, isBrowserOffline, refreshCloudAssignmentDeployments, refreshCloudMemberAssignments, refreshCloudMembershipTargets, refreshCloudSnapshot, refreshCloudTeamActivity, refreshCloudTeamPulse]);

  // Realtime subscription + online/focus handlers
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !cloudSession?.user || !isReady) return;
    const client = supabase;
    const userId = cloudSession.user.id;

    const refreshSnapshot = async () => {
      try {
        setCloudStatus('syncing');
        await refreshCloudSnapshot(userId);
        await refreshCloudTeamPulse(cloudSquadId);
        await refreshCloudTeamActivity(cloudSquadId);
        await refreshCloudAssignmentDeployments(cloudSquadId);
        await refreshCloudMembershipTargets(cloudSquadId);
        await refreshCloudMemberAssignments(userId);
      } catch (error) {
        console.error('Failed to refresh realtime snapshot', error);
        setCloudStatus('error');
      }
    };

    const channel = client
      .channel(`forge-squad-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_members', filter: `user_id=eq.${userId}` }, refreshSnapshot)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_completions', filter: `user_id=eq.${userId}` }, refreshSnapshot)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'readiness_logs', filter: `user_id=eq.${userId}` }, refreshSnapshot)
      .subscribe();

    if (typeof window === 'undefined') {
      return () => { client.removeChannel(channel); };
    }

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') refreshSnapshot();
    };
    const handleOnline = () => {
      const syncAfterReconnect = async () => {
        try {
          setCloudStatus('syncing');
          await flushOfflineMutations(userId);
          await refreshCloudSnapshot(userId);
          await refreshCloudTeamPulse(cloudSquadId);
          await refreshCloudTeamActivity(cloudSquadId);
          await refreshCloudAssignmentDeployments(cloudSquadId);
          await refreshCloudMembershipTargets(cloudSquadId);
          await refreshCloudMemberAssignments(userId);
        } catch (error) {
          console.error('Failed to sync after reconnect', error);
          setCloudStatus('error');
        }
      };
      syncAfterReconnect();
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      client.removeChannel(channel);
    };
  }, [cloudSession?.user?.id, cloudSquadId, isReady, flushOfflineMutations, refreshCloudAssignmentDeployments, refreshCloudMemberAssignments, refreshCloudMembershipTargets, refreshCloudSnapshot, refreshCloudTeamActivity, refreshCloudTeamPulse]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !cloudSquadId || !isReady) return;
    const client = supabase;

    const refreshPulse = () => {
      Promise.all([
        refreshCloudTeamPulse(cloudSquadId),
        refreshCloudTeamActivity(cloudSquadId),
        refreshCloudAssignmentDeployments(cloudSquadId),
      ]).catch((error) => {
        console.error('Failed to refresh cloud squad activity', error);
      });
    };

    refreshPulse();
    const channel = client
      .channel(`forge-team-pulse-${cloudSquadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_completions', filter: `squad_id=eq.${cloudSquadId}` }, refreshPulse)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: `squad_id=eq.${cloudSquadId}` }, refreshPulse)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_activity', filter: `squad_id=eq.${cloudSquadId}` }, refreshPulse)
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [cloudSquadId, isReady, refreshCloudAssignmentDeployments, refreshCloudTeamActivity, refreshCloudTeamPulse]);

  // Refresh pending count on ready
  useEffect(() => {
    if (isReady) refreshPendingSyncCount();
  }, [isReady, refreshPendingSyncCount]);

  async function signInWithEmail(email: string, password: string) {
    if (!supabase) return;
    if (!email || !password) { setAuthError('Email and password are required.'); return; }
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  }

  async function signUpWithEmail(email: string, password: string) {
    if (!supabase) return;
    if (!email || !password) { setAuthError('Email and password are required.'); return; }
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthError('Account created. Check your email if confirmation is enabled, then sign in.');
    }
    setAuthLoading(false);
  }

  async function signOutCloud() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setCloudSession(null);
    setCloudStatus('auth');
  }

  async function clearCloudAuthSession() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      console.error('Global Supabase sign-out failed during wipe', error);
      const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
      if (localError) console.error('Local Supabase sign-out failed during wipe', localError);
    }
  }

  async function resetCloudForWipe() {
    setCloudSession(null);
    setCloudStatus(isSupabaseConfigured ? 'auth' : 'local');
    await Promise.all([clearCloudAuthSession(), clearOfflineQueue()]).catch((error) =>
      console.error('Failed to clear cloud auth/queue during wipe', error)
    );
    setPendingSyncCount(0);
  }

  async function syncCloudNow() {
    if (!isSupabaseConfigured || !supabase) { setCloudStatus('local'); return; }
    if (!cloudSession?.user) { setCloudStatus('auth'); return; }
    try {
      setCloudStatus('syncing');
      const userId = cloudSession.user.id;
      await flushOfflineMutations(userId);
      await refreshCloudSnapshot(userId);
      await refreshCloudTeamPulse(cloudSquadId);
      await refreshCloudTeamActivity(cloudSquadId);
      await refreshCloudAssignmentDeployments(cloudSquadId);
      await refreshCloudMembershipTargets(cloudSquadId);
      await refreshCloudMemberAssignments(userId);
    } catch (error) {
      console.error('Manual cloud sync failed', error);
      if (isBrowserOffline()) offlineSyncPending.current = true;
      setCloudStatus('error');
    }
  }

  async function exportGoogleSheetsNow(members_: SquadMember[], groups_: import('../data/mockData').TrainingGroup[], programmeTemplates_: import('../data/mockData').ProgrammeTemplate[]) {
    const trimmedEndpoint = googleSheetsEndpoint.trim();
    if (!trimmedEndpoint) {
      if (typeof window !== 'undefined') window.alert('Google Sheets URL required\n\nPaste your Google Apps Script web app URL before exporting.');
      return;
    }
    try {
      setGoogleSheetsExporting(true);
      setGoogleSheetsMessage('Sending export to Google Sheets...');
      const payload = buildGoogleSheetsPayload(sessions, members_, groups_, programmeTemplates_, readinessLogs, workoutCompletions, cloudSession?.user.email ?? null);
      const result = await exportToGoogleSheets(trimmedEndpoint, payload);
      const message = result.delivery === 'json' && result.spreadsheetUrl
        ? `FORGE data was written to Google Sheets.\n\n${result.spreadsheetUrl}`
        : 'FORGE sent the export request. Refresh the Google Sheet and check the Meta tab first.';
      setGoogleSheetsMessage(message);
      if (typeof window !== 'undefined') window.alert(`Export sent\n\n${message}`);
    } catch (error) {
      console.error('Failed to export to Google Sheets', error);
      const message = error instanceof Error ? error.message : 'Could not send data to Google Sheets.';
      setGoogleSheetsMessage(`Export failed: ${message}`);
      if (typeof window !== 'undefined') window.alert(`Export failed\n\n${message}`);
    } finally {
      setGoogleSheetsExporting(false);
    }
  }

  return {
    cloudSession,
    authReady,
    authLoading,
    authError,
    cloudStatus,
    cloudSquadId,
    cloudTeamPulse,
    cloudTeamActivity,
    googleSheetsExporting,
    googleSheetsMessage,
    coachLandingPrimed,
    enqueueCloudMutation,
    signInWithEmail,
    signUpWithEmail,
    signOutCloud,
    syncCloudNow,
    exportGoogleSheetsNow,
    resetCloudForWipe,
  };
}
