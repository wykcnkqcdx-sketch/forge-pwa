import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, radius, touchTarget } from '../theme';

export function RuckTrackingControls({
  isTracking,
  isStarting,
  hasStarted,
  onStart,
  onStop,
  onResume,
  onReview,
  onDiscard,
  onCheckpoint,
}: {
  isTracking: boolean;
  isStarting: boolean;
  hasStarted: boolean;
  onStart: () => void;
  onStop: () => void;
  onResume: () => void;
  onReview: () => void;
  onDiscard: () => void;
  onCheckpoint?: () => void;
}) {
  // ── Live tracking ──────────────────────────────────────────────
  if (isTracking) {
    return (
      <View style={styles.row}>
        {/* Pulse indicator */}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>LIVE RUCK</Text>
        </View>

        {/* Checkpoint — shown when callback provided */}
        {onCheckpoint && (
          <Pressable style={styles.cpBtn} onPress={onCheckpoint}>
            <Ionicons name="flag" size={15} color={colours.amber} />
            <Text style={styles.cpBtnText}>CP</Text>
          </Pressable>
        )}

        {/* Pause */}
        <Pressable style={styles.pauseBtn} onPress={onStop}>
          <Ionicons name="pause" size={16} color={colours.text} />
          <Text style={styles.pauseBtnText}>PAUSE</Text>
        </Pressable>

        {/* Finish — stop + go straight to review */}
        <Pressable style={styles.finishBtn} onPress={() => { onStop(); onReview(); }}>
          <Ionicons name="checkmark-circle" size={16} color={colours.background} />
          <Text style={styles.finishBtnText}>FINISH</Text>
        </Pressable>
      </View>
    );
  }

  // ── Paused / stopped ───────────────────────────────────────────
  if (hasStarted) {
    return (
      <View style={styles.row}>
        <Pressable style={styles.resumeBtn} onPress={onResume}>
          <Ionicons name="play" size={18} color={colours.background} />
          <Text style={styles.resumeBtnText}>RESUME</Text>
        </Pressable>
        <Pressable style={styles.aarBtn} onPress={onReview}>
          <Text style={styles.aarBtnText}>AAR</Text>
        </Pressable>
        <Pressable style={styles.discardBtn} onPress={onDiscard}>
          <Ionicons name="trash-outline" size={17} color={colours.red} />
        </Pressable>
      </View>
    );
  }

  // ── Not started ────────────────────────────────────────────────
  return (
    <Pressable
      style={[styles.startBtn, isStarting && styles.startBtnDisabled]}
      onPress={onStart}
      disabled={isStarting}
    >
      <View style={styles.startInner}>
        <View style={styles.startTextGroup}>
          <Text style={styles.startLabel}>
            {isStarting ? 'ACQUIRING GPS…' : 'START RUCK'}
          </Text>
          <Text style={styles.startSub}>
            {isStarting ? 'Hold on, locking signal' : 'Begin GPS tracking'}
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
    gap: 8,
  },

  // Live state
  liveBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colours.greenDim,
    borderWidth: 1,
    borderColor: `${colours.green}40`,
    minHeight: touchTarget,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colours.green,
  },
  liveLabel: {
    color: colours.green,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.8,
  },
  cpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    minHeight: touchTarget,
    backgroundColor: colours.amberDim,
    borderWidth: 1,
    borderColor: `${colours.amber}40`,
  },
  cpBtnText: {
    color: colours.amber,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    minHeight: touchTarget,
    backgroundColor: colours.layer2,
    borderWidth: 1,
    borderColor: colours.borderSoft,
  },
  pauseBtnText: {
    color: colours.text,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    minHeight: touchTarget,
    backgroundColor: colours.cyan,
  },
  finishBtnText: {
    color: colours.background,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.4,
  },

  // Paused state
  resumeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colours.cyan,
    borderRadius: radius.sm,
    paddingVertical: 12,
    minHeight: touchTarget,
  },
  resumeBtnText: {
    color: colours.background,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  aarBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colours.layer2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colours.borderHot,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget,
  },
  aarBtnText: {
    color: colours.cyan,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  discardBtn: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.redDim,
    borderWidth: 1,
    borderColor: `${colours.red}40`,
  },

  // Start state
  startBtn: {
    backgroundColor: colours.green,
    borderRadius: radius.sm,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  startBtnDisabled: { opacity: 0.62 },
  startInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  startTextGroup: { gap: 3 },
  startLabel: {
    color: colours.background,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1.4,
  },
  startSub: {
    color: 'rgba(11,15,14,0.65)',
    fontSize: 11,
    fontWeight: '700',
  },
});
