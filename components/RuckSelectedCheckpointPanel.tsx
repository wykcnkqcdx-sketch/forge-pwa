import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, touchTarget, typography } from '../theme';
import type { RuckCheckpoint } from '../data/domain';
import type { TrackPoint } from '../data/mockData';
import { formatDuration, formatHeading } from '../utils/ruck';
import { type CoordinateFormat, formatCoordinate } from '../utils/coordinates';
import { formatFieldMarkLabel, getFieldMarkType } from '../utils/ruckFieldMarks';
import { responsiveSpacing, statusColors } from '../utils/styling';

export function RuckSelectedCheckpointPanel({
  selectedCheckpoint,
  selectedCheckpointPoint,
  plannedCheckpoints,
  checkpointLabelInput,
  selectedCheckpointDistanceKm,
  selectedCheckpointBearing,
  selectedCheckpointEtaMinutes,
  coordinateFormat,
  onCheckpointLabelChange,
  onSaveCheckpointLabel,
  onStatusChange,
  onFocusMark,
  onClearSelected,
  onUndoLast,
  onClearAll,
}: {
  selectedCheckpoint: RuckCheckpoint | null;
  selectedCheckpointPoint: (RuckCheckpoint & TrackPoint) | null;
  plannedCheckpoints: RuckCheckpoint[];
  checkpointLabelInput: string;
  selectedCheckpointDistanceKm: number | null;
  selectedCheckpointBearing: number | null;
  selectedCheckpointEtaMinutes: number | null;
  coordinateFormat: CoordinateFormat;
  onCheckpointLabelChange: (label: string) => void;
  onSaveCheckpointLabel: () => void;
  onStatusChange: (status: RuckCheckpoint['status']) => void;
  onFocusMark: (checkpointId: string) => void;
  onClearSelected: () => void;
  onUndoLast: () => void;
  onClearAll: () => void;
}) {
  if (!selectedCheckpoint) {
    return (
      <Text style={styles.navGuide}>Use the active coordinate format selector above the map. LAT/LON, DMS, UTM, and MGRS are accepted.</Text>
    );
  }

  const selectedCheckpointMeta = getFieldMarkType(selectedCheckpoint.markType);

  return (
    <>
      <View style={styles.coordinateEntry}>
        <TextInput
          value={checkpointLabelInput}
          onChangeText={onCheckpointLabelChange}
          placeholder="Checkpoint label"
          placeholderTextColor={colours.soft}
          autoCapitalize="words"
          style={styles.coordinateInput}
        />
        <Pressable style={styles.coordinateAddButton} onPress={onSaveCheckpointLabel}>
          <Ionicons name="checkmark" size={18} color={colours.background} />
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        {(['planned', 'reached', 'skipped'] as const).map((statusOption) => {
          const selected = selectedCheckpoint.status === statusOption;
          return (
            <Pressable
              key={statusOption}
              style={[styles.statusButton, selected && styles.statusButtonActive]}
              onPress={() => onStatusChange(statusOption)}
            >
              <Text style={[styles.statusButtonText, selected && styles.statusButtonTextActive]}>{statusOption.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.navGrid}>
        <View style={styles.navItem}>
          <Text style={[styles.navValue, { color: selectedCheckpointMeta.tone }]}>{formatFieldMarkLabel(selectedCheckpoint)}</Text>
          <Text style={styles.navLabel}>{selectedCheckpoint.status} | {selectedCheckpoint.source === 'current' ? 'GPS mark' : 'Manual mark'}</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navValue}>{selectedCheckpointDistanceKm == null ? '--' : `${selectedCheckpointDistanceKm.toFixed(2)}km`}</Text>
          <Text style={styles.navLabel}>Distance to CP</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navValue}>{selectedCheckpointBearing == null ? '--' : formatHeading(selectedCheckpointBearing)}</Text>
          <Text style={styles.navLabel}>Bearing to CP</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navValue}>{selectedCheckpointEtaMinutes == null ? '--' : formatDuration(selectedCheckpointEtaMinutes)}</Text>
          <Text style={styles.navLabel}>ETA to CP</Text>
        </View>
      </View>

      <Text style={styles.coordinateText}>
        {selectedCheckpointPoint
          ? formatCoordinate(selectedCheckpointPoint.latitude, selectedCheckpointPoint.longitude, coordinateFormat)
          : 'NEEDS GRID'}
      </Text>

      <View style={styles.checkpointList}>
        {plannedCheckpoints.map((checkpoint) => {
          const selected = selectedCheckpoint.id === checkpoint.id;
          return (
            <Pressable
              key={checkpoint.id}
              style={[styles.checkpointPill, selected && styles.checkpointPillActive]}
              onPress={() => onFocusMark(checkpoint.id)}
            >
              <Text style={[styles.checkpointPillText, selected && styles.checkpointPillTextActive]}>{formatFieldMarkLabel(checkpoint)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.checkpointActions}>
        <Pressable style={styles.clearCheckpointButton} onPress={onClearSelected}>
          <Text style={styles.clearCheckpointText}>Remove selected</Text>
        </Pressable>
        <Pressable style={styles.clearCheckpointButton} onPress={onUndoLast}>
          <Text style={styles.clearCheckpointText}>Undo last</Text>
        </Pressable>
        <Pressable style={styles.clearCheckpointButton} onPress={onClearAll}>
          <Text style={styles.clearCheckpointText}>Clear all</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  coordinateEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  coordinateInput: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.05)',
    ...typography.caption,
    color: colours.text,
    fontWeight: '800',
    paddingHorizontal: 12,
  },
  coordinateAddButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  statusButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  statusButtonActive: {
    borderColor: statusColors(colours.green).borderMed,
    backgroundColor: statusColors(colours.green).bgMed,
  },
  statusButtonText: { ...typography.label, color: colours.muted },
  statusButtonTextActive: { color: colours.green },
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
  coordinateText: { ...typography.caption, color: colours.muted, textAlign: 'center', marginTop: 10 },
  checkpointList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  checkpointPill: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  checkpointPillActive: {
    borderColor: statusColors(colours.amber).borderMed,
    backgroundColor: statusColors(colours.amber).bgMed,
  },
  checkpointPillText: { ...typography.caption, color: colours.muted, fontWeight: '900' },
  checkpointPillTextActive: { color: colours.amber },
  checkpointActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  clearCheckpointButton: {
    minHeight: 40,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  clearCheckpointText: { ...typography.caption, color: colours.muted, fontWeight: '900' },
  navGuide: { color: colours.textSoft, fontSize: 13, lineHeight: 19, marginTop: 12 },
});
