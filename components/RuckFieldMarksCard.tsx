import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { RuckFieldMarkTypePicker } from './RuckFieldMarkTypePicker';
import { RuckSelectedCheckpointPanel } from './RuckSelectedCheckpointPanel';
import { colours, touchTarget, typography } from '../theme';
import type { RuckCheckpoint } from '../data/domain';
import type { TrackPoint } from '../data/mockData';
import { formatHeading } from '../utils/ruck';
import { type CoordinateFormat } from '../utils/coordinates';
import {
  formatFieldMarkLabel,
  getFieldMarkType,
  type FieldMarkType,
} from '../utils/ruckFieldMarks';
import { responsiveSpacing, statusColors } from '../utils/styling';

type BearingGuidance = {
  label: string;
  detail: string;
  tone: string;
};

export function RuckFieldMarksCard({
  arrivalCheckpoint,
  plannedCheckpoints,
  nearestCheckpointDistanceMeters,
  activeMarkType,
  selectedCheckpoint,
  selectedCheckpointPoint,
  selectedCheckpointDistanceKm,
  selectedCheckpointBearing,
  selectedCheckpointEtaMinutes,
  checkpointCoordinateInput,
  checkpointBulkInput,
  checkpointLabelInput,
  coordinateFormat,
  bearingGuidance,
  onAddCheckpointHere,
  onCoordinateInputChange,
  onAddCheckpointFromInput,
  onMarkTypeSelect,
  onMoveSelectedToGrid,
  onMoveSelectedHere,
  onCheckpointLabelChange,
  onSaveCheckpointLabel,
  onStatusChange,
  onFocusMark,
  onClearSelected,
  onUndoLast,
  onClearAll,
  onBulkInputChange,
  onImportCheckpoints,
}: {
  arrivalCheckpoint: RuckCheckpoint | null;
  plannedCheckpoints: RuckCheckpoint[];
  nearestCheckpointDistanceMeters: number | null;
  activeMarkType: FieldMarkType;
  selectedCheckpoint: RuckCheckpoint | null;
  selectedCheckpointPoint: (RuckCheckpoint & TrackPoint) | null;
  selectedCheckpointDistanceKm: number | null;
  selectedCheckpointBearing: number | null;
  selectedCheckpointEtaMinutes: number | null;
  checkpointCoordinateInput: string;
  checkpointBulkInput: string;
  checkpointLabelInput: string;
  coordinateFormat: CoordinateFormat;
  bearingGuidance: BearingGuidance;
  onAddCheckpointHere: () => void;
  onCoordinateInputChange: (coordinate: string) => void;
  onAddCheckpointFromInput: () => void;
  onMarkTypeSelect: (markType: FieldMarkType) => void;
  onMoveSelectedToGrid: () => void;
  onMoveSelectedHere: () => void;
  onCheckpointLabelChange: (label: string) => void;
  onSaveCheckpointLabel: () => void;
  onStatusChange: (status: RuckCheckpoint['status']) => void;
  onFocusMark: (checkpointId: string) => void;
  onClearSelected: () => void;
  onUndoLast: () => void;
  onClearAll: () => void;
  onBulkInputChange: (bulkText: string) => void;
  onImportCheckpoints: () => void;
}) {
  return (
    <Card>
      <View style={styles.navHeader}>
        <View>
          <Text style={styles.cardTitle}>FORGE Field Marks</Text>
          <Text style={styles.muted}>
            {arrivalCheckpoint
              ? `${formatFieldMarkLabel(arrivalCheckpoint)} reached inside 50m`
              : plannedCheckpoints.length > 0
                ? `${plannedCheckpoints.length} mapped${nearestCheckpointDistanceMeters != null ? ` | nearest ${nearestCheckpointDistanceMeters}m` : ''}`
                : 'Drop a mark from GPS, map tap, or grid'}
          </Text>
        </View>
        <Pressable style={styles.checkpointButton} onPress={onAddCheckpointHere}>
          <Ionicons name={getFieldMarkType(activeMarkType).icon} size={16} color={colours.background} />
          <Text style={styles.checkpointButtonText}>Drop</Text>
        </Pressable>
      </View>

      <View style={[styles.bearingPanel, { borderColor: statusColors(bearingGuidance.tone).borderMed, backgroundColor: statusColors(bearingGuidance.tone).bgMed }]}>
        <View>
          <Text style={[styles.bearingPanelTitle, { color: bearingGuidance.tone }]}>{bearingGuidance.label}</Text>
          <Text style={styles.bearingPanelDetail}>{bearingGuidance.detail}</Text>
        </View>
        <View style={styles.bearingPanelMetric}>
          <Text style={styles.bearingPanelValue}>{selectedCheckpointBearing == null ? '--' : formatHeading(selectedCheckpointBearing)}</Text>
          <Text style={styles.bearingPanelLabel}>TO CP</Text>
        </View>
      </View>

      <View style={styles.coordinateEntry}>
        <TextInput
          value={checkpointCoordinateInput}
          onChangeText={onCoordinateInputChange}
          placeholder={coordinateFormat === 'mgrs' ? '29U PV 82123 12345' : coordinateFormat === 'utm' ? '29U 682123E 5912345N' : '53.34981, -6.26031'}
          placeholderTextColor={colours.soft}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.coordinateInput}
        />
        <Pressable style={styles.coordinateAddButton} onPress={onAddCheckpointFromInput}>
          <Ionicons name="add" size={18} color={colours.background} />
        </Pressable>
      </View>

      <RuckFieldMarkTypePicker
        activeMarkType={activeMarkType}
        selectedMarkType={selectedCheckpoint?.markType}
        onSelect={onMarkTypeSelect}
      />

      <View style={styles.checkpointActions}>
        <Pressable style={styles.clearCheckpointButton} onPress={onMoveSelectedToGrid} disabled={!selectedCheckpoint}>
          <Text style={styles.clearCheckpointText}>Move to grid</Text>
        </Pressable>
        <Pressable style={styles.clearCheckpointButton} onPress={onMoveSelectedHere} disabled={!selectedCheckpoint}>
          <Text style={styles.clearCheckpointText}>Move here</Text>
        </Pressable>
      </View>

      <RuckSelectedCheckpointPanel
        selectedCheckpoint={selectedCheckpoint}
        selectedCheckpointPoint={selectedCheckpointPoint}
        plannedCheckpoints={plannedCheckpoints}
        checkpointLabelInput={checkpointLabelInput}
        selectedCheckpointDistanceKm={selectedCheckpointDistanceKm}
        selectedCheckpointBearing={selectedCheckpointBearing}
        selectedCheckpointEtaMinutes={selectedCheckpointEtaMinutes}
        coordinateFormat={coordinateFormat}
        onCheckpointLabelChange={onCheckpointLabelChange}
        onSaveCheckpointLabel={onSaveCheckpointLabel}
        onStatusChange={onStatusChange}
        onFocusMark={onFocusMark}
        onClearSelected={onClearSelected}
        onUndoLast={onUndoLast}
        onClearAll={onClearAll}
      />

      <TextInput
        value={checkpointBulkInput}
        onChangeText={onBulkInputChange}
        placeholder={'Bulk import, one per line\nRV: 29U PV 82123 12345\nBridge: 29U 682123E 5912345N'}
        placeholderTextColor={colours.soft}
        autoCapitalize="characters"
        autoCorrect={false}
        multiline
        style={styles.bulkInput}
      />
      <Pressable style={styles.importButton} onPress={onImportCheckpoints}>
        <Ionicons name="download" size={16} color={colours.background} />
        <Text style={styles.checkpointButtonText}>Import checkpoints</Text>
      </Pressable>
    </Card>
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
  checkpointButtonText: { ...typography.caption, color: colours.background, fontWeight: '900' },
  bearingPanel: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bearingPanelTitle: { fontSize: 13, fontWeight: '900' },
  bearingPanelDetail: { ...typography.caption, color: colours.textSoft, fontWeight: '800', marginTop: 2 },
  bearingPanelMetric: { alignItems: 'flex-end' },
  bearingPanelValue: { color: colours.text, fontSize: 15, fontWeight: '900' },
  bearingPanelLabel: { ...typography.label, color: colours.muted, letterSpacing: 1 },
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
  bulkInput: {
    minHeight: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.05)',
    ...typography.caption,
    color: colours.text,
    fontWeight: '800',
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    textAlignVertical: 'top',
  },
  importButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
});
