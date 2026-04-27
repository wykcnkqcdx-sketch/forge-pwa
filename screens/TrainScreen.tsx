import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { colours } from '../theme';
import { TrainingSession } from '../data/mockData';

type ExerciseCategory = 'Strength' | 'Resistance' | 'Cardio' | 'Workout' | 'Mobility';

type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  dose: string;
  guidance: string;
  cues: string[];
};

type TrainingMode = {
  key: string;
  type: TrainingSession['type'];
  label: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  rpe: number;
  score: number;
  coach: string;
  defaultExerciseIds: string[];
};

const exerciseLibrary: Exercise[] = [
  { id: 'trap-bar-deadlift', name: 'Trap-bar deadlift', category: 'Strength', dose: '5 x 5', guidance: 'Build full-body force with a neutral grip and strong brace.', cues: ['Feet midline inside handles', 'Brace before pulling', 'Drive the floor away'] },
  { id: 'front-squat', name: 'Front squat', category: 'Strength', dose: '4 x 5', guidance: 'Train upright squatting strength and trunk stiffness.', cues: ['Elbows high', 'Knees track toes', 'Pause if depth collapses'] },
  { id: 'push-press', name: 'Push press', category: 'Strength', dose: '5 x 3', guidance: 'Develop power transfer from legs into overhead pressing.', cues: ['Dip vertical', 'Drive fast', 'Lock ribs down'] },
  { id: 'pull-up', name: 'Pull-up', category: 'Strength', dose: '5 x max clean', guidance: 'Build pulling strength for climbing, carries, and load carriage.', cues: ['Start from active shoulders', 'Chest to bar path', 'No swinging reps'] },
  { id: 'farmer-carry', name: 'Farmer carry', category: 'Strength', dose: '6 x 40m', guidance: 'Train grip, posture, and loaded gait under fatigue.', cues: ['Tall posture', 'Short fast steps', 'Do not lean back'] },
  { id: 'walking-lunge', name: 'Walking lunge', category: 'Strength', dose: '4 x 20m', guidance: 'Strengthen single-leg control and loaded movement.', cues: ['Long enough stride', 'Soft back knee', 'Push through front foot'] },
  { id: 'band-row', name: 'Band row', category: 'Resistance', dose: '4 x 15', guidance: 'Use controlled pulling volume without heavy joint stress.', cues: ['Squeeze shoulder blades', 'Pause at ribs', 'Slow return'] },
  { id: 'goblet-squat', name: 'Goblet squat', category: 'Resistance', dose: '4 x 12', guidance: 'Groove squat mechanics with moderate load.', cues: ['Hold weight tight', 'Sit between hips', 'Keep chest proud'] },
  { id: 'suspension-press', name: 'Suspension press', category: 'Resistance', dose: '4 x 10', guidance: 'Build pressing control with adjustable body angle.', cues: ['Body straight', 'Hands under shoulders', 'Control depth'] },
  { id: 'hamstring-bridge', name: 'Hamstring bridge', category: 'Resistance', dose: '3 x 14', guidance: 'Target posterior chain endurance and hip extension.', cues: ['Ribs down', 'Squeeze glutes', 'Slow lower'] },
  { id: 'anti-rotation', name: 'Anti-rotation press', category: 'Resistance', dose: '3 x 30s', guidance: 'Train trunk control against twisting forces.', cues: ['Square shoulders', 'Exhale on press', 'No torso drift'] },
  { id: 'band-face-pull', name: 'Band face pull', category: 'Resistance', dose: '3 x 18', guidance: 'Build upper-back resilience for posture and shoulder health.', cues: ['Pull to eyebrows', 'Elbows high', 'Slow return'] },
  { id: 'zone-2-run', name: 'Zone 2 run', category: 'Cardio', dose: '24 mins', guidance: 'Build aerobic base at a conversational pace.', cues: ['Nasal or easy breathing', 'Stay relaxed', 'Finish fresher than you started'] },
  { id: 'tempo-run', name: 'Tempo run', category: 'Cardio', dose: '3 x 8 mins', guidance: 'Improve threshold pace without sprinting.', cues: ['Hard but controlled', 'Even splits', 'Recover fully between reps'] },
  { id: 'bike-intervals', name: 'Bike intervals', category: 'Cardio', dose: '8 x 60s', guidance: 'Develop low-impact conditioning and repeat power.', cues: ['Fast cadence', 'Recover easy', 'Keep hips still'] },
  { id: 'rower-base', name: 'Rower base', category: 'Cardio', dose: '20 mins', guidance: 'Build engine capacity with full-body rhythm.', cues: ['Legs then body then arms', 'Smooth recovery', 'Consistent split'] },
  { id: 'strides', name: 'Strides', category: 'Cardio', dose: '6 x 20s', guidance: 'Touch speed while staying relaxed and technically clean.', cues: ['Tall posture', 'Fast feet', 'Walk back recovery'] },
  { id: 'shuttle-run', name: 'Shuttle run', category: 'Workout', dose: '6 x 60m', guidance: 'Train acceleration, deceleration, and change of direction.', cues: ['Sink hips before turn', 'Touch line under control', 'Accelerate cleanly'] },
  { id: 'sandbag-clean', name: 'Sandbag clean', category: 'Workout', dose: '5 x 6', guidance: 'Build awkward-object power for field work.', cues: ['Lap the bag', 'Hips through', 'Do not curl with arms'] },
  { id: 'push-up-ladder', name: 'Push-up ladder', category: 'Workout', dose: '10-8-6-4-2', guidance: 'Accumulate pressing volume under fatigue.', cues: ['Straight body line', 'Chest to floor', 'Stop before sagging'] },
  { id: 'bear-crawl', name: 'Bear crawl', category: 'Workout', dose: '5 x 20m', guidance: 'Train shoulder stability, trunk control, and coordination.', cues: ['Knees low', 'Opposite hand and foot', 'Quiet hips'] },
  { id: 'burpee', name: 'Burpee', category: 'Workout', dose: '5 x 10', guidance: 'Use as a high-output conditioning tool.', cues: ['Step down if needed', 'Land soft', 'Keep reps consistent'] },
  { id: 'mobility-reset', name: 'Mobility reset', category: 'Mobility', dose: '8 mins', guidance: 'Downshift after training and restore usable range.', cues: ['Move slowly', 'Breathe through positions', 'Avoid pain'] },
  { id: 'hip-airplane', name: 'Hip airplane', category: 'Mobility', dose: '3 x 5 each', guidance: 'Improve hip control for running, rucking, and squatting.', cues: ['Hold support', 'Rotate from hip', 'Move in control'] },
  { id: 'thoracic-rotation', name: 'Thoracic rotation', category: 'Mobility', dose: '2 x 8 each', guidance: 'Restore upper-back rotation and shoulder position.', cues: ['Keep hips stacked', 'Reach long', 'Exhale into rotation'] },
  { id: 'calf-ankle-rock', name: 'Calf ankle rock', category: 'Mobility', dose: '2 x 12 each', guidance: 'Prepare ankles for running, loaded walking, and squatting.', cues: ['Heel stays down', 'Knee tracks toes', 'Pause at end range'] },
];

