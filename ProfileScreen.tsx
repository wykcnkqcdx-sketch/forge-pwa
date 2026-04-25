import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { colours } from '../theme';
import { TrainingSession } from '../data/mockData';

const plan = [
  ['Trap-bar deadlift', '5 x 5'],
  ['Walking lunge', '4 x 20m'],
  ['Push press', '5 x 3'],
  ['Farmer carry', '6 x 40m'],
  ['Mobility reset', '8 mins'],
];

export function TrainScreen({ addSession }: { addSession: (session: TrainingSession) => void }) {
  const [saved, setSaved] = useState(false);

  function completeWorkout() {
    const session: TrainingSession = {
      id: Date.now().toString(),
      type: 'Strength',
      title: 'Tactical Strength',
      score: 84,
      durationMinutes: 50,
      rpe: 7,
    };

    addSession(session);
    setSaved(true);
    Alert.alert('Session saved', 'Tactical Strength has been added to your training log.');
  }

  return (
    <Screen>
      <Text style={styles.muted}>Training block</Text>
      <Text style={styles.title}>Tactical Strength</Text>

      <View style={styles.grid}>
        <MetricCard icon="time" label="Time" value="50" sub="minutes" />
        <MetricCard icon="flash" label="RPE" value="7" sub="target" tone={colours.amber} />
      </View>

      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Session Plan</Text>
          <Text style={styles.badge}>AI adjusted</Text>
        </View>

        {plan.map(([name, dose], index) => (
          <View key={name} style={styles.exerciseRow}>
            <View style={styles.exerciseNumber}>
              <Text style={styles.exerciseNumberText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exerciseName}>{name}</Text>
              <Text style={styles.muted}>{dose}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colours.muted} />
          </View>
        ))}
      </Card>

      <Card style={{ backgroundColor: 'rgba(103,232,249,0.08)' }}>
        <Text style={styles.coach}>
          AI Coach: Readiness is good. Keep load controlled and stop one rep before technical failure.
        </Text>
      </Card>

      <Pressable style={styles.primaryButton} onPress={completeWorkout}>
        <Text style={styles.primaryButtonText}>{saved ? 'Session Saved' : 'Complete Workout'}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colours.muted, fontSize: 13 },
  title: { color: colours.text, fontSize: 32, fontWeight: '900', marginBottom: 16 },
  grid: { flexDirection: 'row', gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900' },
  badge: { color: colours.cyan, fontSize: 12, backgroundColor: 'rgba(103,232,249,0.10)', padding: 8, borderRadius: 999 },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  exerciseNumber: {
    height: 34,
    width: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(103,232,249,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: { color: colours.cyan, fontWeight: '900' },
  exerciseName: { color: colours.text, fontWeight: '800' },
  coach: { color: colours.text, fontSize: 14, lineHeight: 21 },
  primaryButton: {
    backgroundColor: colours.cyan,
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#07111E', fontWeight: '900', fontSize: 16 },
});
