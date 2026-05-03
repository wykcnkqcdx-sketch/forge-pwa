import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { buildPerformanceProfile, buildWeeklyLoadSeries, PerformanceProfile, sortSessionsByDate } from '../lib/performance';
import { buildH2FDomains, buildPrescriptiveGuidance } from '../lib/h2f';
import { getLatestReadinessLog, isReadinessStale } from '../lib/readiness';
import { colours, touchTarget } from '../theme';
import { SquadMember, TrainingSession } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';
import { distanceBetween } from '../utils/mapUtils';

function domainTone(status: 'GREEN' | 'AMBER' | 'RED') {
  if (status === 'GREEN') return colours.green;
  if (status === 'AMBER') return colours.amber;
  return colours.red;
}

function sessionTypeIcon(type: TrainingSession['type']): keyof typeof Ionicons.glyphMap {
  if (type === 'Ruck') return 'footsteps-outline';
  if (type === 'Strength') return 'barbell-outline';
  if (type === 'Cardio') return 'heart-outline';
  if (type === 'Mobility') return 'body-outline';
  if (type === 'Resistance') return 'fitness-outline';
  if (type === 'Run') return 'walk-outline';
  if (type === 'Workout') return 'fitness-outline';
  return 'flash-outline';
}

function isSameLocalDay(dateIso: string | undefined, day: Date) {
  if (!dateIso) return false;
  return new Date(dateIso).toDateString() === day.toDateString();
}

function estimateRuckDistanceKm(session: TrainingSession) {
  if (session.routePoints && session.routePoints.length > 1) {
    return session.routePoints.slice(1).reduce((total, point, index) => (
      total + distanceBetween(session.routePoints![index], point)
    ), 0);
  }

  const titleDistance = session.title.match(/([\d.]+)\s*km/i)?.[1];
  return titleDistance ? Number(titleDistance) : session.ruckMission?.targetDistanceKm ?? 0;
}

function readinessActionLabel(band: 'GREEN' | 'AMBER' | 'RED', loadRisk: 'Low' | 'Moderate' | 'High') {
  if (band === 'RED' || loadRisk === 'High') return 'Recover';
  if (loadRisk === 'Moderate') return 'Reduce';
  if (band === 'AMBER') return 'Maintain';
  return 'Push';
}

