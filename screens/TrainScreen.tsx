import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { WorkoutTimer } from '../components/WorkoutTimer';
import { colours, touchTarget } from '../theme';
import { useResponsive } from '../utils/responsive';
import { TrainingSession, ExerciseCategory, Exercise, MovementPattern, exerciseLibrary, trainingModes } from '../data/mockData';
import { showAlert } from '../lib/dialogs';
import { buildProgrammeRecommendation, ProgrammeBuilderInput, ProgrammeGoal, ProgrammeEquipment, ProgrammeReadiness, ProgrammeRecommendation } from '../lib/aiGuidance';

const ACTIVE_PROGRAMME_KEY = 'forge:active_programme_v1';

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
  const { fs, sp, isTablet, gap } = useResponsive();

  const totalScore = useMemo(() => sessions.reduce((total, s) => total + s.score, 0), [sessions]);
  const currentLevel = Math.floor(totalScore / 500) + 1;
  const unlockProgressPct = Math.min(100, Math.round((totalScore / 4500) * 100));

  const availableModes = useMemo(() => {
    return trainingModes.filter((mode) => !mode.unlockLevel || currentLevel >= mode.unlockLevel);
  }, [currentLevel]);

  useEffect(() => {
    async function checkUnlockAlert() {
      if (currentLevel >= 10) {
        const hasSeen = await AsyncStorage.getItem('forge:elite_unlocked_alert');
        if (!hasSeen) {
          showAlert('Tier 1 Operator Unlocked', 'Congratulations! You have reached Level 10 and unlocked the Elite training block.');
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
  const [showTimer, setShowTimer] = useState(false);

  // Programme builder state
  const [showProgramme, setShowProgramme] = useState(false);
  const [progGoal, setProgGoal] = useState<ProgrammeGoal>('Tactical Hybrid');
  const [progDays, setProgDays] = useState<ProgrammeBuilderInput['daysPerWeek']>(3);
  const [progMinutes, setProgMinutes] = useState<ProgrammeBuilderInput['sessionMinutes']>(45);
  const [progEquipment, setProgEquipment] = useState<ProgrammeEquipment>('Full Gym');
  const [progReadiness, setProgReadiness] = useState<ProgrammeReadiness>('Standard');
  const [expandedProgrammeSection, setExpandedProgrammeSection] = useState<'structure' | 'coach' | 'science' | null>('structure');
  const [expandedProgrammeDay, setExpandedProgrammeDay] = useState(0);
  const programmeRec = useMemo(
    () => showProgramme ? buildProgrammeRecommendation({ goal: progGoal, daysPerWeek: progDays, sessionMinutes: progMinutes, equipment: progEquipment, readiness: progReadiness }) : null,
    [showProgramme, progGoal, progDays, progMinutes, progEquipment, progReadiness]
  );
  const [activeProgramme, setActiveProgramme] = useState<(ProgrammeRecommendation & { startedAt: string; daysPerWeek: number }) | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_PROGRAMME_KEY).then((raw) => {
      if (raw) {
        try { setActiveProgramme(JSON.parse(raw)); } catch { /* ignore corrupt */ }
      }
    });
  }, []);

  async function saveProgramme(rec: ProgrammeRecommendation) {
    const saved = { ...rec, startedAt: new Date().toISOString(), daysPerWeek: progDays };
    await AsyncStorage.setItem(ACTIVE_PROGRAMME_KEY, JSON.stringify(saved));
    setActiveProgramme(saved);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert('Programme Saved', `You are now following: ${rec.assignmentTitle}. Check the top of this screen each session.`);
  }

  async function clearProgramme() {
    await AsyncStorage.removeItem(ACTIVE_PROGRAMME_KEY);
    setActiveProgramme(null);
  }

  function toggleProgrammeSection(section: 'structure' | 'coach' | 'science') {
    setExpandedProgrammeSection((current) => (current === section ? null : section));
  }

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
    setShowTimer(false);
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
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert('Session saved', `${template.label} logged. It will appear on Today and Recent Load.`);
  }

  function handleTimerLog(durationMinutes: number, rpe: number) {
    const session: TrainingSession = {
      id: `timer-${activeMode.key}-${Date.now()}`,
      type: activeMode.type,
      title: `${activeMode.title} — ${durationMinutes}min`,
      score: Math.round(durationMinutes * rpe * 0.75),
      durationMinutes,
      rpe,
      completedAt: new Date().toISOString(),
    };
    addSession(session);
    setSavedKeys((current) => [...current, activeMode.key]);
    setShowTimer(false);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert('Session Logged', `${durationMinutes} min ${activeMode.label} saved with RPE ${rpe}.`);
  }

  return (
    <Screen>
      {activeProgramme && (
        <Card>
          <View style={styles.activeProgHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.activeProgLabel, { color: activeProgramme.tone, fontSize: fs(9, { min: 8, max: 11 }) }]}>ACTIVE PROGRAMME</Text>
              <Text style={[styles.activeProgTitle, { fontSize: fs(15, { min: 13, max: 18 }) }]}>{activeProgramme.assignmentTitle}</Text>
              <Text style={[styles.activeProgMeta, { fontSize: fs(11, { min: 10, max: 13 }) }]}>
                {activeProgramme.daysPerWeek}d/week · started {new Date(activeProgramme.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <Pressable style={styles.activeProgClear} onPress={clearProgramme}>
              <Ionicons name="close" size={isTablet ? 18 : 16} color={colours.muted} />
            </Pressable>
          </View>
          <View style={styles.activeProgWeek}>
            {activeProgramme.weeklyStructure.map((day, i) => (
              <View key={i} style={styles.activeProgDay}>
                <Text style={[styles.activeProgDayNum, { color: activeProgramme.tone, fontSize: fs(10, { min: 9, max: 12 }) }]}>D{i + 1}</Text>
                <Text style={[styles.activeProgDayText, { fontSize: fs(12, { min: 11, max: 14 }) }]} numberOfLines={2}>{day}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Text style={[styles.muted, { fontSize: fs(12, { min: 11, max: 14 }) }]}>Training block</Text>
      <Text style={[styles.title, { fontSize: fs(28, { min: 22, max: 36 }) }]}>{activeMode.title}</Text>

      <Card accent={colours.cyan}>
        <Text style={[styles.cardTitle, { fontSize: fs(17, { min: 14, max: 21 }) }]}>Quick Log</Text>
        <Text style={[styles.trainingHint, { fontSize: fs(12, { min: 11, max: 14 }) }]}>Save a basic session now. Use the builder below when you want exercise detail.</Text>
        <View style={[styles.quickLogGrid, { gap: sp(8) }]}>
          {quickLogTemplates.map((template) => (
            <Pressable
              key={template.label}
              accessibilityRole="button"
              accessibilityLabel={`Quick log ${template.label}`}
              style={[styles.quickLogButton, { borderColor: `${template.tone}55`, backgroundColor: `${template.tone}12` }]}
              onPress={() => quickLogSession(template)}
            >
              <Ionicons name={template.icon} size={isTablet ? 22 : 19} color={template.tone} />
              <Text style={[styles.quickLogLabel, { color: template.tone, fontSize: fs(13, { min: 12, max: 15 }) }]}>{template.label}</Text>
              <Text style={[styles.quickLogMeta, { fontSize: fs(11, { min: 10, max: 12 }) }]}>{template.minutes}m / RPE {template.rpe}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <View style={[styles.modeTabs, { gap: sp(8) }]}>
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
              <Ionicons name={mode.icon} size={isTablet ? 18 : 16} color={isActive ? mode.tone : colours.muted} />
              <Text style={[styles.modeTabText, { color: isActive ? mode.tone : colours.muted, fontSize: fs(12, { min: 10, max: 14 }) }]}>{mode.label}</Text>
            </Pressable>
          );
        })}

        {currentLevel < 10 && (
          <View style={[styles.modeTab, styles.lockedTab]}>
            <Ionicons name="lock-closed" size={13} color={colours.soft} />
            <Text style={[styles.lockedText, { fontSize: fs(11, { min: 10, max: 12 }) }]}>{unlockProgressPct}%</Text>
            <View style={styles.lockedBarBg}>
              <View style={[styles.lockedBarFill, { width: `${unlockProgressPct}%` }]} />
            </View>
          </View>
        )}
      </View>

      <View style={[styles.grid, { gap: isTablet ? 14 : 10 }]}>
        <MetricCard icon="time" label="Target" value={`${estimatedMinutes}`} sub="minutes" tone={activeMode.tone} />
        <MetricCard icon="list" label="Selected" value={`${selectedExercises.length}`} sub={`${recommendedExerciseCount} recommended`} tone={selectedStatusTone} />
      </View>

      <View style={[styles.selectionStatus, { borderColor: `${selectedStatusTone}55`, backgroundColor: `${selectedStatusTone}12` }]}>
        <Text style={[styles.selectionStatusText, { color: selectedStatusTone, fontSize: fs(12, { min: 11, max: 14 }) }]}>
          {selectedExercises.length <= recommendedExerciseCount
            ? 'Selection fits the time target.'
            : selectedExercises.length <= recommendedExerciseCount + 2
              ? 'Selection may run long for this time target.'
              : 'Selection is likely too dense for this time target.'}
        </Text>
      </View>

      <Card>
        <View style={styles.headerRow}>
          <Text style={[styles.cardTitle, { fontSize: fs(17, { min: 14, max: 21 }) }]}>Session Length</Text>
          <Text style={[styles.badge, { color: activeMode.tone, backgroundColor: `${activeMode.tone}14`, fontSize: fs(11, { min: 9, max: 13 }) }]}>Tap a time</Text>
        </View>
        <View style={[styles.timeGrid, { gap: sp(8) }]}>
          {timeTargets.map((minutes) => {
            const active = minutes === targetMinutes;
            return (
              <Pressable
                key={minutes}
                style={[styles.timeButton, active && { borderColor: activeMode.tone, backgroundColor: `${activeMode.tone}18` }]}
                onPress={() => changeTargetMinutes(minutes)}
              >
                <Text style={[styles.timeButtonText, { fontSize: fs(13, { min: 12, max: 15 }) }, active && { color: activeMode.tone }]}>{minutes} min</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.trainingHint, { fontSize: fs(12, { min: 11, max: 14 }) }]}>Coach recommendation: choose fewer exercises for short sessions, then keep reps cleaner.</Text>
      </Card>

      <Card>
        <View style={styles.headerRow}>
          <Text style={[styles.cardTitle, { fontSize: fs(17, { min: 14, max: 21 }) }]}>Selected Exercises</Text>
          <Text style={[styles.badge, { color: activeMode.tone, backgroundColor: `${activeMode.tone}14`, fontSize: fs(11, { min: 9, max: 13 }) }]}>Tap X to remove</Text>
        </View>

        {selectedExercises.length > 0 ? (
          selectedExercises.map((exercise, index) => (
            <Pressable key={exercise.id} style={styles.exerciseRow} onPress={() => setFocusedExerciseId(exercise.id)}>
              <View style={[styles.exerciseNumber, { backgroundColor: `${activeMode.tone}18` }]}>
                <Text style={[styles.exerciseNumberText, { color: activeMode.tone, fontSize: fs(13, { min: 12, max: 15 }) }]}>{index + 1}</Text>
              </View>
              <View style={styles.exerciseCopy}>
                <Text style={[styles.exerciseName, { fontSize: fs(14, { min: 12, max: 16 }) }]}>{exercise.name}</Text>
                <Text style={[styles.muted, { fontSize: fs(12, { min: 11, max: 13 }) }]}>{exercise.dose}</Text>
              </View>
              <Pressable
                style={[styles.removeExerciseButton, pinnedIds.includes(exercise.id) && styles.removeExerciseButtonLocked]}
                onPress={(event) => {
                  event.stopPropagation();
                  toggleExercise(exercise);
                }}
              >
                <Ionicons name={pinnedIds.includes(exercise.id) ? 'lock-closed' : 'close'} size={isTablet ? 20 : 18} color={pinnedIds.includes(exercise.id) ? colours.amber : colours.red} />
              </Pressable>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptySelection}>
            <Text style={[styles.emptyTitle, { fontSize: fs(14, { min: 13, max: 16 }) }]}>No exercises selected</Text>
            <Text style={[styles.muted, { fontSize: fs(12, { min: 11, max: 13 }) }]}>Pick from the exercise library below.</Text>
          </View>
        )}
      </Card>

      {/* ── Workout Timer ─────────────────────────────────────────── */}
      {!showTimer ? (
        <Card accent={activeMode.tone}>
          <View style={styles.timerLaunchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { fontSize: fs(17, { min: 14, max: 21 }) }]}>Workout Timer</Text>
              <Text style={[styles.trainingHint, { fontSize: fs(12, { min: 11, max: 14 }), marginTop: 4 }]}>
                Track your session in real time. Timer logs duration and RPE automatically.
              </Text>
            </View>
            <Pressable
              style={[styles.timerLaunchBtn, { backgroundColor: activeMode.tone }]}
              onPress={() => setShowTimer(true)}
              disabled={selectedExercises.length === 0}
            >
              <Ionicons name="play" size={isTablet ? 22 : 18} color={colours.background} />
              <Text style={[styles.timerLaunchBtnText, { fontSize: fs(13, { min: 11, max: 15 }) }]}>START</Text>
            </Pressable>
          </View>
          {selectedExercises.length === 0 && (
            <Text style={[styles.timerHint, { fontSize: fs(11, { min: 10, max: 13 }) }]}>Select at least one exercise to start the timer.</Text>
          )}
        </Card>
      ) : (
        <WorkoutTimer
          exercises={selectedExercises.map((e) => e.name)}
          sessionType={activeMode.type}
          defaultMinutes={targetMinutes}
          onLogSession={handleTimerLog}
        />
      )}

      <Card style={{ backgroundColor: `${activeMode.tone}10` }}>
        <Text style={[styles.cardTitle, { fontSize: fs(17, { min: 14, max: 21 }), marginBottom: 6 }]}>Exercise Guidance</Text>
        <Text style={[styles.guidanceTitle, { fontSize: fs(16, { min: 14, max: 20 }) }]}>{focusedExercise.name}</Text>
        <Text style={[styles.coach, { fontSize: fs(13, { min: 12, max: 15 }) }]}>{focusedExercise.guidance}</Text>
        <View style={styles.cueList}>
          {focusedExercise.cues.map((cue) => (
            <View key={cue} style={styles.cuePill}>
              <Text style={[styles.cueText, { fontSize: fs(11, { min: 10, max: 13 }) }]}>{cue}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.headerRow}>
          <Text style={[styles.cardTitle, { fontSize: fs(17, { min: 14, max: 21 }) }]}>Exercise Library</Text>
          <Text style={[styles.libraryCount, { fontSize: fs(12, { min: 11, max: 14 }) }]}>{exerciseLibrary.length} total</Text>
        </View>

        <View style={[styles.categoryTabs, { gap: sp(8) }]}>
          {categories.map((category) => {
            const isActive = category === activeCategory;
            return (
              <Pressable
                key={category}
                style={[styles.categoryTab, isActive && { borderColor: activeMode.tone, backgroundColor: `${activeMode.tone}14` }]}
                onPress={() => setActiveCategory(category)}
              >
                <Text style={[styles.categoryText, { fontSize: fs(11, { min: 10, max: 13 }) }, isActive && { color: activeMode.tone }]}>{category}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.libraryGrid, { gap: sp(9) }]}>
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
                  <Text style={[styles.libraryName, { fontSize: fs(13, { min: 12, max: 15 }) }, isSelected && { color: activeMode.tone }]}>{exercise.name}</Text>
                  <Ionicons name={isPinned ? 'ribbon' : isSelected ? 'checkmark-circle' : 'add-circle-outline'} size={isTablet ? 20 : 18} color={isPinned ? colours.amber : isSelected ? activeMode.tone : colours.muted} />
                </View>
                <Text style={[styles.libraryMeta, { fontSize: fs(11, { min: 10, max: 12 }) }]}>{exercise.category} - {exercise.dose}</Text>
                <View style={styles.libraryBadgeRow}>
                  {isPinned && <Text style={[styles.coachPickBadge, { fontSize: fs(10, { min: 9, max: 11 }) }]}>Coach's Pick</Text>}
                  <Text style={[styles.patternBadge, { fontSize: fs(10, { min: 9, max: 11 }) }]}>{getExercisePattern(exercise)}</Text>
                </View>
                <Text style={[styles.libraryAction, { fontSize: fs(11, { min: 10, max: 12 }) }, isSelected && { color: activeMode.tone }]}>{isPinned ? 'Locked in by coach' : isSelected ? 'Selected - tap to remove' : 'Tap to add'}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={{ backgroundColor: `${activeMode.tone}10` }}>
        <Text style={[styles.coach, { fontSize: fs(13, { min: 12, max: 15 }) }]}>AI Coach: {activeMode.coach}</Text>
        {trainingFeedback ? <Text style={[styles.trainingFeedback, { fontSize: fs(12, { min: 11, max: 14 }) }]}>{trainingFeedback}</Text> : null}
        {balanceTip ? <Text style={[styles.balanceTip, { fontSize: fs(12, { min: 11, max: 14 }) }]}>{balanceTip}</Text> : null}
      </Card>

      <Card>
        <Pressable style={styles.progHeader} onPress={() => setShowProgramme((v) => !v)}>
          <View style={styles.progHeaderLeft}>
            <Ionicons name="construct-outline" size={isTablet ? 18 : 16} color={colours.cyan} />
            <Text style={[styles.cardTitle, { fontSize: fs(17, { min: 14, max: 21 }) }]}>AI Programme Builder</Text>
          </View>
          <Ionicons name={showProgramme ? 'chevron-up' : 'chevron-down'} size={isTablet ? 18 : 16} color={colours.muted} />
        </Pressable>

        {showProgramme && (
          <View style={styles.progBody}>
            <Text style={[styles.progLabel, { fontSize: fs(10, { min: 9, max: 12 }) }]}>GOAL</Text>
            <View style={[styles.progPills, { gap: sp(8) }]}>
              {(['Tactical Hybrid', 'Strength Base', 'Hypertrophy', 'Conditioning', 'Recovery'] as ProgrammeGoal[]).map((g) => (
                <Pressable key={g} style={[styles.progPill, progGoal === g && styles.progPillActive]} onPress={() => setProgGoal(g)}>
                  <Text style={[styles.progPillText, { fontSize: fs(12, { min: 11, max: 14 }) }, progGoal === g && styles.progPillTextActive]}>{g}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.progLabel, { fontSize: fs(10, { min: 9, max: 12 }) }]}>DAYS / WEEK</Text>
            <View style={[styles.progPills, { gap: sp(8) }]}>
              {([2, 3, 4, 5] as const).map((d) => (
                <Pressable key={d} style={[styles.progPill, progDays === d && styles.progPillActive]} onPress={() => setProgDays(d)}>
                  <Text style={[styles.progPillText, { fontSize: fs(12, { min: 11, max: 14 }) }, progDays === d && styles.progPillTextActive]}>{d}d</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.progLabel, { fontSize: fs(10, { min: 9, max: 12 }) }]}>SESSION LENGTH</Text>
            <View style={[styles.progPills, { gap: sp(8) }]}>
              {([30, 45, 60] as const).map((m) => (
                <Pressable key={m} style={[styles.progPill, progMinutes === m && styles.progPillActive]} onPress={() => setProgMinutes(m)}>
                  <Text style={[styles.progPillText, { fontSize: fs(12, { min: 11, max: 14 }) }, progMinutes === m && styles.progPillTextActive]}>{m}m</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.progLabel, { fontSize: fs(10, { min: 9, max: 12 }) }]}>EQUIPMENT</Text>
            <View style={[styles.progPills, { gap: sp(8) }]}>
              {(['Full Gym', 'Minimal Kit', 'Bodyweight'] as ProgrammeEquipment[]).map((e) => (
                <Pressable key={e} style={[styles.progPill, progEquipment === e && styles.progPillActive]} onPress={() => setProgEquipment(e)}>
                  <Text style={[styles.progPillText, { fontSize: fs(12, { min: 11, max: 14 }) }, progEquipment === e && styles.progPillTextActive]}>{e}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.progLabel, { fontSize: fs(10, { min: 9, max: 12 }) }]}>READINESS APPROACH</Text>
            <View style={[styles.progPills, { gap: sp(8) }]}>
              {(['Conservative', 'Standard', 'Push'] as ProgrammeReadiness[]).map((r) => (
                <Pressable key={r} style={[styles.progPill, progReadiness === r && styles.progPillActive]} onPress={() => setProgReadiness(r)}>
                  <Text style={[styles.progPillText, { fontSize: fs(12, { min: 11, max: 14 }) }, progReadiness === r && styles.progPillTextActive]}>{r}</Text>
                </Pressable>
              ))}
            </View>

            {programmeRec && (
              <View style={styles.progResult}>
                <View style={styles.progResultHeader}>
                  <View style={[styles.progResultIcon, { backgroundColor: programmeRec.tone }]}>
                    <Ionicons name="pulse-outline" size={18} color={colours.background} />
                  </View>
                  <View style={styles.progResultCopy}>
                    <Text style={[styles.progResultKicker, { color: programmeRec.tone, fontSize: fs(10, { min: 9, max: 12 }) }]}>PRIMARY GUIDANCE</Text>
                    <Text style={[styles.progResultTitle, { fontSize: fs(22, { min: 19, max: 26 }) }]}>{programmeRec.assignmentTitle}</Text>
                    <Text style={[styles.progResultSummary, { fontSize: fs(13, { min: 12, max: 15 }) }]}>{programmeRec.summary}</Text>
                  </View>
                </View>

                <View style={styles.progSignalGrid}>
                  <View style={styles.progSignalItem}>
                    <Ionicons name="flash-outline" size={15} color={programmeRec.tone} />
                    <View style={styles.progSignalCopy}>
                      <Text style={styles.progSignalLabel}>Focus</Text>
                      <Text style={[styles.progSignalValue, { fontSize: fs(12, { min: 11, max: 14 }) }]}>Force + carries + conditioning</Text>
                    </View>
                  </View>
                  <View style={styles.progSignalItem}>
                    <Ionicons name="calendar-outline" size={15} color={programmeRec.tone} />
                    <View style={styles.progSignalCopy}>
                      <Text style={styles.progSignalLabel}>Goal</Text>
                      <Text style={[styles.progSignalValue, { fontSize: fs(12, { min: 11, max: 14 }) }]}>{programmeRec.weeklyVolume}</Text>
                    </View>
                  </View>
                  <View style={styles.progSignalItem}>
                    <Ionicons name="speedometer-outline" size={15} color={programmeRec.tone} />
                    <View style={styles.progSignalCopy}>
                      <Text style={styles.progSignalLabel}>Intensity</Text>
                      <Text style={[styles.progSignalValue, { fontSize: fs(12, { min: 11, max: 14 }) }]}>{programmeRec.intensity}</Text>
                    </View>
                  </View>
                  <View style={styles.progSignalItem}>
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={programmeRec.tone} />
                    <View style={styles.progSignalCopy}>
                      <Text style={styles.progSignalLabel}>Coach Cue</Text>
                      <Text style={[styles.progSignalValue, { fontSize: fs(12, { min: 11, max: 14 }) }]} numberOfLines={2}>{programmeRec.coachNote}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.progAccordionList}>
                  <Pressable style={styles.progAccordionHeader} onPress={() => toggleProgrammeSection('structure')}>
                    <View style={styles.progAccordionTitleRow}>
                      <Ionicons name="list-outline" size={16} color={programmeRec.tone} />
                      <Text style={[styles.progAccordionTitle, { fontSize: fs(12, { min: 11, max: 14 }) }]}>Session Structure</Text>
                    </View>
                    <Ionicons name={expandedProgrammeSection === 'structure' ? 'chevron-up' : 'chevron-down'} size={16} color={colours.muted} />
                  </Pressable>
                  {expandedProgrammeSection === 'structure' ? (
                    <View style={styles.progAccordionBody}>
                      {programmeRec.weeklyStructure.map((day, i) => {
                        const [dayTitle, ...detailParts] = day.split(':');
                        const dayDetail = detailParts.join(':').trim();
                        const open = expandedProgrammeDay === i;
                        return (
                          <Pressable key={day} style={[styles.progDayCard, open && styles.progDayCardOpen]} onPress={() => setExpandedProgrammeDay(open ? -1 : i)}>
                            <View style={styles.progDayTop}>
                              <Text style={[styles.progDayNum, { color: programmeRec.tone, fontSize: fs(10, { min: 9, max: 12 }) }]}>DAY {i + 1}</Text>
                              <Ionicons name={open ? 'remove' : 'add'} size={16} color={open ? programmeRec.tone : colours.muted} />
                            </View>
                            <Text style={[styles.progDayTitle, { fontSize: fs(14, { min: 13, max: 16 }) }]}>{dayTitle.replace(/^Day\s+\d+\s*/i, '').trim() || dayTitle}</Text>
                            <Text style={[styles.progDayMeta, { fontSize: fs(11, { min: 10, max: 12 }) }]}>{progMinutes} min - {programmeRec.intensity}</Text>
                            {open ? <Text style={[styles.progDayDetail, { fontSize: fs(12, { min: 11, max: 14 }) }]}>{dayDetail || day}</Text> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}

                  <Pressable style={styles.progAccordionHeader} onPress={() => toggleProgrammeSection('coach')}>
                    <View style={styles.progAccordionTitleRow}>
                      <Ionicons name="school-outline" size={16} color={programmeRec.tone} />
                      <Text style={[styles.progAccordionTitle, { fontSize: fs(12, { min: 11, max: 14 }) }]}>Advanced Coaching Notes</Text>
                    </View>
                    <Ionicons name={expandedProgrammeSection === 'coach' ? 'chevron-up' : 'chevron-down'} size={16} color={colours.muted} />
                  </Pressable>
                  {expandedProgrammeSection === 'coach' ? (
                    <View style={styles.progAccordionBody}>
                      <Text style={[styles.progCoachNote, { fontSize: fs(12, { min: 11, max: 14 }) }]}>{programmeRec.rationale}</Text>
                      <Text style={[styles.progCoachNote, { fontSize: fs(12, { min: 11, max: 14 }) }]}>{programmeRec.coachNote}</Text>
                    </View>
                  ) : null}

                  <Pressable style={styles.progAccordionHeader} onPress={() => toggleProgrammeSection('science')}>
                    <View style={styles.progAccordionTitleRow}>
                      <Ionicons name="flask-outline" size={16} color={programmeRec.tone} />
                      <Text style={[styles.progAccordionTitle, { fontSize: fs(12, { min: 11, max: 14 }) }]}>Evidence & Science</Text>
                    </View>
                    <Ionicons name={expandedProgrammeSection === 'science' ? 'chevron-up' : 'chevron-down'} size={16} color={colours.muted} />
                  </Pressable>
                  {expandedProgrammeSection === 'science' ? (
                    <View style={styles.progAccordionBody}>
                      {programmeRec.scienceNotes.map((note, i) => (
                        <View key={i} style={styles.progSciRow}>
                          <Text style={[styles.progSciBullet, { color: programmeRec.tone, fontSize: fs(13, { min: 12, max: 15 }) }]}>›</Text>
                          <Text style={[styles.progSciText, { fontSize: fs(12, { min: 11, max: 14 }) }]}>{note}</Text>
                        </View>
                      ))}
                      <Text style={[styles.progEvidenceLabel, { fontSize: fs(10, { min: 9, max: 11 }) }]}>{programmeRec.evidencePack.label} - updated {programmeRec.evidencePack.updatedAt}</Text>
                    </View>
                  ) : null}
                </View>

                <Pressable style={styles.progSaveBtn} onPress={() => saveProgramme(programmeRec)}>
                  <Ionicons name="checkmark-circle-outline" size={isTablet ? 17 : 15} color={colours.background} />
                  <Text style={[styles.progSaveBtnText, { fontSize: fs(13, { min: 12, max: 15 }) }]}>Follow This Programme</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
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
        <Text style={[styles.primaryButtonText, { fontSize: fs(15, { min: 13, max: 18 }) }]}>{saved ? 'Session Saved' : `Complete ${activeMode.label}`}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colours.muted },
  title: { color: colours.text, fontWeight: '900', marginBottom: 14 },
  modeTabs: { flexDirection: 'row', flexWrap: 'wrap' },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modeTabText: { fontWeight: '900' },
  lockedTab: { borderColor: 'rgba(255,255,255,0.03)', backgroundColor: 'transparent', gap: 6 },
  lockedText: { color: colours.soft, fontWeight: '900' },
  lockedBarBg: { width: 32, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  lockedBarFill: { height: '100%', backgroundColor: colours.soft },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  selectionStatus: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  selectionStatusText: { fontWeight: '900' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 },
  cardTitle: { color: colours.text, fontWeight: '900' },
  badge: { fontWeight: '900', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  quickLogGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  quickLogButton: {
    width: '48%',
    flexGrow: 1,
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    justifyContent: 'center',
  },
  quickLogLabel: { fontWeight: '900', marginTop: 5 },
  quickLogMeta: { color: colours.muted, fontWeight: '800', marginTop: 2 },
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
  timeButtonText: { color: colours.muted, fontWeight: '900' },
  trainingHint: { color: colours.textSoft, lineHeight: 18, marginTop: 10 },
  libraryCount: { color: colours.muted, fontWeight: '800' },
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
  // Timer launch card
  timerLaunchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerLaunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 80,
    justifyContent: 'center',
  },
  timerLaunchBtnText: { color: colours.background, fontWeight: '900' },
  timerHint: { color: colours.amber, fontWeight: '800', marginTop: 8 },
  guidanceTitle: { color: colours.text, fontWeight: '900', marginBottom: 6 },
  coach: { color: colours.text, lineHeight: 21 },
  cueList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  cuePill: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cueText: { color: colours.textSoft, fontWeight: '800' },
  categoryTabs: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  categoryTab: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  categoryText: { color: colours.muted, fontWeight: '900' },
  libraryGrid: {},
  libraryItem: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  libraryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  libraryName: { color: colours.text, fontWeight: '900', flex: 1 },
  libraryMeta: { color: colours.muted, marginTop: 4 },
  libraryBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  coachPickBadge: {
    color: colours.background,
    backgroundColor: colours.amber,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontWeight: '900',
  },
  patternBadge: {
    color: colours.textSoft,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontWeight: '900',
  },
  libraryAction: { color: colours.textSoft, fontWeight: '900', marginTop: 8 },
  trainingFeedback: { color: colours.green, lineHeight: 18, fontWeight: '900', marginTop: 10 },
  balanceTip: { color: colours.amber, lineHeight: 18, fontWeight: '900', marginTop: 10 },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.62 },
  primaryButtonText: { color: '#07111E', fontWeight: '900' },
  progHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progBody: { marginTop: 18, gap: 8 },
  progLabel: { color: colours.muted, fontWeight: '900', letterSpacing: 1.2, marginTop: 14, marginBottom: 8 },
  progPills: { flexDirection: 'row', flexWrap: 'wrap' },
  progPill: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.025)' },
  progPillActive: { borderColor: colours.cyan, backgroundColor: colours.cyan },
  progPillText: { color: colours.muted, fontWeight: '900' },
  progPillTextActive: { color: colours.background },
  progResult: { marginTop: 22, gap: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 18 },
  progResultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  progResultIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  progResultCopy: { flex: 1, maxWidth: 520 },
  progResultKicker: { fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 },
  progResultTitle: { color: colours.text, fontWeight: '900', marginBottom: 5 },
  progResultSummary: { color: colours.textSoft, fontWeight: '800', lineHeight: 19 },
  progSignalGrid: { gap: 8 },
  progSignalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  progSignalCopy: { flex: 1 },
  progSignalLabel: { color: colours.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.9, marginBottom: 3 },
  progSignalValue: { color: colours.text, fontWeight: '900', lineHeight: 18 },
  progAccordionList: { gap: 8, marginTop: 2 },
  progAccordionHeader: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    gap: 10,
  },
  progAccordionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progAccordionTitle: { color: colours.text, fontWeight: '900' },
  progAccordionBody: { gap: 8, paddingHorizontal: 2, paddingBottom: 4 },
  progSectionLabel: { color: colours.muted, fontWeight: '900', letterSpacing: 1.2, marginTop: 14, marginBottom: 6 },
  progDayCard: {
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
    padding: 12,
  },
  progDayCardOpen: { backgroundColor: 'rgba(255,255,255,0.055)' },
  progDayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  progDayNum: { fontWeight: '900', letterSpacing: 1 },
  progDayTitle: { color: colours.text, fontWeight: '900', marginTop: 5 },
  progDayMeta: { color: colours.muted, fontWeight: '800', marginTop: 3 },
  progDayDetail: { color: colours.textSoft, fontWeight: '800', lineHeight: 18, marginTop: 10 },
  progCoachNote: { color: colours.textSoft, fontWeight: '800', lineHeight: 19 },
  progSciRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 4 },
  progSciBullet: { fontWeight: '900', marginTop: 1 },
  progSciText: { flex: 1, color: colours.textSoft, fontWeight: '800', lineHeight: 17 },
  progEvidenceLabel: { color: colours.soft, fontWeight: '900', letterSpacing: 1, marginTop: 12 },
  progSaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 12, borderRadius: 10,
    backgroundColor: colours.cyan,
  },
  progSaveBtnText: { color: colours.background, fontWeight: '900' },
  activeProgHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  activeProgLabel: { fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
  activeProgTitle: { color: colours.text, fontWeight: '900' },
  activeProgMeta: { color: colours.muted, fontWeight: '700', marginTop: 2 },
  activeProgClear: { padding: 4 },
  activeProgWeek: { gap: 6 },
  activeProgDay: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  activeProgDayNum: { fontWeight: '900', letterSpacing: 0.5, minWidth: 22, paddingTop: 1 },
  activeProgDayText: { flex: 1, color: colours.textSoft, fontWeight: '700', lineHeight: 17 },
});
