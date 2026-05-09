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
  emergency?: {
    active: boolean;
    message?: string;
    since: number;
  };
  sharedObjects?: SharedFieldObject[];
  updatedAt: number;
  color: string;
};

export type SharedFieldObject = {
  id: string;
  sender: string;
  type: 'mark' | 'measurement';
  label: string;
  sentAt: number;
  geometry: {
    kind: 'point' | 'line' | 'polygon';
    points: Array<{ lat: number; lon: number }>;
  };
  meta?: {
    markType?: string;
    measurementMode?: string;
    distanceKm?: number;
    areaSquareMeters?: number;
  };
};

type PresenceState = {
  callsign: string;
  lat: number;
  lon: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  emergency?: {
    active: boolean;
    message?: string;
    since: number;
  };
  sharedObjects?: SharedFieldObject[];
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

export type TeamMessage = {
  id: string;
  from: string;
  text: string;
  sentAt: number;
};

export function useTeamPresence(callsign: string, enabled: boolean) {
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
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

    ch.on('broadcast', { event: 'team_message' }, ({ payload }) => {
      const msg = payload as { from: string; text: string; sentAt: number };
      if (!msg?.from || !msg?.text) return;
      setMessages((prev) => [
        ...prev.slice(-49),
        { id: `${msg.from}-${msg.sentAt}`, from: msg.from, text: msg.text, sentAt: msg.sentAt },
      ]);
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
            emergency: latest.emergency,
            sharedObjects: latest.sharedObjects,
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

  const sendMessage = useCallback(
    (text: string) => {
      const ch = channelRef.current;
      if (!ch || !enabled || !text.trim()) return;
      const sentAt = Date.now();
      const trimmed = text.trim();
      ch.send({ type: 'broadcast', event: 'team_message', payload: { from: callsign, text: trimmed, sentAt } }).catch(() => {});
      setMessages((prev) => [
        ...prev.slice(-49),
        { id: `${callsign}-${sentAt}`, from: callsign, text: trimmed, sentAt },
      ]);
    },
    [enabled, callsign],
  );

  return { teammates, broadcast, connected, messages, sendMessage };
}