const trainingModes: TrainingMode[] = [
  {
    key: 'strength',
    type: 'Strength',
    label: 'Strength',
    title: 'Strength Training',
    icon: 'barbell',
    tone: colours.cyan,
    rpe: 7,
    score: 84,
    coach: 'Prioritise crisp heavy reps, longer rest, and clean technique.',
    defaultExerciseIds: ['trap-bar-deadlift', 'front-squat', 'push-press', 'pull-up', 'farmer-carry'],
  },
  {
    key: 'resistance',
    type: 'Resistance',
    label: 'Resistance',
    title: 'Resistance Training',
    icon: 'git-branch',
    tone: colours.violet,
    rpe: 6,
    score: 82,
    coach: 'Use controlled tempo and steady tension through the full range.',
    defaultExerciseIds: ['band-row', 'goblet-squat', 'suspension-press', 'hamstring-bridge', 'anti-rotation'],
  },
  {
    key: 'cardio',
    type: 'Cardio',
    label: 'Cardio',
    title: 'Cardio Training',
    icon: 'heart',
    tone: colours.green,
    rpe: 5,
    score: 86,
    coach: 'Keep most work aerobic, then add small speed doses when fresh.',
    defaultExerciseIds: ['zone-2-run', 'tempo-run', 'bike-intervals', 'rower-base', 'strides'],
  },
  {
    key: 'workout',
    type: 'Workout',
    label: 'Workout',
    title: 'Field Workout',
    icon: 'fitness',
    tone: colours.amber,
    rpe: 8,
    score: 79,
    coach: 'Move with intent, but cap intensity if form starts to break.',
    defaultExerciseIds: ['sandbag-clean', 'shuttle-run', 'push-up-ladder', 'bear-crawl', 'mobility-reset'],
  },
];

