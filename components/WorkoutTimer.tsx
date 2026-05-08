import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colours, shadows } from '../theme';
import { statusColors } from '../utils/styling';
import { useResponsive } from '../utils/responsive';
import type { TrainingSession } from '../data/domain';

type TimerMode = 'stopwatch' | 'countdown';
type TimerState = 'idle' | 'running' | 'paused' | 'done';

type Props = {
  exercises: string[];
  defaultMinutes?: number;
  sessionType: TrainingSession['type'];
  onLogSession: (durationMinutes: number, rpe: number) => void;
};

const SESSION_TONES: Record<TrainingSession['type'], string> = {
  Strength:   colours.green,
  Resistance: '#f472b6',
  Cardio:     colours.violet,
  Workout:    colours.cyan,
  Mobility:   colours.textSoft,
  Run:        colours.cyan,
  Ruck:       colours.amber,
};

const PRESET_MINUTES = [15, 20, 30, 45, 60, 90];
const RPE_LABELS = ['', 'Easy', 'Easy', 'Base', 'Base', 'Steady', 'Steady', 'Hard', 'Hard', 'Max', 'Max'];

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function haptic(style: 'light' | 'medium' | 'heavy') {
  if (Platform.OS === 'web') return;
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  };
  Haptics.impactAsync(map[style]);
}

