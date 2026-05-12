import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RuckRing } from '../components/graphics/RuckRing';
import { Screen } from '../components/Screen';
import { ProgressBar } from '../components/ProgressBar';
import { colours, radius, typography } from '../theme';
import type { TrainingSession } from '../data/mockData';

// ── Types ────────────────────────────────────────────────────────

type Period = '7d' | '30d' | 'all';

// ── Helpers ──────────────────────────────────────────────────────

function ruckSessionsInPeriod(sessions: TrainingSession[], period: Period) {
  const rucks = sessions.filter(s => s.type === 'Ruck');
  if (period === 'all') return rucks;
  const cutoff = Date.now() - (period === '7d' ? 7 : 30) * 864e5;
  return rucks.filter(s => s.completedAt && new Date(s.completedAt).getTime() >= cutoff);
}

function sessionDistanceKm(s: TrainingSession) {
  return s.ruckMission?.targetDistanceKm ?? (s.durationMinutes / 60) * 5.2;
}

function sessionPaceMinPerKm(s: TrainingSession) {
  const km = sessionDistanceKm(s);
  if (km <= 0) return 10;
  const mins = s.ruckMission?.targetMinutes ?? s.durationMinutes;
  return mins / km;
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function buildRingValues(rucks: TrainingSession[]) {
  if (!rucks.length) return { distance: 0, load: 0, pace: 0, elevation: 0 };

  const distRatios  = rucks.map(s => clamp(sessionDistanceKm(s) / 16, 0, 1) * 100);
  const loadRatios  = rucks.map(s => clamp((s.loadKg ?? 10) / 22, 0, 1) * 100);
  // Pace: ideal is ~10 min/km under standard load; faster = more points
  const paceRatios  = rucks.map(s => {
    const pace = sessionPaceMinPerKm(s);
    return clamp((13 - pace) / 8, 0, 1) * 100;
  });
  // Elevation not tracked at session level — use a heuristic from RPE & duration
  const elevRatios  = rucks.map(s => clamp(((s.rpe - 4) / 6) * 100, 10, 90));

  return {
    distance:  Math.round(avg(distRatios)),
    load:      Math.round(avg(loadRatios)),
    pace:      Math.round(avg(paceRatios)),
    elevation: Math.round(avg(elevRatios)),
  };
}

function buildSeasonStats(rucks: TrainingSession[]) {
  const totalKm     = rucks.reduce((s, r) => s + sessionDistanceKm(r), 0);
  const totalKgKm   = rucks.reduce((s, r) => s + (r.loadKg ?? 0) * sessionDistanceKm(r), 0);
  const avgScore    = rucks.length ? Math.round(avg(rucks.map(r => r.score))) : 0;
  const bestScore   = rucks.length ? Math.max(...rucks.map(r => r.score)) : 0;
  const avgLoadKg   = rucks.filter(r => r.loadKg).length
    ? Math.round(avg(rucks.filter(r => r.loadKg).map(r => r.loadKg!)))
    : 0;
  return {
    count:      rucks.length,
    totalKm:    Math.round(totalKm * 10) / 10,
    totalKgKm:  Math.round(totalKgKm),
    avgScore,
    bestScore,
    avgLoadKg,
  };
}

function scoreTone(score: number) {
  if (score >= 80) return colours.green;
  if (score >= 65) return colours.cyan;
  if (score >= 50) return colours.amber;
  return colours.red;
}

function formatDate(iso: string | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatPace(minPerKm: number) {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Factor bar ───────────────────────────────────────────────────

function FactorBar({
  label,
  pct,
  colour,
  detail,
}: {
  label: string;
  pct: number;
  colour: string;
  detail: string;
}) {
  return (
    <View style={fb.row}>
      <View style={fb.labelWrap}>
        <Text style={fb.label}>{label}</Text>
      </View>
      <View style={fb.trackWrap}>
        <View style={fb.track}>
          <View style={[fb.fill, { width: `${pct}%`, backgroundColor: colour }]} />
        </View>
      </View>
      <Text style={[fb.pct, { color: colour }]}>{Math.round(pct)}</Text>
      <Text style={fb.detail}>{detail}</Text>
    </View>
  );
}

const fb = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 },
  labelWrap: { width: 68 },
  label:     { color: colours.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  trackWrap: { flex: 1 },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colours.border,
    overflow: 'hidden',
  },
  fill:   { height: 5, borderRadius: 3 },
  pct:    { width: 24, fontSize: 11, fontWeight: '900', textAlign: 'right', fontVariant: ['tabular-nums'] },
  detail: { width: 64, color: colours.soft, fontSize: 9, fontWeight: '700', textAlign: 'right' },
});

