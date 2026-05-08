import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PieChart } from 'react-native-chart-kit';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { ReadinessRing } from '../components/graphics/ReadinessRing';
import { LoadRiskMeter } from '../components/graphics/LoadRiskMeter';
import { MiniTrendLine } from '../components/graphics/MiniTrendLine';
import { ReadinessChip } from '../components/ui/StatusChip';
import { StatTile } from '../components/ui/StatTile';
import { TacticalDivider } from '../components/ui/TacticalDivider';
import { buildPerformanceProfile, buildWeeklyLoadSeries, sortSessionsByDate } from '../lib/performance';
import { buildH2FDomains, buildPrescriptiveGuidance } from '../lib/h2f';
import { getLatestReadinessLog, isReadinessStale } from '../lib/readiness';
import { colours, touchTarget, shadow, radius } from '../theme';
import { statusColors } from '../utils/styling';
import { useResponsive } from '../utils/responsive';
import { SquadMember, TrainingSession } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';
import { getClaudeCoaching, ClaudeCoaching } from '../lib/aiGuidance';

function domainTone(status: 'GREEN' | 'AMBER' | 'RED') {
  if (status === 'GREEN') return colours.green;
  if (status === 'AMBER') return colours.amber;
  return colours.red;
}

function sessionTypeIcon(type: TrainingSession['type']): keyof typeof Ionicons.glyphMap {
  if (type === 'Ruck') return 'footsteps-outline';
  if (type === 'Run') return 'walk-outline';
  if (type === 'Strength') return 'barbell-outline';
  if (type === 'Cardio') return 'heart-outline';
  if (type === 'Mobility') return 'body-outline';
  if (type === 'Resistance') return 'fitness-outline';
  if (type === 'Workout') return 'fitness-outline';
  return 'flash-outline';
}

function isSameLocalDay(dateIso: string | undefined, day: Date) {
  if (!dateIso) return false;
  return new Date(dateIso).toDateString() === day.toDateString();
}

