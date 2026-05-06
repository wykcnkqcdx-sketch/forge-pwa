import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { colours, touchTarget } from '../theme';
import { TrainingSession, ExerciseCategory, Exercise, MovementPattern, exerciseLibrary, trainingModes } from '../data/mockData';
import { showAlert } from '../lib/dialogs';

const categories: Array<'All' | ExerciseCategory> = ['All', 'Strength', 'Resistance', 'Cardio', 'Workout', 'Mobility'];
const timeTargets = [20, 30, 45, 60];
const quickLogTemplates: Array<{
  label: string;
  type: TrainingSession['type'];
  minutes: number;
  rpe: number;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
}> = [
  { label: 'Strength', type: 'Strength', minutes: 45, rpe: 7, icon: 'barbell-outline', tone: colours.green },
  { label: 'Run', type: 'Run', minutes: 30, rpe: 6, icon: 'walk-outline', tone: colours.cyan },
  { label: 'Ruck', type: 'Ruck', minutes: 60, rpe: 7, icon: 'footsteps-outline', tone: colours.amber },
  { label: 'Mobility', type: 'Mobility', minutes: 20, rpe: 3, icon: 'body-outline', tone: colours.violet },
];

function targetCountForMinutes(minutes: number) {
  if (minutes <= 20) return 3;
  if (minutes <= 30) return 4;
  if (minutes <= 45) return 5;
  return 7;
}

function getExercisePattern(exercise: Exercise): MovementPattern {
  if (exercise.pattern) return exercise.pattern;
  if (exercise.category === 'Cardio') return 'Conditioning';
  if (exercise.category === 'Mobility') return 'Mobility';
  if (exercise.category === 'Workout') return 'Conditioning';
  return 'Core';
}