// ── Recent ruck row ──────────────────────────────────────────────

function RuckHistoryRow({ session }: { session: TrainingSession }) {
  const km    = sessionDistanceKm(session);
  const pace  = sessionPaceMinPerKm(session);
  const tone  = scoreTone(session.score);
  return (
    <View style={rh.row}>
      <View style={[rh.scoreBadge, { borderColor: `${tone}50`, backgroundColor: `${tone}12` }]}>
        <Text style={[rh.scoreVal, { color: tone }]}>{session.score}</Text>
      </View>
      <View style={rh.body}>
        <Text style={rh.title} numberOfLines={1}>{session.title}</Text>
        <Text style={rh.meta}>
          {km.toFixed(1)} km
          {session.loadKg ? ` · ${session.loadKg} kg` : ''}
          {` · ${formatPace(pace)}/km`}
        </Text>
      </View>
      <Text style={rh.date}>{formatDate(session.completedAt)}</Text>
    </View>
  );
}

const rh = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colours.borderSoft,
    minHeight: 52,
  },
  scoreBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreVal: { fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
  body:     { flex: 1 },
  title:    { color: colours.text, fontSize: 13, fontWeight: '900' },
  meta:     { color: colours.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  date:     { color: colours.soft, fontSize: 11, fontWeight: '700' },
});

// ── Period switch ─────────────────────────────────────────────────

