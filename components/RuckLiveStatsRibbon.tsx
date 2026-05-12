import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LiveTimerText } from './LiveTimerText';
import { colours, radius } from '../theme';
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
  loadKg,
  nextCpDistanceKm,
}: {
  currentDistance: number;
  startTime: Date | null;
  isTracking: boolean;
  elapsedSeconds: number;
  missionMode: RuckMissionMode;
  navTargetBearing: number | null;
  displayBearing: number | null;
  activePace: string;
  loadKg?: number;
  nextCpDistanceKm?: number | null;
}) {
  const bearingLabel = missionMode === 'navigation' && navTargetBearing != null
    ? formatHeading(navTargetBearing)
    : displayBearing == null ? '--' : formatHeading(displayBearing);

  const showNextCp = nextCpDistanceKm != null && nextCpDistanceKm > 0;

  return (
    <View style={styles.ribbon}>
      {/* Distance — hero */}
      <View style={[styles.cell, styles.cellHero]}>
        <Text style={styles.heroNum}>{currentDistance.toFixed(2)}</Text>
        <Text style={styles.heroUnit}>KM</Text>
      </View>

      <View style={styles.divider} />

      {/* Time */}
      <View style={styles.cell}>
        <LiveTimerText
          startTime={startTime}
          isTracking={isTracking}
          staticSeconds={elapsedSeconds}
          style={styles.primaryNum}
        />
        <Text style={styles.cellLabel}>TIME</Text>
      </View>

      <View style={styles.divider} />

      {/* Pace */}
      <View style={styles.cell}>
        <Text style={styles.primaryNum}>{activePace}</Text>
        <Text style={styles.cellLabel}>/KM</Text>
      </View>

      <View style={styles.divider} />

      {/* Load or bearing or next CP */}
      <View style={styles.cell}>
        {showNextCp ? (
          <>
            <Text style={[styles.secondaryNum, { color: colours.amber }]}>
              {nextCpDistanceKm!.toFixed(1)}
            </Text>
            <Text style={styles.cellLabel}>NEXT CP</Text>
          </>
        ) : loadKg != null ? (
          <>
            <Text style={styles.secondaryNum}>{loadKg}</Text>
            <Text style={styles.cellLabel}>KG</Text>
          </>
        ) : (
          <>
            <Text style={styles.secondaryNum}>{bearingLabel}</Text>
            <Text style={styles.cellLabel}>BRG</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(11,15,14,0.88)',
    borderTopWidth: 1,
    borderTopColor: colours.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  cellHero: {
    flex: 1.5,
  },
  divider: {
    width: 1,
    backgroundColor: colours.borderSoft,
    marginVertical: 10,
  },
  heroNum: {
    color: colours.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 34,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    color: colours.cyan,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 1,
  },
  primaryNum: {
    color: colours.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  secondaryNum: {
    color: colours.textSoft,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  cellLabel: {
    color: colours.muted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