const categories: Array<'All' | ExerciseCategory> = ['All', 'Strength', 'Resistance', 'Cardio', 'Workout', 'Mobility'];

export function TrainScreen({ addSession }: { addSession: (session: TrainingSession) => void }) {
  const [activeKey, setActiveKey] = useState(trainingModes[0].key);
  const [activeCategory, setActiveCategory] = useState<'All' | ExerciseCategory>('All');
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [selectedByMode, setSelectedByMode] = useState<Record<string, string[]>>(
    Object.fromEntries(trainingModes.map((mode) => [mode.key, mode.defaultExerciseIds]))
  );
  const [focusedExerciseId, setFocusedExerciseId] = useState(trainingModes[0].defaultExerciseIds[0]);
  const activeMode = useMemo(
    () => trainingModes.find((mode) => mode.key === activeKey) ?? trainingModes[0],
    [activeKey]
  );
  const selectedIds = selectedByMode[activeMode.key] ?? [];
  const selectedExercises = selectedIds
    .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => Boolean(exercise));
  const focusedExercise = exerciseLibrary.find((exercise) => exercise.id === focusedExerciseId) ?? selectedExercises[0] ?? exerciseLibrary[0];
  const filteredExercises = activeCategory === 'All'
    ? exerciseLibrary
    : exerciseLibrary.filter((exercise) => exercise.category === activeCategory);
  const estimatedMinutes = Math.max(20, selectedExercises.length * 8 + (activeMode.key === 'cardio' ? 8 : 0));
  const saved = savedKeys.includes(activeMode.key);

  function switchMode(key: string) {
    const nextMode = trainingModes.find((mode) => mode.key === key) ?? trainingModes[0];
    setActiveKey(nextMode.key);
    setFocusedExerciseId((selectedByMode[nextMode.key] ?? nextMode.defaultExerciseIds)[0]);
  }

  function toggleExercise(exercise: Exercise) {
    setFocusedExerciseId(exercise.id);
    setSelectedByMode((current) => {
      const currentIds = current[activeMode.key] ?? [];
      const exists = currentIds.includes(exercise.id);
      const nextIds = exists
        ? currentIds.filter((id) => id !== exercise.id)
        : [...currentIds, exercise.id];

      return { ...current, [activeMode.key]: nextIds };
    });
    setSavedKeys((current) => current.filter((key) => key !== activeMode.key));
  }

  function completeWorkout() {
    if (saved || selectedExercises.length === 0) return;

    const session: TrainingSession = {
      id: `${activeMode.key}-${Date.now()}`,
      type: activeMode.type,
      title: `${activeMode.title} (${selectedExercises.length})`,
      score: activeMode.score,
      durationMinutes: estimatedMinutes,
      rpe: activeMode.rpe,
    };

    addSession(session);
    setSavedKeys((current) => [...current, activeMode.key]);
    Alert.alert('Session saved', `${selectedExercises.length} exercises have been added to your training log.`);
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
              onPress={() => switchMode(mode.key)}
            >
              <Ionicons name={mode.icon} size={16} color={isActive ? mode.tone : colours.muted} />
              <Text style={[styles.modeTabText, { color: isActive ? mode.tone : colours.muted }]}>{mode.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.grid}>
        <MetricCard icon="time" label="Time" value={`${estimatedMinutes}`} sub="est. minutes" tone={activeMode.tone} />
        <MetricCard icon="list" label="Selected" value={`${selectedExercises.length}`} sub="exercises" tone={colours.amber} />
      </View>

      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Selected Exercises</Text>
          <Text style={[styles.badge, { color: activeMode.tone, backgroundColor: `${activeMode.tone}14` }]}>Tap to focus</Text>
        </View>

        {selectedExercises.length > 0 ? (
          selectedExercises.map((exercise, index) => (
            <Pressable key={exercise.id} style={styles.exerciseRow} onPress={() => setFocusedExerciseId(exercise.id)}>
              <View style={[styles.exerciseNumber, { backgroundColor: `${activeMode.tone}18` }]}>
                <Text style={[styles.exerciseNumberText, { color: activeMode.tone }]}>{index + 1}</Text>
              </View>
              <View style={styles.exerciseCopy}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.muted}>{exercise.dose}</Text>
              </View>
              <Ionicons name={focusedExercise.id === exercise.id ? 'radio-button-on' : 'chevron-forward'} size={18} color={activeMode.tone} />
            </Pressable>
          ))
        ) : (
          <View style={styles.emptySelection}>
            <Text style={styles.emptyTitle}>No exercises selected</Text>
            <Text style={styles.muted}>Pick from the exercise library below.</Text>
          </View>
        )}
      </Card>

      <Card style={{ backgroundColor: `${activeMode.tone}10` }}>
        <Text style={styles.cardTitle}>Exercise Guidance</Text>
        <Text style={styles.guidanceTitle}>{focusedExercise.name}</Text>
        <Text style={styles.coach}>{focusedExercise.guidance}</Text>
        <View style={styles.cueList}>
          {focusedExercise.cues.map((cue) => (
            <View key={cue} style={styles.cuePill}>
              <Text style={styles.cueText}>{cue}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Exercise Library</Text>
          <Text style={styles.libraryCount}>{exerciseLibrary.length} total</Text>
        </View>

        <View style={styles.categoryTabs}>
          {categories.map((category) => {
            const isActive = category === activeCategory;
            return (
              <Pressable
                key={category}
                style={[styles.categoryTab, isActive && { borderColor: activeMode.tone, backgroundColor: `${activeMode.tone}14` }]}
                onPress={() => setActiveCategory(category)}
              >
                <Text style={[styles.categoryText, isActive && { color: activeMode.tone }]}>{category}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.libraryGrid}>
          {filteredExercises.map((exercise) => {
            const isSelected = selectedIds.includes(exercise.id);
            return (
              <Pressable
                key={exercise.id}
                style={[
                  styles.libraryItem,
                  isSelected && { borderColor: activeMode.tone, backgroundColor: `${activeMode.tone}12` },
                ]}
                onPress={() => toggleExercise(exercise)}
              >
                <View style={styles.libraryTop}>
                  <Text style={[styles.libraryName, isSelected && { color: activeMode.tone }]}>{exercise.name}</Text>
                  <Ionicons name={isSelected ? 'checkmark-circle' : 'add-circle-outline'} size={18} color={isSelected ? activeMode.tone : colours.muted} />
                </View>
                <Text style={styles.libraryMeta}>{exercise.category} - {exercise.dose}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={{ backgroundColor: `${activeMode.tone}10` }}>
        <Text style={styles.coach}>AI Coach: {activeMode.coach}</Text>
      </Card>

      <Pressable
        style={[
          styles.primaryButton,
          { backgroundColor: activeMode.tone },
          (saved || selectedExercises.length === 0) && styles.primaryButtonDisabled,
        ]}
        onPress={completeWorkout}
        disabled={saved || selectedExercises.length === 0}
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
  libraryCount: { color: colours.muted, fontSize: 12, fontWeight: '800' },
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
  emptySelection: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emptyTitle: { color: colours.text, fontWeight: '900' },
  guidanceTitle: { color: colours.text, fontSize: 17, fontWeight: '900', marginBottom: 6 },
  coach: { color: colours.text, fontSize: 14, lineHeight: 21 },
  cueList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  cuePill: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cueText: { color: colours.textSoft, fontSize: 11, fontWeight: '800' },
  categoryTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  categoryTab: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  categoryText: { color: colours.muted, fontSize: 11, fontWeight: '900' },
  libraryGrid: { gap: 9 },
  libraryItem: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  libraryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  libraryName: { color: colours.text, fontSize: 14, fontWeight: '900', flex: 1 },
  libraryMeta: { color: colours.muted, fontSize: 11, marginTop: 4 },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.62 },
  primaryButtonText: { color: '#07111E', fontWeight: '900', fontSize: 16 },
});
