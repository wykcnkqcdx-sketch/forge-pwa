import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { SessionCard, sessionTone } from '../components/SessionCard';
import { SessionEditModal } from '../components/SessionEditModal';
import { colours, radius, touchTarget, typography } from '../theme';
import type { TrainingSession } from '../data/mockData';
import { getPRSessionIds } from '../lib/personalRecords';

type SessionType = TrainingSession['type'];
type Filter = 'ALL' | SessionType;

const FILTERS: Array<{ key: Filter; label: string; icon: string }> = [
  { key: 'ALL',        label: 'ALL',      icon: 'list-outline' },
  { key: 'Ruck',       label: 'RUCK',     icon: 'footsteps-outline' },
  { key: 'Strength',   label: 'STRENGTH', icon: 'barbell-outline' },
  { key: 'Run',        label: 'RUN',      icon: 'walk-outline' },
  { key: 'Cardio',     label: 'CARDIO',   icon: 'heart-outline' },
  { key: 'Mobility',   label: 'MOBILITY', icon: 'body-outline' },
  { key: 'Workout',    label: 'WORKOUT',  icon: 'fitness-outline' },
  { key: 'Resistance', label: 'RESIST',   icon: 'barbell-outline' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function sortedByDate(sessions: TrainingSession[]) {
  return [...sessions].sort((a, b) => {
    const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bt - at;
  });
}

function buildSummary(sessions: TrainingSession[]) {
  const totalHours = Math.round(sessions.reduce((s, x) => s + x.durationMinutes, 0) / 60 * 10) / 10;
  const ruckCount  = sessions.filter(s => s.type === 'Ruck').length;
  const avgScore   = sessions.length
    ? Math.round(sessions.reduce((s, x) => s + x.score, 0) / sessions.length)
    : 0;
  const totalLoadKgKm = sessions
    .filter(s => s.type === 'Ruck' && s.loadKg != null)
    .reduce((sum, s) => {
      const distKm = s.ruckMission?.targetDistanceKm ?? (s.durationMinutes / 12);
      return sum + (s.loadKg! * distKm);
    }, 0);
  return { totalHours, ruckCount, avgScore, totalLoadKgKm: Math.round(totalLoadKgKm) };
}

// ── Month group header ───────────────────────────────────────────

function monthKey(iso: string | undefined) {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

type GroupedItem =
  | { kind: 'header'; month: string }
  | { kind: 'session'; session: TrainingSession };

function groupByMonth(sessions: TrainingSession[]): GroupedItem[] {
  const items: GroupedItem[] = [];
  let lastMonth = '';
  for (const s of sessions) {
    const m = monthKey(s.completedAt);
    if (m !== lastMonth) {
      items.push({ kind: 'header', month: m });
      lastMonth = m;
    }
    items.push({ kind: 'session', session: s });
  }
  return items;
}

// ── Stat chip ────────────────────────────────────────────────────

function StatChip({ value, label, colour }: { value: string; label: string; colour?: string }) {
  return (
    <View style={chip.wrap}>
      <Text style={[chip.val, colour ? { color: colour } : {}]}>{value}</Text>
      <Text style={chip.label}>{label}</Text>
    </View>
  );
}

const chip = StyleSheet.create({
  wrap:  { alignItems: 'center', gap: 1 },
  val:   { color: colours.text, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  label: { ...typography.label, fontSize: 8 },
});

// ── Filter chip ──────────────────────────────────────────────────

function FilterChip({
  item,
  active,
  count,
  onPress,
}: {
  item: (typeof FILTERS)[number];
  active: boolean;
  count: number;
  onPress: () => void;
}) {
  const tone = item.key === 'ALL' ? colours.cyan : (sessionTone(item.key as SessionType));
  return (
    <Pressable
      style={[
        fc.chip,
        active
          ? { backgroundColor: tone, borderColor: tone }
          : { borderColor: `${tone}50`, backgroundColor: `${tone}10` },
      ]}
      onPress={onPress}
    >
      <Text style={[fc.label, { color: active ? colours.background : tone }]}>
        {item.label}
      </Text>
      {count > 0 && (
        <View style={[fc.badge, { backgroundColor: active ? colours.background : tone }]}>
          <Text style={[fc.badgeText, { color: active ? tone : colours.background }]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const fc = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 32,
  },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 8, fontWeight: '900' },
});

// ── Main screen ──────────────────────────────────────────────────

export type LogbookScreenProps = {
  sessions: TrainingSession[];
  addSession:    (session: TrainingSession) => void;
  deleteSession: (id: string) => void;
  editSession:   (id: string, updates: Partial<TrainingSession>) => void;
};

export function LogbookScreen({ sessions, addSession, deleteSession, editSession }: LogbookScreenProps) {
  const [filter, setFilter]       = useState<Filter>('ALL');
  const [editTarget, setEditTarget] = useState<TrainingSession | null>(null);

  const sorted  = useMemo(() => sortedByDate(sessions), [sessions]);
  const prSessionIds = useMemo(() => getPRSessionIds(sessions), [sessions]);
  const filtered = useMemo(
    () => filter === 'ALL' ? sorted : sorted.filter(s => s.type === filter),
    [sorted, filter],
  );

  const countFor = (key: Filter) =>
    key === 'ALL' ? sessions.length : sessions.filter(s => s.type === key).length;

  const summary = useMemo(() => buildSummary(filtered), [filtered]);
  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  function renderItem({ item }: { item: GroupedItem }) {
    if (item.kind === 'header') {
      return (
        <View style={styles.monthHeader}>
          <Text style={styles.monthLabel}>{item.month.toUpperCase()}</Text>
          <View style={styles.monthLine} />
        </View>
      );
    }
    return (
      <SessionCard
        session={item.session}
        onEdit={setEditTarget}
        onDelete={deleteSession}
        isPR={prSessionIds.has(item.session.id)}
      />
    );
  }

  return (
    <View style={styles.root}>
      <Screen>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.kicker}>TRAINING LOGBOOK</Text>
          <Text style={styles.title}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* Summary bar */}
        {filtered.length > 0 && (
          <View style={styles.summaryBar}>
            <StatChip
              value={`${summary.totalHours}h`}
              label="TOTAL TIME"
              colour={colours.cyan}
            />
            <View style={styles.divider} />
            <StatChip
              value={String(summary.ruckCount)}
              label="RUCKS"
              colour={colours.amber}
            />
            <View style={styles.divider} />
            <StatChip
              value={String(summary.avgScore)}
              label="AVG SCORE"
              colour={summary.avgScore >= 80 ? colours.green : summary.avgScore >= 60 ? colours.amber : colours.red}
            />
            {summary.totalLoadKgKm > 0 && (
              <>
                <View style={styles.divider} />
                <StatChip
                  value={`${summary.totalLoadKgKm}`}
                  label="KG·KM"
                  colour={colours.violet}
                />
              </>
            )}
          </View>
        )}

        {/* Filter chips */}
        <FlatList
          data={FILTERS.filter(f => f.key === 'ALL' || countFor(f.key) > 0)}
          keyExtractor={f => f.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <FilterChip
              item={item}
              active={filter === item.key}
              count={item.key === 'ALL' ? 0 : countFor(item.key)}
              onPress={() => setFilter(item.key)}
            />
          )}
        />
      </Screen>

      {/* Session list — outside Screen so it gets its own scroll */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="book-outline" size={40} color={colours.border} />
          <Text style={styles.emptyTitle}>NO SESSIONS LOGGED</Text>
          <Text style={styles.emptyBody}>
            {filter === 'ALL'
              ? 'Complete a workout or ruck to start your logbook.'
              : `No ${filter.toUpperCase()} sessions on record.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item, i) =>
            item.kind === 'header' ? `h-${item.month}` : `s-${item.session.id}-${i}`
          }
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Edit modal */}
      <SessionEditModal
        visible={editTarget !== null}
        session={editTarget}
        onSave={(id, score, durationMinutes) => {
          editSession(id, { score, durationMinutes });
          setEditTarget(null);
        }}
        onClose={() => setEditTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colours.background },

  header: { gap: 4 },
  kicker: { ...typography.label, color: colours.cyan },
  title:  { color: colours.text, fontSize: 30, lineHeight: 34, fontWeight: '900' },

  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: radius.sm,
    padding: 14,
    gap: 0,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colours.border,
    marginHorizontal: 8,
    alignSelf: 'center',
  },

  filterRow: {
    gap: 8,
    paddingBottom: 2,
  },

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
  },
  monthLabel: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  monthLine: {
    flex: 1,
    height: 1,
    backgroundColor: colours.border,
  },

  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 40,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: colours.muted,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  emptyBody: {
    color: colours.soft,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
});
