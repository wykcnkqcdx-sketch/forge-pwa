import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Modal, TextInput, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { colours, shadow } from '../theme';
import { TrainingSession, TrackPoint } from '../data/mockData';
import { getMapPoints } from '../utils/mapUtils';
import { buildPerformanceProfile, sortSessionsByDate } from '../lib/performance';

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
  const orderedSessions = useMemo(() => sortSessionsByDate(sessions), [sessions]);
  const recentSessions = orderedSessions.slice(0, 7);
  const performance = useMemo(() => buildPerformanceProfile(sessions), [sessions]);
  const averageScore = hasSessions
    ? Math.round(sessions.reduce((total, session) => total + session.score, 0) / sessions.length)
    : 0;
  const compliance = hasSessions ? Math.min(100, Math.round(55 + recentSessions.length * 6 + Math.max(0, 20 - performance.highIntensityCount * 4))) : 0;
  
  const screenWidth = Dimensions.get('window').width;
  const [trendDays, setTrendDays] = useState<7 | 28 | 90>(7);

  const trendChartData = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const labels: string[] = [];
    const data: number[] = [];

    const dailyScores: Record<string, number[]> = {};
    sessions.forEach(s => {
      const d = s.completedAt ? new Date(s.completedAt) : new Date();
      const dateStr = d.toISOString().split('T')[0];
      if (!dailyScores[dateStr]) dailyScores[dateStr] = [];
      dailyScores[dateStr].push(s.score);
    });

    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const scores = dailyScores[dateStr];
      const avgScore = scores ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      
      if (trendDays === 7) {
        labels.push(['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]);
        data.push(avgScore);
      } else if (trendDays === 28) {
        if (i % 7 === 0) labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
        else labels.push('');
        data.push(avgScore);
      } else {
        if (i % 14 === 0) labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
        else labels.push('');
        data.push(avgScore);
      }
    }

    return {
      labels,
      datasets: [{ data: data.some(d => d > 0) ? data : data.map(() => 0) }]
    };
  }, [sessions, trendDays]);

  const ruckSessions = sessions.filter((session) => session.type === 'Ruck');
  const strengthSessions = sessions.filter((session) => session.type === 'Strength');
  const ruckProgress = Math.min(100, ruckSessions.length * 18 + Math.max(0, ruckSessions[0]?.score ?? 0) * 0.4);
  const strengthProgress = Math.min(100, strengthSessions.length * 20 + Math.max(0, strengthSessions[0]?.score ?? 0) * 0.35);
  const riskLevel = `${performance.loadRisk} load risk`;
  const riskCopy = performance.recommendation;

  const totalScore = useMemo(() => sessions.reduce((total, session) => total + session.score, 0), [sessions]);
  const currentLevel = Math.floor(totalScore / 500) + 1;
  const currentLevelProgress = totalScore % 500;
  const nextLevelProgressPct = Math.round((currentLevelProgress / 500) * 100);
  const pointsToNext = 500 - currentLevelProgress;
  const badgeColor = currentLevel > 10 ? colours.amber : colours.cyan;
  const badgeDim = currentLevel > 10 ? colours.amberDim : colours.cyanDim;

  const [filterType, setFilterType] = useState<TrainingSession['type'] | 'All'>('All');
  const [sortOrder, setSortOrder] = useState<'latest' | 'score'>('latest');
  const [displayLimit, setDisplayLimit] = useState(10);

  useEffect(() => {
    setDisplayLimit(10);
  }, [filterType, sortOrder]);

  const filteredSessions = useMemo(() => {
    let result = orderedSessions;
    if (filterType !== 'All') {
      result = result.filter((s) => s.type === filterType);
    }
    if (sortOrder === 'score') {
      result = [...result].sort((a, b) => b.score - a.score);
    }
    return result;
  }, [orderedSessions, filterType, sortOrder]);

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
        <MetricCard icon="speedometer" label="Readiness" value={`${performance.readiness}`} sub={performance.readinessLabel} tone={performance.readinessTone} />
        <MetricCard icon="checkmark-circle" label="Compliance" value={`${compliance}%`} sub="weekly" tone={colours.violet} />
      </View>

      <Card>
        <View style={styles.levelHeader}>
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Operator Level</Text>
          <View style={[styles.levelBadge, { backgroundColor: badgeDim, borderColor: `${badgeColor}40` }]}>
            <Text style={[styles.levelBadgeText, { color: badgeColor }]}>LVL {currentLevel}</Text>
          </View>
        </View>
        <ProgressBar value={nextLevelProgressPct} colour={badgeColor} />
        <Text style={[styles.muted, { marginTop: 10 }]}>{pointsToNext} pts to rank up ({totalScore} total)</Text>
      </Card>

      <Card>
        <View style={styles.chartHeader}>
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Score Trends</Text>
          <View style={styles.trendToggle}>
            <Pressable style={[styles.trendBtn, trendDays === 7 && styles.trendBtnActive]} onPress={() => setTrendDays(7)}><Text style={[styles.trendBtnText, trendDays === 7 && styles.trendBtnTextActive]}>7D</Text></Pressable>
            <Pressable style={[styles.trendBtn, trendDays === 28 && styles.trendBtnActive]} onPress={() => setTrendDays(28)}><Text style={[styles.trendBtnText, trendDays === 28 && styles.trendBtnTextActive]}>28D</Text></Pressable>
            <Pressable style={[styles.trendBtn, trendDays === 90 && styles.trendBtnActive]} onPress={() => setTrendDays(90)}><Text style={[styles.trendBtnText, trendDays === 90 && styles.trendBtnTextActive]}>90D</Text></Pressable>
          </View>
        </View>
        <LineChart
          data={trendChartData}
          width={screenWidth - 76}
          height={180}
          yAxisLabel=""
          yAxisSuffix=""
          withInnerLines={false}
          withOuterLines={false}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: '#000000',
            backgroundGradientFromOpacity: 0,
            backgroundGradientTo: '#000000',
            backgroundGradientToOpacity: 0,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 229, 255, ${opacity})`,
            labelColor: (opacity = 1) => colours.muted,
            propsForDots: { r: '4', strokeWidth: '2', stroke: colours.background },
          }}
          bezier
          style={styles.lineChart}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Risk Monitor</Text>
        {hasSessions ? (
          <View style={styles.warning}>
            <Text style={[styles.warningTitle, { color: performance.riskTone }]}>{riskLevel}</Text>
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
        <Text style={styles.metricLabel}>Load monotony</Text>
        <ProgressBar value={Math.min(100, performance.monotony * 30)} colour={performance.riskTone} />
        <Text style={styles.loadIntel}>
          ACWR {performance.acuteChronicRatio} - Strain {performance.strain} - {performance.ruckKm}km ruck load this week
        </Text>

        <Text style={styles.metricLabel}>Readiness Factors</Text>
        <View style={styles.factorGrid}>
          {['Sleep', 'Soreness', 'Pain', 'Hydration', 'Mood', 'Illness', 'Rest HR', 'HRV'].map(factor => (
            <View key={factor} style={styles.factorItem}>
              <Text style={styles.factorLabel}>{factor}</Text>
              <Text style={styles.factorValue}>--</Text>
            </View>
          ))}
        </View>
        <Text style={styles.medicalDisclaimer}>* Readiness is an estimate based on recent load and subjective feedback. Training guidance only, not medical advice.</Text>
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
                    {getMapPoints(session.routePoints).map((point: TrackPoint & { x: number; y: number }, index: number) => (
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
  levelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  levelBadgeText: { fontSize: 12, fontWeight: '900' },
  lineChart: { marginVertical: 8, marginLeft: -12 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  trendToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 2 },
  trendBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  trendBtnActive: { backgroundColor: colours.cyan },
  trendBtnText: { color: colours.muted, fontSize: 11, fontWeight: '900' },
  trendBtnTextActive: { color: colours.background },
  factorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  factorItem: { width: '23%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  factorLabel: { color: colours.muted, fontSize: 9, fontWeight: '800', marginBottom: 4 },
  factorValue: { color: colours.text, fontSize: 13, fontWeight: '900' },
  medicalDisclaimer: { color: colours.amber, fontSize: 10, fontStyle: 'italic', marginTop: 16, lineHeight: 14 },
  warning: {
    borderColor: 'rgba(253,230,138,0.25)',
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    backgroundColor: 'rgba(253,230,138,0.08)',
    marginBottom: 18,
  },
  warningTitle: { color: colours.amber, fontWeight: '900' },
  loadIntel: { color: colours.textSoft, fontSize: 12, lineHeight: 18, marginTop: 10 },
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