export function WorkoutTimer({ exercises, defaultMinutes = 45, sessionType, onLogSession }: Props) {
  const { fs, sp, isTablet } = useResponsive();
  const tone = SESSION_TONES[sessionType] ?? colours.cyan;

  const [mode, setMode] = useState<TimerMode>('stopwatch');
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [targetSeconds, setTargetSeconds] = useState(defaultMinutes * 60);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [rpe, setRpe] = useState(7);
  const [showRpe, setShowRpe] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const remaining = mode === 'countdown' ? Math.max(0, targetSeconds - elapsed) : null;
  const displaySeconds = mode === 'countdown' ? (remaining ?? 0) : elapsed;
  const progressPct = mode === 'countdown'
    ? Math.round((elapsed / targetSeconds) * 100)
    : Math.min(100, Math.round((elapsed / (targetSeconds)) * 100));

  const isCountdownDone = mode === 'countdown' && remaining === 0 && timerState === 'running';

  // Tick
  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = setInterval(() => {
        setElapsed(e => e + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerState]);

  // Auto-stop countdown when done
  useEffect(() => {
    if (isCountdownDone) {
      setTimerState('done');
      setShowRpe(true);
      haptic('heavy');
    }
  }, [isCountdownDone]);

  const handleStart = useCallback(() => {
    if (timerState === 'idle' || timerState === 'paused') {
      setTimerState('running');
      setShowRpe(false);
      haptic('medium');
    }
  }, [timerState]);

  const handlePause = useCallback(() => {
    setTimerState('paused');
    haptic('light');
  }, []);

  const handleReset = useCallback(() => {
    setTimerState('idle');
    setElapsed(0);
    setShowRpe(false);
    setExerciseIdx(0);
    haptic('light');
  }, []);

  const handleFinish = useCallback(() => {
    setTimerState(s => s === 'running' ? 'paused' : s);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setShowRpe(true);
    haptic('medium');
  }, []);

  const handleLog = useCallback(() => {
    const mins = Math.max(1, Math.round(elapsed / 60));
    onLogSession(mins, rpe);
    haptic('heavy');
    handleReset();
  }, [elapsed, rpe, onLogSession, handleReset]);

  const currentExercise = exercises[exerciseIdx] ?? null;

  const timerColor = timerState === 'done'
    ? colours.green
    : mode === 'countdown' && remaining !== null && remaining < 60
      ? colours.red
      : mode === 'countdown' && remaining !== null && remaining < targetSeconds * 0.25
        ? colours.amber
        : tone;

  return (
    <View style={[styles.container, { borderColor: `${timerColor}35` }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerLabel, { fontSize: fs(9, { min: 8, max: 11 }) }]}>WORKOUT TIMER</Text>
          <View style={[styles.typeBadge, { borderColor: `${tone}50`, backgroundColor: `${tone}15` }]}>
            <Text style={[styles.typeBadgeText, { color: tone, fontSize: fs(9, { min: 8, max: 11 }) }]}>{sessionType.toUpperCase()}</Text>
          </View>
        </View>
        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          {(['stopwatch', 'countdown'] as TimerMode[]).map(m => (
            <Pressable
              key={m}
              disabled={timerState === 'running'}
              onPress={() => { setMode(m); setElapsed(0); setTimerState('idle'); }}
              style={[styles.modeBtn, mode === m && { backgroundColor: `${tone}25`, borderColor: tone }]}
            >
              <Ionicons
                name={m === 'stopwatch' ? 'timer-outline' : 'hourglass-outline'}
                size={fs(13, { min: 11, max: 16 })}
                color={mode === m ? tone : colours.muted}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Progress ring background bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: timerColor }]} />
      </View>

      {/* Big clock */}
      <Pressable onPress={timerState === 'running' ? handlePause : handleStart} style={styles.clockArea}>
        <Text style={[styles.clockText, { fontSize: fs(64, { min: 48, max: 96 }), color: timerColor }]}>
          {formatTime(displaySeconds)}
        </Text>
        {timerState === 'idle' && (
          <Text style={[styles.clockHint, { fontSize: fs(11, { min: 9, max: 14 }) }]}>TAP TO START</Text>
        )}
        {timerState === 'paused' && (
          <Text style={[styles.clockHint, { fontSize: fs(11, { min: 9, max: 14 }) }]}>PAUSED — TAP TO RESUME</Text>
        )}
        {timerState === 'running' && (
          <Text style={[styles.clockHint, { fontSize: fs(11, { min: 9, max: 14 }) }]}>TAP TO PAUSE</Text>
        )}
        {timerState === 'done' && (
          <Text style={[styles.clockHint, { fontSize: fs(11, { min: 9, max: 14 }), color: colours.green }]}>COMPLETE</Text>
        )}
      </Pressable>

      {/* Countdown preset selector */}
      {mode === 'countdown' && timerState === 'idle' && (
        <View style={styles.presetRow}>
          {PRESET_MINUTES.map(min => (
            <Pressable
              key={min}
              onPress={() => setTargetSeconds(min * 60)}
              style={[styles.presetChip, targetSeconds === min * 60 && { backgroundColor: `${tone}25`, borderColor: tone }]}
            >
              <Text style={[styles.presetText, targetSeconds === min * 60 && { color: tone }, { fontSize: fs(11, { min: 10, max: 14 }) }]}>
                {min}m
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Exercise tracker */}
      {exercises.length > 0 && (timerState === 'running' || timerState === 'paused') && (
        <View style={styles.exerciseTracker}>
          <Pressable
            onPress={() => setExerciseIdx(i => Math.max(0, i - 1))}
            style={[styles.exNavBtn, exerciseIdx === 0 && { opacity: 0.3 }]}
            disabled={exerciseIdx === 0}
          >
            <Ionicons name="chevron-back" size={fs(18, { min: 14, max: 22 })} color={colours.muted} />
          </Pressable>
          <View style={styles.exerciseCenter}>
            <Text style={[styles.exCount, { fontSize: fs(9, { min: 8, max: 11 }) }]}>
              {exerciseIdx + 1} / {exercises.length}
            </Text>
            <Text style={[styles.exName, { fontSize: fs(14, { min: 12, max: 18 }), color: tone }]}>
              {currentExercise}
            </Text>
          </View>
          <Pressable
            onPress={() => setExerciseIdx(i => Math.min(exercises.length - 1, i + 1))}
            style={[styles.exNavBtn, exerciseIdx === exercises.length - 1 && { opacity: 0.3 }]}
            disabled={exerciseIdx === exercises.length - 1}
          >
            <Ionicons name="chevron-forward" size={fs(18, { min: 14, max: 22 })} color={colours.muted} />
          </Pressable>
        </View>
      )}

      {/* Control row */}
      <View style={styles.controlRow}>
        <Pressable onPress={handleReset} style={[styles.ctrlBtn, styles.ctrlBtnSecondary]}>
          <Ionicons name="refresh-outline" size={fs(16, { min: 14, max: 20 })} color={colours.muted} />
        </Pressable>

        {timerState !== 'running' ? (
          <Pressable onPress={handleStart} style={[styles.ctrlBtnPrimary, { backgroundColor: tone }]}>
            <Ionicons name="play" size={fs(20, { min: 16, max: 26 })} color={colours.background} />
            <Text style={[styles.ctrlBtnPrimaryText, { fontSize: fs(13, { min: 11, max: 17 }) }]}>
              {timerState === 'paused' ? 'RESUME' : 'START'}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={handlePause} style={[styles.ctrlBtnPrimary, { backgroundColor: colours.amber }]}>
            <Ionicons name="pause" size={fs(20, { min: 16, max: 26 })} color={colours.background} />
            <Text style={[styles.ctrlBtnPrimaryText, { fontSize: fs(13, { min: 11, max: 17 }) }]}>PAUSE</Text>
          </Pressable>
        )}

        <Pressable onPress={handleFinish} style={[styles.ctrlBtn, { borderColor: `${colours.green}50`, backgroundColor: `${colours.green}15` }]}>
          <Ionicons name="flag-outline" size={fs(16, { min: 14, max: 20 })} color={colours.green} />
        </Pressable>
      </View>

      {/* RPE selector — shows when stopped */}
      {showRpe && (
        <View style={styles.rpeSection}>
          <Text style={[styles.rpeLabel, { fontSize: fs(9, { min: 8, max: 11 }) }]}>HOW HARD WAS IT? (RPE)</Text>
          <View style={styles.rpeRow}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const active = rpe === n;
              const rpeColor = n >= 8 ? colours.red : n >= 5 ? colours.amber : colours.green;
              return (
                <Pressable
                  key={n}
                  onPress={() => setRpe(n)}
                  style={[styles.rpeBtn, active && { backgroundColor: `${rpeColor}30`, borderColor: rpeColor }]}
                >
                  <Text style={[styles.rpeBtnNum, { fontSize: fs(12, { min: 10, max: 16 }) }, active && { color: rpeColor }]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.rpeSublabel, { fontSize: fs(10, { min: 9, max: 13 }) }]}>
            {RPE_LABELS[rpe]} · {Math.max(1, Math.round(elapsed / 60))} min
          </Text>
          <Pressable onPress={handleLog} style={[styles.logBtn, { backgroundColor: tone }]}>
            <Ionicons name="checkmark-circle-outline" size={fs(18, { min: 15, max: 22 })} color={colours.background} />
            <Text style={[styles.logBtnText, { fontSize: fs(14, { min: 12, max: 18 }) }]}>LOG SESSION</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(8,14,22,0.92)',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 14,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLabel: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  typeBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { fontWeight: '900', letterSpacing: 1 },
  modeToggle: { flexDirection: 'row', gap: 4 },
  modeBtn: {
    width: 34, height: 34, borderRadius: 8,
    borderWidth: 1, borderColor: colours.borderSoft,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  progressBarBg: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  progressBarFill: {
    height: 2,
  },

  clockArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 18,
    gap: 4,
  },
  clockText: {
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
    lineHeight: undefined,
  },
  clockHint: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  presetRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 18,
    paddingBottom: 14,
    justifyContent: 'center',
  },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  presetText: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  exerciseTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 6,
  },
  exNavBtn: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, borderColor: colours.borderSoft,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  exerciseCenter: { flex: 1, alignItems: 'center', gap: 2 },
  exCount: { color: colours.muted, fontWeight: '900', letterSpacing: 1 },
  exName: { fontWeight: '900', letterSpacing: 0.3, textAlign: 'center' },

  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  ctrlBtn: {
    width: 50, height: 50, borderRadius: 14,
    borderWidth: 1, borderColor: colours.borderSoft,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ctrlBtnSecondary: { borderColor: colours.borderSoft },
  ctrlBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
  },
  ctrlBtnPrimaryText: {
    color: colours.background,
    fontWeight: '900',
    letterSpacing: 1,
  },

  rpeSection: {
    borderTopWidth: 1,
    borderTopColor: colours.borderSoft,
    padding: 18,
    gap: 12,
  },
  rpeLabel: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  rpeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  rpeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rpeBtnNum: {
    color: colours.muted,
    fontWeight: '900',
  },
  rpeSublabel: {
    color: colours.textSoft,
    fontWeight: '800',
    textAlign: 'center',
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  logBtnText: {
    color: colours.background,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