function PeriodSwitch({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const opts: Array<{ key: Period; label: string }> = [
    { key: '7d',  label: '7 DAYS' },
    { key: '30d', label: '30 DAYS' },
    { key: 'all', label: 'ALL TIME' },
  ];
  return (
    <View style={ps.bar}>
      {opts.map(o => {
        const active = period === o.key;
        return (
          <Pressable
            key={o.key}
            style={[ps.chip, active && ps.chipActive]}
            onPress={() => onChange(o.key)}
          >
            <Text style={[ps.label, active && ps.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const ps = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colours.surface,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
  },
  chip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.xs,
    alignItems: 'center',
  },
  chipActive:   { backgroundColor: colours.cyan },
  label:        { color: colours.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  labelActive:  { color: colours.background },
});

// ── Props ─────────────────────────────────────────────────────────

export type RuckRingScreenProps = {
  sessions:    TrainingSession[];
  onGoToRuck?: () => void;
};

// ── Main screen ───────────────────────────────────────────────────

export function RuckRingScreen({ sessions, onGoToRuck }: RuckRingScreenProps) {
  const [period, setPeriod] = useState<Period>('30d');

  const rucks  = useMemo(() => ruckSessionsInPeriod(sessions, period), [sessions, period]);
  const ring   = useMemo(() => buildRingValues(rucks), [rucks]);
  const stats  = useMemo(() => buildSeasonStats(rucks), [rucks]);
  const recent = useMemo(
    () => [...rucks]
      .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())
      .slice(0, 6),
    [rucks],
  );

  const allRucks = useMemo(() => sessions.filter(s => s.type === 'Ruck'), [sessions]);

  // Score trend vs previous equal-length period
  const trend = useMemo(() => {
    if (period === 'all' || rucks.length < 2) return null;
    const days = period === '7d' ? 7 : 30;
    const prevCutoff = Date.now() - days * 2 * 864e5;
    const thisCutoff = Date.now() - days * 864e5;
    const prev = allRucks.filter(s =>
      s.completedAt &&
      new Date(s.completedAt).getTime() >= prevCutoff &&
      new Date(s.completedAt).getTime() < thisCutoff
    );
    if (!prev.length) return null;
    const prevAvg = Math.round(avg(prev.map(r => r.score)));
    const diff = stats.avgScore - prevAvg;
    return { diff, prevAvg };
  }, [rucks, allRucks, period, stats.avgScore]);

  const ringTone = scoreTone(stats.avgScore);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.kicker}>RUCK RING</Text>
        <Text style={styles.title}>Season Performance</Text>
      </View>

      {/* Period switch */}
      <PeriodSwitch period={period} onChange={setPeriod} />

      {/* Empty state */}
      {rucks.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="footsteps-outline" size={44} color={colours.border} />
          <Text style={styles.emptyTitle}>NO RUCK SESSIONS</Text>
          <Text style={styles.emptyBody}>
            {period === 'all'
              ? 'Complete your first ruck to unlock your Ruck Ring.'
              : `No ruck sessions in the last ${period === '7d' ? '7' : '30'} days.`}
          </Text>
          {onGoToRuck && (
            <Pressable style={styles.emptyBtn} onPress={onGoToRuck}>
              <Text style={styles.emptyBtnText}>PLAN A RUCK</Text>
              <Ionicons name="arrow-forward" size={14} color={colours.background} />
            </Pressable>
          )}
        </View>
      ) : (
        <>
          {/* RuckRing hero */}
          <View style={styles.ringSection}>
            <RuckRing
              score={stats.avgScore}
              distance={ring.distance}
              load={ring.load}
              pace={ring.pace}
              elevation={ring.elevation}
              size={220}
              showLabels
              animate
            />

            {/* Trend badge */}
            {trend && (
              <View style={[
                styles.trendBadge,
                { borderColor: trend.diff >= 0 ? `${colours.green}40` : `${colours.red}40`,
                  backgroundColor: trend.diff >= 0 ? colours.greenDim : colours.redDim },
              ]}>
                <Ionicons
                  name={trend.diff >= 0 ? 'trending-up' : 'trending-down'}
                  size={13}
                  color={trend.diff >= 0 ? colours.green : colours.red}
                />
                <Text style={[styles.trendText, { color: trend.diff >= 0 ? colours.green : colours.red }]}>
                  {trend.diff >= 0 ? '+' : ''}{trend.diff} vs prev {period === '7d' ? '7d' : '30d'}
                </Text>
              </View>
            )}
          </View>

          {/* Season stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={[styles.statVal, { color: ringTone }]}>{stats.avgScore}</Text>
              <Text style={styles.statLabel}>AVG SCORE</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={[styles.statVal, { color: colours.green }]}>{stats.bestScore}</Text>
              <Text style={styles.statLabel}>BEST</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={[styles.statVal, { color: colours.cyan }]}>{stats.totalKm}</Text>
              <Text style={styles.statLabel}>TOTAL KM</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={[styles.statVal, { color: colours.amber }]}>{stats.count}</Text>
              <Text style={styles.statLabel}>SESSIONS</Text>
            </View>
          </View>

          {/* kg·km card */}
          {stats.totalKgKm > 0 && (
            <View style={styles.kgKmCard}>
              <View style={styles.kgKmLeft}>
                <Ionicons name="barbell-outline" size={16} color={colours.violet} />
                <View>
                  <Text style={styles.kgKmVal}>{stats.totalKgKm.toLocaleString()} kg·km</Text>
                  <Text style={styles.kgKmSub}>total load moved this period</Text>
                </View>
              </View>
              <Text style={styles.kgKmAvgLoad}>{stats.avgLoadKg}kg avg</Text>
            </View>
          )}

          {/* Factor breakdown */}
          <View style={styles.factorCard}>
            <Text style={styles.sectionLabel}>FACTOR BREAKDOWN</Text>
            <FactorBar
              label="Distance"
              pct={ring.distance}
              colour={colours.cyan}
              detail={`${stats.totalKm} km`}
            />
            <FactorBar
              label="Load"
              pct={ring.load}
              colour={colours.violet}
              detail={`${stats.avgLoadKg} kg avg`}
            />
            <FactorBar
              label="Pace"
              pct={ring.pace}
              colour={colours.green}
              detail="vs target"
            />
            <FactorBar
              label="Effort"
              pct={ring.elevation}
              colour={colours.amber}
              detail="RPE-based"
            />
          </View>

          {/* Score progress bar */}
          <View style={styles.scoreBarCard}>
            <View style={styles.scoreBarTop}>
              <Text style={styles.sectionLabel}>SCORE TRACK</Text>
              <Text style={[styles.scoreBarPct, { color: ringTone }]}>
                {stats.avgScore} / 100
              </Text>
            </View>
            <ProgressBar value={stats.avgScore} colour={ringTone} height={8} />
            <Text style={styles.scoreBarHint}>
              {stats.avgScore >= 82
                ? 'Elite tier — progress either load or distance, not both.'
                : stats.avgScore >= 68
                  ? 'Solid base — hold the same route and aim for steadier pace.'
                  : 'Building phase — reduce load or distance to rebuild consistency.'}
            </Text>
          </View>

          {/* Recent sessions */}
          {recent.length > 0 && (
            <View style={styles.historyCard}>
              <Text style={styles.sectionLabel}>RECENT RUCKS</Text>
              {recent.map(s => (
                <RuckHistoryRow key={s.id} session={s} />
              ))}
            </View>
          )}

          {/* Launch CTA */}
          {onGoToRuck && (
            <Pressable style={styles.ruckBtn} onPress={onGoToRuck}>
              <Ionicons name="footsteps-outline" size={16} color={colours.background} />
              <Text style={styles.ruckBtnText}>PLAN NEXT RUCK</Text>
            </Pressable>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colours.background },
  content: { padding: 14, gap: 16, paddingBottom: 60 },

  header: { gap: 4 },
  kicker: { ...typography.label, color: colours.cyan },
  title:  { color: colours.text, fontSize: 30, lineHeight: 34, fontWeight: '900' },

  // Ring section
  ringSection: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 14,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  trendText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },

  // Season stats grid
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: radius.sm,
    paddingVertical: 14,
  },
  statCell:    { flex: 1, alignItems: 'center', gap: 3 },
  statVal:     { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel:   { ...typography.label, fontSize: 7 },
  statDivider: { width: 1, height: 28, backgroundColor: colours.border },

  // kg·km card
  kgKmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  kgKmLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  kgKmVal:     { color: colours.text, fontSize: 15, fontWeight: '900' },
  kgKmSub:     { color: colours.muted, fontSize: 10, fontWeight: '600', marginTop: 1 },
  kgKmAvgLoad: { color: colours.violet, fontSize: 13, fontWeight: '900' },

  // Factor bars
  factorCard: {
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    padding: 14,
    gap: 6,
  },
  sectionLabel: { ...typography.label, color: colours.muted, marginBottom: 4 },

  // Score progress bar card
  scoreBarCard: {
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    padding: 14,
    gap: 8,
  },
  scoreBarTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreBarPct:  { fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  scoreBarHint: { color: colours.muted, fontSize: 11, fontWeight: '600', lineHeight: 17 },

  // History
  historyCard: {
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
  },

  // Launch CTA
  ruckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colours.green,
    borderRadius: radius.sm,
    paddingVertical: 14,
    marginTop: 4,
  },
  ruckBtnText: {
    color: colours.background,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  // Empty state
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: { color: colours.muted, fontSize: 14, fontWeight: '900', letterSpacing: 1.8 },
  emptyBody:  { color: colours.soft, fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colours.green,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  emptyBtnText: { color: colours.background, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
});
