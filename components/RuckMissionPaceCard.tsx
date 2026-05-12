import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colours, touchTarget, typography } from '../theme';
import {
  formatDuration,
  formatSignedMinutes,
  type FinishMode,
  type RuckTemplate,
} from '../utils/ruck';
import { responsiveSpacing, statusColors } from '../utils/styling';

export function RuckMissionPaceCard({
  currentDistance,
  targetDeltaMinutes,
  templates,
  activeTemplateId,
  templateNameInput,
  targetDistanceKm,
  targetMinutes,
  targetPaceLabel,
  targetRemainingKm,
  targetEtaMinutes,
  targetProjectedMinutes,
  finishMode,
  finishOnTarget,
  finishLabel,
  finishDistanceRemainingKm,
  finishEtaMinutes,
  finishRequiredPace,
  onApplyTemplate,
  onDeleteTemplate,
  onTemplateNameChange,
  onSaveTemplate,
  onTargetDistanceChange,
  onTargetMinutesChange,
  onFinishModeChange,
}: {
  currentDistance: number;
  targetDeltaMinutes: number;
  templates: RuckTemplate[];
  activeTemplateId: string | null;
  templateNameInput: string;
  targetDistanceKm: number;
  targetMinutes: number;
  targetPaceLabel: string;
  targetRemainingKm: number;
  targetEtaMinutes: number;
  targetProjectedMinutes: number | null;
  finishMode: FinishMode;
  finishOnTarget: boolean;
  finishLabel: string;
  finishDistanceRemainingKm: number;
  finishEtaMinutes: number;
  finishRequiredPace: number;
  onApplyTemplate: (template: RuckTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onTemplateNameChange: (name: string) => void;
  onSaveTemplate: () => void;
  onTargetDistanceChange: (amount: number) => void;
  onTargetMinutesChange: (amount: number) => void;
  onFinishModeChange: (mode: FinishMode) => void;
}) {
  const targetTone = targetDeltaMinutes <= 0 ? colours.green : colours.amber;
  const finishTone = finishOnTarget ? colours.green : colours.amber;

  return (
    <Card>
      <View style={styles.navHeader}>
        <View>
          <Text style={styles.cardTitle}>Mission Pace</Text>
          <Text style={styles.muted}>Target, splits, checkpoints</Text>
        </View>
        <View style={[styles.signalBadge, { borderColor: statusColors(targetTone).borderMed, backgroundColor: statusColors(targetTone).bgMed }]}>
          <Text style={[styles.signalText, { color: targetTone }]}>
            {currentDistance > 0.02 ? formatSignedMinutes(targetDeltaMinutes).toUpperCase() : 'READY'}
          </Text>
        </View>
      </View>

      <View style={styles.templateGrid}>
        {templates.map((template) => {
          const selected = activeTemplateId === template.id;
          return (
            <Pressable
              key={template.id}
              style={[styles.templateButton, selected && styles.templateButtonActive]}
              onPress={() => onApplyTemplate(template)}
            >
              {template.custom && (
                <Pressable style={styles.templateDelete} onPress={() => onDeleteTemplate(template.id)}>
                  <Ionicons name="close" size={13} color={colours.text} />
                </Pressable>
              )}
              <Text style={[styles.templateTitle, selected && styles.templateTitleActive]}>{template.label}</Text>
              <Text style={styles.templateDetail}>{template.detail}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.templateSaveRow}>
        <TextInput
          value={templateNameInput}
          onChangeText={onTemplateNameChange}
          placeholder="Template name"
          placeholderTextColor={colours.soft}
          style={styles.templateNameInput}
        />
        <Pressable style={styles.templateSaveButton} onPress={onSaveTemplate}>
          <Ionicons name="save" size={16} color={colours.background} />
          <Text style={styles.templateSaveText}>Save</Text>
        </Pressable>
      </View>

      <StepperRow label="Target Distance" value={`${targetDistanceKm.toFixed(1)}km`} onDecrement={() => onTargetDistanceChange(-0.5)} onIncrement={() => onTargetDistanceChange(0.5)} />
      <StepperRow label="Target Time" value={formatDuration(targetMinutes)} onDecrement={() => onTargetMinutesChange(-5)} onIncrement={() => onTargetMinutesChange(5)} />

      <View style={styles.navGrid}>
        <Metric value={targetPaceLabel} label="Target pace" />
        <Metric value={`${targetRemainingKm.toFixed(1)}km`} label="Remaining" />
        <Metric value={formatDuration(targetEtaMinutes)} label="ETA at current pace" />
        <Metric value={targetProjectedMinutes == null ? '--' : formatDuration(targetProjectedMinutes)} label="Projected finish" />
      </View>

      <View style={styles.finishModeRow}>
        {([
          ['target', 'Target'],
          ['finalCheckpoint', 'Final CP'],
          ['selectedCheckpoint', 'Selected CP'],
        ] as const).map(([mode, label]) => {
          const selected = finishMode === mode;
          return (
            <Pressable
              key={mode}
              style={[styles.finishModeButton, selected && styles.finishModeButtonActive]}
              onPress={() => onFinishModeChange(mode)}
            >
              <Text style={[styles.finishModeText, selected && styles.finishModeTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.finishPanel, { borderColor: statusColors(finishTone).borderMed, backgroundColor: statusColors(finishTone).bgMed }]}>
        <View>
          <Text style={[styles.finishPanelTitle, { color: finishTone }]}>
            {finishOnTarget ? 'Finish on target' : 'Finish at risk'}
          </Text>
          <Text style={styles.finishPanelDetail}>{finishLabel}</Text>
        </View>
        <View style={styles.finishPanelMetrics}>
          <FinishMetric value={`${finishDistanceRemainingKm.toFixed(1)}km`} label="LEFT" />
          <FinishMetric value={formatDuration(finishEtaMinutes)} label="ETA" />
          <FinishMetric value={finishRequiredPace > 0 ? finishRequiredPace.toFixed(1) : '--'} label="REQ /KM" />
        </View>
      </View>
    </Card>
  );
}

function StepperRow({ label, value, onDecrement, onIncrement }: { label: string; value: string; onDecrement: () => void; onIncrement: () => void }) {
  return (
    <View style={styles.controlRow}>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={styles.buttons}>
        <Pressable style={styles.smallButton} onPress={onDecrement}>
          <Text style={styles.smallButtonText}>-</Text>
        </Pressable>
        <Text style={styles.controlValue}>{value}</Text>
        <Pressable style={styles.smallButton} onPress={onIncrement}>
          <Text style={styles.smallButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
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

function FinishMetric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.finishMetric}>
      <Text style={styles.finishMetricValue}>{value}</Text>
      <Text style={styles.finishMetricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  navHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: responsiveSpacing('md') },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  muted: { ...typography.caption, color: colours.muted },
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
  signalText: { ...typography.label, color: colours.muted, letterSpacing: 1 },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  templateButton: {
    width: '48%',
    minHeight: 76,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
  },
  templateButtonActive: {
    borderColor: statusColors(colours.cyan).borderMed,
    backgroundColor: statusColors(colours.cyan).bgMed,
  },
  templateDelete: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateTitle: { color: colours.text, fontSize: 12, fontWeight: '900', paddingRight: 16 },
  templateTitleActive: { color: colours.cyan },
  templateDetail: { ...typography.caption, color: colours.muted, fontWeight: '800', marginTop: 3 },
  templateSaveRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  templateNameInput: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: colours.text,
    paddingHorizontal: 12,
    fontWeight: '800',
  },
  templateSaveButton: {
    minHeight: touchTarget,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  templateSaveText: { color: colours.background, fontWeight: '900' },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: responsiveSpacing('sm'), gap: responsiveSpacing('md') },
  controlLabel: { color: colours.text, fontWeight: '800' },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallButton: { width: touchTarget, height: touchTarget, borderRadius: 8, backgroundColor: colours.cyan, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: colours.background, fontSize: 20, fontWeight: '900' },
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
  finishModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  finishModeButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  finishModeButtonActive: {
    borderColor: statusColors(colours.cyan).borderMed,
    backgroundColor: statusColors(colours.cyan).bgMed,
  },
  finishModeText: { ...typography.caption, color: colours.muted, fontWeight: '900' },
  finishModeTextActive: { color: colours.cyan },
  finishPanel: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
    gap: 10,
  },
  finishPanelTitle: { fontSize: 14, fontWeight: '900' },
  finishPanelDetail: { color: colours.textSoft, fontSize: 12, fontWeight: '800', marginTop: 2 },
  finishPanelMetrics: { flexDirection: 'row', gap: 8 },
  finishMetric: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  finishMetricValue: { color: colours.text, fontSize: 13, fontWeight: '900' },
  finishMetricLabel: { ...typography.label, color: colours.muted, letterSpacing: 0.8, marginTop: 2 },
});
