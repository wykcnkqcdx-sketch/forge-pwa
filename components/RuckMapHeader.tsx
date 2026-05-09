import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography } from '../theme';
import type { RuckMissionMode } from '../utils/ruck';

export function RuckMapHeader({
  isTracking,
  hasStarted,
  gpsQuality,
  rejectedPointCount,
  lastRejectedReason,
  missionMode,
  tacticalOptionsOpen,
  onModeChange,
  onToggleOptions,
  onOpenFullscreen,
}: {
  isTracking: boolean;
  hasStarted: boolean;
  gpsQuality: { label: string; detail: string; tone: string };
  rejectedPointCount: number;
  lastRejectedReason: string | null;
  missionMode: RuckMissionMode;
  tacticalOptionsOpen: boolean;
  onModeChange: (mode: RuckMissionMode) => void;
  onToggleOptions: () => void;
  onOpenFullscreen: () => void;
}) {
  const stateLabel = isTracking ? 'RECORDING' : hasStarted ? 'PAUSED' : 'STANDBY';

  return (
    <View style={styles.mapHeader}>
      <View style={styles.stateGroup}>
        <View style={[styles.stateDot, { backgroundColor: gpsQuality.tone }]} />
        <View>
          <Text style={[styles.stateLabel, { color: gpsQuality.tone }]}>{stateLabel}</Text>
          <Text style={styles.stateDetail} numberOfLines={1}>
            {gpsQuality.detail.toUpperCase()}
            {rejectedPointCount > 0 ? ` · ${rejectedPointCount}↓` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.modeChips}>
        {([
          ['simple', 'footsteps-outline', 'SMP'],
          ['tactical', 'radio-outline', 'TAC'],
          ['navigation', 'navigate-outline', 'NAV'],
        ] as const).map(([mode, icon, label]) => (
          <Pressable
            key={mode}
            style={[styles.modeChip, missionMode === mode && styles.modeChipActive]}
            onPress={() => onModeChange(mode)}
          >
            <Ionicons name={icon} size={11} color={missionMode === mode ? colours.background : colours.muted} />
            <Text style={[styles.modeChipText, missionMode === mode && styles.modeChipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, tacticalOptionsOpen && styles.actionBtnActive]} onPress={onToggleOptions}>
          <Ionicons name="options-outline" size={17} color={tacticalOptionsOpen ? colours.background : colours.cyan} />
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onOpenFullscreen}>
          <Ionicons name="expand" size={17} color={colours.cyan} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stateGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  stateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  stateLabel: {
    fontSize: 10,
    fontWeight: '900' as const,
    letterSpacing: 1.4,
  },
  stateDetail: {
    fontSize: 9,
    color: colours.muted,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
    marginTop: 1,
  },
  modeChips: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: 3,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
  },
  modeChipActive: { backgroundColor: colours.cyan },
  modeChipText: {
    fontSize: 9,
    fontWeight: '900' as const,
    color: colours.muted,
    letterSpacing: 0.8,
  },
  modeChipTextActive: { color: colours.background },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.18)',
  },
  actionBtnActive: {
    backgroundColor: colours.cyan,
    borderColor: colours.cyan,
  },
});
