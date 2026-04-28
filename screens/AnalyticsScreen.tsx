import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { colours, shadow } from '../theme';
import { TrainingSession, TrackPoint } from '../data/mockData';
import { getMapPoints } from '../utils/mapUtils';

export function AnalyticsScreen({ 
  sessions,
  deleteSession,
  editSession
}: { 
  sessions: TrainingSession[];
  deleteSession: (id: string) => void;
  editSession: (id: string, updates: Partial<TrainingSession>) => void;
}) {
  const hasSessions = sessions.length > 0;
  const recentSessions = sessions.slice(0, 7);
  const averageScore = hasSessions
    ? Math.round(sessions.reduce((total, session) => total + session.score, 0) / sessions.length)
    : 0;
  const compliance = hasSessions ? Math.min(100, 68 + sessions.length * 4) : 0;
  const maxLoad = Math.max(...recentSessions.map((session) => session.durationMinutes * session.rpe), 1);
  const loadBars = Array.from({ length: 7 }, (_, index) => {
    const session = recentSessions[6 - index];
    if (!session) return 0;
    return Math.max(8, Math.round((session.durationMinutes * session.rpe / maxLoad) * 100));
  });
  const ruckSessions = sessions.filter((session) => session.type === 'Ruck');
  const strengthSessions = sessions.filter((session) => session.type === 'Strength');
  const ruckProgress = Math.min(100, ruckSessions.length * 18 + Math.max(0, ruckSessions[0]?.score ?? 0) * 0.4);
  const strengthProgress = Math.min(100, strengthSessions.length * 20 + Math.max(0, strengthSessions[0]?.score ?? 0) * 0.35);
  const latestRpe = sessions[0]?.rpe ?? 0;
  const riskLevel = latestRpe >= 8 ? 'High load detected' : latestRpe >= 6 ? 'Moderate load detected' : 'Load stable';
  const riskCopy = latestRpe >= 8
    ? 'Prioritise recovery before the next hard effort.'
    : latestRpe >= 6
      ? 'Keep intensity controlled if sleep or HRV drops.'
      : 'Current training stress is well controlled.';

  const totalScore = useMemo(() => sessions.reduce((total, session) => total + session.score, 0), [sessions]);
  const currentLevel = Math.floor(totalScore / 500) + 1;
  const currentLevelProgress = totalScore % 500;
  const nextLevelProgressPct = Math.round((currentLevelProgress / 500) * 100);
  const pointsToNext = 500 - currentLevelProgress;

  const [filterType, setFilterType] = useState<TrainingSession['type'] | 'All'>('All');
  const [sortOrder, setSortOrder] = useState<'latest' | 'score'>('latest');
  const [displayLimit, setDisplayLimit] = useState(10);

  useEffect(() => {
    setDisplayLimit(10);
  }, [filterType, sortOrder]);

  const filteredSessions = useMemo(() => {
    let result = sessions;
    if (filterType !== 'All') {
      result = result.filter((s) => s.type === filterType);
    }
    if (sortOrder === 'score') {
      result = [...result].sort((a, b) => b.score - a.score);
    }
    return result;
  }, [sessions, filterType, sortOrder]);

  const displayedSessions = filteredSessions.slice(0, displayLimit);

  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [editScore, setEditScore] = useState('');
  const [editDuration, setEditDuration] = useState('');

  function confirmDelete(id: string) {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to permanently delete this logged session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteSession(id) },
      ]
    );
  }

  function openEdit(session: TrainingSession) {
    setEditingSession(session);
    setEditScore(String(session.score));
    setEditDuration(String(session.durationMinutes));
  }

  function saveEdit() {
    if (!editingSession) return;
    const newScore = parseInt(editScore, 10);
    const newDuration = parseInt(editDuration, 10);

    if (isNaN(newScore) || isNaN(newDuration)) {
      Alert.alert('Invalid Input', 'Score and duration must be numbers.');
      return;
    }

    editSession(editingSession.id, { score: newScore, durationMinutes: newDuration });
    setEditingSession(null);
  }

  return (
    <Screen>
      <Text style={styles.muted}>Performance intelligence</Text>
      <Text style={styles.title}>Analytics</Text>

      <View style={styles.grid}>
        <MetricCard icon="speedometer" label="Avg Score" value={`${averageScore}`} sub="latest sessions" />
        <MetricCard icon="checkmark-circle" label="Compliance" value={`${compliance}%`} sub="weekly" tone={colours.violet} />
      </View>

      <Card>
        <View style={styles.levelHeader}>
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Operator Level</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>LVL {currentLevel}</Text>
          </View>
        </View>
        <ProgressBar value={nextLevelProgressPct} colour={colours.cyan} />
        <Text style={[styles.muted, { marginTop: 10 }]}>{pointsToNext} pts to rank up ({totalScore} total)</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Weekly Load</Text>
        <View style={styles.chart}>
          {loadBars.map((value, index) => (
            <View key={index} style={[styles.bar, !value && styles.barEmpty, { height: `${value}%` }]} />
          ))}
        </View>
        <View style={styles.days}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <Text key={`${day}-${index}`} style={styles.day}>{day}</Text>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Risk Monitor</Text>
        {hasSessions ? (
          <View style={styles.warning}>
            <Text style={styles.warningTitle}>{riskLevel}</Text>
            <Text style={styles.muted}>{riskCopy}</Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No sessions logged</Text>
            <Text style={styles.muted}>Complete a workout or ruck to build your analytics baseline.</Text>
          </View>
        )}

        <Text style={styles.metricLabel}>Ruck progression</Text>
        <ProgressBar value={ruckProgress} />

        <Text style={styles.metricLabel}>Strength progression</Text>
        <ProgressBar value={strengthProgress} />
      </Card>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Session Log</Text>
        <Pressable 
          style={styles.sortBtn} 
          onPress={() => setSortOrder(current => current === 'latest' ? 'score' : 'latest')}
        >
          <Ionicons name={sortOrder === 'latest' ? 'time-outline' : 'trophy-outline'} size={12} color={colours.cyan} />
          <Text style={styles.sortBtnText}>{sortOrder === 'latest' ? 'Latest' : 'Top Score'}</Text>
        </Pressable>
      </View>

      {hasSessions && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
          {['All', 'Ruck', 'Strength', 'Resistance', 'Cardio', 'Workout', 'Mobility', 'Run'].map((type) => {
            const isActive = filterType === type;
            return (
              <Pressable
                key={type}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setFilterType(type as TrainingSession['type'] | 'All')}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{type}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {hasSessions ? (
        displayedSessions.length > 0 ? (
          <React.Fragment>
            {displayedSessions.map((session) => (
              <View key={session.id} style={[styles.sessionCard, shadow.subtle]}>
                <View style={styles.sessionRow}>
                  <View style={styles.sessionIconWrap}>
                    <Ionicons 
                      name={session.type === 'Ruck' ? 'footsteps-outline' : 'barbell-outline'} 
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
                    <Pressable onPress={() => openEdit(session)} style={styles.actionBtn}>
                      <Ionicons name="pencil" size={18} color={colours.cyan} />
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(session.id)} style={styles.actionBtn}>
                      <Ionicons name="trash-outline" size={18} color={colours.red} />
                    </Pressable>
                  </View>
                </View>
                
                {session.routePoints && session.routePoints.length > 0 && (
                  <View style={styles.miniMapStage}>
                    {getMapPoints(session.routePoints).map((point, index) => (
                      <View
                        key={index}
                        style={[styles.trailDot, { left: `${point.x}%`, top: `${point.y}%` }]}
                      />
                    ))}
                  </View>
                )}
              </View>
            ))}

            {displayLimit < filteredSessions.length && (
              <Pressable style={styles.loadMoreBtn} onPress={() => setDisplayLimit((curr) => curr + 10)}>
                <Text style={styles.loadMoreText}>Load More</Text>
              </Pressable>
            )}
          </React.Fragment>
        ) : (
          <View style={[styles.logEmptyState, shadow.subtle]}>
            <Ionicons name="funnel-outline" size={22} color={colours.cyan} />
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.logEmptyText}>No sessions found for the selected filter.</Text>
          </View>
        )
      ) : (
        <View style={[styles.logEmptyState, shadow.subtle]}>
          <Ionicons name="document-text-outline" size={22} color={colours.cyan} />
          <Text style={styles.emptyTitle}>No sessions logged</Text>
          <Text style={styles.logEmptyText}>Complete a workout or ruck to populate your log.</Text>
        </View>
      )}

      {/* Edit Modal */}
      <Modal visible={!!editingSession} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalPanel, shadow.card]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Session</Text>
              <Pressable onPress={() => setEditingSession(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colours.text} />
              </Pressable>
            </View>
            <Text style={styles.inputLabel}>SCORE</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={editScore} onChangeText={setEditScore} />
            <Text style={styles.inputLabel}>DURATION (MINS)</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={editDuration} onChangeText={setEditDuration} />
            <Pressable style={styles.saveBtn} onPress={saveEdit}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colours.muted, fontSize: 13 },
  title: { color: colours.text, fontSize: 32, fontWeight: '900', marginBottom: 16 },
  grid: { flexDirection: 'row', gap: 12 },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: 16 },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  levelBadge: { backgroundColor: colours.cyanDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: `${colours.cyan}40` },
  levelBadgeText: { color: colours.cyan, fontSize: 12, fontWeight: '900' },
  chart: { height: 140, flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  bar: { flex: 1, backgroundColor: colours.cyan, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  barEmpty: { backgroundColor: 'rgba(255,255,255,0.08)' },
  days: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  day: { color: colours.muted, fontSize: 11 },
  warning: {
    borderColor: 'rgba(253,230,138,0.25)',
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    backgroundColor: 'rgba(253,230,138,0.08)',
    marginBottom: 18,
  },
  warningTitle: { color: colours.amber, fontWeight: '900' },
  emptyState: {
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 18,
  },
  emptyTitle: { color: colours.text, fontWeight: '900' },
  metricLabel: { color: colours.text, marginTop: 15, marginBottom: 8, fontWeight: '800' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    marginTop: 12,
  },
  sectionTitle: { color: colours.text, fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colours.cyanDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: `${colours.cyan}40` },
  sortBtnText: { color: colours.cyan, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  filterScroll: { flexGrow: 0, marginBottom: 12, marginHorizontal: -20 },
  filterContainer: { gap: 8, paddingHorizontal: 20 },
  filterPill: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.04)' },
  filterPillActive: { borderColor: `${colours.cyan}80`, backgroundColor: colours.cyanDim },
  filterText: { color: colours.muted, fontSize: 11, fontWeight: '900' },
  filterTextActive: { color: colours.cyan },
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
    backgroundColor: colours.cyanDim,
    borderColor: colours.border,
  },
  sessionCopy: { flex: 1 },
  sessionTitle: { color: colours.text, fontWeight: '800', fontSize: 13 },
  sessionMeta: { color: colours.muted, fontSize: 11, marginTop: 2 },
  sessionRight: { alignItems: 'flex-end' },
  score: { color: colours.cyan, fontSize: 20, fontWeight: '900' },
  scoreLabel: { color: colours.soft, fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginTop: 1 },
  actions: { flexDirection: 'row', marginLeft: 4 },
  actionBtn: { marginLeft: 2, padding: 6, justifyContent: 'center' },
  logEmptyState: { alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 16, padding: 18, backgroundColor: 'rgba(10, 20, 35, 0.70)' },
  logEmptyText: { color: colours.muted, fontSize: 12, textAlign: 'center', lineHeight: 17 },
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
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.62)' },
  modalPanel: { borderWidth: 1, borderColor: colours.border, borderRadius: 20, padding: 18, backgroundColor: colours.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { color: colours.text, fontSize: 20, fontWeight: '900' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  inputLabel: { color: colours.muted, fontSize: 10, fontWeight: '900', marginBottom: 6, letterSpacing: 1.2 },
  input: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 14, color: colours.text, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, fontSize: 16, fontWeight: '800' },
  saveBtn: { alignItems: 'center', backgroundColor: colours.cyan, borderRadius: 16, paddingVertical: 13, marginTop: 4 },
  saveBtnText: { color: colours.background, fontSize: 15, fontWeight: '900' },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  loadMoreText: { color: colours.cyan, fontSize: 13, fontWeight: '800' },
});
