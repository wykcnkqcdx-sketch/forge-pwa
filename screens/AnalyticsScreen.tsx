import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Dimensions, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { colours, shadow, typography } from '../theme';
import { responsiveSpacing, statusColors } from '../utils/styling';
import { TrainingSession, TrackPoint } from '../data/mockData';
import { ReadinessLog } from '../data/domain';
import { formatCoordinate } from '../utils/coordinates';
import { distanceBetween, getMapPoints } from '../utils/mapUtils';
import { buildPerformanceProfile, sortSessionsByDate } from '../lib/performance';
import { BodyMap, BodyMapView, PainMap, choirSegments } from '../components/BodyMap';
import { calculateWHtR } from '../lib/h2f';
import { getLatestReadinessLog, isReadinessStale } from '../lib/readiness';
import { showAlert, showConfirm } from '../lib/dialogs';
import { SessionCard } from '../components/SessionCard';
import { SessionEditModal } from '../components/SessionEditModal';
import { ReadinessModal } from '../components/ReadinessModal';

export function AnalyticsScreen({ 
  sessions,
  readinessLogs,
  addReadinessLog,
  deleteSession,
  editSession
}: { 
  sessions: TrainingSession[];
  readinessLogs: ReadinessLog[];
  addReadinessLog: (log: ReadinessLog) => void;
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

  const latestReadiness = useMemo(() => {
    const log = getLatestReadinessLog(readinessLogs);
    return isReadinessStale(log) ? undefined : log;
  }, [readinessLogs]);
  const latestReadinessIsStale = useMemo(() => isReadinessStale(getLatestReadinessLog(readinessLogs)), [readinessLogs]);
  const [loggingReadiness, setLoggingReadiness] = useState(false);

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
        labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1));
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

  // Body Metrics state
  const [waistCm, setWaistCm] = useState('88');
  const [heightCm, setHeightCm] = useState('180');
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [bodyMapView, setBodyMapView] = useState<BodyMapView>('anterior');
  const [selectedPainLevel, setSelectedPainLevel] = useState(4);
  const [painMap, setPainMap] = useState<PainMap>({});
  const whtr = calculateWHtR(Number(waistCm), Number(heightCm));
  const hotspots = choirSegments
    .map((seg) => ({ ...seg, level: painMap[seg.id] ?? 0 }))
    .filter((seg) => seg.level > 0)
    .sort((a, b) => b.level - a.level)
    .slice(0, 3);
  const lowerBackLoadFlag =
    sessions.some((s) => s.type === 'Ruck' && (s.loadKg ?? 0) >= 18) &&
    ((painMap.P09 ?? 0) >= 5 || (painMap.P10 ?? 0) >= 5);

  function markInjury(segmentId: string) {
    setSelectedSegment(segmentId);
    setPainMap((cur) => ({ ...cur, [segmentId]: selectedPainLevel }));
  }

  function setPainIntensity(level: number) {
    setSelectedPainLevel(level);
    if (selectedSegment) setPainMap((cur) => ({ ...cur, [selectedSegment]: level }));
  }

  function confirmDelete(id: string) {
    showConfirm(
      'Delete Session',
      'Are you sure you want to permanently delete this logged session?',
      () => deleteSession(id),
      'Delete'
    );
  }

  function openEdit(session: TrainingSession) {
    setEditingSession(session);
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
          <View style={[styles.levelBadge, { backgroundColor: statusColors(badgeColor).bgMed, borderColor: statusColors(badgeColor).borderMed }]}>
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
          <View style={[styles.warning, shadow.subtle, { borderColor: statusColors(performance.riskTone).borderMed, backgroundColor: statusColors(performance.riskTone).bgMed }]}>
            <Text style={[styles.warningTitle, { color: performance.riskTone }]}>{riskLevel}</Text>
            <Text style={styles.muted}>{riskCopy}</Text>
          </View>
        ) : (
          <View style={[styles.emptyState, shadow.subtle]}>
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

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 8 }}>
          <Text style={[styles.metricLabel, { marginTop: 0, marginBottom: 0 }]}>Readiness Factors</Text>
          <Pressable style={styles.sortBtn} onPress={() => setLoggingReadiness(true)}>
            <Text style={styles.sortBtnText}>LOG TODAY</Text>
          </Pressable>
        </View>
        {latestReadinessIsStale ? (
          <View style={[styles.staleNotice, shadow.subtle, { borderColor: statusColors(colours.amber).borderMed, backgroundColor: statusColors(colours.amber).bgMed }]}>
            <Ionicons name="warning-outline" size={14} color={colours.amber} />
            <Text style={styles.staleNoticeText}>Latest check-in is stale. Log today before using these factors.</Text>
          </View>
        ) : null}
        <View style={styles.factorGrid}>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>Sleep</Text>
            <Text style={styles.factorValue}>{latestReadiness?.sleepQuality ? `${latestReadiness.sleepQuality}/5` : '--'}</Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>Soreness</Text>
            <Text style={styles.factorValue}>{latestReadiness?.soreness ? `${latestReadiness.soreness}/5` : '--'}</Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>Stress</Text>
            <Text style={styles.factorValue}>{latestReadiness?.stress ? `${latestReadiness.stress}/5` : '--'}</Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>Hydration</Text>
            <Text style={styles.factorValue}>{latestReadiness?.hydration ?? '--'}</Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>Rest HR</Text>
            <Text style={styles.factorValue}>{latestReadiness?.restingHR ? `${latestReadiness.restingHR}` : '--'}</Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>HRV</Text>
            <Text style={styles.factorValue}>{latestReadiness?.hrv ? `${latestReadiness.hrv}` : '--'}</Text>
          </View>
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
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
          data={['All', 'Ruck', 'Strength', 'Resistance', 'Cardio', 'Workout', 'Mobility', 'Run'] as const}
          keyExtractor={(item) => item}
          renderItem={({ item: type }) => {
            const isActive = filterType === type;
            return (
              <Pressable
                style={[
                  styles.filterPill,
                  isActive && { borderColor: statusColors(colours.cyan).borderMed, backgroundColor: statusColors(colours.cyan).bgMed }
                ]}
                onPress={() => setFilterType(type as TrainingSession['type'] | 'All')}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{type}</Text>
              </Pressable>
            );
          }}
        />
      )}

      {hasSessions ? (
        displayedSessions.length > 0 ? (
          <FlatList
            data={displayedSessions}
            keyExtractor={(session) => session.id}
            scrollEnabled={false} // Embeds nicely in outer Screen container
            renderItem={({ item: session }) => (
              <SessionCard
                session={session}
                onEdit={openEdit}
                onDelete={confirmDelete}
              />
            )}
            ListFooterComponent={
              displayLimit < filteredSessions.length ? (
                <Pressable style={styles.loadMoreBtn} onPress={() => setDisplayLimit((curr) => curr + 10)}>
                  <Text style={styles.loadMoreText}>Load More</Text>
                </Pressable>
              ) : null
            }
          />
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

      {/* Body Composition */}
      <Card>
        <Text style={styles.cardTitle}>Body Composition</Text>
        <Text style={styles.muted}>2026 WHtR mandate target: under 0.55</Text>
        <View style={styles.bodyInputRow}>
          <View style={styles.bodyInputGroup}>
            <Text style={styles.bodyInputLabel}>WAIST CM</Text>
            <TextInput value={waistCm} onChangeText={setWaistCm} keyboardType="numeric" style={styles.bodyInput} />
          </View>
          <View style={styles.bodyInputGroup}>
            <Text style={styles.bodyInputLabel}>HEIGHT CM</Text>
            <TextInput value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" style={styles.bodyInput} />
          </View>
        </View>
        <View style={styles.whtrResult}>
          <Text style={[styles.whtrValue, { color: whtr.compliant ? colours.green : colours.red }]}>
            {whtr.ratio.toFixed(3)}
          </Text>
          <Text style={styles.muted}>
            {whtr.compliant ? `Compliant — ${whtr.marginCm} cm margin` : `${Math.abs(whtr.marginCm)} cm over threshold`}
          </Text>
        </View>
      </Card>

      {/* Injury Report */}
      <Card>
        <Text style={styles.cardTitle}>Injury Report</Text>
        <Text style={styles.muted}>Tap a CHOIR segment, then set pain intensity.</Text>
        <View style={styles.intensityRow}>
          {[0, 2, 4, 6, 8, 10].map((level) => (
            <Pressable
              key={level}
              style={[
                styles.intensityButton,
                {
                  backgroundColor:
                    level <= 0 ? colours.cyanDim : level <= 3 ? colours.cyan : level <= 6 ? colours.amber : colours.red,
                  borderColor: selectedPainLevel === level ? colours.text : 'transparent',
                },
              ]}
              onPress={() => setPainIntensity(level)}
              accessibilityRole="button"
              accessibilityLabel={`Set pain intensity ${level} out of 10`}
            >
              <Text style={[styles.intensityText, level > 0 && { color: colours.background }]}>{level}</Text>
            </Pressable>
          ))}
        </View>
        <BodyMap
          activeView={bodyMapView}
          painMap={painMap}
          selectedSegment={selectedSegment}
          selectedPainLevel={selectedPainLevel}
          onChangeView={setBodyMapView}
          onSelect={markInjury}
        />
        <View style={[styles.hotspotPanel, shadow.subtle]}>
          <Text style={styles.hotspotTitle}>HPT Hotspots</Text>
          {hotspots.length ? (
            hotspots.map((seg) => (
              <View key={seg.id} style={styles.hotspotRow}>
                <Text style={styles.hotspotName}>{seg.id} {seg.label}</Text>
                <Text style={[styles.hotspotScore, { color: seg.level >= 7 ? colours.red : seg.level >= 4 ? colours.amber : colours.cyan }]}>
                  {seg.level}/10
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No musculoskeletal reports logged.</Text>
          )}
          {lowerBackLoadFlag && (
            <Text style={styles.hotspotAlert}>
              Lower-back hotspot rising after loaded ruck exposure. Flag for HPT trend review.
            </Text>
          )}
        </View>
      </Card>

      <SessionEditModal
        visible={!!editingSession}
        session={editingSession}
        onClose={() => setEditingSession(null)}
        onSave={(id, score, duration) => {
          editSession(id, { score, durationMinutes: duration });
          setEditingSession(null);
        }}
      />

      <ReadinessModal
        visible={loggingReadiness}
        onClose={() => setLoggingReadiness(false)}
        onSave={(log) => {
          addReadinessLog(log);
          setLoggingReadiness(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { ...typography.caption, color: colours.muted },
  title: { color: colours.text, fontSize: 32, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  grid: { flexDirection: 'row', gap: responsiveSpacing('md') },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: responsiveSpacing('md') },
  levelBadge: { paddingHorizontal: responsiveSpacing('sm'), paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  levelBadgeText: { ...typography.caption, fontWeight: '900' },
  lineChart: { marginVertical: responsiveSpacing('sm'), marginLeft: -12 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: responsiveSpacing('md') },
  trendToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 2 },
  trendBtn: { paddingHorizontal: responsiveSpacing('md'), paddingVertical: 6, borderRadius: 6 },
  trendBtnActive: { backgroundColor: colours.cyan },
  trendBtnText: { ...typography.label, color: colours.muted },
  trendBtnTextActive: { color: colours.background },
  factorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing('sm'), marginTop: responsiveSpacing('sm') },
  factorItem: { width: '23%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: responsiveSpacing('sm'), alignItems: 'center' },
  factorLabel: { ...typography.label, color: colours.muted, marginBottom: 4 },
  factorValue: { ...typography.caption, color: colours.text, fontWeight: '900' },
  staleNotice: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing('sm'), borderWidth: 1, borderRadius: 8, padding: responsiveSpacing('sm'), marginBottom: responsiveSpacing('sm') },
  staleNoticeText: { flex: 1, ...typography.caption, color: colours.amber, fontWeight: '800', lineHeight: 16 },
  medicalDisclaimer: { ...typography.caption, color: colours.amber, fontStyle: 'italic', marginTop: responsiveSpacing('md'), lineHeight: 14 },
  warning: {
    borderWidth: 1,
    borderRadius: 18,
    padding: responsiveSpacing('md'),
    marginBottom: responsiveSpacing('lg'),
  },
  warningTitle: { color: colours.amber, fontWeight: '900' },
  loadIntel: { ...typography.caption, color: colours.textSoft, lineHeight: 18, marginTop: responsiveSpacing('sm') },
  emptyState: {
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: responsiveSpacing('md'),
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: responsiveSpacing('lg'),
  },
  emptyTitle: { color: colours.text, fontWeight: '900' },
  metricLabel: { color: colours.text, marginTop: responsiveSpacing('md'), marginBottom: responsiveSpacing('sm'), fontWeight: '800' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    marginTop: responsiveSpacing('md'),
  },
  sectionTitle: { ...typography.h4, color: colours.text, letterSpacing: 0.2 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: statusColors(colours.cyan).bgMed, paddingHorizontal: responsiveSpacing('sm'), paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: statusColors(colours.cyan).borderMed },
  sortBtnText: { ...typography.label, color: colours.cyan, letterSpacing: 0.5 },
  filterScroll: { flexGrow: 0, marginBottom: responsiveSpacing('md'), marginHorizontal: -20 },
  filterContainer: { gap: responsiveSpacing('sm'), paddingHorizontal: 20 },
  filterPill: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 999, paddingHorizontal: responsiveSpacing('md'), paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.04)' },
  filterText: { ...typography.label, color: colours.muted },
  filterTextActive: { color: colours.cyan },
  logEmptyState: { alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 16, padding: responsiveSpacing('lg'), backgroundColor: 'rgba(10, 20, 35, 0.70)' },
  logEmptyText: { ...typography.caption, color: colours.muted, textAlign: 'center', lineHeight: 17 },
  bodyInputRow: { flexDirection: 'row', gap: responsiveSpacing('sm'), marginTop: responsiveSpacing('sm') },
  bodyInputGroup: { flex: 1 },
  bodyInputLabel: { ...typography.label, color: colours.muted, letterSpacing: 1.2, marginBottom: 4 },
  bodyInput: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 8, color: colours.text, backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontWeight: '900' },
  whtrResult: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing('md'), marginTop: responsiveSpacing('md') },
  whtrValue: { fontSize: 30, fontWeight: '900' },
  intensityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing('sm'), marginVertical: responsiveSpacing('md') },
  intensityButton: { width: 44, height: 44, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  intensityText: { color: colours.text, fontSize: 14, fontWeight: '900' },
  hotspotPanel: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 8, padding: responsiveSpacing('md'), backgroundColor: 'rgba(10,18,30,0.6)', marginTop: responsiveSpacing('md'), gap: 6 },
  hotspotTitle: { ...typography.h4, color: colours.text, marginBottom: 4 },
  hotspotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: responsiveSpacing('md'), paddingVertical: 6, borderTopWidth: 1, borderColor: colours.borderSoft },
  hotspotName: { flex: 1, ...typography.caption, color: colours.textSoft, fontWeight: '800' },
  hotspotScore: { ...typography.caption, fontWeight: '900' },
  hotspotAlert: { ...typography.caption, color: colours.red, fontWeight: '900', lineHeight: 17, marginTop: 4 },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: responsiveSpacing('md'),
    marginTop: responsiveSpacing('xs'),
    marginBottom: responsiveSpacing('lg'),
    borderRadius: 16,
    backgroundColor: statusColors(colours.cyan).bgMed,
    borderWidth: 1,
    borderColor: statusColors(colours.cyan).borderMed,
  },
  loadMoreText: { color: colours.cyan, fontSize: 13, fontWeight: '800' },
});
