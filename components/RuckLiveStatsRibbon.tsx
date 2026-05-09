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
    <View style={styles.liveStats}>
      <View style={styles.liveRibbonItem}>
        <Text style={styles.liveRibbonValue}>{currentDistance.toFixed(2)}</Text>
        <Text style={styles.liveRibbonLabel}>KM</Text>
      </View>
      <View style={styles.liveRibbonItem}>
        <LiveTimerText startTime={startTime} isTracking={isTracking} staticSeconds={elapsedSeconds} style={styles.liveRibbonValue} />
        <Text style={styles.liveRibbonLabel}>TIME</Text>
      </View>
      <View style={styles.liveRibbonItem}>
        <Text style={styles.liveRibbonValue}>{bearingLabel}</Text>
        <Text style={styles.liveRibbonLabel}>BRG</Text>
      </View>
      <View style={styles.liveRibbonItem}>
        <Text style={styles.liveRibbonValue}>{activePace}</Text>
        <Text style={styles.liveRibbonLabel}>MIN/KM</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  liveStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveRibbonItem: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(103,232,249,0.10)',
  },
  liveRibbonValue: { color: colours.text, fontSize: 15, fontWeight: '900' },
  liveRibbonLabel: { ...typography.label, color: colours.muted, letterSpacing: 1, marginTop: 2 },
});
