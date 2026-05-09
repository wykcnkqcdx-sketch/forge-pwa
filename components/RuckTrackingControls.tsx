import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, touchTarget } from '../theme';

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
  return (
    <View style={styles.trackingControls}>
      {isTracking ? (
        <View style={styles.trackingActive}>
          <Pressable style={[styles.trackButton, styles.stopButton]} onPress={onStop}>
            <Ionicons name="stop" size={20} color={colours.background} />
            <Text style={styles.trackButtonText}>Stop Tracking</Text>
          </Pressable>
        </View>
      ) : hasStarted ? (
        <View style={styles.trackingActive}>
          <Pressable style={styles.trackButton} onPress={onResume}>
            <Ionicons name="play" size={20} color={colours.background} />
            <Text style={styles.trackButtonText}>Resume</Text>
          </Pressable>
          <Pressable style={styles.saveButton} onPress={onReview}>
            <Text style={styles.saveButtonText}>Review Ruck</Text>
          </Pressable>
          <Pressable style={[styles.trackButton, styles.discardButton]} onPress={onDiscard}>
            <Ionicons name="close" size={20} color={colours.text} />
            <Text style={[styles.trackButtonText, { color: colours.text }]}>Discard</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.trackButton, isStarting && styles.trackButtonDisabled]}
          onPress={onStart}
          disabled={isStarting}
        >
          <Ionicons name={isStarting ? 'sync' : 'play'} size={20} color={colours.background} />
          <Text style={styles.trackButtonText}>{isStarting ? 'Starting GPS...' : 'Start GPS Tracking'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trackingControls: { marginBottom: 16 },
  trackButton: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.green,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  trackButtonDisabled: { opacity: 0.62 },
  trackButtonText: { color: colours.background, fontWeight: '900', fontSize: 16 },
  stopButton: { backgroundColor: colours.red },
  trackingActive: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  saveButton: {
    minHeight: touchTarget,
    backgroundColor: colours.cyan,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  saveButtonText: { color: colours.background, fontWeight: '900', fontSize: 16 },
  discardButton: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colours.border, borderWidth: 1 },
});