function sessionDateLabel(completedAt?: string): string {
  if (!completedAt) return '';
  if (isSameLocalDay(completedAt, new Date())) return 'Today';
  if (isSameLocalDay(completedAt, new Date(Date.now() - 864e5))) return 'Yesterday';
  return new Date(completedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function HomeScreen({
  sessions,
  goToRuck,
  goToAnalytics,
  goToFuel,
  goToTrain,
  goToReadiness,
  readinessLogs = [],
  workoutCompletions = [],
  member,
  secondaryActionLabel = 'Intel',
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
  const { width: screenWidth, fs, sp, isTablet } = useResponsive();
  const hasSessions = sessions.length > 0;
  const performance = useMemo(() => buildPerformanceProfile(sessions), [sessions]);
  const displayName = member?.gymName || member?.name;
  const memberReadinessLogs = useMemo(
    () => member ? readinessLogs.filter((log) => log.memberId === member.id) : readinessLogs,
    [member, readinessLogs],
  );
  const latestReadiness = useMemo(() => {
    const log = getLatestReadinessLog(memberReadinessLogs, member?.id);
    return isReadinessStale(log) ? undefined : log;
  }, [member?.id, memberReadinessLogs]);
  const latestStoredReadiness = useMemo(() => getLatestReadinessLog(memberReadinessLogs, member?.id), [member?.id, memberReadinessLogs]);
  const readinessIsStale = isReadinessStale(latestStoredReadiness);
  const domains = useMemo(
    () => buildH2FDomains(sessions, latestReadiness),
    [sessions, latestReadiness],
  );
  const guidance = useMemo(
    () => buildPrescriptiveGuidance(sessions, latestReadiness?.sleepHours ?? 7, performance.loadRisk === 'High' ? 'down' : 'flat'),
    [sessions, latestReadiness?.sleepHours, performance.loadRisk],
  );

  const [claudeCoaching, setClaudeCoaching] = useState<ClaudeCoaching | null>(null);
  useEffect(() => {
    getClaudeCoaching(sessions, readinessLogs).then(setClaudeCoaching);
  }, [sessions, readinessLogs]);

  const ruckWork = sessions
    .filter((s) => s.type === 'Ruck')
    .reduce((total, s) => total + (s.loadKg ?? 0) * (s.durationMinutes / 60) * 5.2, 0);

  const recentSessions = sortSessionsByDate(sessions).slice(0, 3);

  const acwrValue = Number(performance.acuteChronicRatio);
  const acwrTone = acwrValue > 1.3 ? colours.red : acwrValue < 0.8 ? colours.amber : colours.green;
  const acwrLabel = acwrValue > 1.3 ? 'Overreach risk' : acwrValue < 0.8 ? 'Under-trained' : 'Optimal zone';

  const today = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const todayStr = new Date().toDateString();
  const hasSessionToday = sessions.some((s) => s.completedAt && new Date(s.completedAt).toDateString() === todayStr);
  const needsReadinessCheckIn = !latestStoredReadiness || readinessIsStale;
  const assignedWorkout = member?.assignmentSession;
  const assignedWorkoutPreview = assignedWorkout?.exercises.slice(0, 4) ?? [];
  const assignedCompletion = useMemo(() => {
    const matches = workoutCompletions
      .filter((completion) => (
        completion.completionType === 'assigned'
        && (!member || completion.memberId === member.id)
        && (!assignedWorkout || completion.assignment === assignedWorkout.title)
      ))
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    return matches[0];
  }, [assignedWorkout, member, workoutCompletions]);
  const assignedCompletedToday = Boolean(assignedCompletion && isSameLocalDay(assignedCompletion.completedAt, new Date()));
  const checkInStatus = latestStoredReadiness
    ? readinessIsStale
      ? 'Check-in stale'
      : `Checked in ${new Date(latestStoredReadiness.date).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
    : 'No check-in yet';

  // 7-day activity strip
  const weeklyLoadSeries = useMemo(() => buildWeeklyLoadSeries(sessions), [sessions]);
  const dayLabels = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      return d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1);
    });
  }, []);
  const maxLoad = Math.max(...weeklyLoadSeries, 1);

  // Warning banners
  const warnings = useMemo(() => {
    const list: { tone: string; icon: keyof typeof Ionicons.glyphMap; text: string }[] = [];
    if (!latestStoredReadiness) {
      list.push({ tone: colours.amber, icon: 'body-outline', text: 'No readiness check-in yet — log today to unlock sleep and recovery guidance' });
    } else if (readinessIsStale) {
      list.push({ tone: colours.amber, icon: 'time-outline', text: 'Readiness check-in is stale — log today before acting on recovery signals' });
    }
    if (performance.monotony > 2.0) {
      list.push({ tone: colours.amber, icon: 'warning-outline', text: `Monotony elevated (${performance.monotony.toFixed(1)}) — vary training type` });
    }
    if (latestReadiness?.sleepHours !== undefined && latestReadiness.sleepHours < 6) {
      list.push({ tone: colours.amber, icon: 'moon-outline', text: 'Low sleep flagged — limit high-intensity work today' });
    }
    if (latestReadiness?.hydration === 'Poor') {
      list.push({ tone: colours.red, icon: 'water-outline', text: 'Hydration poor — address before training' });
    }
    return list;
  }, [performance.monotony, latestReadiness, latestStoredReadiness, readinessIsStale]);

  const recoveryBlockers = useMemo(() => {
    return [
      { label: 'Sleep',     value: latestReadiness?.sleepHours !== undefined ? `${latestReadiness.sleepHours}h` : '--', flagged: latestReadiness?.sleepHours !== undefined ? latestReadiness.sleepHours < 6 : needsReadinessCheckIn },
      { label: 'Soreness',  value: latestReadiness?.soreness ? `${latestReadiness.soreness}/5` : '--', flagged: (latestReadiness?.soreness ?? 0) >= 4 },
      { label: 'Hydration', value: latestReadiness?.hydration ?? '--', flagged: latestReadiness?.hydration === 'Poor' },
      { label: 'Stress',    value: latestReadiness?.stress ? `${latestReadiness.stress}/5` : '--', flagged: (latestReadiness?.stress ?? 0) >= 4 },
    ];
  }, [latestReadiness, needsReadinessCheckIn]);

  const typeDistributionData = useMemo(() => {
    if (!hasSessions) return [];
    const counts: Record<string, number> = {};
    sessions.forEach(s => { counts[s.type] = (counts[s.type] || 0) + 1; });
    const chartColorMap: Record<string, string> = {
      Ruck: colours.chartRuck,
      Strength: colours.chartStr,
      Run: colours.chartRun,
      Cardio: colours.chartCardio,
      Mobility: colours.chartMob,
      Workout: colours.chartWork,
      Resistance: '#f472b6',
    };
    return Object.entries(counts)
      .map(([type, count]) => ({
        name: type,
        population: count,
        color: chartColorMap[type] || colours.cyan,
        legendFontColor: colours.muted,
        legendFontSize: 11,
      }))
      .sort((a, b) => b.population - a.population);
  }, [sessions, hasSessions]);

  const recommendedSession = useMemo(() => {
    if (performance.readinessBand === 'RED' || performance.loadRisk === 'High') {
      return { title: 'Mobility & Recovery', detail: '20–30 min · Low intensity · Focus on tissue care', reason: performance.loadRisk === 'High' ? 'High load risk. Bring stress down before another hard block.' : 'Readiness is red. Recovery quality matters most today.', actionLabel: 'Open Recovery', icon: 'body-outline' as keyof typeof Ionicons.glyphMap, tone: colours.red, goTo: goToTrain };
    }
    if (performance.readinessBand === 'AMBER' || performance.loadRisk === 'Moderate') {
      return { title: 'Zone 2 Aerobic', detail: '40 min · Heart rate 130–145 bpm · Steady effort', reason: 'Readiness is usable, but load needs control. Keep the session aerobic.', actionLabel: 'Start Training', icon: 'heart-outline' as keyof typeof Ionicons.glyphMap, tone: colours.amber, goTo: goToTrain };
    }
    const now = new Date();
    const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const hasRuckThisWeek = sessions.some((s) => s.type === 'Ruck' && s.completedAt && new Date(s.completedAt).getTime() >= weekAgo);
    if (!hasRuckThisWeek) {
      return { title: 'Ruck Intervals', detail: '60 min · 25–30kg load · Varied pace', reason: 'Readiness is green and no ruck is logged this week.', actionLabel: 'Start Ruck', icon: 'footsteps-outline' as keyof typeof Ionicons.glyphMap, tone: colours.green, goTo: goToRuck };
    }
    return { title: 'Strength Block', detail: '45 min · Compound movements · RPE 7–8', reason: 'Readiness is green. Build quality work without adding junk volume.', actionLabel: 'Start Training', icon: 'barbell-outline' as keyof typeof Ionicons.glyphMap, tone: colours.green, goTo: goToTrain };
  }, [performance.readinessBand, performance.loadRisk, sessions, goToTrain, goToRuck]);

  const dailyDecision = useMemo(() => {
    if (needsReadinessCheckIn && goToReadiness) {
      return { title: 'Log readiness', detail: 'Fresh check-in unlocks sleep, mood, soreness, and hydration guidance.', reason: latestStoredReadiness ? 'Last readiness check-in is stale.' : 'No readiness check-in is logged yet.', actionLabel: 'Log Readiness', icon: 'body-outline' as keyof typeof Ionicons.glyphMap, tone: colours.amber, goTo: goToReadiness };
    }
    if (assignedCompletedToday && assignedCompletion) {
      return { title: 'Recover from today', detail: `${assignedCompletion.assignment} completed in ${assignedCompletion.durationMinutes} min.`, reason: `Effort was ${assignedCompletion.effort.toLowerCase()}. Prioritise fuel, hydration, and recovery markers now.`, actionLabel: 'Open Fuel', icon: 'restaurant-outline' as keyof typeof Ionicons.glyphMap, tone: colours.green, goTo: goToFuel };
    }
    if (member?.assignmentSession && member.assignmentSession.status !== 'completed' && performance.readinessBand !== 'RED' && performance.loadRisk !== 'High') {
      return { title: member.assignmentSession.title, detail: member.assignmentSession.coachNote ?? `${member.assignmentSession.type} assigned by coach.`, reason: `${checkInStatus}. Assigned session is ready to execute.`, actionLabel: 'Start Assigned', icon: sessionTypeIcon(member.assignmentSession.type), tone: performance.readinessBand === 'AMBER' || performance.loadRisk === 'Moderate' ? colours.amber : colours.green, goTo: goToTrain };
    }
    return recommendedSession;
  }, [assignedCompletedToday, assignedCompletion, checkInStatus, goToFuel, goToReadiness, goToTrain, latestStoredReadiness, member, needsReadinessCheckIn, performance.loadRisk, performance.readinessBand, recommendedSession]);

  function domainPressHandler(domainId: string) {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (domainId === 'nutrition') goToFuel?.();
    if (domainId === 'sleep' || domainId === 'mental') goToReadiness?.();
  }

  function handleDecisionAction() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dailyDecision.goTo?.();
  }

  function handleAssignedWorkoutAction() {
    if (!assignedWorkout || assignedWorkout.status === 'completed' || assignedCompletedToday) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    goToTrain?.();
  }

  function handlePostWorkoutFuel() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToFuel?.();
  }

  function handlePostWorkoutReadiness() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToReadiness?.();
  }

  const ringSize = isTablet ? 112 : 96;

  return (
    <Screen>

      {/* ── Header ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { fontSize: fs(9, { min: 8, max: 11 }) }]}>{today.toUpperCase()} · FORGE TACTICAL</Text>
          <Text style={[styles.title, { fontSize: fs(26, { min: 20, max: 34 }) }]}>
            {displayName ? `${displayName}'s Today` : 'Tactical Readiness'}
          </Text>
          {!hasSessionToday && (
            <Text style={[styles.noCheckIn, { fontSize: fs(11, { min: 10, max: 13 }) }]}>No training logged today</Text>
          )}
        </View>
        <View style={styles.opsecBadge}>
          <Ionicons name="shield-checkmark" size={13} color={colours.cyan} />
          <Text style={[styles.opsecText, { fontSize: fs(10, { min: 9, max: 11 }) }]}>Offline · Private</Text>
        </View>
      </View>

      {/* ── Hero Command Card ─────────────────────────────────── */}
      <Card hot>
        {/* Top row: readiness ring + mission copy */}
        <View style={styles.heroRow}>
          <View style={styles.heroRingWrap}>
            <ReadinessRing
              score={performance.readiness}
              tone={performance.readinessTone}
              size={ringSize}
              strokeWidth={isTablet ? 10 : 8}
              band={performance.readinessBand}
            />
          </View>

          <View style={styles.heroCopy}>
            <View style={styles.heroTopRow}>
              <Text style={[styles.heroLabel, { fontSize: fs(9, { min: 8, max: 11 }) }]}>TODAY'S MISSION</Text>
              <ReadinessChip band={performance.readinessBand as 'GREEN' | 'AMBER' | 'RED'} size="sm" />
            </View>
            <Text style={[styles.heroMission, { color: dailyDecision.tone, fontSize: fs(19, { min: 15, max: 24 }) }]}>
              {dailyDecision.title}
            </Text>
            <Text style={[styles.heroDetail, { fontSize: fs(12, { min: 11, max: 14 }) }]}>
              {dailyDecision.detail}
            </Text>
            <Text style={[styles.heroCheckin, { fontSize: fs(10, { min: 9, max: 11 }) }]}>{checkInStatus}</Text>
          </View>
        </View>

        {/* Readiness progress bar */}
        <ProgressBar value={performance.readiness} colour={performance.readinessTone} height={5} />

        {/* Reason panel */}
        <View style={[styles.reasonPanel, { borderColor: `${dailyDecision.tone}40`, backgroundColor: `${dailyDecision.tone}0E` }]}>
          <View style={[styles.reasonIconBox, { backgroundColor: `${dailyDecision.tone}18` }]}>
            <Ionicons name={dailyDecision.icon} size={isTablet ? 22 : 18} color={dailyDecision.tone} />
          </View>
          <View style={styles.reasonCopy}>
            <Text style={[styles.reasonTitle, { color: dailyDecision.tone, fontSize: fs(12, { min: 11, max: 14 }) }]}>{dailyDecision.reason}</Text>
            <Text style={[styles.reasonDetail, { fontSize: fs(11, { min: 10, max: 13 }) }]}>{guidance}</Text>
          </View>
        </View>

        {/* AI coaching card */}
        {claudeCoaching && (
          <View style={[styles.claudeCard, { borderColor: `${claudeCoaching.tone}45`, backgroundColor: `${claudeCoaching.tone}0A` }]}>
            <View style={styles.claudeHeader}>
              <Ionicons name="sparkles" size={12} color={claudeCoaching.tone} />
              <Text style={[styles.claudeHeadline, { color: claudeCoaching.tone, fontSize: fs(12, { min: 11, max: 14 }) }]}>{claudeCoaching.headline}</Text>
            </View>
            <Text style={[styles.claudeBody, { fontSize: fs(12, { min: 11, max: 14 }) }]}>{claudeCoaching.body}</Text>
            <Text style={[styles.claudeAction, { fontSize: fs(11, { min: 10, max: 13 }) }]}>{claudeCoaching.action}</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: dailyDecision.tone }]}
            accessibilityLabel={dailyDecision.actionLabel}
            accessibilityRole="button"
            onPress={handleDecisionAction}
          >
            <Ionicons name={dailyDecision.icon} size={isTablet ? 20 : 18} color={colours.background} />
            <Text style={[styles.primaryButtonText, { fontSize: fs(13, { min: 12, max: 15 }) }]}>{dailyDecision.actionLabel}</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            accessibilityLabel="View analytics"
            accessibilityRole="button"
            onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); goToAnalytics(); }}
          >
            <Ionicons name="analytics" size={isTablet ? 20 : 18} color={colours.cyan} />
            <Text style={[styles.secondaryButtonText, { fontSize: fs(13, { min: 12, max: 15 }) }]}>{secondaryActionLabel}</Text>
          </Pressable>
        </View>

        {/* Recovery blockers */}
        <View style={[styles.blockerGrid, { gap: sp(6) }]}>
          {recoveryBlockers.map((item) => (
            <View key={item.label} style={[styles.blockerTile, item.flagged && styles.blockerTileFlagged]}>
              <Text style={[styles.blockerLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>{item.label.toUpperCase()}</Text>
              <Text style={[styles.blockerValue, { fontSize: fs(13, { min: 12, max: 15 }) }, item.flagged && styles.blockerValueFlagged]}>{item.value}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* ── Quick Actions ─────────────────────────────────────── */}
      <View style={[styles.quickActions, { gap: sp(8) }]}>
        {[
          { label: 'Train',    icon: 'barbell-outline' as const,    tone: colours.green,  onPress: goToTrain },
          { label: 'Ruck',     icon: 'footsteps-outline' as const,  tone: colours.amber,  onPress: goToRuck },
          { label: 'Fuel',     icon: 'restaurant-outline' as const, tone: colours.sand,   onPress: goToFuel },
          { label: 'Readiness',icon: 'body-outline' as const,       tone: colours.cyan,   onPress: goToReadiness },
        ].map((action) => (
          <Pressable
            key={action.label}
            style={({ pressed }) => [styles.quickActionBtn, { borderColor: `${action.tone}40`, backgroundColor: `${action.tone}10` }, pressed && { opacity: 0.7 }]}
            onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); action.onPress?.(); }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: `${action.tone}18` }]}>
              <Ionicons name={action.icon} size={isTablet ? 22 : 18} color={action.tone} />
            </View>
            <Text style={[styles.quickActionLabel, { color: action.tone, fontSize: fs(10, { min: 9, max: 12 }) }]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── 7-Day Activity Strip ──────────────────────────────── */}
      <Card>
        <View style={styles.stripHeader}>
          <Text style={[styles.sectionTitle, { fontSize: fs(14, { min: 12, max: 17 }) }]}>7-Day Activity</Text>
          <MiniTrendLine data={weeklyLoadSeries} width={64} height={24} color={colours.cyan} />
        </View>
        <View style={[styles.stripContainer, { height: isTablet ? 80 : 64, gap: sp(5) }]}>
          {weeklyLoadSeries.map((load, i) => {
            const isToday = i === 6;
            const barFraction = load > 0 ? Math.max(0.06, load / maxLoad) : 0;
            const barTone = load === 0 ? colours.borderSoft
              : load < 300 ? colours.loadLow
              : load < 600 ? colours.loadMod
              : colours.loadHigh;
            return (
              <View key={i} style={styles.stripDay}>
                <View style={styles.stripTrack}>
                  <View style={[styles.stripBar, {
                    height: `${Math.round(barFraction * 100)}%`,
                    backgroundColor: barTone,
                    opacity: isToday ? 1 : 0.65,
                    shadowColor: isToday ? barTone : 'transparent',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.7,
                    shadowRadius: 4,
                  }]} />
                </View>
                <Text style={[styles.stripLabel, { fontSize: fs(9, { min: 8, max: 10 }) }, isToday && styles.stripLabelToday]}>{dayLabels[i]}</Text>
                {isToday && <View style={[styles.stripTodayDot, { backgroundColor: colours.cyan }]} />}
              </View>
            );
          })}
        </View>
      </Card>

      {/* ── Load Risk + Metrics ───────────────────────────────── */}
      <Card>
        <Text style={[styles.sectionTitle, { fontSize: fs(14, { min: 12, max: 17 }), marginBottom: sp(10) }]}>Performance Status</Text>
        <LoadRiskMeter risk={performance.loadRisk as 'Low' | 'Moderate' | 'High'} acwr={acwrValue} />
        <View style={[styles.statRow, { gap: sp(8), marginTop: sp(12) }]}>
          <StatTile label="LOAD" value={String(performance.weeklyLoad)} sub="AU this week" icon="flame-outline" tone={performance.riskTone} />
          <StatTile label="ACWR" value={String(performance.acuteChronicRatio)} sub={acwrLabel} icon="analytics-outline" tone={acwrTone} />
          <StatTile label="RUCK" value={`${performance.ruckKm}km`} sub={`${performance.ruckLoadKg || '--'}kg avg`} icon="footsteps-outline" tone={colours.amber} />
          <StatTile label="RPE" value={performance.averageRpe ? performance.averageRpe.toFixed(1) : '--'} sub={`${performance.highIntensityCount} hard sessions`} icon="speedometer-outline" tone={colours.cyan} />
        </View>
      </Card>

      {/* ── Insight panel (sessions present) ─────────────────── */}
      {hasSessions && (
        <View style={styles.insightPanel}>
          <Ionicons name="bulb-outline" size={16} color={colours.cyan} />
          <Text style={[styles.insightText, { fontSize: fs(12, { min: 11, max: 14 }) }]}>
            {performance.readiness >= 75 ? 'Readiness is optimal. Ready for high-intensity work.' : 'Readiness is compromised. Prioritise recovery today.'}
            {performance.loadRisk === 'High' ? ' High load risk detected. Monitor strain.' : ''}
          </Text>
        </View>
      )}

      {/* ── Warning Banners ───────────────────────────────────── */}
      {warnings.map((w, i) => (
        <View key={i} style={[styles.warningBanner, { borderColor: `${w.tone}50`, backgroundColor: `${w.tone}0F` }]}>
          <View style={[styles.warningIconBox, { backgroundColor: `${w.tone}18` }]}>
            <Ionicons name={w.icon} size={15} color={w.tone} />
          </View>
          <Text style={[styles.warningText, { color: w.tone, fontSize: fs(12, { min: 11, max: 14 }) }]}>{w.text}</Text>
        </View>
      ))}

      {/* ── Assigned Workout ─────────────────────────────────── */}
      {assignedWorkout ? (
        <Card accent={assignedCompletedToday || assignedWorkout.status === 'completed' ? colours.green : colours.amber}>
          <View style={styles.assignedHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.assignedTopRow}>
                <Text style={[styles.heroLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>ASSIGNED WORKOUT</Text>
                <View style={[styles.assignedStatusBadge, (assignedCompletedToday || assignedWorkout.status === 'completed') && styles.assignedStatusDone]}>
                  <Text style={[styles.assignedStatusText, { fontSize: fs(9, { min: 8, max: 10 }) }, (assignedCompletedToday || assignedWorkout.status === 'completed') && styles.assignedStatusTextDone]}>
                    {assignedCompletedToday ? 'DONE TODAY' : assignedWorkout.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={[styles.assignedTitle, { fontSize: fs(18, { min: 15, max: 22 }) }]}>{assignedWorkout.title}</Text>
              <Text style={[styles.assignedMeta, { fontSize: fs(12, { min: 11, max: 13 }) }]}>
                {assignedWorkout.type} — {assignedCompletedToday ? 'completed today' : assignedWorkout.status}
              </Text>
            </View>
          </View>

          {assignedCompletedToday && assignedCompletion ? (
            <View style={[styles.completionSummary, { gap: sp(8) }]}>
              <View style={styles.completionStat}>
                <Text style={[styles.completionLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>DURATION</Text>
                <Text style={[styles.completionValue, { fontSize: fs(14, { min: 12, max: 16 }) }]}>{assignedCompletion.durationMinutes} min</Text>
              </View>
              <View style={styles.completionStat}>
                <Text style={[styles.completionLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>EFFORT</Text>
                <Text style={[styles.completionValue, { fontSize: fs(14, { min: 12, max: 16 }) }]}>{assignedCompletion.effort}</Text>
              </View>
            </View>
          ) : null}

          {!assignedCompletedToday && assignedWorkout.coachNote ? (
            <Text style={[styles.assignedNote, { fontSize: fs(12, { min: 11, max: 14 }) }]}>Coach note: {assignedWorkout.coachNote}</Text>
          ) : null}

          {!assignedCompletedToday && assignedWorkoutPreview.length ? (
            <View style={[styles.assignedExerciseList, { gap: sp(7) }]}>
              {assignedWorkoutPreview.map((exercise) => (
                <View key={exercise.exerciseId} style={styles.assignedExerciseRow}>
                  <View style={[styles.assignedExerciseDot, { backgroundColor: colours.cyan }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.assignedExerciseName, { fontSize: fs(13, { min: 12, max: 15 }) }]}>{exercise.name}</Text>
                    <Text style={[styles.assignedExerciseDose, { fontSize: fs(11, { min: 10, max: 12 }) }]}>{exercise.dose}</Text>
                  </View>
                  {exercise.coachPinned ? <Text style={[styles.assignedPinned, { fontSize: fs(9, { min: 8, max: 10 }) }]}>PINNED</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {assignedCompletedToday ? (
            <View style={[styles.postWorkoutActions, { gap: sp(8) }]}>
              <Pressable style={styles.assignedButton} accessibilityRole="button" onPress={handlePostWorkoutFuel}>
                <Ionicons name="restaurant-outline" size={16} color={colours.background} />
                <Text style={[styles.assignedButtonText, { fontSize: fs(13, { min: 12, max: 15 }) }]}>Open Fuel</Text>
              </Pressable>
              <Pressable style={styles.assignedSecondaryButton} accessibilityRole="button" onPress={handlePostWorkoutReadiness}>
                <Ionicons name="body-outline" size={16} color={colours.cyan} />
                <Text style={[styles.assignedSecondaryButtonText, { fontSize: fs(13, { min: 12, max: 15 }) }]}>Log Recovery</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.assignedButton, assignedWorkout.status === 'completed' && styles.assignedButtonDone]}
              accessibilityRole="button"
              onPress={handleAssignedWorkoutAction}
              disabled={assignedWorkout.status === 'completed'}
            >
              <Ionicons name={assignedWorkout.status === 'completed' ? 'checkmark-circle' : sessionTypeIcon(assignedWorkout.type)} size={16} color={assignedWorkout.status === 'completed' ? colours.green : colours.background} />
              <Text style={[styles.assignedButtonText, { fontSize: fs(13, { min: 12, max: 15 }) }, assignedWorkout.status === 'completed' && styles.assignedButtonTextDone]}>
                {assignedWorkout.status === 'completed' ? 'Completed — recover well' : 'Start Assigned'}
              </Text>
            </Pressable>
          )}
        </Card>
      ) : null}

      {/* ── H2F Domain Grid ───────────────────────────────────── */}
      <TacticalDivider label="H2F Domains" tone={colours.cyan} />
      <View style={[styles.domainGrid, { gap: sp(8) }]}>
        {domains.map((domain) => {
          const tone = domainTone(domain.status);
          const ic = statusColors(tone);
          const tappable = (domain.id === 'nutrition' && !!goToFuel) || ((domain.id === 'sleep' || domain.id === 'mental') && !!goToReadiness);
          return (
            <Pressable
              key={domain.id}
              style={({ pressed }) => [styles.domainCard, shadow.subtle, pressed && tappable && { opacity: 0.72 }]}
              onPress={() => domainPressHandler(domain.id)}
              disabled={!tappable}
            >
              {/* Top accent */}
              <View style={[styles.domainAccent, { backgroundColor: tone }]} />
              <View style={styles.domainHeader}>
                <View style={[styles.domainIconWrap, { backgroundColor: ic.bgMed, borderColor: ic.borderMed }]}>
                  <Ionicons name={domain.icon as keyof typeof Ionicons.glyphMap} size={12} color={tone} />
                </View>
                <View style={[styles.dot, { backgroundColor: tone }]} />
              </View>
              <Text style={[styles.domainLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>{domain.label}</Text>
              <Text style={[styles.domainValue, { color: domain.hasData ? tone : colours.muted, fontSize: fs(18, { min: 15, max: 22 }) }]}>{domain.value}</Text>
              <Text style={[styles.domainDetail, { fontSize: fs(10, { min: 9, max: 11 }) }]}>{domain.detail}</Text>
              {domain.actionLabel ? <Text style={[styles.domainAction, { fontSize: fs(9, { min: 8, max: 10 }) }]}>{domain.actionLabel}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {/* ── Loaded Movement ───────────────────────────────────── */}
      <Card accent={colours.cyan}>
        <Text style={[styles.sectionTitle, { fontSize: fs(15, { min: 13, max: 18 }) }]}>Loaded Movement</Text>
        <Text style={[styles.body, { fontSize: fs(13, { min: 12, max: 15 }) }]}>
          {Math.round(ruckWork)} estimated loaded exposure across all ruck sessions. Calculated from load, duration, and assumed field pace.
        </Text>
        <Pressable
          style={[styles.primaryButton, { marginTop: 14, backgroundColor: colours.cyan }]}
          accessibilityLabel="Open ruck calculator"
          accessibilityRole="button"
          onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); goToRuck(); }}
        >
          <Ionicons name="footsteps" size={isTablet ? 20 : 17} color={colours.background} />
          <Text style={[styles.primaryButtonText, { fontSize: fs(13, { min: 12, max: 15 }) }]}>Ruck Calculator</Text>
        </Pressable>
      </Card>

      {/* ── Training Distribution ─────────────────────────────── */}
      {hasSessions && typeDistributionData.length > 0 && (
        <Card>
          <Text style={[styles.sectionTitle, { fontSize: fs(15, { min: 13, max: 18 }) }]}>Training Distribution</Text>
          <Text style={[styles.mutedText, { fontSize: fs(11, { min: 10, max: 13 }), marginBottom: 10 }]}>By session type</Text>
          <PieChart
            data={typeDistributionData}
            width={screenWidth - 56}
            height={150}
            chartConfig={{ color: (opacity = 1) => `rgba(240, 242, 232, ${opacity})` }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="0"
            center={[8, 0]}
            absolute
          />
        </Card>
      )}

      {/* ── Recent Load ───────────────────────────────────────── */}
      <View style={styles.recentHeader}>
        <Text style={[styles.sectionTitle, { fontSize: fs(15, { min: 13, max: 18 }) }]}>Recent Load</Text>
        <Pressable style={styles.viewAllBtn} onPress={goToAnalytics}>
          <Text style={[styles.viewAllText, { fontSize: fs(12, { min: 11, max: 13 }) }]}>View all</Text>
          <Ionicons name="chevron-forward" size={13} color={colours.cyan} />
        </Pressable>
      </View>

      {recentSessions.length ? (
        recentSessions.map((session) => {
          const sessionTone = statusColors(colours.cyan);
          return (
            <View key={session.id} style={[styles.sessionRow, shadow.subtle]}>
              <View style={[styles.sessionIcon, { backgroundColor: sessionTone.bgMed, borderColor: sessionTone.borderMed }]}>
                <Ionicons name={sessionTypeIcon(session.type)} size={15} color={colours.cyan} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sessionTitle, { fontSize: fs(13, { min: 12, max: 15 }) }]}>{session.title}</Text>
                <Text style={[styles.sessionMeta, { fontSize: fs(11, { min: 10, max: 12 }) }]}>
                  {[session.type, `${session.durationMinutes}m`, `RPE ${session.rpe}`, sessionDateLabel(session.completedAt)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.sessionScore}>
                <Text style={[styles.scoreValue, { fontSize: fs(18, { min: 15, max: 22 }) }]}>{session.score}</Text>
                <Text style={[styles.scoreLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>PTS</Text>
              </View>
            </View>
          );
        })
      ) : (
        <View style={[styles.sessionRow, shadow.subtle]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sessionTitle, { fontSize: fs(13, { min: 12, max: 15 }) }]}>No training logged yet</Text>
            <Text style={[styles.sessionMeta, { fontSize: fs(11, { min: 10, max: 12 }) }]}>Start with a ruck or strength block to populate your log.</Text>
          </View>
        </View>
      )}

    </Screen>
  );
}

const styles = StyleSheet.create({
  // ── Header ─────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  kicker: {
    color: colours.cyan,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colours.text,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 3,
    lineHeight: undefined,
  },
  noCheckIn: {
    color: colours.amber,
    fontWeight: '700',
    marginTop: 4,
  },
  opsecBadge: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colours.cyanDim,
  },
  opsecText: {
    color: colours.cyan,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ── Hero card ──────────────────────────────────────────────
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  heroRingWrap: {
    flexShrink: 0,
  },
  heroCopy: {
    flex: 1,
    gap: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  heroLabel: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  heroMission: {
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: undefined,
  },
  heroDetail: {
    color: colours.textSoft,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  heroCheckin: {
    color: colours.muted,
    fontWeight: '700',
    marginTop: 4,
  },

  // ── Reason panel ───────────────────────────────────────────
  reasonPanel: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reasonIconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reasonCopy: {
    flex: 1,
    gap: 3,
  },
  reasonTitle: {
    fontWeight: '800',
    lineHeight: 17,
  },
  reasonDetail: {
    color: colours.textSoft,
    fontWeight: '700',
    lineHeight: 16,
  },

  // ── Claude card ────────────────────────────────────────────
  claudeCard: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 12,
    marginTop: 10,
    gap: 5,
  },
  claudeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  claudeHeadline: {
    fontWeight: '900',
    flex: 1,
    letterSpacing: 0.2,
  },
  claudeBody: {
    color: colours.text,
    fontWeight: '800',
    lineHeight: 18,
  },
  claudeAction: {
    color: colours.textSoft,
    fontWeight: '700',
    lineHeight: 16,
  },

  // ── Action buttons ─────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  primaryButton: {
    minHeight: touchTarget,
    flex: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  primaryButtonText: {
    color: colours.background,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    minHeight: touchTarget,
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colours.borderHot,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    backgroundColor: colours.cyanDim,
  },
  secondaryButtonText: {
    color: colours.cyan,
    fontWeight: '900',
  },

  // ── Recovery blockers ──────────────────────────────────────
  blockerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  blockerTile: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: radius.xs,
    padding: 9,
    backgroundColor: colours.layer1,
  },
  blockerTileFlagged: {
    borderColor: `${colours.amber}50`,
    backgroundColor: `${colours.amber}0D`,
  },
  blockerLabel: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  blockerValue: {
    color: colours.text,
    fontWeight: '900',
    marginTop: 3,
  },
  blockerValueFlagged: {
    color: colours.amber,
  },

  // ── Quick actions ──────────────────────────────────────────
  quickActions: {
    flexDirection: 'row',
  },
  quickActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 7,
    minHeight: 72,
    justifyContent: 'center',
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  // ── Activity strip ─────────────────────────────────────────
  stripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stripContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 4,
  },
  stripDay: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  stripTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: radius.xs,
    overflow: 'hidden',
    backgroundColor: colours.borderSoft,
  },
  stripBar: {
    width: '100%',
    borderRadius: radius.xs,
    minHeight: 3,
  },
  stripLabel: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stripLabelToday: {
    color: colours.cyan,
  },
  stripTodayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // ── Metrics row ────────────────────────────────────────────
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // ── Insight panel ──────────────────────────────────────────
  insightPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colours.cyanDim,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: radius.sm,
    padding: 12,
  },
  insightText: {
    color: colours.cyan,
    flex: 1,
    lineHeight: 17,
    fontWeight: '800',
  },

  // ── Warning banners ────────────────────────────────────────
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  warningIconBox: {
    width: 30,
    height: 30,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  warningText: {
    flex: 1,
    fontWeight: '700',
    lineHeight: 16,
  },

  // ── Assigned workout ───────────────────────────────────────
  assignedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  assignedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  assignedTitle: {
    color: colours.text,
    fontWeight: '900',
    marginTop: 2,
  },
  assignedMeta: {
    color: colours.textSoft,
    fontWeight: '700',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  assignedStatusBadge: {
    borderWidth: 1,
    borderColor: `${colours.amber}50`,
    borderRadius: radius.xs,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: `${colours.amber}12`,
  },
  assignedStatusDone: {
    borderColor: `${colours.green}50`,
    backgroundColor: `${colours.green}12`,
  },
  assignedStatusText: {
    color: colours.amber,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  assignedStatusTextDone: {
    color: colours.green,
  },
  assignedNote: {
    color: colours.textSoft,
    lineHeight: 18,
    marginTop: 12,
    fontWeight: '700',
  },
  completionSummary: {
    flexDirection: 'row',
    marginTop: 12,
  },
  completionStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: `${colours.green}35`,
    borderRadius: radius.xs,
    padding: 10,
    backgroundColor: `${colours.green}0D`,
  },
  completionLabel: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  completionValue: {
    color: colours.green,
    fontWeight: '900',
    marginTop: 3,
  },
  assignedExerciseList: {
    marginTop: 12,
  },
  assignedExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: radius.xs,
    padding: 10,
    backgroundColor: colours.layer1,
  },
  assignedExerciseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  assignedExerciseName: {
    color: colours.text,
    fontWeight: '900',
  },
  assignedExerciseDose: {
    color: colours.muted,
    fontWeight: '700',
    marginTop: 2,
  },
  assignedPinned: {
    color: colours.amber,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  assignedButton: {
    minHeight: touchTarget,
    flex: 1,
    borderRadius: radius.sm,
    backgroundColor: colours.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: 14,
  },
  assignedButtonDone: {
    borderWidth: 1,
    borderColor: `${colours.green}50`,
    backgroundColor: `${colours.green}10`,
  },
  assignedButtonText: {
    color: colours.background,
    fontWeight: '900',
  },
  assignedButtonTextDone: {
    color: colours.green,
  },
  postWorkoutActions: {
    flexDirection: 'row',
    marginTop: 14,
  },
  assignedSecondaryButton: {
    minHeight: touchTarget,
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colours.borderHot,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    backgroundColor: colours.cyanDim,
  },
  assignedSecondaryButtonText: {
    color: colours.cyan,
    fontWeight: '900',
  },

  // ── Domain grid ────────────────────────────────────────────
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  domainCard: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: radius.sm,
    padding: 12,
    backgroundColor: colours.surface,
    gap: 2,
    overflow: 'hidden',
  },
  domainAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.6,
  },
  domainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 4,
  },
  domainIconWrap: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  domainLabel: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  domainValue: {
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  domainDetail: {
    color: colours.textSoft,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 2,
  },
  domainAction: {
    color: colours.cyan,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 5,
    textTransform: 'uppercase',
  },

  // ── Section headers & misc ─────────────────────────────────
  sectionTitle: {
    color: colours.text,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  body: {
    color: colours.textSoft,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
  },
  mutedText: {
    color: colours.muted,
    fontWeight: '700',
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    color: colours.cyan,
    fontWeight: '700',
  },
  sessionRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: radius.sm,
    padding: 12,
    backgroundColor: colours.surface,
  },
  sessionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionTitle: {
    color: colours.text,
    fontWeight: '900',
  },
  sessionMeta: {
    color: colours.muted,
    fontWeight: '700',
    marginTop: 2,
  },
  sessionScore: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    color: colours.cyan,
    fontWeight: '900',
  },
  scoreLabel: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
