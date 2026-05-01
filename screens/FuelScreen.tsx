import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { colours } from '../theme';
import { fuelProfile, TrainingSession } from '../data/mockData';
import type { ReadinessLog } from '../data/domain';
import { buildPerformanceProfile } from '../lib/performance';
import { getLatestReadinessLog, isReadinessStale, readinessSleepScore } from '../lib/readiness';

type WeightGoal = 'loss' | 'maintain' | 'gain';

const goals: Array<{ id: WeightGoal; label: string; offset: number; tone: string }> = [
  { id: 'loss', label: 'Loss', offset: -350, tone: colours.green },
  { id: 'maintain', label: 'Maintain', offset: 0, tone: colours.cyan },
  { id: 'gain', label: 'Gain', offset: 300, tone: colours.amber },
];

const heartRateZones = [
  { label: 'Z1 Recovery', range: '50-60%', low: 0.5, high: 0.6, tone: colours.green },
  { label: 'Z2 Aerobic', range: '60-70%', low: 0.6, high: 0.7, tone: colours.cyan },
  { label: 'Z3 Tempo', range: '70-80%', low: 0.7, high: 0.8, tone: colours.amber },
  { label: 'Z4 Threshold', range: '80-90%', low: 0.8, high: 0.9, tone: colours.sand },
  { label: 'Z5 Max', range: '90-100%', low: 0.9, high: 1, tone: colours.red },
];

