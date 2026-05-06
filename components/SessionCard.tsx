import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, shadow } from '../theme';
import { TrainingSession, TrackPoint } from '../data/mockData';
import { distanceBetween, getMapPoints } from '../utils/mapUtils';
import { formatCoordinate } from '../utils/coordinates';
import { showAlert } from '../lib/dialogs';

export function sessionIcon(type: TrainingSession['type']) {
  switch (type) {
    case 'Ruck': return 'footsteps-outline';
    case 'Strength':
    case 'Resistance': return 'barbell-outline';
    case 'Cardio': return 'heart-outline';
    case 'Mobility': return 'body-outline';
    case 'Run': return 'walk-outline';
    case 'Workout':
    default: return 'fitness-outline';
  }
}

function formatElapsed(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function routeDistanceKm(points: TrackPoint[] | undefined) {
  if (!points || points.length < 2) return 0;
  return points.slice(1).reduce((total, point, index) => total + distanceBetween(points[index], point), 0);
}

function formatDuration(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs <= 0) return `${mins} min`;
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

function buildRuckAar(session: TrainingSession) {
  const mission = session.ruckMission;
  const distanceKm = routeDistanceKm(session.routePoints);
  const actualPace = distanceKm > 0 ? session.durationMinutes / distanceKm : 0;
  const lines = [
    'RUCK AAR',
    session.title,
    `Distance: ${distanceKm.toFixed(2)}km`,
    `Duration: ${formatDuration(session.durationMinutes)}`,
    `Load: ${session.loadKg ?? 0}kg`,
    `Pace: ${actualPace > 0 ? actualPace.toFixed(1) : '--'} min/km`,
  ];

  if (mission) {
    const targetPace = mission.targetMinutes / Math.max(0.1, mission.targetDistanceKm);
    lines.push(
      `Target: ${mission.targetDistanceKm.toFixed(1)}km in ${formatDuration(mission.targetMinutes)}`,
      `Target pace: ${targetPace.toFixed(1)} min/km`,
      `Result: ${session.durationMinutes <= mission.targetMinutes ? 'On target' : 'Missed target'}`
    );
    if (mission.plannedCheckpoints.length > 0) {
      lines.push('', 'Checkpoints:');
      mission.plannedCheckpoints.forEach((cp, i) => {
        const coord = cp.latitude == null || cp.longitude == null ? 'NEEDS GRID' : formatCoordinate(cp.latitude, cp.longitude, 'mgrs');
        lines.push(`${i + 1}. ${cp.label} - ${cp.status.toUpperCase()} - ${coord}`);
      });
    }
    if (mission.splits && mission.splits.length > 0) {
      lines.push('', 'Splits:');
      mission.splits.forEach(split => lines.push(`KM ${split.km} - ${formatElapsed(split.splitSeconds)} (${formatElapsed(split.elapsedSeconds)} total)`));
    }
  }
  return lines.join('\n');
}

export type SessionCardProps = {
  session: TrainingSession;
  onEdit: (session: TrainingSession) => void;
  onDelete: (id: string) => void;
};

export const SessionCard = React.memo(function SessionCard({ session, onEdit, onDelete }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const mapPoints = getMapPoints(session.routePoints || []);

  const actualDistanceKm = routeDistanceKm(session.routePoints);
  const actualPace = actualDistanceKm > 0 ? session.durationMinutes / actualDistanceKm : 0;
  
  async function copyRuckAar() {
    const text = buildRuckAar(session);
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    try {
      if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
      await clipboard.writeText(text);
      showAlert('AAR copied', 'Ruck summary copied to clipboard.');
    } catch {
      showAlert('Copy unavailable', text);
    }
  }

  async function shareRuckAar() {
    try {
      await Share.share({ message: buildRuckAar(session) });
    } catch {
      showAlert('Share unavailable', 'Unable to open the share sheet on this device.');
    }
  }

  return (
    <View style={[styles.sessionCard, shadow.subtle]}>
      <View style={styles.sessionRow}>
        <View style={[styles.sessionIconWrap, { backgroundColor: colours.cyanDim, borderColor: colours.border }]}>
          <Ionicons
            name={sessionIcon(session.type)}
            size={18}
            color={colours.cyan}
          />
        </View>
        <View style={styles.sessionCopy}>
          <Text style={styles.sessionTitle}>{session.title}</Text>
          <Text style={styles.sessionMeta}>
            {session.type} · {session.durationMinutes} min · RPE {session.rpe}
          </Text>
        </View>
        <View style={styles.sessionRight}>
          <Text style={styles.score}>{session.score}</Text>
          <Text style={styles.scoreLabel}>SCORE</Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => onEdit(session)} style={styles.actionBtn}>
            <Ionicons name="pencil" size={18} color={colours.cyan} />
          </Pressable>
          <Pressable onPress={() => onDelete(session.id)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={18} color={colours.red} />
          </Pressable>
        </View>
      </View>

      {mapPoints.length > 0 && (
        <View style={styles.miniMapStage}>
          {mapPoints.map((point, index) => (
            <View
              key={index}
              style={[styles.trailDot, { left: `${point.x}%`, top: `${point.y}%` }]}
            />
          ))}
        </View>
      )}

      {session.ruckMission && (() => {
        const targetPace = session.ruckMission.targetMinutes / Math.max(0.1, session.ruckMission.targetDistanceKm);
        const splits = session.ruckMission.splits ?? [];
        const bestSplit = splits.length > 0 ? splits.reduce((best, split) => split.splitSeconds < best.splitSeconds ? split : best, splits[0]) : null;
        const slowestSplit = splits.length > 0 ? splits.reduce((slowest, split) => split.splitSeconds > slowest.splitSeconds ? split : slowest, splits[0]) : null;
        const reachedCount = session.ruckMission.plannedCheckpoints.filter((cp) => cp.status === 'reached').length;
        const finishOnTarget = session.durationMinutes <= session.ruckMission.targetMinutes;

        return (
          <>
            <Pressable style={styles.ruckReview} onPress={() => setExpanded(!expanded)}>
              <View style={styles.ruckReviewItem}>
                <Text style={styles.ruckReviewValue}>{session.ruckMission.targetDistanceKm.toFixed(1)}km</Text>
                <Text style={styles.ruckReviewLabel}>TARGET</Text>
              </View>
              <View style={styles.ruckReviewItem}>
                <Text style={styles.ruckReviewValue}>{reachedCount}/{session.ruckMission.plannedCheckpoints.length}</Text>
                <Text style={styles.ruckReviewLabel}>CHECKPOINTS</Text>
              </View>
              <View style={styles.ruckReviewItem}>
                <Text style={styles.ruckReviewValue}>{splits.length}</Text>
                <Text style={styles.ruckReviewLabel}>SPLITS</Text>
              </View>
              <View style={styles.ruckReviewItem}>
                <Text style={styles.ruckReviewValue}>{expanded ? 'HIDE' : 'VIEW'}</Text>
                <Text style={styles.ruckReviewLabel}>AAR</Text>
              </View>
            </Pressable>

            {expanded && (
              <View style={styles.ruckDetail}>
                <View style={styles.ruckDetailGrid}>
                  <View style={styles.ruckDetailItem}>
                    <Text style={styles.ruckDetailValue}>{actualDistanceKm.toFixed(2)}km</Text>
                    <Text style={styles.ruckReviewLabel}>ROUTE</Text>
                  </View>
                  <View style={styles.ruckDetailItem}>
                    <Text style={styles.ruckDetailValue}>{actualPace > 0 ? actualPace.toFixed(1) : '--'}</Text>
                    <Text style={styles.ruckReviewLabel}>ACTUAL /KM</Text>
                  </View>
                  <View style={styles.ruckDetailItem}>
                    <Text style={styles.ruckDetailValue}>{targetPace.toFixed(1)}</Text>
                    <Text style={styles.ruckReviewLabel}>TARGET /KM</Text>
                  </View>
                  <View style={styles.ruckDetailItem}>
                    <Text style={[styles.ruckDetailValue, { color: finishOnTarget ? colours.green : colours.amber }]}>{finishOnTarget ? 'ON' : 'MISS'}</Text>
                    <Text style={styles.ruckReviewLabel}>TARGET</Text>
                  </View>
                </View>

                <View style={styles.ruckDetailGrid}>
                  <View style={styles.ruckDetailItem}>
                    <Text style={styles.ruckDetailValue}>{Math.round(actualDistanceKm * (session.loadKg ?? 0))}</Text>
                    <Text style={styles.ruckReviewLabel}>KG-KM</Text>
                  </View>
                  <View style={styles.ruckDetailItem}>
                    <Text style={styles.ruckDetailValue}>{bestSplit ? formatElapsed(bestSplit.splitSeconds) : '--'}</Text>
                    <Text style={styles.ruckReviewLabel}>BEST SPLIT</Text>
                  </View>
                  <View style={styles.ruckDetailItem}>
                    <Text style={styles.ruckDetailValue}>{slowestSplit ? formatElapsed(slowestSplit.splitSeconds) : '--'}</Text>
                    <Text style={styles.ruckReviewLabel}>SLOW SPLIT</Text>
                  </View>
                  <View style={styles.ruckDetailItem}>
                    <Text style={styles.ruckDetailValue}>{session.loadKg ?? 0}kg</Text>
                    <Text style={styles.ruckReviewLabel}>LOAD</Text>
                  </View>
                </View>

                <View style={styles.aarActions}>
                  <Pressable style={styles.aarButton} onPress={copyRuckAar}>
                    <Ionicons name="copy-outline" size={15} color={colours.background} />
                    <Text style={styles.aarButtonText}>Copy AAR</Text>
                  </Pressable>
                  <Pressable style={styles.aarButton} onPress={shareRuckAar}>
                    <Ionicons name="share-outline" size={15} color={colours.background} />
                    <Text style={styles.aarButtonText}>Share</Text>
                  </Pressable>
                </View>

                {session.ruckMission.plannedCheckpoints.length > 0 && (
                  <View style={styles.ruckSection}>
                    <Text style={styles.ruckSectionTitle}>Checkpoints</Text>
                    {session.ruckMission.plannedCheckpoints.map((cp, index) => (
                      <View key={cp.id} style={styles.ruckCheckpointRow}>
                        <View style={[styles.statusDot, { backgroundColor: cp.status === 'reached' ? colours.green : cp.status === 'skipped' ? colours.red : colours.cyan }]} />
                        <View style={styles.ruckCheckpointCopy}>
                          <Text style={styles.ruckCheckpointTitle}>{index + 1}. {cp.label}</Text>
                          <Text style={styles.ruckCheckpointCoord}>
                            {cp.latitude == null || cp.longitude == null ? 'NEEDS GRID' : formatCoordinate(cp.latitude, cp.longitude, 'mgrs')}
                          </Text>
                        </View>
                        <Text style={styles.ruckCheckpointStatus}>{cp.status.toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {splits.length > 0 && (
                  <View style={styles.ruckSection}>
                    <Text style={styles.ruckSectionTitle}>Splits</Text>
                    {splits.map((split) => (
                      <View key={split.km} style={styles.ruckSplitRow}>
                        <Text style={styles.ruckSplitKm}>KM {split.km}</Text>
                        <Text style={styles.ruckSplitValue}>{formatElapsed(split.splitSeconds)}</Text>
                        <Text style={styles.ruckSplitMeta}>{formatElapsed(split.elapsedSeconds)} total</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        );
      })()}
    </View>
  );
});

const styles = StyleSheet.create({
  sessionCard: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 20, 35, 0.70)',
    marginBottom: 10,
    overflow: 'hidden',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  sessionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionCopy: { flex: 1 },
  sessionTitle: {
    color: colours.text,
    fontWeight: '800',
    fontSize: 13,
  },
  sessionMeta: {
    color: colours.muted,
    fontSize: 11,
    marginTop: 2,
  },
  sessionRight: { alignItems: 'flex-end' },
  score: {
    color: colours.cyan,
    fontSize: 20,
    fontWeight: '900',
  },
  scoreLabel: {
    color: colours.soft,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    marginLeft: 4,
  },
  actionBtn: {
    marginLeft: 2,
    padding: 6,
    justifyContent: 'center',
  },
  miniMapStage: {
    height: 80,
    backgroundColor: 'rgba(4,8,15,0.4)',
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
    position: 'relative',
  },
  trailDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: -2,
    marginTop: -2,
    backgroundColor: colours.cyan,
    opacity: 0.8,
  },
  ruckReview: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderColor: colours.borderSoft, padding: 10, backgroundColor: 'rgba(255,255,255,0.03)' },
  ruckReviewItem: { flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: colours.borderSoft, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  ruckReviewValue: { color: colours.cyan, fontSize: 13, fontWeight: '900' },
  ruckReviewLabel: { color: colours.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginTop: 2 },
  ruckDetail: { borderTopWidth: 1, borderColor: colours.borderSoft, padding: 10, gap: 10, backgroundColor: 'rgba(4,8,15,0.22)' },
  ruckDetailGrid: { flexDirection: 'row', gap: 8 },
  ruckDetailItem: { flex: 1, minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: colours.borderSoft, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  ruckDetailValue: { color: colours.text, fontSize: 13, fontWeight: '900' },
  aarActions: { flexDirection: 'row', gap: 8 },
  aarButton: { flex: 1, minHeight: 42, borderRadius: 8, backgroundColor: colours.cyan, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  aarButtonText: { color: colours.background, fontSize: 12, fontWeight: '900' },
  ruckSection: { borderRadius: 8, borderWidth: 1, borderColor: colours.borderSoft, backgroundColor: 'rgba(255,255,255,0.035)', overflow: 'hidden' },
  ruckSectionTitle: { color: colours.text, fontSize: 12, fontWeight: '900', paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6 },
  ruckCheckpointRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: colours.borderSoft },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  ruckCheckpointCopy: { flex: 1 },
  ruckCheckpointTitle: { color: colours.text, fontSize: 12, fontWeight: '900' },
  ruckCheckpointCoord: { color: colours.muted, fontSize: 10, fontWeight: '800', marginTop: 2 },
  ruckCheckpointStatus: { color: colours.muted, fontSize: 9, fontWeight: '900' },
  ruckSplitRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 10, borderTopWidth: 1, borderColor: colours.borderSoft },
  ruckSplitKm: { color: colours.text, fontSize: 11, fontWeight: '900', width: 50 },
  ruckSplitValue: { color: colours.cyan, fontSize: 13, fontWeight: '900', flex: 1, textAlign: 'center' },
  ruckSplitMeta: { color: colours.muted, fontSize: 10, fontWeight: '800', width: 82, textAlign: 'right' },
});
