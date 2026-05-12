import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, shadow } from '../theme';
import { responsiveSpacing, statusColors } from '../utils/styling';
import type { TrainingSession } from '../data/domain';
import { buildDayRecommendation } from '../lib/aiGuidance';
import { sessionIcon, sessionTone } from './SessionCard';

const SESSION_TYPES: TrainingSession['type'][] = ['Strength', 'Ruck', 'Run', 'Cardio', 'Resistance', 'Workout', 'Mobility'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
    full: d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}

type Props = {
  visible: boolean;
  date: string;
  daySessions: TrainingSession[];
  allSessions: TrainingSession[];
  onClose: () => void;
  onAddSession: (session: TrainingSession) => void;
};

export function DayDetailModal({ visible, date, daySessions, allSessions, onClose, onAddSession }: Props) {
  const [logType, setLogType] = useState<TrainingSession['type']>('Strength');
  const [logDuration, setLogDuration] = useState(45);
  const [logRpe, setLogRpe] = useState(7);
  const [showLog, setShowLog] = useState(false);

  const { weekday, full } = useMemo(() => formatDate(date), [date]);
  const today = new Date().toISOString().slice(0, 10);
  const isFuture = date > today;
  const isToday = date === today;
  const isPast = date < today;

  const recommendation = useMemo(() => buildDayRecommendation(date, allSessions), [date, allSessions]);

  function handleLog() {
    const tone = sessionTone(logType);
    onAddSession({
      id: `cal-${Date.now()}`,
      type: logType,
      title: `${logType} Session`,
      score: Math.round(logDuration * logRpe * 0.75),
      durationMinutes: logDuration,
      rpe: logRpe,
      completedAt: date + 'T12:00:00.000Z',
      updatedAt: new Date().toISOString(),
    });
    setShowLog(false);
    onClose();
  }

  const statusLabel = isToday ? 'TODAY' : isFuture ? 'PLANNED' : isPast && daySessions.length === 0 ? 'REST' : 'LOGGED';
  const statusColor = isToday ? colours.cyan : isFuture ? colours.violet : daySessions.length > 0 ? colours.green : colours.muted;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.panel, shadow.card]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.headerTop}>
                <Text style={styles.weekday}>{weekday}</Text>
                <View style={[styles.statusBadge, { borderColor: statusColor, backgroundColor: `${statusColor}20` }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.fullDate}>{full}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colours.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.scrollContent}>

            {/* Sessions logged */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {daySessions.length > 0 ? `SESSIONS LOGGED (${daySessions.length})` : isPast ? 'REST DAY' : 'NO SESSIONS YET'}
              </Text>
              {daySessions.length > 0 ? daySessions.map(s => {
                const tone = sessionTone(s.type);
                return (
                  <View key={s.id} style={[styles.sessionRow, { borderLeftColor: tone }]}>
                    <View style={[styles.sessionIconWrap, { backgroundColor: `${tone}20` }]}>
                      <Ionicons name={sessionIcon(s.type) as any} size={16} color={tone} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionTitle}>{s.title}</Text>
                      <Text style={styles.sessionMeta}>{s.type} · {formatDuration(s.durationMinutes)} · RPE {s.rpe}</Text>
                    </View>
                    <View style={styles.sessionScore}>
                      <Text style={[styles.sessionScoreVal, { color: tone }]}>{s.score}</Text>
                      <Text style={styles.sessionScoreLabel}>PTS</Text>
                    </View>
                  </View>
                );
              }) : (
                <Text style={styles.emptyText}>
                  {isPast ? 'No training logged. Tap below to add a backdated session.' : 'Plan your session below.'}
                </Text>
              )}
            </View>

            {/* AI Recommendation */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>AI RECOMMENDATION</Text>
                <View style={[styles.recTypeBadge, { backgroundColor: `${recommendation.tone}20`, borderColor: recommendation.tone }]}>
                  <Text style={[styles.recTypeText, { color: recommendation.tone }]}>{recommendation.type.toUpperCase()}</Text>
                </View>
              </View>
              <View style={[styles.recPanel, { borderColor: `${recommendation.tone}40` }]}>
                <View style={styles.recHeader}>
                  <Ionicons name={sessionIcon(recommendation.type) as any} size={18} color={recommendation.tone} />
                  <Text style={[styles.recHeadline, { color: recommendation.tone }]}>{recommendation.headline}</Text>
                </View>
                <Text style={styles.recRationale}>{recommendation.rationale}</Text>
                <View style={styles.recMeta}>
                  <View style={styles.recMetaChip}>
                    <Ionicons name="time-outline" size={11} color={colours.muted} />
                    <Text style={styles.recMetaText}>{recommendation.suggestedDuration} min</Text>
                  </View>
                  <View style={styles.recMetaChip}>
                    <Ionicons name="speedometer-outline" size={11} color={colours.muted} />
                    <Text style={styles.recMetaText}>RPE {recommendation.suggestedRpe}</Text>
                  </View>
                </View>
                <View style={styles.exerciseList}>
                  {recommendation.exercises.map((ex, i) => (
                    <View key={i} style={styles.exerciseRow}>
                      <View style={[styles.exerciseDot, { backgroundColor: recommendation.tone }]} />
                      <Text style={styles.exerciseText}>{ex}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Quick Log — not for future dates */}
            {!isFuture && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>{isToday ? 'LOG SESSION' : 'ADD BACKDATED SESSION'}</Text>
                  <Pressable onPress={() => setShowLog(v => !v)} style={styles.toggleLogBtn}>
                    <Ionicons name={showLog ? 'chevron-up' : 'chevron-down'} size={14} color={colours.cyan} />
                    <Text style={styles.toggleLogText}>{showLog ? 'HIDE' : 'OPEN'}</Text>
                  </Pressable>
                </View>

                {showLog && (
                  <View style={styles.logForm}>
                    {/* Type picker */}
                    <Text style={styles.logFieldLabel}>SESSION TYPE</Text>
                    <View style={styles.typePicker}>
                      {SESSION_TYPES.map(t => {
                        const active = logType === t;
                        const tone = sessionTone(t);
                        return (
                          <Pressable
                            key={t}
                            onPress={() => { setLogType(t); setLogDuration(recommendation.type === t ? recommendation.suggestedDuration : logDuration); setLogRpe(recommendation.type === t ? recommendation.suggestedRpe : logRpe); }}
                            style={[styles.typePill, active && { backgroundColor: `${tone}25`, borderColor: tone }]}
                          >
                            <Ionicons name={sessionIcon(t) as any} size={12} color={active ? tone : colours.muted} />
                            <Text style={[styles.typePillText, active && { color: tone }]}>{t}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Duration */}
                    <Text style={styles.logFieldLabel}>DURATION</Text>
                    <View style={styles.stepperRow}>
                      {[15, 30, 45, 60, 75, 90].map(d => (
                        <Pressable key={d} onPress={() => setLogDuration(d)} style={[styles.durationChip, logDuration === d && styles.durationChipActive]}>
                          <Text style={[styles.durationChipText, logDuration === d && styles.durationChipTextActive]}>{d}m</Text>
                        </Pressable>
                      ))}
                    </View>

                    {/* RPE */}
                    <Text style={styles.logFieldLabel}>RPE (RATE OF PERCEIVED EXERTION)</Text>
                    <View style={styles.rpeRow}>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => {
                        const active = logRpe === n;
                        const rpeColor = n >= 8 ? colours.red : n >= 5 ? colours.amber : colours.green;
                        return (
                          <Pressable key={n} onPress={() => setLogRpe(n)} style={[styles.rpeBtn, active && { backgroundColor: `${rpeColor}30`, borderColor: rpeColor }]}>
                            <Text style={[styles.rpeBtnText, active && { color: rpeColor }]}>{n}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Summary preview */}
                    <View style={[styles.logPreview, { borderColor: `${sessionTone(logType)}40` }]}>
                      <Text style={styles.logPreviewText}>
                        {logType} · {formatDuration(logDuration)} · RPE {logRpe} · ~{Math.round(logDuration * logRpe * 0.75)} pts
                      </Text>
                    </View>

                    <Pressable style={[styles.logBtn, { backgroundColor: sessionTone(logType) }]} onPress={handleLog}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={colours.background} />
                      <Text style={styles.logBtnText}>LOG SESSION</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,15,14,0.75)' },
  panel: {
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.surface,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colours.borderSoft,
    gap: 12,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  weekday: { color: colours.text, fontSize: 20, fontWeight: '900' },
  fullDate: { ...typography.caption, color: colours.muted },
  statusBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { ...typography.label, fontWeight: '900', letterSpacing: 1, fontSize: 9 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.layer2 },

  scroll: { flexGrow: 0 },
  scrollContent: { padding: 20, gap: 20 },

  section: { gap: 10 },
  sectionLabel: { ...typography.label, color: colours.muted, letterSpacing: 1.5, fontSize: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: colours.borderSoft,
    backgroundColor: colours.surface,
  },
  sessionIconWrap: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sessionTitle: { color: colours.text, fontWeight: '800', fontSize: 13 },
  sessionMeta: { ...typography.label, color: colours.muted, marginTop: 2 },
  sessionScore: { alignItems: 'center' },
  sessionScoreVal: { fontSize: 18, fontWeight: '900' },
  sessionScoreLabel: { ...typography.label, color: colours.muted, fontSize: 8, letterSpacing: 1 },
  emptyText: { ...typography.caption, color: colours.muted, lineHeight: 18 },

  recTypeBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  recTypeText: { ...typography.label, fontWeight: '900', letterSpacing: 1, fontSize: 9 },
  recPanel: { borderWidth: 1, borderRadius: 12, padding: 14, backgroundColor: colours.surface, gap: 10 },
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recHeadline: { fontSize: 17, fontWeight: '900' },
  recRationale: { ...typography.caption, color: colours.textSoft, lineHeight: 18 },
  recMeta: { flexDirection: 'row', gap: 10 },
  recMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recMetaText: { ...typography.label, color: colours.muted },
  exerciseList: { gap: 5, borderTopWidth: 1, borderTopColor: colours.borderSoft, paddingTop: 10 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseDot: { width: 5, height: 5, borderRadius: 3 },
  exerciseText: { ...typography.caption, color: colours.textSoft, flex: 1 },

  toggleLogBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: statusColors(colours.cyan).borderMed, backgroundColor: statusColors(colours.cyan).bgMed },
  toggleLogText: { ...typography.label, color: colours.cyan, fontWeight: '900' },

  logForm: { gap: 12 },
  logFieldLabel: { ...typography.label, color: colours.muted, letterSpacing: 1.2, fontSize: 9 },
  typePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colours.borderSoft, backgroundColor: colours.surface },
  typePillText: { ...typography.label, color: colours.muted, fontWeight: '800' },
  stepperRow: { flexDirection: 'row', gap: 6 },
  durationChip: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: colours.borderSoft, alignItems: 'center', backgroundColor: colours.surface },
  durationChipActive: { borderColor: colours.cyan, backgroundColor: statusColors(colours.cyan).bgMed },
  durationChipText: { ...typography.label, color: colours.muted, fontWeight: '800' },
  durationChipTextActive: { color: colours.cyan },
  rpeRow: { flexDirection: 'row', gap: 4 },
  rpeBtn: { flex: 1, paddingVertical: 9, borderRadius: 6, borderWidth: 1, borderColor: colours.borderSoft, alignItems: 'center', backgroundColor: colours.surface },
  rpeBtnText: { color: colours.muted, fontSize: 12, fontWeight: '900' },
  logPreview: { borderWidth: 1, borderRadius: 8, padding: 10 },
  logPreviewText: { ...typography.caption, color: colours.textSoft, fontWeight: '800', textAlign: 'center' },
  logBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  logBtnText: { color: colours.background, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});
