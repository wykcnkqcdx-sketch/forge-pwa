import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { buildPerformanceProfile } from '../lib/performance';
import { getLatestReadinessLog, isReadinessStale } from '../lib/readiness';
import { getCurrentStreak, getLongestStreak, getLast7DayFlags, streakMilestoneLabel } from '../lib/streak';
import { colours, radius, shadow, touchTarget, typography } from '../theme';
import type { SquadMember, TrainingSession } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';

function isThisWeek(dateIso?: string) {
  if (!dateIso) return false;
  const date = new Date(dateIso);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return date >= start && date <= now;
}

function formatOneDecimal(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function readinessBand(score: number): { label: string; sub: string; tone: string } {
  if (score >= 75) return { label: 'FIELD READY',  sub: 'Moderate session recommended', tone: colours.green };
  if (score >= 60) return { label: 'MODERATE',     sub: 'Keep load steady today',        tone: colours.amber };
  return              { label: 'RECOVER',          sub: 'Recovery priority',              tone: colours.red   };
}

export function HomeScreen({
  sessions,
  goToRuck,
  goToAnalytics,
  goToTrain,
  goToReadiness,
  goToLogbook,
  readinessLogs = [],
  workoutCompletions = [],
  member,
}: {
  sessions: TrainingSession[];
  goToRuck: () => void;
  goToAnalytics: () => void;
  goToFuel?: () => void;
  goToTrain?: () => void;
  goToReadiness?: () => void;
  goToLogbook?: () => void;
  readinessLogs?: ReadinessLog[];
  workoutCompletions?: WorkoutCompletion[];
  member?: SquadMember | null;
  secondaryActionLabel?: string;
}) {
  const performance = useMemo(() => buildPerformanceProfile(sessions), [sessions]);
  const latestReadiness = useMemo(
    () => getLatestReadinessLog(readinessLogs, member?.id),
    [member?.id, readinessLogs],
  );
  const readinessStale = isReadinessStale(latestReadiness);
  const readinessScore = performance.readiness;
  const band = readinessBand(readinessScore);

  const weeklyRuckKm = useMemo(() =>
    sessions
      .filter(s => s.type === 'Ruck' && isThisWeek(s.completedAt))
      .reduce((total, s) => {
        const km = s.ruckMission?.targetDistanceKm ?? (s.durationMinutes / 60) * 5.2;
        return total + km;
      }, 0),
    [sessions],
  );

  const loadMoved = useMemo(() =>
    sessions
      .filter(s => s.type === 'Ruck' && isThisWeek(s.completedAt) && s.loadKg)
      .reduce((total, s) => {
        const km = s.ruckMission?.targetDistanceKm ?? (s.durationMinutes / 60) * 5.2;
        return total + (s.loadKg ?? 0) * km;
      }, 0),
    [sessions],
  );

  const streak = useMemo(
    () => member?.streakDays ?? getCurrentStreak(sessions),
    [member?.streakDays, sessions],
  );
  const longestStreak = useMemo(() => getLongestStreak(sessions), [sessions]);
  const last7 = useMemo(() => getLast7DayFlags(sessions), [sessions]);

  const orders = useMemo(() => {
    const assigned = member?.assignmentSession;
    if (goToReadiness && (!latestReadiness || readinessStale)) {
      return {
        title: 'Readiness check',
        detail: 'Two minutes. Sleep, soreness, hydration and pain flags.',
        action: 'COMPLETE READINESS CHECK',
        icon: 'body-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.amber,
        onPress: goToReadiness,
      };
    }
    if (assigned && assigned.status !== 'completed') {
      return {
        title: assigned.title,
        detail: assigned.coachNote ?? `${assigned.type} assigned by coach.`,
        action: assigned.type === 'Ruck' ? 'START RUCK' : 'START SESSION',
        icon: assigned.type === 'Ruck' ? ('footsteps-outline' as const) : ('barbell-outline' as const),
        tone: band.tone,
        onPress: assigned.type === 'Ruck' ? goToRuck : goToTrain,
      };
    }
    if (performance.loadRisk === 'High' || performance.readinessBand === 'RED') {
      return {
        title: 'Mobility reset',
        detail: '20–30 min. Bring load down before the next hard effort.',
        action: 'LOG WORKOUT',
        icon: 'body-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.red,
        onPress: goToTrain,
      };
    }
    if (weeklyRuckKm < 6) {
      return {
        title: '6 km ruck · 15 kg load',
        detail: 'Zone 2 pace. Add checkpoints if training outdoors.',
        action: 'START RUCK',
        icon: 'footsteps-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.cyan,
        onPress: goToRuck,
      };
    }
    return {
      title: 'Strength block',
      detail: 'Compound work plus carries. Keep effort at RPE 7.',
      action: 'LOG WORKOUT',
      icon: 'barbell-outline' as keyof typeof Ionicons.glyphMap,
      tone: colours.green,
      onPress: goToTrain,
    };
  }, [goToReadiness, goToRuck, goToTrain, latestReadiness, member?.assignmentSession, performance.loadRisk, performance.readinessBand, readinessStale, band.tone, weeklyRuckKm]);

  const alerts = useMemo(() => {
    const list: Array<{ label: string; tone: string; icon: keyof typeof Ionicons.glyphMap }> = [];
    if (!latestReadiness || readinessStale) list.push({ label: 'Readiness check due', tone: colours.amber, icon: 'time-outline' });
    if (latestReadiness?.hydration === 'Poor') list.push({ label: 'Hydration low', tone: colours.amber, icon: 'water-outline' });
    if ((latestReadiness?.pain ?? 0) >= 4) list.push({ label: 'Pain flag needs review', tone: colours.red, icon: 'alert-circle-outline' });
    if (performance.loadRisk === 'High') list.push({ label: 'Training load high', tone: colours.red, icon: 'flame-outline' });
    return list.length
      ? list
      : [{ label: 'No injury flags', tone: colours.green, icon: 'shield-checkmark-outline' as const }];
  }, [latestReadiness, performance.loadRisk, readinessStale]);

  const lastRuck = useMemo(() =>
    sessions
      .filter(s => s.type === 'Ruck' && s.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0] ?? null,
    [sessions],
  );

  const squadCompliance = member ? Math.round(member.compliance) : null;
  const lastCompletion = workoutCompletions[0];

  return (
    <Screen>
      {/* ── Header ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandName}>FORGE</Text>
          <Text style={[styles.brandKicker, { color: band.tone }]}>{band.label}</Text>
        </View>
        <Pressable style={styles.readinessBadge} onPress={goToReadiness}>
          <Text style={[styles.readinessNum, { color: band.tone }]}>{readinessScore}</Text>
          <Text style={styles.readinessLabel}>READINESS</Text>
        </Pressable>
      </View>

      {/* ── Today's Orders ───────────────────────────────────── */}
      <Card hot accent={orders.tone}>
        <View style={styles.ordersHeader}>
          <Text style={styles.sectionLabel}>TODAY'S ORDERS</Text>
          <Ionicons name={orders.icon} size={18} color={orders.tone} />
        </View>
        <View style={styles.divider} />
        <Text style={[styles.ordersTitle, { color: orders.tone }]}>{orders.title}</Text>
        <Text style={styles.ordersDetail}>{orders.detail}</Text>
        <Pressable
          style={[styles.ctaButton, { backgroundColor: orders.tone }]}
          onPress={orders.onPress}
        >
          <Ionicons name={orders.icon} size={16} color={colours.background} />
          <Text style={styles.ctaText}>{orders.action}</Text>
        </Pressable>
      </Card>

      {/* ── Stat tiles ───────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.tileLabel}>RUCK WEEK</Text>
          <Text style={styles.tileValue}>{formatOneDecimal(weeklyRuckKm)}</Text>
          <Text style={styles.tileUnit}>km</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.tileLabel}>LOAD MOVED</Text>
          <Text style={styles.tileValue}>{Math.round(loadMoved)}</Text>
          <Text style={styles.tileUnit}>kg·km</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.tileLabel}>STREAK</Text>
          <View style={styles.streakDots}>
            {last7.map((active, i) => (
              <View key={i} style={[styles.streakDot, active && styles.streakDotActive]} />
            ))}
          </View>
          <Text style={[styles.tileValue, streak >= 3 && { color: colours.cyan }]}>{streak}</Text>
          <Text style={styles.tileUnit}>days</Text>
          {streakMilestoneLabel(streak) && (
            <View style={styles.streakMilestone}>
              <Text style={styles.streakMilestoneText}>{streakMilestoneLabel(streak)}</Text>
            </View>
          )}
          {longestStreak > streak && (
            <Text style={styles.streakBest}>BEST {longestStreak}</Text>
          )}
        </View>
      </View>

      {/* ── Last ruck ────────────────────────────────────────── */}
      {lastRuck && <LastRuckCard session={lastRuck} onPress={goToLogbook} />}

      {/* ── Squad Pulse ──────────────────────────────────────── */}
      {squadCompliance !== null && (
        <Card>
          <View style={styles.squadHeader}>
            <Text style={styles.sectionLabel}>SQUAD PULSE</Text>
            <Ionicons name="people-outline" size={16} color={colours.muted} />
          </View>
          <View style={styles.squadCompliance}>
            <Text style={[styles.squadPct, { color: squadCompliance >= 75 ? colours.green : colours.amber }]}>
              {squadCompliance}%
            </Text>
            <Text style={styles.squadSub}>complete this week</Text>
          </View>
          <ProgressBar
            value={squadCompliance}
            colour={squadCompliance >= 75 ? colours.green : colours.amber}
            height={6}
          />
          {lastCompletion && (
            <Text style={styles.squadNote}>
              Last: {lastCompletion.assignment} — {lastCompletion.effort.toLowerCase()}
            </Text>
          )}
        </Card>
      )}

      {/* ── Field status ─────────────────────────────────────── */}
      <View style={styles.statusCard}>
        <Text style={styles.sectionLabel}>FIELD STATUS</Text>
        {alerts.map((alert) => (
          <View key={alert.label} style={styles.alertRow}>
            <Ionicons name={alert.icon} size={14} color={alert.tone} />
            <Text style={[styles.alertText, { color: alert.tone }]}>{alert.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Analytics link ───────────────────────────────────── */}
      <Pressable style={styles.analyticsLink} onPress={goToAnalytics}>
        <Text style={styles.analyticsText}>Readiness + load analytics</Text>
        <Ionicons name="chevron-forward" size={14} color={colours.cyan} />
      </Pressable>
    </Screen>
  );
}

// ── Last Ruck Card ───────────────────────────────────────────────

function scoreTone(score: number) {
  if (score >= 80) return colours.green;
  if (score >= 65) return colours.cyan;
  if (score >= 50) return colours.amber;
  return colours.red;
}

function formatRuckDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();
}

function formatPaceShort(session: TrainingSession) {
  const km = session.ruckMission?.targetDistanceKm ?? (session.durationMinutes / 60) * 5.2;
  if (km <= 0) return '--';
  const minPerKm = session.durationMinutes / km;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function LastRuckCard({ session, onPress }: { session: TrainingSession; onPress?: () => void }) {
  const tone = scoreTone(session.score);
  const km = (session.ruckMission?.targetDistanceKm ?? (session.durationMinutes / 60) * 5.2).toFixed(1);
  const pace = formatPaceShort(session);
  const date = session.completedAt ? formatRuckDate(session.completedAt) : '';

  return (
    <Pressable style={lr.card} onPress={onPress} disabled={!onPress}>
      <View style={lr.left}>
        <Text style={lr.label}>LAST RUCK</Text>
        <Text style={lr.title} numberOfLines={1}>{session.title}</Text>
        <View style={lr.metaRow}>
          <Text style={lr.meta}>{km} km</Text>
          {session.loadKg ? <><Text style={lr.dot}>·</Text><Text style={lr.meta}>{session.loadKg} kg</Text></> : null}
          <Text style={lr.dot}>·</Text>
          <Text style={lr.meta}>{pace}/km</Text>
        </View>
      </View>
      <View style={lr.right}>
        <View style={[lr.scoreBadge, { borderColor: `${tone}45`, backgroundColor: `${tone}10` }]}>
          <Text style={[lr.scoreVal, { color: tone }]}>{session.score}</Text>
          <Text style={lr.scoreUnit}>SCORE</Text>
        </View>
        <Text style={lr.date}>{date}</Text>
        {onPress && <Ionicons name="chevron-forward" size={14} color={colours.muted} />}
      </View>
    </Pressable>
  );
}

const lr = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  left: { flex: 1, gap: 3 },
  label: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2,
    color: colours.muted,
    textTransform: 'uppercase',
  },
  title: {
    color: colours.text,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  meta: { color: colours.muted, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dot: { color: colours.border, fontSize: 11, fontWeight: '900' },
  right: { alignItems: 'flex-end', gap: 4 },
  scoreBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreVal: { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 24 },
  scoreUnit: { color: colours.muted, fontSize: 6, fontWeight: '900', letterSpacing: 1.5 },
  date: { color: colours.soft, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
});

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 4,
  },
  brandName: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    color: colours.text,
    lineHeight: 44,
  },
  brandKicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.5,
    marginTop: 2,
  },
  readinessBadge: {
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  readinessNum: {
    fontSize: 56,
    fontWeight: '900',
    lineHeight: 58,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  readinessLabel: {
    ...typography.label,
    color: colours.muted,
    textAlign: 'right',
  },

  // Today's Orders
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    ...typography.label,
    color: colours.muted,
  },
  divider: {
    height: 1,
    backgroundColor: colours.borderSoft,
    marginBottom: 12,
  },
  ordersTitle: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  ordersDetail: {
    ...typography.body,
    color: colours.textSoft,
    marginBottom: 16,
  },
  ctaButton: {
    minHeight: touchTarget,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    color: colours.background,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.2,
  },

  // Stat tiles
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    flex: 1,
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    padding: 12,
    alignItems: 'center',
  },
  tileLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: colours.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  tileValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colours.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  tileUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: colours.soft,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  streakDots: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
    marginTop: 2,
  },
  streakDot: {
    width: 5,
    height: 5,
    borderRadius: 2,
    backgroundColor: colours.border,
  },
  streakDotActive: {
    backgroundColor: colours.cyan,
  },
  streakMilestone: {
    marginTop: 4,
    backgroundColor: `${colours.cyan}20`,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  streakMilestoneText: {
    color: colours.cyan,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  streakBest: {
    color: colours.muted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 3,
  },

  // Squad Pulse
  squadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  squadCompliance: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  squadPct: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 38,
    fontVariant: ['tabular-nums'],
  },
  squadSub: {
    ...typography.caption,
    color: colours.muted,
  },
  squadNote: {
    ...typography.caption,
    color: colours.muted,
    marginTop: 8,
  },

  // Field Status
  statusCard: {
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    padding: 14,
    gap: 2,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 32,
    borderTopWidth: 1,
    borderTopColor: colours.borderSoft,
    marginTop: 4,
  },
  alertText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  // Analytics link
  analyticsLink: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: radius.sm,
    backgroundColor: colours.cyanDim,
    ...shadow.subtle,
  },
  analyticsText: {
    color: colours.cyan,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.6,
  },
});
