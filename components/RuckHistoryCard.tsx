import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colours, touchTarget, typography } from '../theme';
import { TrainingSession } from '../data/mockData';
import { responsiveSpacing, statusColors } from '../utils/styling';
import { estimateRuckSessionDistanceKm, formatSessionDate, sessionTime } from '../utils/ruck';

export function RuckHistoryCard({ sessions }: { sessions: TrainingSession[] }) {
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const ruckHistory = useMemo(
    () => sessions.filter((session) => session.type === 'Ruck').sort((a, b) => sessionTime(b) - sessionTime(a)).slice(0, 6),
    [sessions]
  );
  const selectedHistoryRuck = ruckHistory.find((session) => session.id === selectedHistoryId) ?? ruckHistory[0];

  return (
    <Card>
      <View style={styles.navHeader}>
        <View>
          <Text style={styles.cardTitle}>Ruck History</Text>
          <Text style={styles.muted}>Saved loaded movement, GPS quality, and field notes</Text>
        </View>
        <View style={styles.historyCountBadge}>
          <Text style={styles.historyCountText}>{ruckHistory.length}</Text>
        </View>
      </View>

      {selectedHistoryRuck ? (
        <>
          <View style={styles.historyDetail}>
            <View style={styles.historyDetailHeader}>
              <View style={styles.sessionIcon}>
                <Ionicons name="footsteps-outline" size={18} color={colours.cyan} />
              </View>
              <View style={styles.historyDetailCopy}>
                <Text style={styles.historyTitle}>{selectedHistoryRuck.title}</Text>
                <Text style={styles.historyMeta}>
                  {formatSessionDate(selectedHistoryRuck)} | {selectedHistoryRuck.durationMinutes} min | RPE {selectedHistoryRuck.rpe}
                </Text>
              </View>
            </View>

            <View style={styles.historyMetricGrid}>
              <View style={styles.historyMetric}>
                <Text style={styles.historyMetricValue}>{estimateRuckSessionDistanceKm(selectedHistoryRuck).toFixed(2)}km</Text>
                <Text style={styles.historyMetricLabel}>Distance</Text>
              </View>
              <View style={styles.historyMetric}>
                <Text style={styles.historyMetricValue}>{selectedHistoryRuck.loadKg ?? 0}kg</Text>
                <Text style={styles.historyMetricLabel}>Load</Text>
              </View>
              <View style={styles.historyMetric}>
                <Text style={styles.historyMetricValue}>
                  {estimateRuckSessionDistanceKm(selectedHistoryRuck) > 0
                    ? (selectedHistoryRuck.durationMinutes / estimateRuckSessionDistanceKm(selectedHistoryRuck)).toFixed(1)
                    : '--'}
                </Text>
                <Text style={styles.historyMetricLabel}>Min/km</Text>
              </View>
              <View style={styles.historyMetric}>
                <Text style={[
                  styles.historyMetricValue,
                  {
                    color: selectedHistoryRuck.routeConfidence === 'Low'
                      ? colours.red
                      : selectedHistoryRuck.routeConfidence === 'Medium'
                        ? colours.amber
                        : colours.green,
                  },
                ]}>
                  {selectedHistoryRuck.routeConfidence ?? 'Manual'}
                </Text>
                <Text style={styles.historyMetricLabel}>GPS</Text>
              </View>
            </View>

            {selectedHistoryRuck.note ? (
              <Text style={styles.historyNote}>{selectedHistoryRuck.note}</Text>
            ) : null}

            <Text style={styles.historyQuality}>
              {selectedHistoryRuck.averageAccuracyMeters ? `Average GPS +/-${selectedHistoryRuck.averageAccuracyMeters}m` : 'No GPS accuracy saved'}
              {selectedHistoryRuck.rejectedPointCount != null ? ` | ${selectedHistoryRuck.rejectedPointCount} rejected point${selectedHistoryRuck.rejectedPointCount === 1 ? '' : 's'}` : ''}
              {selectedHistoryRuck.ruckMission?.plannedCheckpoints?.length ? ` | ${selectedHistoryRuck.ruckMission.plannedCheckpoints.filter((checkpoint) => checkpoint.status === 'reached').length}/${selectedHistoryRuck.ruckMission.plannedCheckpoints.length} checkpoints` : ''}
            </Text>
          </View>

          <View style={styles.historyList}>
            {ruckHistory.map((session) => {
              const selected = session.id === selectedHistoryRuck.id;
              return (
                <Pressable
                  key={session.id}
                  style={[styles.historyRow, selected && styles.historyRowActive]}
                  onPress={() => setSelectedHistoryId(session.id)}
                >
                  <View style={styles.historyRowCopy}>
                    <Text style={styles.historyRowTitle}>{session.title}</Text>
                    <Text style={styles.historyRowMeta}>
                      {formatSessionDate(session)} | {session.durationMinutes} min | {session.loadKg ?? 0}kg
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={selected ? colours.cyan : colours.muted} />
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.emptyHistory}>
          <Text style={styles.historyTitle}>No rucks saved yet</Text>
          <Text style={styles.historyMeta}>Track a GPS ruck or save a planned ruck to build your loaded movement history.</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  navHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: responsiveSpacing('md') },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  muted: { ...typography.caption, color: colours.muted },
  historyCountBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderHot,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.cyanDim,
  },
  historyCountText: { color: colours.cyan, fontWeight: '900', fontSize: 14 },
  historyDetail: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: responsiveSpacing('md'),
    marginTop: responsiveSpacing('md'),
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  historyDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyDetailCopy: { flex: 1 },
  historyTitle: { color: colours.text, fontSize: 15, fontWeight: '900' },
  historyMeta: { ...typography.caption, color: colours.muted, fontWeight: '800', marginTop: 3 },
  historyMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing('sm'), marginTop: responsiveSpacing('md') },
  historyMetric: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 9,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  historyMetricValue: { color: colours.text, fontSize: 15, fontWeight: '900' },
  historyMetricLabel: { ...typography.label, color: colours.muted, marginTop: 2 },
  historyNote: {
    ...typography.caption,
    color: colours.textSoft,
    lineHeight: 18,
    borderLeftWidth: 2,
    borderLeftColor: colours.cyan,
    paddingLeft: 10,
    marginTop: 12,
  },
  historyQuality: { ...typography.caption, color: colours.muted, fontWeight: '800', lineHeight: 16, marginTop: 10 },
  historyList: { gap: 8, marginTop: 12 },
  historyRow: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  historyRowActive: { borderColor: statusColors(colours.cyan).borderMed, backgroundColor: statusColors(colours.cyan).bgMed },
  historyRowCopy: { flex: 1 },
  historyRowTitle: { color: colours.text, fontSize: 12, fontWeight: '900' },
  historyRowMeta: { ...typography.label, color: colours.muted, marginTop: 2 },
  emptyHistory: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