export function TrainScreen({ addSession, sessions }: { addSession: (session: TrainingSession) => void; sessions: TrainingSession[] }) {
  const totalScore = useMemo(() => sessions.reduce((total, s) => total + s.score, 0), [sessions]);
  const currentLevel = Math.floor(totalScore / 500) + 1;
  const unlockProgressPct = Math.min(100, Math.round((totalScore / 4500) * 100)); // 4500 pts = Level 10

  const availableModes = useMemo(() => {
    return trainingModes.filter((mode) => !mode.unlockLevel || currentLevel >= mode.unlockLevel);
  }, [currentLevel]);

  useEffect(() => {
    async function checkUnlockAlert() {
      if (currentLevel >= 10) {
        const hasSeen = await AsyncStorage.getItem('forge:elite_unlocked_alert');
        if (!hasSeen) {
          showAlert(
            'Tier 1 Operator Unlocked',
            'Congratulations! You have reached Level 10 and unlocked the Elite training block.'
          );
          await AsyncStorage.setItem('forge:elite_unlocked_alert', 'true');
        }
      }
    }
    checkUnlockAlert();
  }, [currentLevel]);

  const [activeKey, setActiveKey] = useState(availableModes[0].key);
  const [activeCategory, setActiveCategory] = useState<'All' | ExerciseCategory>('All');
  const [targetMinutes, setTargetMinutes] = useState(45);
  const [trainingFeedback, setTrainingFeedback] = useState('');
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [selectedByMode, setSelectedByMode] = useState<Record<string, string[]>>(
    Object.fromEntries(trainingModes.map((mode) => [mode.key, mode.defaultExerciseIds]))
  );

  const [focusedExerciseId, setFocusedExerciseId] = useState(availableModes[0].defaultExerciseIds[0]);
  const activeMode = useMemo(
    () => availableModes.find((mode) => mode.key === activeKey) ?? availableModes[0],
    [activeKey, availableModes]
  );
  const selectedIds = selectedByMode[activeMode.key] ?? [];
  const selectedExercises = selectedIds
    .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => Boolean(exercise));
  const focusedExercise = exerciseLibrary.find((exercise) => exercise.id === focusedExerciseId) ?? selectedExercises[0] ?? exerciseLibrary[0];
  const pinnedIds = activeMode.coachPinnedExerciseIds ?? [];
  const rawFilteredExercises = activeCategory === 'All'
    ? exerciseLibrary
    : exerciseLibrary.filter((exercise) => exercise.category === activeCategory);
  const filteredExercises = [...rawFilteredExercises].sort((a, b) => Number(pinnedIds.includes(b.id)) - Number(pinnedIds.includes(a.id)));
  const estimatedMinutes = targetMinutes;
  const recommendedExerciseCount = targetCountForMinutes(targetMinutes);
  const selectedStatusTone = selectedExercises.length > recommendedExerciseCount + 2
    ? colours.red
    : selectedExercises.length > recommendedExerciseCount
      ? colours.amber
      : colours.green;
  const selectedPatternCounts = selectedExercises.reduce<Record<MovementPattern, number>>((counts, exercise) => {
    const pattern = getExercisePattern(exercise);
    counts[pattern] = (counts[pattern] ?? 0) + 1;
    return counts;
  }, {} as Record<MovementPattern, number>);
  const balanceTip = selectedPatternCounts.Push >= 3 && !selectedPatternCounts.Pull
    ? 'Balance tip: add a pull movement to offset pressing volume.'
    : selectedPatternCounts.Pull >= 3 && !selectedPatternCounts.Push
      ? 'Balance tip: add a push movement so the session is not all pulling.'
      : selectedPatternCounts.Legs >= 4 && selectedExercises.length <= recommendedExerciseCount
        ? 'Balance tip: lots of legs today. Consider core or mobility if fatigue climbs.'
        : '';
  const saved = savedKeys.includes(activeMode.key);

  function switchMode(key: string) {
    const nextMode = availableModes.find((mode) => mode.key === key) ?? availableModes[0];
    setActiveKey(nextMode.key);
    setFocusedExerciseId((selectedByMode[nextMode.key] ?? nextMode.defaultExerciseIds)[0]);
  }

  function toggleExercise(exercise: Exercise) {
    if (pinnedIds.includes(exercise.id) && selectedIds.includes(exercise.id)) {
      setTrainingFeedback(`${exercise.name} is a coach pick and stays in today's block.`);
      return;
    }

    setFocusedExerciseId(exercise.id);
    setSelectedByMode((current) => {
      const currentIds = current[activeMode.key] ?? [];
      const exists = currentIds.includes(exercise.id);
      const nextIds = exists
        ? currentIds.filter((id) => id !== exercise.id)
        : [...currentIds, exercise.id];

      if (!exists && nextIds.length > recommendedExerciseCount) {
        setTrainingFeedback(`${nextIds.length} exercises is above the ${recommendedExerciseCount} recommended for ${targetMinutes} min. Fine for longer sessions; trim if quality drops.`);
      } else if (exists) {
        setTrainingFeedback(`${exercise.name} removed from this ${activeMode.label} block.`);
      } else {
        setTrainingFeedback(`${exercise.name} added to this ${activeMode.label} block.`);
      }

      return { ...current, [activeMode.key]: nextIds };
    });
    setSavedKeys((current) => current.filter((key) => key !== activeMode.key));
  }

  function changeTargetMinutes(minutes: number) {
    setTargetMinutes(minutes);
    setTrainingFeedback(`Target set to ${minutes} min. Recommended range: ${targetCountForMinutes(minutes)} focused exercises.`);
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
      completedAt: new Date().toISOString(),
    };

    addSession(session);
    setSavedKeys((current) => [...current, activeMode.key]);
    showAlert('Session saved', `${selectedExercises.length} exercises have been added to your training log.`);
  }

  function quickLogSession(template: typeof quickLogTemplates[number]) {
    const session: TrainingSession = {
      id: `quick-${template.type.toLowerCase()}-${Date.now()}`,
      type: template.type,
      title: `Quick ${template.label}`,
      score: Math.round(template.minutes * template.rpe),
      durationMinutes: template.minutes,
      rpe: template.rpe,
      completedAt: new Date().toISOString(),
      loadKg: template.type === 'Ruck' ? 20 : undefined,
    };

    addSession(session);
    showAlert('Session saved', `${template.label} logged. It will appear on Today and Recent Load.`);
  }

  return (
    <Screen>
      <Text style={styles.muted}>Training block</Text>
      <Text style={styles.title}>{activeMode.title}</Text>

      <Card accent={colours.cyan}>
        <Text style={styles.cardTitle}>Quick Log</Text>
        <Text style={styles.trainingHint}>Save a basic session now. Use the builder below when you want exercise detail.</Text>
        <View style={styles.quickLogGrid}>
          {quickLogTemplates.map((template) => (
            <Pressable
              key={template.label}
              accessibilityRole="button"
              accessibilityLabel={`Quick log ${template.label}`}
              style={[styles.quickLogButton, { borderColor: `${template.tone}55`, backgroundColor: `${template.tone}12` }]}
              onPress={() => quickLogSession(template)}
            >
              <Ionicons name={template.icon} size={19} color={template.tone} />
              <Text style={[styles.quickLogLabel, { color: template.tone }]}>{template.label}</Text>
              <Text style={styles.quickLogMeta}>{template.minutes}m / RPE {template.rpe}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <View style={styles.modeTabs}>
        {availableModes.map((mode) => {
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

        {currentLevel < 10 && (
          <View style={[styles.modeTab, styles.lockedTab]}>
            <Ionicons name="lock-closed" size={13} color={colours.soft} />
            <Text style={styles.lockedText}>{unlockProgressPct}%</Text>
            <View style={styles.lockedBarBg}>
              <View style={[styles.lockedBarFill, { width: `${unlockProgressPct}%` }]} />
            </View>
          </View>
        )}
      </View>

      <View style={styles.grid}>
        <MetricCard icon="time" label="Target" value={`${estimatedMinutes}`} sub="minutes" tone={activeMode.tone} />
        <MetricCard icon="list" label="Selected" value={`${selectedExercises.length}`} sub={`${recommendedExerciseCount} recommended`} tone={selectedStatusTone} />
      </View>

      <View style={[styles.selectionStatus, { borderColor: `${selectedStatusTone}55`, backgroundColor: `${selectedStatusTone}12` }]}>
        <Text style={[styles.selectionStatusText, { color: selectedStatusTone }]}>
          {selectedExercises.length <= recommendedExerciseCount
            ? 'Selection fits the time target.'
            : selectedExercises.length <= recommendedExerciseCount + 2
              ? 'Selection may run long for this time target.'
              : 'Selection is likely too dense for this time target.'}
        </Text>
      </View>

      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Session Length</Text>
          <Text style={[styles.badge, { color: activeMode.tone, backgroundColor: `${activeMode.tone}14` }]}>Tap a time</Text>
        </View>
        <View style={styles.timeGrid}>
          {timeTargets.map((minutes) => {
            const active = minutes === targetMinutes;
            return (
              <Pressable
                key={minutes}
                style={[styles.timeButton, active && { borderColor: activeMode.tone, backgroundColor: `${activeMode.tone}18` }]}
                onPress={() => changeTargetMinutes(minutes)}
              >
                <Text style={[styles.timeButtonText, active && { color: activeMode.tone }]}>{minutes} min</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.trainingHint}>Coach recommendation: choose fewer exercises for short sessions, then keep reps cleaner.</Text>
      </Card>

      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Selected Exercises</Text>
          <Text style={[styles.badge, { color: activeMode.tone, backgroundColor: `${activeMode.tone}14` }]}>Tap X to remove</Text>
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
              <Pressable
                style={[styles.removeExerciseButton, pinnedIds.includes(exercise.id) && styles.removeExerciseButtonLocked]}
                onPress={(event) => {
                  event.stopPropagation();
                  toggleExercise(exercise);
                }}
              >
                <Ionicons name={pinnedIds.includes(exercise.id) ? 'lock-closed' : 'close'} size={18} color={pinnedIds.includes(exercise.id) ? colours.amber : colours.red} />
              </Pressable>
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
            const isPinned = pinnedIds.includes(exercise.id);
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
                  <Ionicons name={isPinned ? 'ribbon' : isSelected ? 'checkmark-circle' : 'add-circle-outline'} size={18} color={isPinned ? colours.amber : isSelected ? activeMode.tone : colours.muted} />
                </View>
                <Text style={styles.libraryMeta}>{exercise.category} - {exercise.dose}</Text>
                <View style={styles.libraryBadgeRow}>
                  {isPinned && <Text style={styles.coachPickBadge}>Coach's Pick</Text>}
                  <Text style={styles.patternBadge}>{getExercisePattern(exercise)}</Text>
                </View>
                <Text style={[styles.libraryAction, isSelected && { color: activeMode.tone }]}>{isPinned ? 'Locked in by coach' : isSelected ? 'Selected - tap to remove' : 'Tap to add'}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={{ backgroundColor: `${activeMode.tone}10` }}>
        <Text style={styles.coach}>AI Coach: {activeMode.coach}</Text>
        {trainingFeedback ? <Text style={styles.trainingFeedback}>{trainingFeedback}</Text> : null}
        {balanceTip ? <Text style={styles.balanceTip}>{balanceTip}</Text> : null}
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
  lockedTab: { borderColor: 'rgba(255,255,255,0.03)', backgroundColor: 'transparent', gap: 6 },
  lockedText: { color: colours.soft, fontSize: 11, fontWeight: '900' },
  lockedBarBg: { width: 32, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  lockedBarFill: { height: '100%', backgroundColor: colours.soft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  selectionStatus: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  selectionStatusText: { fontSize: 12, fontWeight: '900' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 },
  cardTitle: { color: colours.text, fontSize: 18, fontWeight: '900' },
  badge: { fontSize: 11, fontWeight: '900', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickLogGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  quickLogButton: {
    width: '48%',
    flexGrow: 1,
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    justifyContent: 'center',
  },
  quickLogLabel: { fontSize: 13, fontWeight: '900', marginTop: 5 },
  quickLogMeta: { color: colours.muted, fontSize: 11, fontWeight: '800', marginTop: 2 },
  timeButton: {
    minHeight: 48,
    flex: 1,
    minWidth: '22%',
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  timeButtonText: { color: colours.muted, fontSize: 13, fontWeight: '900' },
  trainingHint: { color: colours.textSoft, fontSize: 12, lineHeight: 18, marginTop: 10 },
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
  removeExerciseButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: `${colours.red}40`,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.redDim,
  },
  removeExerciseButtonLocked: {
    borderColor: `${colours.amber}50`,
    backgroundColor: colours.amberDim,
  },
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
  libraryBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  coachPickBadge: {
    color: colours.background,
    backgroundColor: colours.amber,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '900',
  },
  patternBadge: {
    color: colours.textSoft,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '900',
  },
  libraryAction: { color: colours.textSoft, fontSize: 11, fontWeight: '900', marginTop: 8 },
  trainingFeedback: { color: colours.green, fontSize: 12, lineHeight: 18, fontWeight: '900', marginTop: 10 },
  balanceTip: { color: colours.amber, fontSize: 12, lineHeight: 18, fontWeight: '900', marginTop: 10 },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.62 },
  primaryButtonText: { color: '#07111E', fontWeight: '900', fontSize: 16 },
});
