import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { colours } from '../theme';
import { TrainingSession } from '../data/mockData';

export function AnalyticsScreen({ sessions }: { sessions: TrainingSession[] }) {
  const averageScore = Math.round(sessions.reduce((total, session) => total + session.score, 0) / sessions.length);
  const compliance = Math.min(100, 68 + sessions.length * 4);

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
          {[42, 58, 36, 76, 64, 90, 72].map((value, index) => (
            <View key={index} style={[styles.bar, { height: `${value}%` }]} />
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
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>Medium load increase detected</Text>
          <Text style={styles.muted}>Reduce intensity if sleep or HRV drops.</Text>
        </View>

        <Text style={styles.metricLabel}>Ruck progression</Text>
        <ProgressBar value={74} />

        <Text style={styles.metricLabel}>Strength progression</Text>
        <ProgressBar value={68} />
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
  metricLabel: { color: colours.text, marginTop: 15, marginBottom: 8, fontWeight: '800' },
});
