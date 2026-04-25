import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { colours } from '../theme';
import { TrainingSession } from '../data/mockData';

export function HomeScreen({
  sessions,
  goToRuck,
  goToAnalytics,
}: {
  sessions: TrainingSession[];
  goToRuck: () => void;
  goToAnalytics: () => void;
}) {
  const readiness = 82;

  return (
    <Screen>
      <Text style={styles.muted}>Morning, Leo</Text>
      <Text style={styles.title}>Today’s Mission</Text>

      <Card>
        <View style={styles.readinessRow}>
          <View>
            <Text style={styles.muted}>Readiness Score</Text>
            <Text style={styles.bigNumber}>{readiness}</Text>
            <Text style={styles.good}>Green — train as planned</Text>
          </View>
          <View style={styles.circle}>
            <Ionicons name="speedometer" size={46} color={colours.cyan} />
          </View>
        </View>
        <ProgressBar value={readiness} />
      </Card>

      <Card style={{ backgroundColor: colours.panel }}>
        <Text style={styles.eyebrow}>ASSIGNED</Text>
        <Text style={styles.cardTitle}>Ruck Intervals</Text>
        <Text style={styles.muted}>45 mins · 18kg · mixed terrain</Text>
        <Pressable style={styles.primaryButton} onPress={goToRuck}>
          <Text style={styles.primaryButtonText}>Start Ruck</Text>
        </Pressable>
      </Card>

      <View style={styles.grid}>
        <MetricCard icon="pulse" label="Weekly Load" value="486" sub="+8% this week" />
        <MetricCard icon="flame" label="Recovery" value="Good" sub="Sleep stable" tone={colours.amber} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        <Pressable onPress={goToAnalytics}>
          <Text style={styles.link}>View all</Text>
        </Pressable>
      </View>

      {sessions.slice(0, 3).map((session) => (
        <View key={session.id} style={styles.sessionRow}>
          <View>
            <Text style={styles.sessionTitle}>{session.title}</Text>
            <Text style={styles.mutedSmall}>
              {session.type} · {session.durationMinutes} mins · RPE {session.rpe}
            </Text>
          </View>
          <View>
            <Text style={styles.score}>{session.score}</Text>
            <Text style={styles.mutedTiny}>score</Text>
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colours.muted, fontSize: 14 },
  mutedSmall: { color: colours.muted, fontSize: 12 },
  mutedTiny: { color: colours.muted, fontSize: 10, textAlign: 'right' },
  title: { color: colours.text, fontSize: 32, fontWeight: '900', marginBottom: 16 },
  bigNumber: { color: colours.text, fontSize: 62, fontWeight: '900' },
  good: { color: colours.cyan, fontSize: 14, marginBottom: 16 },
  readinessRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  circle: {
    height: 110,
    width: 110,
    borderRadius: 55,
    borderColor: 'rgba(103,232,249,0.3)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(103,232,249,0.09)',
  },
  eyebrow: { color: colours.amber, letterSpacing: 3, fontSize: 11, fontWeight: '800' },
  cardTitle: { color: colours.text, fontSize: 22, fontWeight: '800', marginTop: 6 },
  primaryButton: {
    marginTop: 16,
    backgroundColor: colours.cyan,
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#07111E', fontWeight: '900' },
  grid: { flexDirection: 'row', gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { color: colours.text, fontSize: 18, fontWeight: '800' },
  link: { color: colours.cyan, fontSize: 13 },
  sessionRow: {
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionTitle: { color: colours.text, fontWeight: '800' },
  score: { color: colours.cyan, fontSize: 20, fontWeight: '900', textAlign: 'right' },
});
