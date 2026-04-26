import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { colours } from '../theme';
import { TrainingSession } from '../data/mockData';

export function AnalyticsScreen({ sessions }: { sessions: TrainingSession[] }) {
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

  return (
    <Screen>
      <Text style={styles.muted}>Performance intelligence</Text>
      <Text style={styles.title}>Analytics</Text>

      <View style={styles.grid}>
        <MetricCard icon="speedometer" label="Avg Score" value={`${averageScore}`} sub="latest sessions" />
        <MetricCard icon="checkmark-circle" label="Compliance" value={`${compliance}%`} sub="weekly" tone={colours.violet} />
      </View>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colours.muted, fontSize: 13 },
  title: { color: colours.text, fontSize: 32, fontWeight: '900', marginBottom: 16 },
  grid: { flexDirection: 'row', gap: 12 },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: 16 },
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
});
