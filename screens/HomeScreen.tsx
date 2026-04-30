import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { buildPerformanceProfile, sortSessionsByDate } from '../lib/performance';
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
  readinessLogs = [],
}: {
  sessions: TrainingSession[];
  goToRuck: () => void;
  goToAnalytics: () => void;
  goToFuel?: () => void;
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
});
