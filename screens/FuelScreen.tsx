import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { colours } from '../theme';
import { fuelProfile, teamMessages, TrainingSession, TeamMessage } from '../data/mockData';

type WeightGoal = 'loss' | 'maintain' | 'gain';

const goals: Array<{ id: WeightGoal; label: string; offset: number; tone: string }> = [
  { id: 'loss', label: 'Loss', offset: -350, tone: colours.green },
  { id: 'maintain', label: 'Maintain', offset: 0, tone: colours.cyan },
  { id: 'gain', label: 'Gain', offset: 300, tone: colours.amber },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function FuelScreen({ sessions }: { sessions: TrainingSession[] }) {
  const [goal, setGoal] = useState<WeightGoal>('maintain');
  const [bodyWeightKg, setBodyWeightKg] = useState(fuelProfile.bodyWeightKg);
  const [sleepScore, setSleepScore] = useState(fuelProfile.sleepScore);
  const [hydrationLoggedMl, setHydrationLoggedMl] = useState(fuelProfile.hydrationLoggedMl);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<TeamMessage[]>(teamMessages);

  const activeGoal = goals.find((item) => item.id === goal) ?? goals[1];
  const caloriesUsed = useMemo(
    () => sessions.slice(0, 7).reduce((total, session) => total + session.durationMinutes * session.rpe * 7, 0),
    [sessions]
  );
  const baseCalories = Math.round(bodyWeightKg * 31);
  const calorieTarget = baseCalories + activeGoal.offset + Math.round(caloriesUsed / 7);
  const proteinTarget = Math.round(bodyWeightKg * (goal === 'gain' ? 2.0 : 1.8));
  const carbTarget = Math.round((calorieTarget * (goal === 'loss' ? 0.38 : 0.48)) / 4);
  const fatTarget = Math.round((calorieTarget * 0.25) / 9);
  const hydrationTargetMl = Math.round(bodyWeightKg * 35 + Math.min(1200, caloriesUsed / 7));
  const hydrationPct = Math.round((hydrationLoggedMl / hydrationTargetMl) * 100);
  const sleepTone = sleepScore >= 80 ? colours.green : sleepScore >= 65 ? colours.amber : colours.red;
  const fuelTiming = goal === 'gain'
    ? 'Add a carb/protein meal within 90 minutes after training.'
    : goal === 'loss'
      ? 'Keep protein high and place most carbs around training.'
      : 'Fuel hard sessions, keep normal meals steady on recovery days.';

  function sendMessage() {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    const now = new Date();
    setMessages((current) => [
      {
        id: `msg-${Date.now()}`,
        author: 'You',
        group: 'Team',
        message: trimmed,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      },
      ...current,
    ]);
    setChatInput('');
  }

  return (
    <Screen>
      <Text style={styles.muted}>Food, fuel, recovery</Text>
      <Text style={styles.title}>Fuel Centre</Text>

      <View style={styles.goalTabs}>
        {goals.map((item) => {
          const active = item.id === goal;
          return (
            <Pressable
              key={item.id}
              style={[
                styles.goalTab,
                {
                  borderColor: active ? `${item.tone}80` : colours.borderSoft,
                  backgroundColor: active ? `${item.tone}16` : 'rgba(255,255,255,0.04)',
                },
              ]}
              onPress={() => setGoal(item.id)}
            >
              <Text style={[styles.goalText, { color: active ? item.tone : colours.muted }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.grid}>
        <MetricCard icon="flame" label="Calories Used" value={`${caloriesUsed}`} sub="last 7 sessions" tone={colours.amber} />
        <MetricCard icon="restaurant" label="Fuel Target" value={`${calorieTarget}`} sub="kcal today" tone={activeGoal.tone} />
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardTitle}>Body Weight</Text>
            <Text style={styles.muted}>Adjust to update fuel and hydration targets.</Text>
          </View>
          <View style={styles.stepper}>
            <Pressable style={styles.stepButton} onPress={() => setBodyWeightKg((value) => clamp(value - 1, 40, 180))}>
              <Text style={styles.stepText}>-</Text>
            </Pressable>
            <Text style={styles.weightValue}>{bodyWeightKg}kg</Text>
            <Pressable style={styles.stepButton} onPress={() => setBodyWeightKg((value) => clamp(value + 1, 40, 180))}>
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Macros</Text>
        <View style={styles.macroGrid}>
          <View style={styles.macroItem}>
            <Text style={styles.macroValue}>{proteinTarget}g</Text>
            <Text style={styles.macroLabel}>Protein</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={styles.macroValue}>{carbTarget}g</Text>
            <Text style={styles.macroLabel}>Carbs</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={styles.macroValue}>{fatTarget}g</Text>
            <Text style={styles.macroLabel}>Fat</Text>
          </View>
        </View>
        <Text style={styles.guidance}>{fuelTiming}</Text>
      </Card>

      <View style={styles.grid}>
        <MetricCard icon="moon" label="Sleep Score" value={`${sleepScore}`} sub={sleepScore >= 80 ? 'ready' : 'monitor load'} tone={sleepTone} />
        <MetricCard icon="water" label="Hydration" value={`${Math.round(hydrationTargetMl / 100) / 10}L`} sub={`${Math.min(100, hydrationPct)}% logged`} tone={colours.cyan} />
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Sleep Score</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepButton} onPress={() => setSleepScore((value) => clamp(value - 5, 0, 100))}>
              <Text style={styles.stepText}>-</Text>
            </Pressable>
            <Pressable style={styles.stepButton} onPress={() => setSleepScore((value) => clamp(value + 5, 0, 100))}>
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>
        <ProgressBar value={sleepScore} colour={sleepTone} />
        <Text style={styles.guidance}>
          {sleepScore >= 80 ? 'Good to train as planned.' : sleepScore >= 65 ? 'Keep intensity controlled and extend warm-up.' : 'Prioritise recovery, hydration, and low-intensity work.'}
        </Text>
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Hydration Needs</Text>
          <Text style={styles.hydrationValue}>{hydrationLoggedMl}ml</Text>
        </View>
        <ProgressBar value={hydrationPct} colour={colours.cyan} />
        <View style={styles.hydrationActions}>
          {[250, 500, 750].map((amount) => (
            <Pressable key={amount} style={styles.hydrationButton} onPress={() => setHydrationLoggedMl((value) => clamp(value + amount, 0, hydrationTargetMl))}>
              <Text style={styles.hydrationButtonText}>+{amount}ml</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Member Chat</Text>
        <View style={styles.chatComposer}>
          <TextInput
            style={styles.chatInput}
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Message the team"
            placeholderTextColor={colours.soft}
          />
          <Pressable style={styles.sendButton} onPress={sendMessage}>
            <Ionicons name="send" size={17} color={colours.background} />
          </Pressable>
        </View>

        {messages.slice(0, 5).map((message) => (
          <View key={message.id} style={styles.messageRow}>
            <View style={styles.messageHeader}>
              <Text style={styles.messageAuthor}>{message.author}</Text>
              <Text style={styles.messageMeta}>{message.group} - {message.time}</Text>
            </View>
            <Text style={styles.messageText}>{message.message}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colours.muted, fontSize: 13 },
  title: { color: colours.text, fontSize: 30, fontWeight: '900', marginBottom: 14 },
  goalTabs: { flexDirection: 'row', gap: 8 },
  goalTab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  goalText: { fontSize: 12, fontWeight: '900' },
  grid: { flexDirection: 'row', gap: 12 },
  cardTitle: { color: colours.text, fontSize: 18, fontWeight: '900' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colours.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colours.background, fontSize: 18, fontWeight: '900' },
  weightValue: { color: colours.text, fontWeight: '900', minWidth: 50, textAlign: 'center' },
  macroGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  macroItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  macroValue: { color: colours.cyan, fontSize: 22, fontWeight: '900' },
  macroLabel: { color: colours.muted, fontSize: 11, fontWeight: '900', marginTop: 3 },
  guidance: { color: colours.textSoft, fontSize: 13, lineHeight: 19, marginTop: 12 },
  hydrationValue: { color: colours.cyan, fontWeight: '900' },
  hydrationActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  hydrationButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: `${colours.cyan}40`,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: colours.cyanDim,
  },
  hydrationButtonText: { color: colours.cyan, fontSize: 12, fontWeight: '900' },
  chatComposer: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    color: colours.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.cyan,
  },
  messageRow: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: 11,
    backgroundColor: 'rgba(0,0,0,0.16)',
    marginBottom: 9,
  },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  messageAuthor: { color: colours.text, fontSize: 13, fontWeight: '900' },
  messageMeta: { color: colours.muted, fontSize: 11, fontWeight: '700' },
  messageText: { color: colours.textSoft, fontSize: 13, lineHeight: 18 },
});
