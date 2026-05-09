import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colours, touchTarget, typography } from '../theme';
import { formatDuration, formatHeading } from '../utils/ruck';
import { responsiveSpacing } from '../utils/styling';

export function RuckCheckpointModeCard({
  checkpointStatus,
  checkpointIndex,
  checkpointCount,
  checkpointIntervalKm,
  nextCheckpointKm,
  checkpointRemainingKm,
  checkpointEtaMinutes,
  displayBearing,
  onMarkReached,
  onUndoMark,
  onCheckpointIntervalChange,
}: {
  checkpointStatus: string;
  checkpointIndex: number;
  checkpointCount: number;
  checkpointIntervalKm: number;
  nextCheckpointKm: number;
  checkpointRemainingKm: number;
  checkpointEtaMinutes: number;
  displayBearing: number | null;
  onMarkReached: () => void;
  onUndoMark: () => void;
  onCheckpointIntervalChange: (amount: number) => void;
}) {
  const canMark = checkpointIndex < checkpointCount;
  const canUndo = checkpointIndex > 0;

  return (
    <Card>
      <View style={styles.navHeader}>
        <View>
          <Text style={styles.cardTitle}>Checkpoint Mode</Text>
          <Text style={styles.muted}>{checkpointStatus}</Text>
        </View>
        <Pressable
          style={[styles.checkpointButton, !canMark && styles.checkpointButtonDisabled]}
          onPress={onMarkReached}
          disabled={!canMark}
        >
          <Ionicons name="flag" size={16} color={colours.background} />
          <Text style={styles.checkpointButtonText}>Mark</Text>
        </Pressable>
        <Pressable
          style={[styles.undoMarkButton, !canUndo && styles.checkpointButtonDisabled]}
          onPress={onUndoMark}
          disabled={!canUndo}
        >
          <Ionicons name="arrow-undo" size={16} color={colours.text} />
        </Pressable>
      </View>

      <View style={styles.controlRow}>
        <Text style={styles.controlLabel}>Checkpoint Every</Text>
        <View style={styles.buttons}>
          <Pressable style={styles.smallButton} onPress={() => onCheckpointIntervalChange(-0.5)}>
            <Text style={styles.smallButtonText}>-</Text>
          </Pressable>
          <Text style={styles.controlValue}>{checkpointIntervalKm.toFixed(1)}km</Text>
          <Pressable style={styles.smallButton} onPress={() => onCheckpointIntervalChange(0.5)}>
            <Text style={styles.smallButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.navGrid}>
        <Metric value={`${nextCheckpointKm.toFixed(1)}km`} label="Next checkpoint" />
        <Metric value={`${checkpointRemainingKm.toFixed(1)}km`} label="Distance to CP" />
        <Metric value={formatDuration(checkpointEtaMinutes)} label="ETA to CP" />
        <Metric value={displayBearing == null ? '--' : formatHeading(displayBearing)} label="Current bearing" />
      </View>
    </Card>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.navItem}>
      <Text style={styles.navValue}>{value}</Text>
      <Text style={styles.navLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  navHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: responsiveSpacing('md') },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  muted: { ...typography.caption, color: colours.muted },
  checkpointButton: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  checkpointButtonDisabled: { opacity: 0.5 },
  checkpointButtonText: { ...typography.caption, color: colours.background, fontWeight: '900' },
  undoMarkButton: {
    minHeight: 40,
    width: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: responsiveSpacing('sm'), gap: responsiveSpacing('md') },
  controlLabel: { color: colours.text, fontWeight: '800' },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallButton: { width: touchTarget, height: touchTarget, borderRadius: 8, backgroundColor: colours.cyan, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: '#07111E', fontSize: 20, fontWeight: '900' },
  controlValue: { color: colours.text, fontWeight: '900', width: 55, textAlign: 'center' },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing('sm'), marginTop: responsiveSpacing('md') },
  navItem: {
    width: '47%',
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: responsiveSpacing('md'),
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  navValue: { color: colours.cyan, fontSize: 17, fontWeight: '900' },
  navLabel: { ...typography.label, color: colours.muted, marginTop: 3 },
});
