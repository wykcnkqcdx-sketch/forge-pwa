import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { colours, touchTarget } from '../theme';
import { exerciseLibrary, SquadMember, TrainingGroup, trainingModes } from '../data/mockData';

type Props = {
  member: SquadMember | null;
  members: SquadMember[];
  groups: TrainingGroup[];
  onUpdateMember: (id: string, updates: Partial<SquadMember>) => void;
  onCoachView: () => void;
};

const weeklyGoal = 10000;

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

export function MemberScreen({ member, members, groups, onUpdateMember, onCoachView }: Props) {
  const [workoutNote, setWorkoutNote] = useState('');
  const [finishFeedback, setFinishFeedback] = useState('');
  const group = member ? groups.find((item) => item.id === member.groupId) ?? null : null;
  const groupMembers = group ? members.filter((item) => item.groupId === group.id) : [];
  const teamMembers = groupMembers.length ? groupMembers : members;
  const displayName = member?.gymName || member?.name || 'Athlete';
  const assignmentMode = trainingModes.find((mode) => mode.title === member?.assignment);
  const assignedExercises = assignmentMode
    ? assignmentMode.defaultExerciseIds
        .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
        .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
        .slice(0, 5)
    : [];
  const plannedVolume = Math.max(120, assignedExercises.length * 60 + (assignmentMode?.key === 'cardio' ? 180 : 0));

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

  function finishWorkout(effort: 'About Right' | 'Too Easy' | 'Too Hard') {
    if (!member) return;

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
      lastWorkoutTitle: member.assignment ?? 'Assigned Workout',
      lastWorkoutAt: now,
      lastWorkoutNote: workoutNote.trim() || undefined,
    });
    setWorkoutNote('');
    setFinishFeedback(message);
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
          <Pressable style={styles.coachButton} onPress={onCoachView}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colours.cyan} />
            <Text style={styles.coachButtonText}>Coach</Text>
          </Pressable>
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
        <Pressable style={styles.coachButton} onPress={onCoachView}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colours.cyan} />
          <Text style={styles.coachButtonText}>Coach</Text>
        </Pressable>
      </View>

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
        <Text style={styles.assignmentTitle}>{member.assignment ?? 'No active assignment'}</Text>
        {assignedExercises.length ? (
          <View style={styles.exerciseList}>
            {assignedExercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseRow}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseDose}>{exercise.dose}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.body}>Your coach has not attached a detailed block yet.</Text>
        )}
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
  coachButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colours.cyanDim,
  },
  coachButtonText: {
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
  exerciseDose: {
    color: colours.muted,
    fontSize: 12,
    fontWeight: '900',
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
  finishButtonText: {
    color: colours.background,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
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
