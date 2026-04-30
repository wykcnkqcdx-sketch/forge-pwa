import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { colours, touchTarget } from '../theme';
import { exerciseLibrary, SquadMember, TrainingGroup, TrainingSession, trainingModes } from '../data/mockData';
import type { WorkoutCompletion } from '../data/domain';

type Props = {
  member: SquadMember | null;
  members: SquadMember[];
  groups: TrainingGroup[];
  onUpdateMember: (id: string, updates: Partial<SquadMember>) => void;
  onCompleteWorkout: (completion: WorkoutCompletion) => void;
  onAddSession: (session: TrainingSession) => void;
  cloudEnabled: boolean;
  cloudStatus: 'local' | 'auth' | 'syncing' | 'synced' | 'error';
  pendingSyncCount?: number;
  onCloudSync: () => void;
};

const weeklyGoal = 10000;
const quickLogKinds: TrainingSession['type'][] = ['Run', 'Ruck', 'Cardio', 'Strength', 'Workout', 'Mobility'];

function estimateQuickLogVolume(kind: TrainingSession['type'], durationMinutes: number) {
  const rate = kind === 'Strength' || kind === 'Workout'
    ? 10
    : kind === 'Ruck'
      ? 8
      : kind === 'Run' || kind === 'Cardio'
        ? 6
        : 2;
  return Math.max(rate * Math.max(durationMinutes, 1), kind === 'Mobility' ? 20 : 60);
}

function scoreTone(value: number) {
  if (value >= 75) return colours.green;
  if (value >= 60) return colours.amber;
  return colours.red;
}

