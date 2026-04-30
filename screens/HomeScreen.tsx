import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { buildPerformanceProfile, buildWeeklyLoadSeries, sortSessionsByDate } from '../lib/performance';
import { buildH2FDomains, buildPrescriptiveGuidance } from '../lib/h2f';
import { colours, touchTarget } from '../theme';
import { TrainingSession } from '../data/mockData';
import type { ReadinessLog } from '../data/domain';

function domainTone(status: 'GREEN' | 'AMBER' | 'RED') {
  if (status === 'GREEN') return colours.green;
  if (status === 'AMBER') return colours.amber;
  return colours.red;
}

function nextActionForReadiness(performance: ReturnType<typeof buildPerformanceProfile>) {
  if (performance.readinessBand === 'RED' || performance.loadRisk === 'High') {
    return {
      title: 'Recovery priority',
      detail: performance.recoveryFocus,
      icon: 'bed-outline' as keyof typeof Ionicons.glyphMap,
      tone: colours.red,
    };
  }
  if (performance.readinessBand === 'AMBER' || performance.loadRisk === 'Moderate') {
    return {
      title: 'Controlled training',
      detail: 'Cap intensity and check soreness after warm-up',
      icon: 'speedometer-outline' as keyof typeof Ionicons.glyphMap,
      tone: colours.amber,
    };
  }
  return {
    title: 'Build today',
    detail: 'Good window for quality work',
    icon: 'flash-outline' as keyof typeof Ionicons.glyphMap,
    tone: colours.green,
  };
}

function sessionTypeIcon(type: TrainingSession['type']): keyof typeof Ionicons.glyphMap {
  if (type === 'Ruck') return 'footsteps-outline';
  if (type === 'Strength') return 'barbell-outline';
  if (type === 'Cardio') return 'heart-outline';
  if (type === 'Mobility') return 'body-outline';
  return 'flash-outline';
}

