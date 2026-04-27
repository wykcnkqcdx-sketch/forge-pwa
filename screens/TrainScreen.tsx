import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { colours } from '../theme';
import { TrainingSession } from '../data/mockData';

type TrainingMode = {
  key: string;
  type: TrainingSession['type'];
  label: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  durationMinutes: number;
  rpe: number;
  score: number;
  coach: string;
  plan: Array<[string, string]>;
};

const trainingModes: TrainingMode[] = [
  {
    key: 'strength',
    type: 'Strength',
    label: 'Strength',
    title: 'Tactical Strength',
    icon: 'barbell',
    tone: colours.cyan,
    durationMinutes: 50,
    rpe: 7,
    score: 84,
    coach: 'Keep load controlled and stop one rep before technical failure.',
    plan: [
      ['Trap-bar deadlift', '5 x 5'],
      ['Walking lunge', '4 x 20m'],
      ['Push press', '5 x 3'],
      ['Farmer carry', '6 x 40m'],
      ['Mobility reset', '8 mins'],
    ],
  },
  {
    key: 'resistance',
    type: 'Resistance',
    label: 'Resistance',
    title: 'Resistance Circuit',
    icon: 'git-branch',
    tone: colours.violet,
    durationMinutes: 38,
    rpe: 6,
    score: 82,
    coach: 'Use smooth tempo and keep tension through the full range.',
    plan: [
      ['Band row', '4 x 15'],
      ['Goblet squat', '4 x 12'],
      ['Suspension press', '4 x 10'],
      ['Hamstring bridge', '3 x 14'],
      ['Core anti-rotation', '3 x 30s'],
    ],
  },
  {
    key: 'cardio',
    type: 'Cardio',
    label: 'Cardio',
    title: 'Cardio Capacity',
    icon: 'heart',
    tone: colours.green,
    durationMinutes: 42,
    rpe: 5,
    score: 86,
    coach: 'Stay conversational for the base block, then finish with clean strides.',
    plan: [
      ['Warm-up jog', '8 mins'],
      ['Zone 2 run', '24 mins'],
      ['Strides', '6 x 20s'],
      ['Walk recovery', '5 mins'],
      ['Breathing reset', '3 mins'],
    ],
  },
  {
    key: 'workout',
    type: 'Workout',
    label: 'Workout',
    title: 'Field Workout',
    icon: 'fitness',
    tone: colours.amber,
    durationMinutes: 30,
    rpe: 8,
    score: 79,
    coach: 'Move with intent, but cap intensity if form starts to break.',
    plan: [
      ['Sandbag clean', '5 x 6'],
      ['Shuttle run', '6 x 60m'],
      ['Push-up ladder', '10-8-6-4-2'],
      ['Bear crawl', '5 x 20m'],
      ['Cooldown walk', '5 mins'],
    ],
  },
];

export function TrainScreen({ addSession }: { addSession: (session: TrainingSession) => void }) {
  const [activeKey, setActiveKey] = useState(trainingModes[0].key);
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const activeMode = useMemo(
    () => trainingModes.find((mode) => mode.key === activeKey) ?? trainingModes[0],
    [activeKey]
  );
  const saved = savedKeys.includes(activeMode.key);

  function completeWorkout() {
    if (saved) return;

    const session: TrainingSession = {
      id: `${activeMode.key}-${Date.now()}`,
      type: activeMode.type,
      title: activeMode.title,
      score: activeMode.score,
      durationMinutes: activeMode.durationMinutes,
      rpe: activeMode.rpe,
    };

    addSession(session);
    setSavedKeys((current) => [...current, activeMode.key]);
    Alert.alert('Session saved', `${activeMode.title} has been added to your training log.`);
  }

  return (
    <Screen>
      <Text style={styles.muted}>Training block</Text>
      <Text style={styles.title}>{activeMode.title}</Text>

      <View style={styles.modeTabs}>
        {trainingModes.map((mode) => {
          const isActive = mode.key === activeMode.key;
          return (
            <Pressable
              key={mode.key}
              style={[
                styles.modeTab,
                {
                  borderColor: isActive ? `${mode.tone}80` : colours.borderSoft,
                  backgroundColor: isActive ? `${mode.tone}18` : 'rgba(255,255,255,0.04)',
                },
              ]}
              onPress={() => setActiveKey(mode.key)}
            >
              <Ionicons name={mode.icon} size={16} color={isActive ? mode.tone : colours.muted} />
              <Text style={[styles.modeTabText, { color: isActive ? mode.tone : colours.muted }]}>{mode.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.grid}>
        <MetricCard icon="time" label="Time" value={`${activeMode.durationMinutes}`} sub="minutes" tone={activeMode.tone} />
        <MetricCard icon="flash" label="RPE" value={`${activeMode.rpe}`} sub="target" tone={colours.amber} />
      </View>

      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Session Plan</Text>
          <Text style={[styles.badge, { color: activeMode.tone, backgroundColor: `${activeMode.tone}14` }]}>AI adjusted</Text>
        </View>

        {activeMode.plan.map(([name, dose], index) => (
          <View key={name} style={styles.exerciseRow}>
            <View style={[styles.exerciseNumber, { backgroundColor: `${activeMode.tone}18` }]}>
              <Text style={[styles.exerciseNumberText, { color: activeMode.tone }]}>{index + 1}</Text>
            </View>
            <View style={styles.exerciseCopy}>
              <Text style={styles.exerciseName}>{name}</Text>
              <Text style={styles.muted}>{dose}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colours.muted} />
          </View>
        ))}
      </Card>

      <Card style={{ backgroundColor: `${activeMode.tone}10` }}>
        <Text style={styles.coach}>AI Coach: {activeMode.coach}</Text>
      </Card>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: activeMode.tone }, saved && styles.primaryButtonDisabled]}
        onPress={completeWorkout}
        disabled={saved}
      >
        <Text style={styles.primaryButtonText}>{saved ? 'Session Saved' : `Complete ${activeMode.label}`}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colours.muted, fontSize: 13 },
  title: { color: colours.text, fontSize: 30, fontWeight: '900', marginBottom: 14 },
  modeTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modeTabText: { fontSize: 12, fontWeight: '900' },
  grid: { flexDirection: 'row', gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 },
  cardTitle: { color: colours.text, fontSize: 18, fontWeight: '900' },
  badge: { fontSize: 11, fontWeight: '900', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 9,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  exerciseNumber: {
    height: 32,
    width: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: { fontWeight: '900' },
  exerciseCopy: { flex: 1 },
  exerciseName: { color: colours.text, fontWeight: '800' },
  coach: { color: colours.text, fontSize: 14, lineHeight: 21 },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.62 },
  primaryButtonText: { color: '#07111E', fontWeight: '900', fontSize: 16 },
});
