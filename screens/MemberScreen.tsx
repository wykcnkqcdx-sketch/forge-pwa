import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { colours } from '../theme';
import { exerciseLibrary, SquadMember, TrainingGroup, trainingModes } from '../data/mockData';

type Props = {
  member: SquadMember | null;
  members: SquadMember[];
  groups: TrainingGroup[];
  onCoachView: () => void;
};

function scoreTone(value: number) {
  if (value >= 75) return colours.green;
  if (value >= 60) return colours.amber;
  return colours.red;
}

export function MemberScreen({ member, members, groups, onCoachView }: Props) {
  const group = member ? groups.find((item) => item.id === member.groupId) ?? null : null;
  const groupMembers = group ? members.filter((item) => item.groupId === group.id) : [];
  const teamMembers = groupMembers.length ? groupMembers : members;
  const assignmentMode = trainingModes.find((mode) => mode.title === member?.assignment);
  const assignedExercises = assignmentMode
    ? assignmentMode.defaultExerciseIds
        .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
        .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
        .slice(0, 5)
    : [];

  const teamProgress = useMemo(() => {
    const source = teamMembers.length ? teamMembers : members;
    const readiness = source.length
      ? Math.round(source.reduce((total, item) => total + item.readiness, 0) / source.length)
      : 0;
    const compliance = source.length
      ? Math.round(source.reduce((total, item) => total + item.compliance, 0) / source.length)
      : 0;
    const load = source.length
      ? Math.round(source.reduce((total, item) => total + item.load, 0) / source.length)
      : 0;
    const atRisk = source.filter((item) => item.risk !== 'Low').length;
    const score = Math.round(readiness * 0.5 + compliance * 0.3 + Math.max(0, 100 - load) * 0.2);

    return { readiness, compliance, load, atRisk, score, count: source.length };
  }, [members, teamMembers]);

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
            This device does not have the squad record for that invite yet. Once shared team storage is connected, this link can resolve the member account from the backend.
          </Text>
        </Card>
      </Screen>
    );
  }

  const readinessTone = scoreTone(member.readiness);
  const teamTone = scoreTone(teamProgress.score);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>MEMBER PORTAL</Text>
          <Text style={styles.title}>My Training</Text>
        </View>
        <Pressable style={styles.coachButton} onPress={onCoachView}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colours.cyan} />
          <Text style={styles.coachButtonText}>Coach</Text>
        </Pressable>
      </View>

      <Card hot>
        <View style={styles.profileTop}>
          <View style={styles.profileCopy}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.body}>
              {group?.name ?? 'Unassigned'} - {member.inviteStatus ?? 'Manual'} - Risk {member.risk}
            </Text>
          </View>
          <Text style={[styles.readinessScore, { color: readinessTone }]}>{member.readiness}</Text>
        </View>
        <ProgressBar value={member.readiness} colour={readinessTone} />
      </Card>

      <View style={styles.metricGrid}>
        <MetricCard icon="checkmark-done" label="Compliance" value={`${member.compliance}%`} sub="your current rate" tone={scoreTone(member.compliance)} />
        <MetricCard icon="pulse" label="Load" value={`${member.load}`} sub="training load" tone={member.load >= 85 ? colours.red : member.load >= 75 ? colours.amber : colours.green} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>Assigned Workout</Text>
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
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{group ? `${group.name} Progress` : 'Team Progress'}</Text>
        <View style={styles.teamScoreRow}>
          <View>
            <Text style={styles.label}>TEAM SCORE</Text>
            <Text style={[styles.teamScore, { color: teamTone }]}>{teamProgress.score}</Text>
          </View>
          <View style={styles.teamCopy}>
            <Text style={styles.body}>
              {teamProgress.count} members tracked. {teamProgress.atRisk} currently need review.
            </Text>
          </View>
        </View>
        <ProgressBar value={teamProgress.score} colour={teamTone} />
        <View style={styles.teamStats}>
          <Text style={styles.teamStat}>Ready {teamProgress.readiness}</Text>
          <Text style={styles.teamStat}>Comply {teamProgress.compliance}%</Text>
          <Text style={styles.teamStat}>Load {teamProgress.load}</Text>
        </View>
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
  kicker: {
    color: colours.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: colours.text,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 4,
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
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
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
  teamScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  label: {
    color: colours.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  teamScore: {
    fontSize: 44,
    fontWeight: '900',
  },
  teamCopy: {
    flex: 1,
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
});