export function HomeScreen({
  sessions,
  goToRuck,
  goToAnalytics,
  goToFuel,
  goToTrain,
  readinessLogs = [],
}: {
  sessions: TrainingSession[];
  goToRuck: () => void;
  goToAnalytics: () => void;
  goToFuel?: () => void;
  goToTrain?: () => void;
  readinessLogs?: ReadinessLog[];
}) {
  const performance = buildPerformanceProfile(sessions);
  const latestReadiness = readinessLogs[0];
  const domains = useMemo(
    () => buildH2FDomains(sessions, latestReadiness),
    [sessions, latestReadiness],
  );
  const guidance = buildPrescriptiveGuidance(sessions, 6.25, performance.loadRisk === 'High' ? 'down' : 'flat');
  const nextAction = nextActionForReadiness(performance);

  const loadedKm = sessions
    .filter((s) => s.type === 'Ruck')
    .reduce((total, s) => total + (s.loadKg ?? 0) * (s.durationMinutes / 60) * 5.2, 0);

  const recentSessions = sortSessionsByDate(sessions).slice(0, 3);

  const acwrValue = Number(performance.acuteChronicRatio);
  const acwrTone = acwrValue > 1.3 ? colours.red : acwrValue < 0.8 ? colours.amber : colours.green;
  const acwrLabel = acwrValue > 1.3 ? 'Overreach risk' : acwrValue < 0.8 ? 'Under-trained' : 'Optimal zone';

  const today = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const hasSessionToday = sessions.some((s) => {
    if (!s.completedAt) return false;
    const d = new Date(s.completedAt);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // 7-day activity strip
  const weeklyLoadSeries = useMemo(() => buildWeeklyLoadSeries(sessions), [sessions]);
  const dayLabels = useMemo(() => {
    const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      return dayLetters[d.getDay()];
    });
  }, []);
  const maxLoad = Math.max(...weeklyLoadSeries, 1);

  // Warning banners
  const warnings = useMemo(() => {
    const list: { tone: string; icon: keyof typeof Ionicons.glyphMap; text: string }[] = [];
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
  }, [performance.monotony, latestReadiness]);

  // Recommended session
  const recommendedSession = useMemo(() => {
    if (performance.readinessBand === 'RED' || performance.loadRisk === 'High') {
      return {
        title: 'Mobility & Recovery',
        detail: '20–30 min · Low intensity · Focus on tissue care',
        icon: 'body-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.red,
        goTo: goToTrain,
      };
    }
    if (performance.readinessBand === 'AMBER' || performance.loadRisk === 'Moderate') {
      return {
        title: 'Zone 2 Aerobic',
        detail: '40 min · Heart rate 130–145 bpm · Steady effort',
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
        icon: 'footsteps-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.green,
        goTo: goToRuck,
      };
    }
    return {
      title: 'Strength Block',
      detail: '45 min · Compound movements · RPE 7–8',
      icon: 'barbell-outline' as keyof typeof Ionicons.glyphMap,
      tone: colours.green,
      goTo: goToTrain,
    };
  }, [performance.readinessBand, performance.loadRisk, sessions, goToTrain, goToRuck]);

  function domainPressHandler(domainId: string) {
    if (domainId === 'nutrition') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      goToFuel?.();
    }
  }

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{today.toUpperCase()}</Text>
          <Text style={styles.title}>Tactical Readiness</Text>
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
                <View style={[styles.stripBar, { flex: barFraction, backgroundColor: barTone, opacity: isToday ? 1 : 0.72 }]} />
              </View>
              <Text style={[styles.stripLabel, isToday && styles.stripLabelToday]}>{dayLabels[i]}</Text>
              {isToday && <View style={styles.stripTodayDot} />}
            </View>
          );
        })}
      </View>

      {/* Readiness card */}
      <Card hot>
        <View style={styles.readinessRow}>
          <View>
            <Text style={styles.label}>TODAY BRIEF</Text>
            <Text style={[styles.readinessValue, { color: performance.readinessTone }]}>{performance.readiness}</Text>
          </View>
          <View style={styles.readinessCopy}>
            <Text style={[styles.statusBand, { color: performance.readinessTone }]}>{performance.readinessBand}</Text>
            <Text style={styles.body}>{guidance}</Text>
          </View>
        </View>
        <ProgressBar value={performance.readiness} colour={performance.readinessTone} />

        {/* Command tiles */}
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

        {/* Next action */}
        <View style={[styles.nextActionPanel, { borderColor: `${nextAction.tone}66`, backgroundColor: `${nextAction.tone}12` }]}>
          <View style={[styles.nextActionIcon, { backgroundColor: `${nextAction.tone}22` }]}>
            <Ionicons name={nextAction.icon} size={22} color={nextAction.tone} />
          </View>
          <View style={styles.nextActionCopy}>
            <Text style={[styles.nextActionTitle, { color: nextAction.tone }]}>{nextAction.title}</Text>
            <Text style={styles.nextActionDetail}>{nextAction.detail}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); goToRuck(); }}
          >
            <Ionicons name="footsteps" size={20} color={colours.background} />
            <Text style={styles.primaryButtonText}>Start Ruck</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); goToAnalytics(); }}
          >
            <Ionicons name="analytics" size={20} color={colours.cyan} />
            <Text style={styles.secondaryButtonText}>Intel</Text>
          </Pressable>
        </View>
      </Card>

      {/* Warning banners */}
      {warnings.map((w, i) => (
        <View key={i} style={[styles.warningBanner, { borderColor: `${w.tone}55`, backgroundColor: `${w.tone}12` }]}>
          <Ionicons name={w.icon} size={16} color={w.tone} />
          <Text style={[styles.warningText, { color: w.tone }]}>{w.text}</Text>
        </View>
      ))}

      {/* Today's recommended session */}
      <Pressable
        style={({ pressed }) => [styles.recCard, { borderColor: `${recommendedSession.tone}44`, backgroundColor: `${recommendedSession.tone}0D` }, pressed && { opacity: 0.8 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); recommendedSession.goTo?.(); }}
      >
        <View style={styles.recLeft}>
          <View style={[styles.recIconWrap, { backgroundColor: `${recommendedSession.tone}22` }]}>
            <Ionicons name={recommendedSession.icon} size={22} color={recommendedSession.tone} />
          </View>
          <View style={styles.recCopy}>
            <Text style={styles.recKicker}>TODAY'S SESSION</Text>
            <Text style={[styles.recTitle, { color: recommendedSession.tone }]}>{recommendedSession.title}</Text>
            <Text style={styles.recDetail}>{recommendedSession.detail}</Text>
          </View>
        </View>
        <View style={[styles.recChevron, { borderColor: `${recommendedSession.tone}44` }]}>
          <Ionicons name="chevron-forward" size={16} color={recommendedSession.tone} />
        </View>
      </Pressable>

      {/* H2F Domain grid */}
      <View style={styles.domainGrid}>
        {domains.map((domain) => {
          const tone = domainTone(domain.status);
          const tappable = domain.id === 'nutrition' && !!goToFuel;
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
          {Math.round(loadedKm)} kg-km of ruck work logged. Loaded miles accumulate here across all ruck sessions.
        </Text>
        <View style={styles.actionRow}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); goToRuck(); }}
          >
            <Ionicons name="footsteps" size={20} color={colours.background} />
            <Text style={styles.primaryButtonText}>Ruck Calculator</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); goToAnalytics(); }}
          >
            <Ionicons name="analytics" size={20} color={colours.cyan} />
            <Text style={styles.secondaryButtonText}>Intel</Text>
          </Pressable>
        </View>
      </Card>

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
  },
  kicker: {
    color: colours.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: colours.text,
    fontSize: 30,
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
  },
  opsecText: {
    color: colours.cyan,
    fontSize: 11,
    fontWeight: '900',
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  readinessValue: {
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '900',
  },
  readinessCopy: {
    flex: 1,
  },
  statusBand: {
    fontSize: 15,
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
  commandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
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
  nextActionPanel: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nextActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextActionCopy: {
    flex: 1,
  },
  nextActionTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  nextActionDetail: {
    color: colours.textSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
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
  // Recommended session card
  recCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  recLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recCopy: {
    flex: 1,
  },
  recKicker: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  recTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  recDetail: {
    color: colours.textSoft,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  recChevron: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
