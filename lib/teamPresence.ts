import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type Teammate = {
  callsign: string;
  lat: number;
  lon: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  updatedAt: number;
  color: string;
};

type PresenceState = {
  callsign: string;
  lat: number;
  lon: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  updatedAt: number;
};

const TEAM_CHANNEL = 'forge:ruck-presence-v1';

const TEAMMATE_COLORS = [
  '#f59e0b', '#f97316', '#a78bfa', '#34d399', '#fb7185', '#60a5fa',
];

function colorForCallsign(cs: string): string {
  let hash = 0;
  for (let i = 0; i < cs.length; i++) hash = cs.charCodeAt(i) + ((hash << 5) - hash);
  return TEAMMATE_COLORS[Math.abs(hash) % TEAMMATE_COLORS.length];
}

export function useTeamPresence(callsign: string, enabled: boolean) {
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !supabase) {
      setTeammates([]);
      setConnected(false);
      return;
    }

    const ch = supabase.channel(TEAM_CHANNEL, {
      config: { presence: { key: callsign } },
    });

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<PresenceState>();
      const members: Teammate[] = [];
      for (const [key, presences] of Object.entries(state)) {
        if (key === callsign) continue;
        const sorted = [...(presences as PresenceState[])].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        );
        const latest = sorted[0];
        if (latest && typeof latest.lat === 'number' && typeof latest.lon === 'number') {
          members.push({
            callsign: latest.callsign ?? key,
            lat: latest.lat,
            lon: latest.lon,
            heading: latest.heading,
            speed: latest.speed,
            accuracy: latest.accuracy,
            updatedAt: latest.updatedAt,
            color: colorForCallsign(latest.callsign ?? key),
          });
        }
      }
      setTeammates(members);
    });

    ch.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED');
    });

    channelRef.current = ch;

    return () => {
      ch.unsubscribe();
      channelRef.current = null;
      setConnected(false);
      setTeammates([]);
    };
  }, [enabled, callsign]);

  const broadcast = useCallback(
    (payload: Omit<PresenceState, 'callsign' | 'updatedAt'>) => {
      const ch = channelRef.current;
      if (!ch || !enabled) return;
      ch.track({ callsign, ...payload, updatedAt: Date.now() }).catch(() => {});
    },
    [enabled, callsign],
  );

  return { teammates, broadcast, connected };
}
