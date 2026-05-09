import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LiveTimerText } from './LiveTimerText';
import { colours, typography } from '../theme';
import { formatHeading, type RuckMissionMode } from '../utils/ruck';

export function RuckLiveStatsRibbon({
  currentDistance,
  startTime,
  isTracking,
  elapsedSeconds,
  missionMode,
  navTargetBearing,
  displayBearing,
  activePace,
}: {
  currentDistance: number;
  startTime: Date | null;
  isTracking: boolean;
  elapsedSeconds: number;
  missionMode: RuckMissionMode;
  navTargetBearing: number | null;
  displayBearing: number | null;
  activePace: string;
}) {
  const bearingLabel = missionMode === 'navigation' && navTargetBearing != null
    ? formatHeading(navTargetBearing)
    : displayBearing == null ? '--' : formatHeading(displayBearing);

  return (
    <View style={styles.ribbon}>
      <View style={[styles.item, styles.itemHero]}>
        <Text style={styles.heroValue}>{currentDistance.toFixed(2)}</Text>
        <Text style={styles.heroLabel}>KM</Text>
      </View>
      <View style={[styles.item, styles.itemPrimary]}>
        <LiveTimerText startTime={startTime} isTracking={isTracking} staticSeconds={elapsedSeconds} style={styles.primaryValue} />
        <Text style={styles.primaryLabel}>TIME</Text>
      </View>
      <View style={[styles.item, styles.itemSecondary]}>
        <Text style={styles.secondaryValue}>{bearingLabel}</Text>
        <Text style={styles.secondaryLabel}>BRG</Text>
      </View>
      <View style={[styles.item, styles.itemSecondary]}>
        <Text style={styles.secondaryValue}>{activePace}</Text>
        <Text style={styles.secondaryLabel}>MIN/KM</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(103,232,249,0.10)',
  },
  itemHero: { flex: 1.4 },
  itemPrimary: { flex: 1.2 },
  itemSecondary: { flex: 0.85 },
  heroValue: { color: colours.text, fontSize: 22, fontWeight: '900' as const, letterSpacing: -0.5 },
  heroLabel: { ...typography.label, color: colours.cyan, letterSpacing: 1.2, marginTop: 2 },
  primaryValue: { color: colours.text, fontSize: 16, fontWeight: '900' as const },
  primaryLabel: { ...typography.label, color: colours.muted, letterSpacing: 1, marginTop: 2 },
  secondaryValue: { color: colours.textSoft, fontSize: 13, fontWeight: '800' as const },
  secondaryLabel: { ...typography.label, color: colours.muted, letterSpacing: 0.8, marginTop: 2, fontSize: 8 },
});