function buildDailyReadinessDecision(performance: PerformanceProfile, readiness?: ReadinessLog) {
  const flags: string[] = [];
  let score = performance.readiness;

  if (readiness?.sleepHours !== undefined && readiness.sleepHours < 6) {
    score -= 12;
    flags.push('sleep below target');
  }
  if ((readiness?.soreness ?? 0) >= 4) {
    score -= 10;
    flags.push('high soreness');
  }
  if ((readiness?.pain ?? 0) >= 3) {
    score -= 14;
    flags.push('pain reported');
  }
  if ((readiness?.illness ?? 0) >= 3) {
    score -= 18;
    flags.push('illness reported');
  }
  if (readiness?.hydration === 'Poor') {
    score -= 8;
    flags.push('poor hydration');
  }
  if ((readiness?.stress ?? 0) >= 4) {
    score -= 6;
    flags.push('high stress');
  }

  const readinessScore = Math.max(25, Math.min(96, Math.round(score)));
  const band = readinessScore >= 80 ? 'GREEN' : readinessScore >= 62 ? 'AMBER' : 'RED';
  const tone = band === 'GREEN' ? colours.green : band === 'AMBER' ? colours.amber : colours.red;
  const action = readinessActionLabel(band, performance.loadRisk);

  return {
    score: readinessScore,
    band,
    tone,
    action,
    explanation: flags.length
      ? `Readiness adjusted for ${flags.slice(0, 3).join(', ')}.`
      : 'Readiness is based on recent load and today\'s check-in.',
  };
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
  const dailyReadiness = useMemo(
    () => buildDailyReadinessDecision(performance, latestReadiness),
    [performance, latestReadiness],
  );
  const ruckWork = sessions
    .filter((s) => s.type === 'Ruck')
    .reduce((total, s) => total + (s.loadKg ?? 0) * (s.durationMinutes / 60) * 5.2, 0);

  const recentSessions = sortSessionsByDate(sessions).slice(0, 3);
  const latestRuck = sortSessionsByDate(sessions).find((session) => session.type === 'Ruck');
  const latestRuckDistance = latestRuck ? estimateRuckDistanceKm(latestRuck) : 0;

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
      list.push({ tone: colours.amber, icon: 'body-outline', text: 'No readiness check-in yet - log today to unlock sleep and recovery guidance' });
    } else if (readinessIsStale) {
      list.push({ tone: colours.amber, icon: 'time-outline', text: 'Readiness check-in is stale - log today before acting on recovery signals' });
    }
    if (performance.monotony > 2.0) {
      list.push({ tone: colours.amber, icon: 'warning-outline', text: `Monotony elevated (${performance.monotony.toFixed(1)}) - vary training type` });
    }
    if (latestReadiness?.sleepHours !== undefined && latestReadiness.sleepHours < 6) {
      list.push({ tone: colours.amber, icon: 'moon-outline', text: 'Low sleep flagged - limit high-intensity work today' });
    }
    if (latestReadiness?.hydration === 'Poor') {
      list.push({ tone: colours.red, icon: 'water-outline', text: 'Hydration poor - address before training' });
    }
    return list;
  }, [performance.monotony, latestReadiness, latestStoredReadiness, readinessIsStale]);

  const recoveryBlockers = useMemo(() => {
    const blockers = [
      {
        label: 'Sleep',
        value: latestReadiness?.sleepHours !== undefined ? `${latestReadiness.sleepHours}h` : '--',
        flagged: latestReadiness?.sleepHours !== undefined ? latestReadiness.sleepHours < 6 : needsReadinessCheckIn,
      },
      {
        label: 'Soreness',
        value: latestReadiness?.soreness ? `${latestReadiness.soreness}/5` : '--',
        flagged: (latestReadiness?.soreness ?? 0) >= 4,
      },
      {
        label: 'Hydration',
        value: latestReadiness?.hydration ?? '--',
        flagged: latestReadiness?.hydration === 'Poor',
      },
      {
        label: 'Stress',
        value: latestReadiness?.stress ? `${latestReadiness.stress}/5` : '--',
        flagged: (latestReadiness?.stress ?? 0) >= 4,
      },
    ];
    return blockers;
  }, [latestReadiness, needsReadinessCheckIn]);

  // Recommended session
  const recommendedSession = useMemo(() => {
    if (dailyReadiness.band === 'RED' || performance.loadRisk === 'High') {
      return {
        title: 'Mobility & Recovery',
        detail: '20–30 min · Low intensity · Focus on tissue care',
        reason: performance.loadRisk === 'High' ? 'High load risk. Bring stress down before another hard block.' : 'Readiness is red. Recovery quality matters most today.',
        actionLabel: 'Open Recovery',
        icon: 'body-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.red,
        goTo: goToTrain,
      };
    }
    if (dailyReadiness.band === 'AMBER' || performance.loadRisk === 'Moderate') {
      return {
        title: 'Zone 2 Aerobic',
        detail: '40 min · Heart rate 130–145 bpm · Steady effort',
        reason: 'Readiness is usable, but load needs control. Keep the session aerobic.',
        actionLabel: 'Start Training',
        icon: 'heart-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.amber,
        goTo: goToTrain,
      };
    }
    const now = new Date();
    const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const hasRuckThisWeek = sessions.some((s) => s.type === 'Ruck' && s.completedAt && new Date(s.completedAt).getTime() >= weekAgo);
    if (!hasRuckThisWeek) {
      return {
        title: 'Ruck Intervals',
        detail: '60 min · 25–30kg load · Varied pace',
        reason: 'Readiness is green and no ruck is logged this week.',
        actionLabel: 'Start Ruck',
        icon: 'footsteps-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.green,
        goTo: goToRuck,
      };
    }
    return {
      title: 'Strength Block',
      detail: '45 min · Compound movements · RPE 7–8',
      reason: 'Readiness is green. Build quality work without adding junk volume.',
      actionLabel: 'Start Training',
      icon: 'barbell-outline' as keyof typeof Ionicons.glyphMap,
      tone: colours.green,
      goTo: goToTrain,
    };
  }, [dailyReadiness.band, performance.loadRisk, sessions, goToTrain, goToRuck]);

  const dailyDecision = useMemo(() => {
    if (needsReadinessCheckIn && goToReadiness) {
      return {
        title: 'Log readiness',
        detail: 'Fresh check-in unlocks sleep, mood, soreness, and hydration guidance.',
        reason: latestStoredReadiness ? 'Last readiness check-in is stale.' : 'No readiness check-in is logged yet.',
        actionLabel: 'Log Readiness',
        icon: 'body-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.amber,
        goTo: goToReadiness,
      };
    }
    if (assignedCompletedToday && assignedCompletion) {
      return {
        title: 'Recover from today',
        detail: `${assignedCompletion.assignment} completed in ${assignedCompletion.durationMinutes} min.`,
        reason: `Effort was ${assignedCompletion.effort.toLowerCase()}. Prioritise fuel, hydration, and recovery markers now.`,
        actionLabel: 'Open Fuel',
        icon: 'restaurant-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.green,
        goTo: goToFuel,
      };
    }
    if (member?.assignmentSession && member.assignmentSession.status !== 'completed' && dailyReadiness.band !== 'RED' && performance.loadRisk !== 'High') {
      return {
        title: member.assignmentSession.title,
        detail: member.assignmentSession.coachNote ?? `${member.assignmentSession.type} assigned by coach.`,
        reason: `${checkInStatus}. Assigned session is ready to execute.`,
        actionLabel: 'Start Assigned',
        icon: sessionTypeIcon(member.assignmentSession.type),
        tone: dailyReadiness.band === 'AMBER' || performance.loadRisk === 'Moderate' ? colours.amber : colours.green,
        goTo: goToTrain,
      };
    }
    return recommendedSession;
  }, [assignedCompletedToday, assignedCompletion, checkInStatus, dailyReadiness.band, goToFuel, goToReadiness, goToTrain, latestStoredReadiness, member, needsReadinessCheckIn, performance.loadRisk, recommendedSession]);

  function domainPressHandler(domainId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (domainId === 'nutrition') goToFuel?.();
    if (domainId === 'sleep' || domainId === 'mental') goToReadiness?.();
  }

  function handleDecisionAction() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dailyDecision.goTo?.();
  }

  function handleAssignedWorkoutAction() {
    if (!assignedWorkout || assignedWorkout.status === 'completed' || assignedCompletedToday) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    goToTrain?.();
  }

  function handlePostWorkoutFuel() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToFuel?.();
  }

  function handlePostWorkoutReadiness() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToReadiness?.();
  }

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{today.toUpperCase()}</Text>
          <Text style={styles.title}>{displayName ? `${displayName}'s Today` : 'Today'}</Text>
          {!hasSessionToday && (
            <Text style={styles.noCheckIn}>No training logged today</Text>
          )}
        </View>
        <View style={styles.opsecBadge}>
          <Ionicons name="shield-checkmark" size={16} color={colours.cyan} />
          <Text style={styles.opsecText}>Offline · Private</Text>
        </View>
      </View>

      {/* 7-day activity strip */}
      <View style={styles.stripContainer}>
        {weeklyLoadSeries.map((load, i) => {
          const isToday = i === 6;
          const barFraction = load > 0 ? Math.max(0.08, load / maxLoad) : 0;
          const barTone = load === 0 ? colours.borderSoft
            : load < 300 ? colours.green
            : load < 600 ? colours.amber
            : colours.red;
          return (
            <View key={i} style={styles.stripDay}>
              <View style={styles.stripTrack}>
                <View style={[styles.stripBar, { height: `${Math.round(barFraction * 100)}%`, backgroundColor: barTone, opacity: isToday ? 1 : 0.72 }]} />
              </View>
              <Text style={[styles.stripLabel, isToday && styles.stripLabelToday]}>{dayLabels[i]}</Text>
              {isToday && <View style={styles.stripTodayDot} />}
            </View>
          );
        })}
      </View>

      {/* Daily decision */}
      <Card hot>
        <View style={styles.decisionHeader}>
          <View style={styles.readinessPuck}>
            <Text style={styles.label}>READINESS</Text>
            <Text style={[styles.readinessValue, { color: dailyReadiness.tone }]}>{dailyReadiness.score}</Text>
            <Text style={[styles.statusBand, { color: dailyReadiness.tone }]}>{dailyReadiness.action}</Text>
          </View>
          <View style={styles.decisionCopy}>
            <Text style={styles.label}>TRAINING DECISION</Text>
            <Text style={[styles.decisionTitle, { color: dailyDecision.tone }]}>{dailyDecision.title}</Text>
            <Text style={styles.decisionDetail}>{dailyDecision.detail}</Text>
            <Text style={styles.checkInStamp}>{checkInStatus}</Text>
          </View>
        </View>

        <ProgressBar value={dailyReadiness.score} colour={dailyReadiness.tone} />

        <View style={[styles.reasonPanel, { borderColor: `${dailyDecision.tone}55`, backgroundColor: `${dailyDecision.tone}12` }]}>
          <View style={[styles.reasonIcon, { backgroundColor: `${dailyDecision.tone}22` }]}>
            <Ionicons name={dailyDecision.icon} size={20} color={dailyDecision.tone} />
          </View>
          <View style={styles.reasonCopy}>
            <Text style={[styles.reasonTitle, { color: dailyDecision.tone }]}>{dailyDecision.reason}</Text>
            <Text style={styles.reasonDetail}>{dailyReadiness.explanation} {guidance}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.primaryButton}
            accessibilityLabel={dailyDecision.actionLabel}
            accessibilityRole="button"
            onPress={handleDecisionAction}
          >
            <Ionicons name={dailyDecision.icon} size={20} color={colours.background} />
            <Text style={styles.primaryButtonText}>{dailyDecision.actionLabel}</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            accessibilityLabel="View analytics"
            accessibilityRole="button"
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); goToAnalytics(); }}
          >
            <Ionicons name="analytics" size={20} color={colours.cyan} />
            <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.blockerGrid}>
          {recoveryBlockers.map((item) => (
            <View key={item.label} style={[styles.blockerTile, item.flagged && styles.blockerTileFlagged]}>
              <Text style={styles.blockerLabel}>{item.label}</Text>
              <Text style={[styles.blockerValue, item.flagged && styles.blockerValueFlagged]}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.signalHeader}>
          <Text style={styles.signalTitle}>Readiness Signals</Text>
          <Text style={styles.signalSubtitle}>Details</Text>
        </View>
        <View style={styles.commandGrid}>
          <View style={styles.commandTile}>
            <Text style={styles.commandLabel}>LOAD</Text>
            <Text style={[styles.commandValue, { color: performance.riskTone }]}>{performance.loadRisk}</Text>
            <Text style={styles.commandSub}>{performance.weeklyLoad} AU</Text>
          </View>
          <View style={styles.commandTile}>
            <Text style={styles.commandLabel}>ACWR</Text>
            <Text style={[styles.commandValue, { color: acwrTone }]}>{performance.acuteChronicRatio}</Text>
            <Text style={styles.commandSub}>{acwrLabel}</Text>
          </View>
          <View style={styles.commandTile}>
            <Text style={styles.commandLabel}>RUCK</Text>
            <Text style={styles.commandValue}>{performance.ruckKm}km</Text>
            <Text style={styles.commandSub}>{performance.ruckLoadKg || '--'}kg avg</Text>
          </View>
          <View style={styles.commandTile}>
            <Text style={styles.commandLabel}>RPE</Text>
            <Text style={styles.commandValue}>{performance.averageRpe ? performance.averageRpe.toFixed(1) : '--'}</Text>
            <Text style={styles.commandSub}>{performance.highIntensityCount} hard</Text>
          </View>
        </View>
      </Card>

      {/* Warning banners */}
      {warnings.map((w, i) => (
        <View key={i} style={[styles.warningBanner, { borderColor: `${w.tone}55`, backgroundColor: `${w.tone}12` }]}>
          <Ionicons name={w.icon} size={16} color={w.tone} />
          <Text style={[styles.warningText, { color: w.tone }]}>{w.text}</Text>
        </View>
      ))}

      {assignedWorkout ? (
        <Card accent={assignedCompletedToday || assignedWorkout.status === 'completed' ? colours.green : colours.amber}>
          <View style={styles.assignedHeader}>
            <View style={styles.assignedTitleBlock}>
              <Text style={styles.label}>ASSIGNED WORKOUT</Text>
              <Text style={styles.assignedTitle}>{assignedWorkout.title}</Text>
              <Text style={styles.assignedMeta}>
                {assignedWorkout.type} - {assignedCompletedToday ? 'completed today' : assignedWorkout.status}
              </Text>
            </View>
            <View style={[styles.assignedStatusBadge, (assignedCompletedToday || assignedWorkout.status === 'completed') && styles.assignedStatusDone]}>
              <Text style={[styles.assignedStatusText, (assignedCompletedToday || assignedWorkout.status === 'completed') && styles.assignedStatusTextDone]}>
                {assignedCompletedToday ? 'DONE TODAY' : assignedWorkout.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {assignedCompletedToday && assignedCompletion ? (
            <View style={styles.completionSummary}>
              <View style={styles.completionStat}>
                <Text style={styles.completionLabel}>DURATION</Text>
                <Text style={styles.completionValue}>{assignedCompletion.durationMinutes} min</Text>
              </View>
              <View style={styles.completionStat}>
                <Text style={styles.completionLabel}>EFFORT</Text>
                <Text style={styles.completionValue}>{assignedCompletion.effort}</Text>
              </View>
            </View>
          ) : null}

          {!assignedCompletedToday && assignedWorkout.coachNote ? (
            <Text style={styles.assignedNote}>Coach note: {assignedWorkout.coachNote}</Text>
          ) : null}

          {!assignedCompletedToday && assignedWorkoutPreview.length ? (
            <View style={styles.assignedExerciseList}>
              {assignedWorkoutPreview.map((exercise) => (
                <View key={exercise.exerciseId} style={styles.assignedExerciseRow}>
                  <View style={styles.assignedExerciseDot} />
                  <View style={styles.assignedExerciseCopy}>
                    <Text style={styles.assignedExerciseName}>{exercise.name}</Text>
                    <Text style={styles.assignedExerciseDose}>{exercise.dose}</Text>
                  </View>
                  {exercise.coachPinned ? <Text style={styles.assignedPinned}>PINNED</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {assignedCompletedToday ? (
            <View style={styles.postWorkoutActions}>
              <Pressable
                style={styles.assignedButton}
                accessibilityRole="button"
                accessibilityLabel="Open fuel after completed workout"
                onPress={handlePostWorkoutFuel}
              >
                <Ionicons name="restaurant-outline" size={18} color={colours.background} />
                <Text style={styles.assignedButtonText}>Open Fuel</Text>
              </Pressable>
              <Pressable
                style={styles.assignedSecondaryButton}
                accessibilityRole="button"
                accessibilityLabel="Log recovery readiness after completed workout"
                onPress={handlePostWorkoutReadiness}
              >
                <Ionicons name="body-outline" size={18} color={colours.cyan} />
                <Text style={styles.assignedSecondaryButtonText}>Log Recovery</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.assignedButton, assignedWorkout.status === 'completed' && styles.assignedButtonDone]}
              accessibilityRole="button"
              accessibilityLabel={assignedWorkout.status === 'completed' ? 'Assigned workout completed' : 'Start assigned workout'}
              onPress={handleAssignedWorkoutAction}
              disabled={assignedWorkout.status === 'completed'}
            >
              <Ionicons
                name={assignedWorkout.status === 'completed' ? 'checkmark-circle' : sessionTypeIcon(assignedWorkout.type)}
                size={18}
                color={assignedWorkout.status === 'completed' ? colours.green : colours.background}
              />
              <Text style={[styles.assignedButtonText, assignedWorkout.status === 'completed' && styles.assignedButtonTextDone]}>
                {assignedWorkout.status === 'completed' ? 'Completed - recover well' : 'Start Assigned'}
              </Text>
            </Pressable>
          )}
        </Card>
      ) : null}

      {/* H2F Domain grid */}
      <View style={styles.domainGrid}>
        {domains.map((domain) => {
          const tone = domainTone(domain.status);
          const tappable = (domain.id === 'nutrition' && !!goToFuel) || ((domain.id === 'sleep' || domain.id === 'mental') && !!goToReadiness);
          return (
            <Pressable
              key={domain.id}
              style={({ pressed }) => [styles.domainCard, pressed && tappable && { opacity: 0.75 }]}
              onPress={() => domainPressHandler(domain.id)}
              disabled={!tappable}
            >
              {/* Card header: icon left, status dot right */}
              <View style={styles.domainHeader}>
                <View style={[styles.domainIconWrap, { backgroundColor: `${tone}18`, borderColor: `${tone}28` }]}>
                  <Ionicons
                    name={domain.icon as keyof typeof Ionicons.glyphMap}
                    size={13}
                    color={tone}
                  />
                </View>
                <View style={[styles.dot, { backgroundColor: tone }]} />
              </View>

              {/* Label + value */}
              <Text style={styles.domainLabel}>{domain.label}</Text>
              <Text style={[styles.domainValue, { color: domain.hasData ? tone : colours.muted }]}>
                {domain.value}
              </Text>
              <Text style={styles.domainDetail}>{domain.detail}</Text>

              {/* Action affordance for empty or navigable states */}
              {domain.actionLabel ? (
                <Text style={styles.domainAction}>{domain.actionLabel}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Loaded Movement */}
      <Card accent={colours.cyan}>
        <Text style={styles.sectionTitle}>Loaded Movement</Text>
        <Text style={styles.body}>
          {Math.round(ruckWork)} estimated loaded exposure across all ruck sessions. Calculated from load, duration, and assumed field pace.
        </Text>
        <Pressable
          style={[styles.primaryButton, { marginTop: 14 }]}
          accessibilityLabel="Open ruck calculator"
          accessibilityRole="button"
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); goToRuck(); }}
        >
          <Ionicons name="footsteps" size={20} color={colours.background} />
          <Text style={styles.primaryButtonText}>Ruck Calculator</Text>
        </Pressable>
      </Card>

      {latestRuck ? (
        <Card accent={latestRuck.routeConfidence === 'Low' ? colours.red : latestRuck.routeConfidence === 'Medium' ? colours.amber : colours.green}>
          <View style={styles.lastRuckHeader}>
            <View>
              <Text style={styles.sectionTitle}>Last Ruck</Text>
              <Text style={styles.body}>{latestRuck.title}</Text>
            </View>
            <View style={styles.lastRuckBadge}>
              <Text style={styles.lastRuckBadgeText}>{latestRuck.routeConfidence ?? 'Manual'}</Text>
            </View>
          </View>
          <View style={styles.lastRuckGrid}>
            <View style={styles.lastRuckMetric}>
              <Text style={styles.lastRuckValue}>{latestRuckDistance ? latestRuckDistance.toFixed(2) : '--'}km</Text>
              <Text style={styles.lastRuckLabel}>Distance</Text>
            </View>
            <View style={styles.lastRuckMetric}>
              <Text style={styles.lastRuckValue}>{latestRuck.loadKg ?? 0}kg</Text>
              <Text style={styles.lastRuckLabel}>Load</Text>
            </View>
            <View style={styles.lastRuckMetric}>
              <Text style={styles.lastRuckValue}>{latestRuck.durationMinutes}m</Text>
              <Text style={styles.lastRuckLabel}>Time</Text>
            </View>
            <View style={styles.lastRuckMetric}>
              <Text style={styles.lastRuckValue}>
                {latestRuckDistance ? (latestRuck.durationMinutes / latestRuckDistance).toFixed(1) : '--'}
              </Text>
              <Text style={styles.lastRuckLabel}>Min/km</Text>
            </View>
          </View>
          <Text style={styles.lastRuckQuality}>
            {latestRuck.averageAccuracyMeters ? `GPS average +/-${latestRuck.averageAccuracyMeters}m` : 'No GPS accuracy saved'}
            {latestRuck.rejectedPointCount != null ? ` | ${latestRuck.rejectedPointCount} rejected point${latestRuck.rejectedPointCount === 1 ? '' : 's'}` : ''}
          </Text>
          <Pressable
            style={[styles.secondaryButton, { marginTop: 12 }]}
            accessibilityLabel="Open ruck history"
            accessibilityRole="button"
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); goToRuck(); }}
          >
            <Ionicons name="list" size={18} color={colours.cyan} />
            <Text style={styles.secondaryButtonText}>Open Ruck History</Text>
          </Pressable>
        </Card>
      ) : null}

      {/* Recent Load */}
      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>Recent Load</Text>
        <Pressable style={styles.viewAllBtn} onPress={goToAnalytics}>
          <Text style={styles.viewAllText}>View all</Text>
          <Ionicons name="chevron-forward" size={13} color={colours.cyan} />
        </Pressable>
      </View>

      {recentSessions.length ? (
        recentSessions.map((session) => (
          <View key={session.id} style={styles.sessionRow}>
            <View style={styles.sessionIcon}>
              <Ionicons name={sessionTypeIcon(session.type)} size={16} color={colours.cyan} />
            </View>
            <View style={styles.sessionCopy}>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Text style={styles.sessionMeta}>{session.type} · {session.durationMinutes} min · RPE {session.rpe}</Text>
            </View>
            <View style={styles.sessionScore}>
              <Text style={styles.scoreValue}>{session.score}</Text>
              <Text style={styles.scoreLabel}>PTS</Text>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.sessionRow}>
          <View style={styles.sessionCopy}>
            <Text style={styles.sessionTitle}>No training logged yet</Text>
            <Text style={styles.sessionMeta}>Start with a ruck or strength block to populate your log.</Text>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  kicker: {
    color: colours.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: colours.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  noCheckIn: {
    color: colours.amber,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  opsecBadge: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colours.cyanDim,
    flexShrink: 0,
  },
  opsecText: {
    color: colours.cyan,
    fontSize: 11,
    fontWeight: '900',
  },
  decisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  readinessPuck: {
    width: 104,
    minHeight: 116,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingVertical: 10,
  },
  decisionCopy: {
    flex: 1,
  },
  decisionTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  decisionDetail: {
    color: colours.textSoft,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 4,
  },
  checkInStamp: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 8,
  },
  readinessValue: {
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '900',
  },
  statusBand: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  label: {
    color: colours.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  body: {
    color: colours.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  reasonPanel: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reasonIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonCopy: {
    flex: 1,
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  reasonDetail: {
    color: colours.textSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  commandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  signalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  signalTitle: {
    color: colours.text,
    fontSize: 13,
    fontWeight: '900',
  },
  signalSubtitle: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  commandTile: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  commandLabel: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  commandValue: {
    color: colours.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  commandSub: {
    color: colours.textSoft,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  blockerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  blockerTile: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  blockerTileFlagged: {
    borderColor: `${colours.amber}55`,
    backgroundColor: `${colours.amber}10`,
  },
  blockerLabel: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  blockerValue: {
    color: colours.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },
  blockerValueFlagged: {
    color: colours.amber,
  },
  primaryButton: {
    minHeight: touchTarget,
    flex: 1,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: colours.background,
    fontWeight: '900',
    fontSize: 14,
  },
  secondaryButton: {
    minHeight: touchTarget,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderHot,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: colours.cyan,
    fontWeight: '900',
    fontSize: 14,
  },
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  domainCard: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colours.panel,
    gap: 3,
  },
  domainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  domainIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  domainLabel: {
    color: colours.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  domainValue: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  domainDetail: {
    color: colours.textSoft,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  domainAction: {
    color: colours.cyan,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: 0.3,
  },
  sectionTitle: {
    color: colours.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
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
    fontSize: 12,
    fontWeight: '700',
  },
  lastRuckHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  lastRuckBadge: {
    minHeight: 32,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.cyanDim,
  },
  lastRuckBadgeText: { color: colours.cyan, fontSize: 10, fontWeight: '900' },
  lastRuckGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  lastRuckMetric: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  lastRuckValue: { color: colours.text, fontSize: 16, fontWeight: '900' },
  lastRuckLabel: { color: colours.muted, fontSize: 9, fontWeight: '900', marginTop: 2 },
  lastRuckQuality: { color: colours.muted, fontSize: 11, fontWeight: '800', lineHeight: 16, marginTop: 10 },
  sessionRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colours.panel,
  },
  sessionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionCopy: {
    flex: 1,
  },
  sessionTitle: {
    color: colours.text,
    fontSize: 13,
    fontWeight: '900',
  },
  sessionMeta: {
    color: colours.muted,
    fontSize: 11,
    marginTop: 2,
  },
  sessionScore: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    color: colours.cyan,
    fontSize: 18,
    fontWeight: '900',
  },
  scoreLabel: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  // Activity strip
  stripContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 72,
    paddingBottom: 4,
  },
  stripDay: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  stripTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colours.borderSoft,
  },
  stripBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  stripLabel: {
    color: colours.muted,
    fontSize: 9,
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
    backgroundColor: colours.cyan,
  },
  // Warning banners
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  assignedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  assignedTitleBlock: {
    flex: 1,
  },
  assignedTitle: {
    color: colours.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  assignedMeta: {
    color: colours.textSoft,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  assignedStatusBadge: {
    borderWidth: 1,
    borderColor: `${colours.amber}50`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: `${colours.amber}12`,
  },
  assignedStatusDone: {
    borderColor: `${colours.green}50`,
    backgroundColor: `${colours.green}12`,
  },
  assignedStatusText: {
    color: colours.amber,
    fontSize: 10,
    fontWeight: '900',
  },
  assignedStatusTextDone: {
    color: colours.green,
  },
  assignedNote: {
    color: colours.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  completionSummary: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  completionStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: `${colours.green}35`,
    borderRadius: 8,
    padding: 10,
    backgroundColor: `${colours.green}0F`,
  },
  completionLabel: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  completionValue: {
    color: colours.green,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },
  assignedExerciseList: {
    gap: 8,
    marginTop: 12,
  },
  assignedExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  assignedExerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colours.cyan,
  },
  assignedExerciseCopy: {
    flex: 1,
  },
  assignedExerciseName: {
    color: colours.text,
    fontSize: 13,
    fontWeight: '900',
  },
  assignedExerciseDose: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  assignedPinned: {
    color: colours.amber,
    fontSize: 9,
    fontWeight: '900',
  },
  assignedButton: {
    minHeight: touchTarget,
    flex: 1,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  assignedButtonDone: {
    borderWidth: 1,
    borderColor: `${colours.green}50`,
    backgroundColor: `${colours.green}12`,
  },
  assignedButtonText: {
    color: colours.background,
    fontSize: 14,
    fontWeight: '900',
  },
  assignedButtonTextDone: {
    color: colours.green,
  },
  postWorkoutActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  assignedSecondaryButton: {
    minHeight: touchTarget,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderHot,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  assignedSecondaryButtonText: {
    color: colours.cyan,
    fontSize: 14,
    fontWeight: '900',
  },
});
