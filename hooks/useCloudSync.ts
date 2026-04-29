import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { SquadMember, TrainingSession } from '../data/mockData';
import { fetchCloudSnapshot, pushCloudSnapshot } from '../lib/cloud';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type CloudStatus = 'local' | 'auth' | 'syncing' | 'synced' | 'error';

type Params = {
  sessions: TrainingSession[];
  members: SquadMember[];
  isReady: boolean;
  applyCloudSnapshot: (sessions: TrainingSession[], members: SquadMember[]) => void;
};

export function useCloudSync({ sessions, members, isReady, applyCloudSnapshot }: Params) {
  const [cloudSession, setCloudSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(
    isSupabaseConfigured ? 'auth' : 'local'
  );

  // Refs so async callbacks always read the latest values without being in effect deps.
  const sessionsRef = useRef(sessions);
  const membersRef = useRef(members);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { membersRef.current = members; }, [members]);

  const cloudHydrated = useRef(false);
  const skipNextRemotePush = useRef(false);

  // Restore Supabase auth session and subscribe to changes.
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
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudSession(session ?? null);
      setAuthReady(true);
      setAuthError('');
      setCloudStatus(session ? 'syncing' : 'auth');
      cloudHydrated.current = false;
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // On first sign-in (or app start with an existing session), pull the remote snapshot.
  // If the remote is empty, push local data — using refs so stale-closure is not an issue
  // even if sessions/members change during the async fetch.
  useEffect(() => {
    if (!isSupabaseConfigured || !cloudSession?.user || !isReady) return;

    let cancelled = false;
    const userId = cloudSession.user.id;

    async function hydrateCloud() {
      try {
        setCloudStatus('syncing');
        const snapshot = await fetchCloudSnapshot(userId);
        if (cancelled) return;

        if (snapshot.sessions.length > 0 || snapshot.members.length > 0) {
          skipNextRemotePush.current = true;
          applyCloudSnapshot(snapshot.sessions, snapshot.members);
        } else {
          // Use refs — sessions/members may have changed while we awaited the fetch.
          await pushCloudSnapshot(userId, sessionsRef.current, membersRef.current);
        }

        if (!cancelled) {
          cloudHydrated.current = true;
          setCloudStatus('synced');
        }
      } catch (error) {
        console.error('Failed to hydrate cloud data', error);
        if (!cancelled) {
          cloudHydrated.current = true;
          setCloudStatus('error');
        }
      }
    }

    hydrateCloud();
    return () => { cancelled = true; };
  }, [cloudSession?.user?.id, isReady, applyCloudSnapshot]);

  // Debounced push whenever local data changes (after initial hydration).
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
        await pushCloudSnapshot(userId, sessions, members);
        setCloudStatus('synced');
      } catch (error) {
        console.error('Failed to sync cloud data', error);
        setCloudStatus('error');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [sessions, members, cloudSession?.user?.id, isReady]);

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

  return {
    cloudSession,
    authReady,
    authLoading,
    authError,
    cloudStatus,
    signInWithEmail,
    signUpWithEmail,
    signOutCloud,
  };
}
