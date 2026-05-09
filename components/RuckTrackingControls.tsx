import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, touchTarget, typography } from '../theme';

export function RuckTrackingControls({
  isTracking,
  isStarting,
  hasStarted,
  onStart,
  onStop,
  onResume,
  onReview,
  onDiscard,
}: {
  isTracking: boolean;
  isStarting: boolean;
  hasStarted: boolean;
  onStart: () => void;
  onStop: () => void;
  onResume: () => void;
  onReview: () => void;
  onDiscard: () => void;
}) {
  if (isTracking) {
    return (
      <View style={styles.row}>
        <View style={styles.fieldBadge}>
          <View style={styles.fieldDot} />
          <Text style={styles.fieldLabel}>IN FIELD</Text>
        </View>
        <Pressable style={styles.endButton} onPress={onStop}>
          <Ionicons name="stop" size={16} color="#fff" />
          <Text style={styles.endButtonText}>END</Text>
        </Pressable>
      </View>
    );
  }

  if (hasStarted) {
    return (
      <View style={styles.row}>
        <Pressable style={styles.resumeButton} onPress={onResume}>
          <Ionicons name="play" size={18} color={colours.background} />
          <Text style={styles.resumeButtonText}>RESUME</Text>
        </Pressable>
        <Pressable style={styles.reviewButton} onPress={onReview}>
          <Text style={styles.reviewButtonText}>Review</Text>
        </Pressable>
        <Pressable style={styles.discardButton} onPress={onDiscard}>
          <Ionicons name="close" size={18} color={colours.textSoft} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.launchButton, isStarting && styles.launchButtonDisabled]}
      onPress={onStart}
      disabled={isStarting}
    >
      <View style={styles.launchInner}>
        <View style={styles.launchTextGroup}>
          <Text style={styles.launchLabel}>BEGIN MISSION</Text>
          <Text style={styles.launchSubtext}>
            {isStarting ? 'Acquiring GPS signal…' : 'Start GPS tracking'}
          </Text>
        </View>
        <Ionicons
          name={isStarting ? 'sync-outline' : 'arrow-forward-circle'}
          size={28}
          color={colours.background}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fieldBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(167,201,87,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(167,201,87,0.22)',
    minHeight: touchTarget,
  },
  fieldDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colours.green,
  },
  fieldLabel: {
    color: colours.green,
    fontWeight: '900' as const,
    fontSize: 12,
    letterSpacing: 1.8,
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colours.red,
    borderRadius: 8,
    minHeight: touchTarget,
  },
  endButtonText: {
    color: '#fff',
    fontWeight: '900' as const,
    fontSize: 13,
    letterSpacing: 1.4,
  },
  resumeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colours.cyan,
    borderRadius: 8,
    paddingVertical: 12,
    minHeight: touchTarget,
  },
  resumeButtonText: { color: colours.background, fontWeight: '900' as const, fontSize: 14 },
  reviewButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget,
  },
  reviewButtonText: { color: colours.textSoft, fontWeight: '900' as const, fontSize: 13 },
  discardButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  launchButton: {
    backgroundColor: colours.green,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  launchButtonDisabled: { opacity: 0.62 },
  launchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  launchTextGroup: { gap: 3 },
  launchLabel: {
    color: colours.background,
    fontWeight: '900' as const,
    fontSize: 16,
    letterSpacing: 1.4,
  },
  launchSubtext: {
    color: 'rgba(7,17,30,0.70)',
    fontSize: 11,
    fontWeight: '700' as const,
  },
});
