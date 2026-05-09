import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { buildPerformanceProfile } from '../lib/performance';
import { getLatestReadinessLog, isReadinessStale } from '../lib/readiness';
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

function readinessStatus(score: number) {
  if (score >= 75) return { label: 'Ready for moderate training', tone: colours.green };
  if (score >= 60) return { label: 'Keep this steady', tone: colours.amber };
  return { label: 'Recovery priority', tone: colours.red };
}

export function HomeScreen({
  sessions,
  goToRuck,
  goToAnalytics,
  goToTrain,
  goToReadiness,
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
  readinessLogs?: ReadinessLog[];
  workoutCompletions?: WorkoutCompletion[];
  member?: SquadMember | null;
  secondaryActionLabel?: string;
}) {
  const performance = useMemo(() => buildPerformanceProfile(sessions), [sessions]);
  const latestReadiness = useMemo(() => getLatestReadinessLog(readinessLogs, member?.id), [member?.id, readinessLogs]);
  const readinessStale = isReadinessStale(latestReadiness);
  const readinessScore = readinessStale ? performance.readiness : latestReadiness ? performance.readiness : performance.readiness;
  const status = readinessStatus(readinessScore);
  const displayName = member?.gymName || member?.name;

  const weeklyRuckKm = useMemo(() => {
    return sessions
      .filter((session) => session.type === 'Ruck' && isThisWeek(session.completedAt))
      .reduce((total, session) => {
        const routeKm = session.routePoints && session.routePoints.length > 1 ? undefined : undefined;
        return total + (routeKm ?? (session.durationMinutes / 60) * 5.2);
      }, 0);
  }, [sessions]);

  const streak = useMemo(() => {
    const days = new Set(
      sessions
        .filter((session) => session.completedAt)
        .map((session) => new Date(session.completedAt as string).toDateString())
    );
    let count = 0;
    const cursor = new Date();
    while (days.has(cursor.toDateString())) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return member?.streakDays ?? count;
  }, [member?.streakDays, sessions]);

  const recommendation = useMemo(() => {
    const assigned = member?.assignmentSession;
    if (goToReadiness && (!latestReadiness || readinessStale)) {
      return {
        title: 'Readiness check',
        detail: 'Two minutes. Sleep, soreness, hydration and pain flags.',
        action: 'Readiness Check',
        icon: 'body-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.amber,
        onPress: goToReadiness,
      };
    }
    if (assigned && assigned.status !== 'completed') {
      return {
        title: assigned.title,
        detail: assigned.coachNote ?? `${assigned.type} assigned by coach.`,
        action: 'Start Session',
        icon: assigned.type === 'Ruck' ? 'footsteps-outline' as const : 'barbell-outline' as const,
        tone: status.tone,
        onPress: assigned.type === 'Ruck' ? goToRuck : goToTrain,
      };
    }
    if (performance.loadRisk === 'High' || performance.readinessBand === 'RED') {
      return {
        title: 'Mobility reset',
        detail: '20 to 30 min. Bring load down before the next hard effort.',
        action: 'Log Workout',
        icon: 'body-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.red,
        onPress: goToTrain,
      };
    }
    if (weeklyRuckKm < 6) {
      return {
        title: '6 km ruck',
        detail: '15 kg load. Zone 2 pace. Add checkpoints if training outdoors.',
        action: 'Start Ruck',
        icon: 'footsteps-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.green,
        onPress: goToRuck,
      };
    }
    return {
      title: 'Strength block',
      detail: 'Compound work plus carries. Keep effort at RPE 7.',
      action: 'Log Workout',
      icon: 'barbell-outline' as keyof typeof Ionicons.glyphMap,
      tone: colours.green,
      onPress: goToTrain,
    };
  }, [goToReadiness, goToRuck, goToTrain, latestReadiness, member?.assignmentSession, performance.loadRisk, performance.readinessBand, readinessStale, status.tone, weeklyRuckKm]);

  const alerts = useMemo(() => {
    const list: Array<{ label: string; tone: string; icon: keyof typeof Ionicons.glyphMap }> = [];
    if (!latestReadiness || readinessStale) list.push({ label: 'Readiness check due', tone: colours.amber, icon: 'time-outline' });
    if (latestReadiness?.hydration === 'Poor') list.push({ label: 'Hydration low', tone: colours.amber, icon: 'water-outline' });
    if ((latestReadiness?.pain ?? 0) >= 4) list.push({ label: 'Pain flag needs review', tone: colours.red, icon: 'alert-circle-outline' });
    if (performance.loadRisk === 'High') list.push({ label: 'Training load high', tone: colours.red, icon: 'flame-outline' });
    return list.length ? list : [{ label: 'No injury flags', tone: colours.green, icon: 'shield-checkmark-outline' as const }];
  }, [latestReadiness, performance.loadRisk, readinessStale]);

  const lastCompletion = workoutCompletions[0];

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>FORGE READINESS</Text>
          <Text style={styles.title}>{displayName ? `${displayName}'s Today` : 'What is next?'}</Text>
        </View>
      </View>

      <Card hot>
        <View style={styles.readinessRow}>
          <View>
            <Text style={styles.label}>Readiness</Text>
            <Text style={[styles.readinessValue, { color: status.tone }]}>{readinessScore}</Text>
          </View>
          <View style={styles.statusBlock}>
            <Text style={[styles.statusText, { color: status.tone }]}>{status.label}</Text>
            <Text style={styles.statusMeta}>{readinessStale ? 'Fresh check needed' : 'Current check-in active'}</Text>
          </View>
        </View>
        <ProgressBar value={readinessScore} colour={status.tone} height={8} />
      </Card>

      <Card>
        <View style={styles.recommendationHeader}>
          <Text style={styles.label}>Today's Recommendation</Text>
          <Ionicons name={recommendation.icon} size={20} color={recommendation.tone} />
        </View>
        <Text style={[styles.recommendationTitle, { color: recommendation.tone }]}>{recommendation.title}</Text>
        <Text style={styles.body}>{recommendation.detail}</Text>
        <Pressable style={[styles.primaryButton, { backgroundColor: recommendation.tone }]} onPress={recommendation.onPress}>
          <Ionicons name={recommendation.icon} size={18} color={colours.background} />
          <Text style={styles.primaryButtonText}>{recommendation.action}</Text>
        </Pressable>
      </Card>

      <View style={styles.quickRow}>
        {[
          { label: 'Start Ruck', icon: 'footsteps-outline' as const, tone: colours.green, onPress: goToRuck },
          { label: 'Log Workout', icon: 'barbell-outline' as const, tone: colours.amber, onPress: goToTrain },
          { label: 'Readiness', icon: 'body-outline' as const, tone: colours.cyan, onPress: goToReadiness },
        ].map((action) => (
          <Pressable key={action.label} style={[styles.quickButton, { borderColor: `${action.tone}45`, backgroundColor: `${action.tone}12` }]} onPress={action.onPress}>
            <Ionicons name={action.icon} size={18} color={action.tone} />
            <Text style={[styles.quickText, { color: action.tone }]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <Text style={styles.cardTitle}>This Week</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{formatOneDecimal(weeklyRuckKm)} km</Text>
            <Text style={styles.statLabel}>Ruck distance</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={[styles.statValue, { color: performance.riskTone }]}>{performance.loadRisk}</Text>
            <Text style={styles.statLabel}>Training load</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Alerts</Text>
        {alerts.map((alert) => (
          <View key={alert.label} style={styles.alertRow}>
            <Ionicons name={alert.icon} size={16} color={alert.tone} />
            <Text style={[styles.alertText, { color: alert.tone }]}>{alert.label}</Text>
          </View>
        ))}
        {lastCompletion ? <Text style={styles.footerNote}>Last member update: {lastCompletion.assignment} was {lastCompletion.effort.toLowerCase()}.</Text> : null}
      </Card>

      <Pressable style={styles.linkButton} onPress={goToAnalytics}>
        <Text style={styles.linkText}>Open detailed readiness and load analytics</Text>
        <Ionicons name="chevron-forward" size={16} color={colours.cyan} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kicker: { ...typography.label, color: colours.cyan },
  title: { color: colours.text, fontSize: 32, lineHeight: 36, fontWeight: '900', marginTop: 4 },
  label: { ...typography.label, color: colours.muted },
  readinessRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginBottom: 12 },
  readinessValue: { fontSize: 64, lineHeight: 68, fontWeight: '900' },
  statusBlock: { flex: 1, alignItems: 'flex-end' },
  statusText: { fontSize: 18, lineHeight: 23, fontWeight: '900', textAlign: 'right' },
  statusMeta: { ...typography.caption, color: colours.muted, marginTop: 5, textAlign: 'right' },
  recommendationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  recommendationTitle: { fontSize: 28, lineHeight: 32, fontWeight: '900' },
  body: { ...typography.body, color: colours.textSoft, marginTop: 6 },
  primaryButton: { minHeight: touchTarget, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 16 },
  primaryButtonText: { color: colours.background, fontWeight: '900', fontSize: 14 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickButton: { flex: 1, minHeight: 70, borderWidth: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  quickText: { fontSize: 11, fontWeight: '900', textAlign: 'center' },
  cardTitle: { ...typography.h4, color: colours.text, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', gap: 8 },
  statTile: { flex: 1, borderWidth: 1, borderColor: colours.borderSoft, borderRadius: radius.sm, padding: 12, backgroundColor: colours.layer1 },
  statValue: { color: colours.text, fontSize: 22, fontWeight: '900' },
  statLabel: { ...typography.caption, color: colours.muted, marginTop: 4 },
  alertRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colours.borderSoft },
  alertText: { fontSize: 13, fontWeight: '900' },
  footerNote: { ...typography.caption, color: colours.textSoft, marginTop: 10, lineHeight: 18 },
  linkButton: { ...shadow.subtle, minHeight: touchTarget, borderWidth: 1, borderColor: colours.borderHot, borderRadius: radius.sm, backgroundColor: colours.cyanDim, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  linkText: { color: colours.cyan, fontWeight: '900', fontSize: 13 },
});
