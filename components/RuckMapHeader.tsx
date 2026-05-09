import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography } from '../theme';
import { responsiveSpacing, statusColors } from '../utils/styling';

export function RuckMapHeader({
  isTracking,
  hasStarted,
  gpsQuality,
  rejectedPointCount,
  lastRejectedReason,
  tacticalOptionsOpen,
  onToggleOptions,
  onOpenFullscreen,
}: {
  isTracking: boolean;
  hasStarted: boolean;
  gpsQuality: { label: string; detail: string; tone: string };
  rejectedPointCount: number;
  lastRejectedReason: string | null;
  tacticalOptionsOpen: boolean;
  onToggleOptions: () => void;
  onOpenFullscreen: () => void;
}) {
  return (
    <View style={styles.mapHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.mapLabel}>LIVE GPS</Text>
        <Text style={styles.mapText}>{isTracking ? 'Tracking active' : hasStarted ? 'Track paused' : 'Ready to acquire signal'}</Text>
        <Text style={styles.mapSubText}>
          {`${gpsQuality.detail.toUpperCase()} - ${isTracking ? 'RECORDING' : 'IDLE'}`}
          {rejectedPointCount > 0 ? ` | ${rejectedPointCount} rejected${lastRejectedReason ? ` (${lastRejectedReason})` : ''}` : ''}
        </Text>
      </View>
      <View style={styles.mapHeaderActions}>
        <Pressable style={[styles.mapHeaderIcon, tacticalOptionsOpen && styles.mapHeaderIconActive]} onPress={onToggleOptions}>
          <Ionicons name="options-outline" size={18} color={tacticalOptionsOpen ? colours.background : colours.cyan} />
        </Pressable>
        <Pressable style={styles.mapHeaderIcon} onPress={onOpenFullscreen}>
          <Ionicons name="expand" size={18} color={colours.cyan} />
        </Pressable>
      </View>
      <View style={[styles.signalBadge, { borderColor: statusColors(gpsQuality.tone).borderMed, backgroundColor: statusColors(gpsQuality.tone).bgMed }]}>
        <View style={[styles.signalDot, { backgroundColor: gpsQuality.tone }]} />
        <Text style={[styles.signalText, { color: gpsQuality.tone }]}>
          {isTracking ? gpsQuality.label : 'IDLE'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: responsiveSpacing('sm') },
  mapLabel: { ...typography.label, color: colours.cyan, letterSpacing: 1.8 },
  mapText: { color: colours.text, fontWeight: '900', marginTop: 2 },
  mapSubText: { ...typography.caption, color: colours.muted, marginTop: 3 },
  mapHeaderActions: { flexDirection: 'row', gap: 7 },
  mapHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.18)',
  },
  mapHeaderIconActive: {
    backgroundColor: colours.cyan,
    borderColor: colours.cyan,
  },
  signalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  signalDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colours.muted },
  signalText: { ...typography.label, color: colours.muted, letterSpacing: 1 },
});