function formatActivityTime(value?: string) {
  if (!value) return 'This week';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'This week';
  return date.toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

export function MemberScreen({
  member,
  members,
  groups,
  onUpdateMember,
  onCompleteWorkout,
  onAddSession,
  cloudEnabled,
  cloudStatus,
  pendingSyncCount = 0,
  onCloudSync,
}: Props) {
  const [workoutNote, setWorkoutNote] = useState('');
  const [completedDuration, setCompletedDuration] = useState('45');
  const [finishFeedback, setFinishFeedback] = useState('');
  const [quickLogKind, setQuickLogKind] = useState<TrainingSession['type']>('Run');
  const [quickLogDuration, setQuickLogDuration] = useState('30');
  const [quickLogVolume, setQuickLogVolume] = useState('');
  const [quickLogEffort, setQuickLogEffort] = useState<'Too Easy' | 'About Right' | 'Too Hard'>('About Right');
  const [quickLogNote, setQuickLogNote] = useState('');
  const [quickLogFeedback, setQuickLogFeedback] = useState('');
  const group = member ? groups.find((item) => item.id === member.groupId) ?? null : null;
  const groupMembers = group ? members.filter((item) => item.groupId === group.id) : [];
  const teamMembers = groupMembers.length ? groupMembers : members;
  const displayName = member?.gymName || member?.name || 'Athlete';
  const assignmentSession = member?.assignmentSession;
  const assignmentMode = trainingModes.find((mode) => mode.title === member?.assignment);
  const pinnedExerciseIds = assignmentSession?.exercises.filter((exercise) => exercise.coachPinned).map((exercise) => exercise.exerciseId)
    ?? member?.pinnedExerciseIds
    ?? assignmentMode?.coachPinnedExerciseIds
    ?? [];
  const assignedExercises = assignmentSession
    ? assignmentSession.exercises
        .map((item) => exerciseLibrary.find((exercise) => exercise.id === item.exerciseId))
        .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
    : assignmentMode
      ? [...new Set([...pinnedExerciseIds, ...assignmentMode.defaultExerciseIds])]
        .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
        .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
        .slice(0, 8)
      : [];
  const plannedVolume = Math.max(120, assignedExercises.length * 60 + (assignmentMode?.key === 'cardio' ? 180 : 0));
  const defaultAssignedDuration = assignmentMode?.type === 'Cardio' ? 30 : assignmentMode?.type === 'Mobility' ? 20 : 45;
  const cloudTone = cloudStatus === 'synced'
    ? colours.green
    : cloudStatus === 'syncing'
      ? colours.cyan
      : cloudStatus === 'error'
        ? colours.red
        : colours.amber;
  const cloudLabel = cloudEnabled ? cloudStatus.toUpperCase() : 'LOCAL ONLY';
  const syncCopy = pendingSyncCount > 0
    ? `${pendingSyncCount} record${pendingSyncCount === 1 ? '' : 's'} pending sync.`
    : 'Assignments and workout completions sync automatically when connected.';

  const teamPulse = useMemo(() => {
    const source = teamMembers.length ? teamMembers : members;
    const visible = source.filter((item) => !item.ghostMode || item.id === member?.id);
    const weeklyVolume = source.reduce((total, item) => total + (item.weeklyVolume ?? 0), 0);
    const readiness = source.length
      ? Math.round(source.reduce((total, item) => total + item.readiness, 0) / source.length)
      : 0;
    const compliance = source.length
      ? Math.round(source.reduce((total, item) => total + item.compliance, 0) / source.length)
      : 0;
    const atRisk = source.filter((item) => item.risk !== 'Low').length;
    const recent = visible
      .filter((item) => item.lastWorkoutAt)
      .sort((a, b) => new Date(b.lastWorkoutAt ?? 0).getTime() - new Date(a.lastWorkoutAt ?? 0).getTime())
      .slice(0, 4);

    return { weeklyVolume, readiness, compliance, atRisk, recent, count: source.length };
  }, [member?.id, members, teamMembers]);

  useEffect(() => {
    if (!member?.assignmentSession) return;
    if (member.assignmentSession.status !== 'assigned') return;
    onUpdateMember(member.id, {
      assignmentSession: {
        ...member.assignmentSession,
        status: 'viewed',
      },
    });
  }, [member?.assignmentSession, member?.id, onUpdateMember]);

  function markExerciseHit(exerciseId: string) {
    if (!member?.assignmentSession) return;

    onUpdateMember(member.id, {
      assignmentSession: {
        ...member.assignmentSession,
        exercises: member.assignmentSession.exercises.map((exercise) => (
          exercise.exerciseId === exerciseId
            ? {
                ...exercise,
                actual: {
                  sets: exercise.prescribed?.sets,
                  reps: exercise.prescribed?.reps,
                  load: exercise.prescribed?.load,
                  durationMinutes: exercise.prescribed?.durationMinutes,
                },
                status: 'hit',
              }
            : exercise
        )),
      },
    });
  }

  function finishWorkout(effort: 'About Right' | 'Too Easy' | 'Too Hard') {
    if (!member) return;

    const parsedDuration = Number.parseInt(completedDuration, 10);
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      setFinishFeedback('Enter a valid completed time in minutes.');
      return;
    }

    const now = new Date().toISOString();
    const currentVolume = member.weeklyVolume ?? 0;
    const currentCompliance = member.compliance ?? 0;
    const currentLoad = member.load ?? 0;
    const loadDelta = effort === 'Too Hard' ? 5 : effort === 'Too Easy' ? 1 : 3;
    const readinessDelta = effort === 'Too Hard' ? -3 : effort === 'Too Easy' ? 2 : 1;
    const message = `+${plannedVolume} added to ${group?.name ?? 'team'} Pulse`;

    onUpdateMember(member.id, {
      inviteStatus: 'Joined',
      weeklyVolume: currentVolume + plannedVolume,
      compliance: Math.min(100, currentCompliance + 4),
      load: Math.min(100, currentLoad + loadDelta),
      readiness: Math.max(1, Math.min(100, member.readiness + readinessDelta)),
      streakDays: (member.streakDays ?? 0) + 1,
      lastWorkoutTitle: assignmentSession?.title ?? member.assignment ?? 'Assigned Workout',
      lastWorkoutAt: now,
      lastWorkoutNote: workoutNote.trim() || undefined,
      assignmentSession: assignmentSession
        ? { ...assignmentSession, status: 'completed' }
        : undefined,
    });
    onCompleteWorkout({
      id: `completion-${member.id}-${Date.now()}`,
      memberId: member.id,
      memberName: member.gymName || member.name,
      groupId: member.groupId,
      completionType: 'assigned',
      sessionKind: assignmentMode?.type ?? 'Workout',
      assignment: assignmentSession?.title ?? member.assignment ?? 'Assigned Workout',
      effort,
      durationMinutes: parsedDuration,
      note: workoutNote.trim() || undefined,
      volume: plannedVolume,
      exercises: assignmentSession?.exercises.map((exercise) => ({
        name: exercise.name,
        sets: exercise.actual?.sets ?? exercise.prescribed?.sets,
        reps: exercise.actual?.reps ?? exercise.prescribed?.reps,
        loadKg: exercise.actual?.load ?? exercise.prescribed?.load,
      })) ?? assignedExercises.map((exercise) => ({ name: exercise.name })),
      completedAt: now,
    });
    setWorkoutNote('');
    setCompletedDuration(String(defaultAssignedDuration));
    setFinishFeedback(`${message} Logged ${parsedDuration} min.`);
  }

  function submitQuickLog() {
    if (!member) return;

    const parsedDuration = Number.parseInt(quickLogDuration, 10);
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      setQuickLogFeedback('Enter a valid duration in minutes.');
      return;
    }

    const parsedVolume = quickLogVolume.trim()
      ? Number.parseInt(quickLogVolume, 10)
      : estimateQuickLogVolume(quickLogKind, parsedDuration);

    if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
      setQuickLogFeedback('Enter a valid volume or leave it blank to auto-calculate.');
      return;
    }

    const now = new Date().toISOString();
    const title = `Quick Log: ${quickLogKind}`;
    const loadDelta = quickLogEffort === 'Too Hard' ? 5 : quickLogEffort === 'Too Easy' ? 1 : 3;
    const readinessDelta = quickLogEffort === 'Too Hard' ? -3 : quickLogEffort === 'Too Easy' ? 2 : 1;

    onUpdateMember(member.id, {
      inviteStatus: 'Joined',
      weeklyVolume: (member.weeklyVolume ?? 0) + parsedVolume,
      compliance: Math.min(100, (member.compliance ?? 0) + 3),
      load: Math.min(100, (member.load ?? 0) + loadDelta),
      readiness: Math.max(1, Math.min(100, member.readiness + readinessDelta)),
      streakDays: (member.streakDays ?? 0) + 1,
      lastWorkoutTitle: title,
      lastWorkoutAt: now,
      lastWorkoutNote: quickLogNote.trim() || undefined,
    });

    onAddSession({
      id: `member-${member.id}-${Date.now()}`,
      type: quickLogKind,
      title,
      score: quickLogEffort === 'About Right' ? 84 : quickLogEffort === 'Too Easy' ? 78 : 70,
      durationMinutes: parsedDuration,
      rpe: quickLogEffort === 'About Right' ? 7 : quickLogEffort === 'Too Easy' ? 5 : 8,
      completedAt: now,
    });

    onCompleteWorkout({
      id: `completion-${member.id}-${Date.now()}`,
      memberId: member.id,
      memberName: member.gymName || member.name,
      groupId: member.groupId,
      completionType: 'quick_log',
      sessionKind: quickLogKind,
      assignment: title,
      effort: quickLogEffort,
      durationMinutes: parsedDuration,
      note: quickLogNote.trim() || undefined,
      volume: parsedVolume,
      completedAt: now,
    });

    setQuickLogDuration('30');
    setQuickLogVolume('');
    setQuickLogNote('');
    setQuickLogEffort('About Right');
    setQuickLogFeedback(`Logged ${quickLogKind.toLowerCase()} for ${parsedDuration} min and sent it to the coach feed.`);
  }

  function toggleGhostMode() {
    if (!member) return;
    onUpdateMember(member.id, { ghostMode: !member.ghostMode });
  }

  function sendHype(target: SquadMember) {
    onUpdateMember(target.id, { hypeCount: (target.hypeCount ?? 0) + 1 });
  }

  if (!member) {
    return (
      <Screen>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>MEMBER PORTAL</Text>
            <Text style={styles.title}>Invite Not Found</Text>
          </View>
        </View>
        <Card>
          <Text style={styles.cardTitle}>No matching team member</Text>
          <Text style={styles.body}>
            This device does not have the squad record for that invite yet. Shared team storage will let invite tokens resolve member accounts from the backend.
          </Text>
        </Card>
      </Screen>
    );
  }

  const readinessTone = scoreTone(member.readiness);
  const pulsePercent = Math.min(100, Math.round((teamPulse.weeklyVolume / weeklyGoal) * 100));
  const statusLabel = (member.streakDays ?? 0) >= 5 ? 'On Fire' : (member.streakDays ?? 0) >= 2 ? 'Active' : 'Ready';

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>LOCKER ROOM</Text>
          <Text style={styles.title}>Welcome back, {displayName}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{statusLabel}</Text>
            </View>
            <View style={styles.statusBadgeMuted}>
              <Text style={styles.statusBadgeMutedText}>{member.streakDays ?? 0} day streak</Text>
            </View>
          </View>
        </View>
      </View>

      <Card>
        <View style={styles.syncRow}>
          <View style={styles.syncCopy}>
            <View style={[styles.syncBadge, { borderColor: `${cloudTone}40`, backgroundColor: `${cloudTone}12` }]}>
              <Text style={[styles.syncBadgeText, { color: cloudTone }]}>{cloudLabel}</Text>
            </View>
            <Text style={styles.syncText}>
              {cloudEnabled
                ? syncCopy
                : 'This device is running in local mode right now.'}
            </Text>
          </View>
          {cloudEnabled ? (
            <Pressable
              style={[styles.syncButton, cloudStatus === 'syncing' && styles.syncButtonDisabled]}
              onPress={onCloudSync}
              disabled={cloudStatus === 'syncing'}
            >
              <Text style={styles.syncButtonText}>{cloudStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      <Card hot>
        <View style={styles.profileTop}>
          <View style={styles.profileCopy}>
            <Text style={styles.memberName}>{displayName}</Text>
            <Text style={styles.body}>
              {group?.name ?? 'Unassigned'} - {member.inviteStatus ?? 'Manual'} - Risk {member.risk}
            </Text>
          </View>
          <Text style={[styles.readinessScore, { color: readinessTone }]}>{member.readiness}</Text>
        </View>
        <ProgressBar value={member.readiness} colour={readinessTone} />
        <Pressable style={styles.ghostRow} onPress={toggleGhostMode}>
          <View style={[styles.toggleDot, member.ghostMode && styles.toggleDotActive]} />
          <Text style={styles.ghostText}>{member.ghostMode ? 'Ghost Mode on: activity is anonymous in Pulse' : 'Ghost Mode off: teammates can see your activity'}</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Current Workout</Text>
        <Text style={styles.assignmentTitle}>{assignmentSession?.title ?? member.assignment ?? 'No active assignment'}</Text>
        {assignmentSession?.status ? <Text style={styles.assignmentStatus}>Status: {assignmentSession.status}</Text> : null}
        {assignmentSession?.coachNote ? <Text style={styles.assignmentNote}>Coach note: {assignmentSession.coachNote}</Text> : null}
        {assignedExercises.length ? (
          <View style={styles.exerciseList}>
            {assignedExercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseRow}>
                <View style={styles.exerciseCopy}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  {pinnedExerciseIds.includes(exercise.id) && <Text style={styles.coachPick}>Coach's Pick</Text>}
                  {assignmentSession?.exercises.find((item) => item.exerciseId === exercise.id)?.prescribed ? (
                    <Text style={styles.prescribedDose}>
                      Prescribed: {assignmentSession?.exercises.find((item) => item.exerciseId === exercise.id)?.prescribed?.sets ? `${assignmentSession?.exercises.find((item) => item.exerciseId === exercise.id)?.prescribed?.sets} x ` : ''}
                      {assignmentSession?.exercises.find((item) => item.exerciseId === exercise.id)?.prescribed?.reps ? `${assignmentSession?.exercises.find((item) => item.exerciseId === exercise.id)?.prescribed?.reps}` : ''}
                      {assignmentSession?.exercises.find((item) => item.exerciseId === exercise.id)?.prescribed?.load ? ` @ ${assignmentSession?.exercises.find((item) => item.exerciseId === exercise.id)?.prescribed?.load}${assignmentSession?.exercises.find((item) => item.exerciseId === exercise.id)?.prescribed?.loadUnit ?? 'kg'}` : ''}
                      {assignmentSession?.exercises.find((item) => item.exerciseId === exercise.id)?.prescribed?.durationMinutes ? `${assignmentSession?.exercises.find((item) => item.exerciseId === exercise.id)?.prescribed?.durationMinutes} min` : ''}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.exerciseRight}>
                  <Text style={styles.exerciseDose}>
                    {assignmentSession?.exercises.find((item) => item.exerciseId === exercise.id)?.dose ?? exercise.dose}
                  </Text>
                  {assignmentSession ? (
                    <Pressable
                      style={[
                        styles.hitButton,
                        assignmentSession.exercises.find((item) => item.exerciseId === exercise.id)?.status === 'hit' && styles.hitButtonDone,
                      ]}
                      onPress={() => markExerciseHit(exercise.id)}
                    >
                      <Text
                        style={[
                          styles.hitButtonText,
                          assignmentSession.exercises.find((item) => item.exerciseId === exercise.id)?.status === 'hit' && styles.hitButtonTextDone,
                        ]}
                      >
                        {assignmentSession.exercises.find((item) => item.exerciseId === exercise.id)?.status === 'hit' ? 'Hit' : 'Hit Prescribed'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.body}>Your coach has not attached a detailed block yet.</Text>
        )}
        <View style={styles.quickLogField}>
          <Text style={styles.fieldLabel}>Time completed</Text>
          <TextInput
            style={styles.quickLogInput}
            value={completedDuration}
            onChangeText={setCompletedDuration}
            keyboardType="number-pad"
            placeholder={`${defaultAssignedDuration}`}
            placeholderTextColor={colours.soft}
          />
        </View>
        <TextInput
          style={styles.noteInput}
          value={workoutNote}
          onChangeText={setWorkoutNote}
          placeholder="How did this feel?"
          placeholderTextColor={colours.soft}
          multiline
        />
        <View style={styles.finishGrid}>
          {(['Too Easy', 'About Right', 'Too Hard'] as const).map((label) => (
            <Pressable key={label} style={styles.finishButton} onPress={() => finishWorkout(label)}>
              <Text style={styles.finishButtonText}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {finishFeedback ? <Text style={styles.finishFeedback}>{finishFeedback}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Quick Log</Text>
        <Text style={styles.body}>
          Record a run, ruck, mobility block, or extra session without building every exercise.
        </Text>
        <View style={styles.kindGrid}>
          {quickLogKinds.map((kind) => {
            const active = quickLogKind === kind;
            return (
              <Pressable
                key={kind}
                style={[styles.kindPill, active && styles.kindPillActive]}
                onPress={() => setQuickLogKind(kind)}
              >
                <Text style={[styles.kindPillText, active && styles.kindPillTextActive]}>{kind}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.quickLogRow}>
          <View style={styles.quickLogField}>
            <Text style={styles.fieldLabel}>Duration</Text>
            <TextInput
              style={styles.quickLogInput}
              value={quickLogDuration}
              onChangeText={setQuickLogDuration}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor={colours.soft}
            />
          </View>
          <View style={styles.quickLogField}>
            <Text style={styles.fieldLabel}>Volume</Text>
            <TextInput
              style={styles.quickLogInput}
              value={quickLogVolume}
              onChangeText={setQuickLogVolume}
              keyboardType="number-pad"
              placeholder={`${estimateQuickLogVolume(quickLogKind, Number.parseInt(quickLogDuration || '0', 10) || 30)}`}
              placeholderTextColor={colours.soft}
            />
          </View>
        </View>
        <Text style={styles.fieldHint}>
          Leave volume blank and FORGE will estimate it from your session type and time.
        </Text>
        <View style={styles.finishGrid}>
          {(['Too Easy', 'About Right', 'Too Hard'] as const).map((label) => (
            <Pressable
              key={label}
              style={[styles.finishButton, quickLogEffort === label && styles.finishButtonActive]}
              onPress={() => setQuickLogEffort(label)}
            >
              <Text style={styles.finishButtonText}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.noteInput}
          value={quickLogNote}
          onChangeText={setQuickLogNote}
          placeholder="Optional note for coach"
          placeholderTextColor={colours.soft}
          multiline
        />
        <Pressable style={styles.logButton} onPress={submitQuickLog}>
          <Text style={styles.logButtonText}>Log Session</Text>
        </Pressable>
        {quickLogFeedback ? <Text style={styles.finishFeedback}>{quickLogFeedback}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{group ? `${group.name} Pulse` : 'Team Pulse'}</Text>
        <View style={styles.pulseHero}>
          <Text style={styles.pulseNumber}>{teamPulse.weeklyVolume.toLocaleString()}</Text>
          <Text style={styles.pulseCopy}>of {weeklyGoal.toLocaleString()} squad volume this week</Text>
        </View>
        <ProgressBar value={pulsePercent} colour={pulsePercent >= 75 ? colours.green : pulsePercent >= 45 ? colours.amber : colours.cyan} height={12} />
        <View style={styles.teamStats}>
          <Text style={styles.teamStat}>Ready {teamPulse.readiness}</Text>
          <Text style={styles.teamStat}>Comply {teamPulse.compliance}%</Text>
          <Text style={styles.teamStat}>{teamPulse.atRisk} review</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Recent Activity</Text>
        {teamPulse.recent.length ? teamPulse.recent.map((item) => {
          const isSelf = item.id === member.id;
          const name = item.ghostMode && !isSelf ? 'A teammate' : item.gymName || item.name;
          return (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle}>{name} finished {item.lastWorkoutTitle ?? 'training'}</Text>
                <Text style={styles.activityMeta}>{formatActivityTime(item.lastWorkoutAt)} - {item.hypeCount ?? 0} bumps</Text>
              </View>
              {!isSelf ? (
                <Pressable style={styles.hypeButton} onPress={() => sendHype(item)}>
                  <Text style={styles.hypeButtonText}>Bump</Text>
                </Pressable>
              ) : (
                <Text style={styles.selfTag}>You</Text>
              )}
            </View>
          );
        }) : (
          <Text style={styles.body}>No squad activity logged yet this week.</Text>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  kicker: {
    color: colours.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: colours.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncCopy: {
    flex: 1,
    gap: 8,
  },
  syncBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  syncText: {
    color: colours.textSoft,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  syncButton: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: `${colours.cyan}40`,
    borderRadius: 10,
    backgroundColor: colours.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  syncButtonDisabled: {
    opacity: 0.45,
  },
  syncButtonText: {
    color: colours.cyan,
    fontSize: 12,
    fontWeight: '900',
  },
  statusBadge: {
    borderRadius: 8,
    backgroundColor: colours.green,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    color: colours.background,
    fontSize: 11,
    fontWeight: '900',
  },
  statusBadgeMuted: {
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: 8,
    backgroundColor: colours.cyanDim,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeMutedText: {
    color: colours.cyan,
    fontSize: 11,
    fontWeight: '900',
  },
  cardTitle: {
    color: colours.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  body: {
    color: colours.textSoft,
    fontSize: 16,
    lineHeight: 23,
  },
  profileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
  },
  profileCopy: {
    flex: 1,
  },
  memberName: {
    color: colours.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  readinessScore: {
    fontSize: 48,
    fontWeight: '900',
  },
  ghostRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  toggleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colours.borderHot,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  toggleDotActive: {
    backgroundColor: colours.cyan,
  },
  ghostText: {
    flex: 1,
    color: colours.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  assignmentTitle: {
    color: colours.cyan,
    fontSize: 22,
    fontWeight: '900',
  },
  assignmentStatus: {
    color: colours.amber,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  assignmentNote: {
    color: colours.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  exerciseList: {
    gap: 8,
    marginTop: 14,
  },
  exerciseRow: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  exerciseName: {
    flex: 1,
    color: colours.text,
    fontSize: 14,
    fontWeight: '900',
  },
  exerciseCopy: {
    flex: 1,
  },
  exerciseRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  coachPick: {
    color: colours.amber,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 3,
  },
  prescribedDose: {
    color: colours.green,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 3,
  },
  exerciseDose: {
    color: colours.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  hitButton: {
    minHeight: 32,
    borderWidth: 1,
    borderColor: `${colours.cyan}40`,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.cyanDim,
  },
  hitButtonDone: {
    borderColor: `${colours.green}40`,
    backgroundColor: colours.greenDim,
  },
  hitButtonText: {
    color: colours.cyan,
    fontSize: 10,
    fontWeight: '900',
  },
  hitButtonTextDone: {
    color: colours.green,
  },
  noteInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    color: colours.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 14,
    textAlignVertical: 'top',
  },
  finishGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  finishButton: {
    minHeight: touchTarget,
    flex: 1,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  finishButtonActive: {
    borderWidth: 1,
    borderColor: `${colours.green}60`,
    backgroundColor: colours.green,
  },
  finishButtonText: {
    color: colours.background,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  kindGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  kindPill: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  kindPillActive: {
    borderColor: `${colours.amber}70`,
    backgroundColor: colours.amberDim,
  },
  kindPillText: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  kindPillTextActive: {
    color: colours.amber,
  },
  quickLogRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  quickLogField: {
    flex: 1,
  },
  fieldLabel: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 6,
  },
  quickLogInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    color: colours.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '800',
  },
  fieldHint: {
    color: colours.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  logButton: {
    minHeight: touchTarget,
    borderRadius: 8,
    backgroundColor: colours.amber,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  logButtonText: {
    color: colours.background,
    fontSize: 13,
    fontWeight: '900',
  },
  finishFeedback: {
    color: colours.green,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 10,
  },
  pulseHero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  pulseNumber: {
    color: colours.text,
    fontSize: 46,
    lineHeight: 50,
    fontWeight: '900',
  },
  pulseCopy: {
    flex: 1,
    color: colours.textSoft,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    paddingBottom: 8,
  },
  teamStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  teamStat: {
    color: colours.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  activityRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
    paddingVertical: 10,
  },
  activityCopy: {
    flex: 1,
  },
  activityTitle: {
    color: colours.text,
    fontSize: 14,
    fontWeight: '900',
  },
  activityMeta: {
    color: colours.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  hypeButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: colours.cyanDim,
  },
  hypeButtonText: {
    color: colours.cyan,
    fontSize: 12,
    fontWeight: '900',
  },
  selfTag: {
    color: colours.green,
    fontSize: 12,
    fontWeight: '900',
  },
});