const rpeScale = [
  { range: '1-2', label: 'Easy', guidance: 'Warm-up, recovery, breathing stays calm.' },
  { range: '3-4', label: 'Base', guidance: 'Aerobic work you can hold and talk through.' },
  { range: '5-6', label: 'Steady', guidance: 'Working pace, controlled but focused.' },
  { range: '7-8', label: 'Hard', guidance: 'Threshold intervals, short phrases only.' },
  { range: '9-10', label: 'Max', guidance: 'Very hard efforts, use sparingly.' },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBmiCategory(bmi: number) {
  if (bmi < 18.5) {
    return { label: 'Low', tone: colours.amber, guidance: 'BMI is a rough screen. Pair it with strength, energy, and food logs.' };
  }
  if (bmi < 25) {
    return { label: 'Standard', tone: colours.green, guidance: 'Use BMI as a trend only. Skinfolds and performance tell the better story.' };
  }
  if (bmi < 30) {
    return { label: 'High', tone: colours.amber, guidance: 'BMI can over-read muscular athletes. Compare it with skinfold and waist trends.' };
  }
  return { label: 'Very high', tone: colours.red, guidance: 'If this trend is unwanted or changing fast, get professional guidance.' };
}

function MetricStepper({
  label,
  value,
  unit,
  onMinus,
  onPlus,
}: {
  label: string;
  value: number;
  unit: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.metricControl}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable style={styles.stepButton} onPress={onMinus}>
          <Text style={styles.stepText}>-</Text>
        </Pressable>
        <Text style={styles.weightValue}>{value}{unit}</Text>
        <Pressable style={styles.stepButton} onPress={onPlus}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function FuelScreen({ sessions, readinessLogs = [] }: { sessions: TrainingSession[]; readinessLogs?: ReadinessLog[] }) {
  const [goal, setGoal] = useState<WeightGoal>('maintain');
  const [bodyWeightKg, setBodyWeightKg] = useState(fuelProfile.bodyWeightKg);
  const [heightCm, setHeightCm] = useState(fuelProfile.heightCm);
  const [age, setAge] = useState(fuelProfile.age);
  const [skinfoldMm, setSkinfoldMm] = useState(fuelProfile.skinfoldMm);
  const [hydrationLoggedMl, setHydrationLoggedMl] = useState(fuelProfile.hydrationLoggedMl);

  const performance = useMemo(() => buildPerformanceProfile(sessions), [sessions]);
  const latestReadiness = useMemo(() => getLatestReadinessLog(readinessLogs), [readinessLogs]);
  const latestReadinessIsStale = isReadinessStale(latestReadiness);
  const sleepScore = latestReadinessIsStale ? undefined : readinessSleepScore(latestReadiness);
  const activeGoal = useMemo(() => goals.find((item) => item.id === goal) ?? goals[1], [goal]);
  const bmi = useMemo(() => Math.round((bodyWeightKg / Math.pow(heightCm / 100, 2)) * 10) / 10, [bodyWeightKg, heightCm]);
  const bmiInfo = useMemo(() => getBmiCategory(bmi), [bmi]);
  const maxHr = useMemo(() => Math.max(120, 220 - age), [age]);
  const estimatedBodyFat = useMemo(() => Math.round(clamp(5 + skinfoldMm * 0.45, 5, 45) * 10) / 10, [skinfoldMm]);
  const caloriesUsed = useMemo(
    () => performance.weeklyLoad * 7,
    [performance.weeklyLoad]
  );
  const baseCalories = useMemo(() => Math.round(bodyWeightKg * 31), [bodyWeightKg]);
  const calorieTarget = useMemo(() => baseCalories + activeGoal.offset + Math.round(caloriesUsed / 7), [baseCalories, activeGoal.offset, caloriesUsed]);
  const proteinTarget = useMemo(() => Math.round(bodyWeightKg * (goal === 'gain' ? 2.0 : 1.8)), [bodyWeightKg, goal]);
  const carbTarget = useMemo(() => Math.round((calorieTarget * (goal === 'loss' ? 0.38 : 0.48)) / 4), [calorieTarget, goal]);
  const fatTarget = useMemo(() => Math.round((calorieTarget * 0.25) / 9), [calorieTarget]);
  const hydrationTargetMl = useMemo(() => Math.round(bodyWeightKg * 35 + Math.min(1200, caloriesUsed / 7)), [bodyWeightKg, caloriesUsed]);
  const hydrationPct = useMemo(() => Math.round((hydrationLoggedMl / hydrationTargetMl) * 100), [hydrationLoggedMl, hydrationTargetMl]);
  const sleepTone = sleepScore === undefined ? colours.muted : sleepScore >= 80 ? colours.green : sleepScore >= 65 ? colours.amber : colours.red;
  const fuelTiming = goal === 'gain'
    ? 'Add a carb/protein meal within 90 minutes after training.'
    : goal === 'loss'
      ? 'Keep protein high and place most carbs around training.'
      : 'Fuel hard sessions, keep normal meals steady on recovery days.';

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
        <MetricCard icon="flame" label="Load Cost" value={`${performance.weeklyLoad}`} sub="last 7 days" tone={performance.riskTone} />
        <MetricCard icon="restaurant" label="Fuel Target" value={`${calorieTarget}`} sub="kcal today" tone={activeGoal.tone} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>Body Metrics</Text>
        <Text style={styles.muted}>Adjust these to update BMI, fuel targets, hydration, and training zones.</Text>
        <View style={styles.metricGrid}>
          <MetricStepper
            label="Weight"
            value={bodyWeightKg}
            unit="kg"
            onMinus={() => setBodyWeightKg((value) => clamp(value - 1, 40, 180))}
            onPlus={() => setBodyWeightKg((value) => clamp(value + 1, 40, 180))}
          />
          <MetricStepper
            label="Height"
            value={heightCm}
            unit="cm"
            onMinus={() => setHeightCm((value) => clamp(value - 1, 130, 220))}
            onPlus={() => setHeightCm((value) => clamp(value + 1, 130, 220))}
          />
          <MetricStepper
            label="Age"
            value={age}
            unit=""
            onMinus={() => setAge((value) => clamp(value - 1, 13, 85))}
            onPlus={() => setAge((value) => clamp(value + 1, 13, 85))}
          />
          <MetricStepper
            label="Skinfold"
            value={skinfoldMm}
            unit="mm"
            onMinus={() => setSkinfoldMm((value) => clamp(value - 1, 5, 100))}
            onPlus={() => setSkinfoldMm((value) => clamp(value + 1, 5, 100))}
          />
        </View>
      </Card>

      <View style={styles.grid}>
        <MetricCard icon="speedometer" label="BMI Index" value={`${bmi}`} sub={bmiInfo.label} tone={bmiInfo.tone} />
        <MetricCard icon="analytics" label="Skinfold" value={`${skinfoldMm}mm`} sub={`${estimatedBodyFat}% est.`} tone={colours.violet} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>Body Guidance</Text>
        <Text style={styles.guidance}>{bmiInfo.guidance}</Text>
        <Text style={styles.guidance}>
          Skinfold estimate uses a simple field calculation for coaching trends. Use the same sites and technique each time.
        </Text>
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

      <Card>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardTitle}>Heart Rate Zones</Text>
            <Text style={styles.muted}>Age based estimate: max HR {maxHr} bpm</Text>
          </View>
          <Ionicons name="heart" size={22} color={colours.red} />
        </View>
        {heartRateZones.map((zone) => {
          const low = Math.round(maxHr * zone.low);
          const high = Math.round(maxHr * zone.high);
          return (
            <View key={zone.label} style={styles.zoneRow}>
              <View style={styles.zoneTop}>
                <Text style={styles.zoneLabel}>{zone.label}</Text>
                <Text style={styles.zoneBpm}>{low}-{high} bpm</Text>
              </View>
              <ProgressBar value={Math.round(zone.high * 100)} colour={zone.tone} />
              <Text style={styles.zoneRange}>{zone.range} max HR</Text>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>RPE Scale</Text>
        {rpeScale.map((item) => (
          <View key={item.range} style={styles.rpeRow}>
            <Text style={styles.rpeRange}>{item.range}</Text>
            <View style={styles.rpeCopy}>
              <Text style={styles.rpeLabel}>{item.label}</Text>
              <Text style={styles.rpeGuidance}>{item.guidance}</Text>
            </View>
          </View>
        ))}
      </Card>

      <View style={styles.grid}>
        <MetricCard
          icon="moon"
          label="Sleep Score"
          value={sleepScore === undefined ? '--' : `${sleepScore}`}
          sub={latestReadiness?.sleepHours ? `${latestReadiness.sleepHours}h logged` : 'from readiness'}
          tone={sleepTone}
        />
        <MetricCard icon="water" label="Hydration" value={`${Math.round(hydrationTargetMl / 100) / 10}L`} sub={`${Math.min(100, hydrationPct)}% logged`} tone={colours.cyan} />
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Sleep Score</Text>
          <Ionicons name="moon" size={22} color={sleepTone} />
        </View>
        <ProgressBar value={sleepScore ?? 0} colour={sleepTone} />
        <Text style={styles.guidance}>
          {sleepScore === undefined
            ? latestReadinessIsStale
              ? 'Readiness sleep data is stale. Check in today before setting fuel and recovery priority.'
              : 'Log readiness to calculate sleep guidance from real check-in data.'
            : sleepScore >= 80
              ? 'Good to train as planned.'
              : sleepScore >= 65
                ? 'Keep intensity controlled and extend warm-up.'
                : 'Prioritise recovery, hydration, and low-intensity work.'}
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
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  metricControl: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  metricLabel: { color: colours.muted, fontSize: 11, fontWeight: '900', marginBottom: 8 },
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
  zoneRow: { marginTop: 14 },
  zoneTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  zoneLabel: { color: colours.text, fontSize: 13, fontWeight: '900' },
  zoneBpm: { color: colours.textSoft, fontSize: 12, fontWeight: '800' },
  zoneRange: { color: colours.muted, fontSize: 11, fontWeight: '700', marginTop: 5 },
  rpeRow: {
    flexDirection: 'row',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colours.borderSoft,
    paddingVertical: 11,
  },
  rpeRange: {
    width: 42,
    height: 30,
    borderRadius: 9,
    overflow: 'hidden',
    color: colours.background,
    backgroundColor: colours.cyan,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: '900',
    paddingTop: 7,
  },
  rpeCopy: { flex: 1 },
  rpeLabel: { color: colours.text, fontSize: 13, fontWeight: '900' },
  rpeGuidance: { color: colours.textSoft, fontSize: 12, lineHeight: 17, marginTop: 2 },
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
});
