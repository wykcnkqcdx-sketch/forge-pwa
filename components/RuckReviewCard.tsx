import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colours, touchTarget, typography } from '../theme';
import { responsiveSpacing, statusColors } from '../utils/styling';
import { formatElapsed } from '../utils/ruck';
import type { RuckScoreBreakdown } from '../utils/ruckScore';

type RouteReview = {
  averageAccuracyMeters?: number;
  confidence: 'High' | 'Medium' | 'Low';
  reachedCheckpoints: number;
  totalCheckpoints: number;
};

export function RuckReviewCard({
  currentDistance,
  elapsedSeconds,
  activePace,
  weight,
  routeReview,
  rejectedPointCount,
  splitCount,
  ruckScore,
  note,
  onNoteChange,
  onSave,
  onResume,
  onDiscard,
}: {
  currentDistance: number;
  elapsedSeconds: number;
  activePace: string;
  weight: number;
  routeReview: RouteReview;
  rejectedPointCount: number;
  splitCount: number;
  ruckScore: RuckScoreBreakdown;
  note: string;
  onNoteChange: (note: string) => void;
  onSave: () => void;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const confidenceTone = routeReview.confidence === 'High'
    ? colours.green
    : routeReview.confidence === 'Medium'
      ? colours.amber
      : colours.red;

  return (
    <Card style={styles.reviewCard}>
      <View style={styles.navHeader}>
        <View>
          <Text style={styles.cardTitle}>Ruck Review</Text>
          <Text style={styles.muted}>Confirm the session before it hits your log.</Text>
        </View>
        <View style={[styles.signalBadge, { borderColor: statusColors(confidenceTone).borderMed, backgroundColor: statusColors(confidenceTone).bgMed }]}>
          <Text style={[styles.signalText, { color: confidenceTone }]}>
            {routeReview.confidence.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.reviewGrid}>
        <ReviewItem value={String(ruckScore.score)} label="Ruck Score" highlight />
        <ReviewItem value={`${currentDistance.toFixed(2)}km`} label="Distance" />
        <ReviewItem value={formatElapsed(elapsedSeconds)} label="Time" />
        <ReviewItem value={activePace} label="Min/km" />
        <ReviewItem value={`${weight}kg`} label="Load" />
        <ReviewItem value={routeReview.averageAccuracyMeters ? `+/-${routeReview.averageAccuracyMeters}m` : 'Unknown'} label="Avg GPS" />
        <ReviewItem value={String(rejectedPointCount)} label="Rejected" />
        <ReviewItem value={`${routeReview.reachedCheckpoints}/${routeReview.totalCheckpoints}`} label="Checkpoints" />
        <ReviewItem value={String(splitCount)} label="Splits" />
      </View>

      <View style={styles.aarPanel}>
        <Text style={styles.aarKicker}>After Action Review</Text>
        <Text style={styles.aarFinding}>Finding: {ruckScore.finding}</Text>
        <Text style={styles.aarText}>Recommendation: {ruckScore.recommendation}</Text>
        <Text style={styles.aarText}>Load-adjusted pace: {ruckScore.loadAdjustedPace} min/km</Text>
      </View>

      <TextInput
        value={note}
        onChangeText={onNoteChange}
        placeholder="Session note, kit issue, terrain, pain, weather..."
        placeholderTextColor={colours.soft}
        style={styles.reviewNoteInput}
        multiline
      />

      <View style={styles.reviewActions}>
        <Pressable style={styles.saveButton} onPress={onSave}>
          <Text style={styles.saveButtonText}>Save Ruck</Text>
        </Pressable>
        <Pressable style={styles.trackButton} onPress={onResume}>
          <Ionicons name="play" size={18} color={colours.background} />
          <Text style={styles.trackButtonText}>Resume</Text>
        </Pressable>
        <Pressable style={[styles.trackButton, styles.discardButton]} onPress={onDiscard}>
          <Ionicons name="close" size={18} color={colours.text} />
          <Text style={[styles.trackButtonText, { color: colours.text }]}>Discard</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function ReviewItem({ value, label, highlight = false }: { value: string; label: string; highlight?: boolean }) {
  return (
    <View style={[styles.reviewItem, highlight && styles.reviewItemHighlight]}>
      <Text style={[styles.reviewValue, highlight && styles.reviewValueHighlight]}>{value}</Text>
      <Text style={styles.reviewLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  reviewCard: { borderColor: 'rgba(103,232,249,0.28)' },
  navHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: responsiveSpacing('md') },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  muted: { ...typography.caption, color: colours.muted },
  signalBadge: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalText: { ...typography.label, color: colours.muted, letterSpacing: 1 },
  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  reviewItem: {
    width: '47%',
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: 11,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  reviewItemHighlight: {
    borderColor: `${colours.cyan}55`,
    backgroundColor: colours.cyanDim,
  },
  reviewValue: { color: colours.text, fontSize: 17, fontWeight: '900' },
  reviewValueHighlight: { color: colours.cyan },
  reviewLabel: { ...typography.label, color: colours.muted, marginTop: 3 },
  aarPanel: {
    borderWidth: 1,
    borderColor: `${colours.amber}40`,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    backgroundColor: colours.amberDim,
    gap: 5,
  },
  aarKicker: { ...typography.label, color: colours.amber },
  aarFinding: { color: colours.text, fontSize: 14, lineHeight: 20, fontWeight: '900' },
  aarText: { color: colours.textSoft, fontSize: 12, lineHeight: 18, fontWeight: '800' },
  reviewNoteInput: {
    minHeight: 86,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    color: colours.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    textAlignVertical: 'top',
  },
  reviewActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
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
  trackButtonText: { color: colours.background, fontWeight: '900', fontSize: 16 },
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
