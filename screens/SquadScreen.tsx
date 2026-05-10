import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InstructorScreen } from './InstructorScreen';
import { MemberScreen } from './MemberScreen';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { ProgressBar } from '../components/ProgressBar';
import { colours, radius, touchTarget, typography } from '../theme';
import type { SquadMember, TrainingGroup, TrainingSession, ProgrammeTemplate } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';
import type { CloudTeamActivity } from '../lib/squadCloud';

type InstructorProps = React.ComponentProps<typeof InstructorScreen>;

type Props = InstructorProps & {
  onCompleteWorkout: (completion: WorkoutCompletion) => void;
  onAddSession: (session: TrainingSession) => void;
  initialMode?: 'coach' | 'member';
  cloudTeamActivity?: CloudTeamActivity[];
};

function ModeSwitch({ mode, onModeChange }: { mode: 'coach' | 'member'; onModeChange: (mode: 'coach' | 'member') => void }) {
  return (
    <View style={styles.modeSwitch}>
      {(['coach', 'member'] as const).map((item) => {
        const active = mode === item;
        return (
          <Pressable key={item} style={[styles.modeButton, active && styles.modeButtonActive]} onPress={() => onModeChange(item)}>
            <Ionicons name={item === 'coach' ? 'clipboard-outline' : 'flash-outline'} size={16} color={active ? colours.background : colours.cyan} />
            <Text style={[styles.modeText, active && styles.modeTextActive]}>{item === 'coach' ? 'Coach View' : 'Member View'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function buildTeamPulse(members: SquadMember[], workoutCompletions: WorkoutCompletion[]) {
  const readiness = members.length ? Math.round(members.reduce((sum, member) => sum + member.readiness, 0) / members.length) : 0;
  const compliance = members.length ? Math.round(members.reduce((sum, member) => sum + member.compliance, 0) / members.length) : 0;
  const riskCount = members.filter((member) => member.risk !== 'Low').length;
  const weeklyVolume = members.reduce((sum, member) => sum + (member.weeklyVolume ?? 0), 0);
  const assignedCompletions = workoutCompletions.filter((completion) => completion.completionType === 'assigned').length;
  return { readiness, compliance, riskCount, weeklyVolume, assignedCompletions };
}

function SquadOverview({
  members,
  groups,
  workoutCompletions,
  readinessLogs,
}: {
  members: SquadMember[];
  groups: TrainingGroup[];
  workoutCompletions: WorkoutCompletion[];
  readinessLogs: ReadinessLog[];
}) {
  const pulse = useMemo(() => buildTeamPulse(members, workoutCompletions), [members, workoutCompletions]);
  const membersNeedingReview = members.filter((member) => member.risk !== 'Low' || member.readiness < 60 || member.compliance < 70).slice(0, 4);
  const latestNote = workoutCompletions.find((completion) => completion.note?.trim());
  const weeklyGoal = Math.max(1000, groups.length * 2500);
  const goalPercent = Math.min(100, Math.round((pulse.weeklyVolume / weeklyGoal) * 100));

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>SQUAD</Text>
        <Text style={styles.title}>Coach and member accountability</Text>
      </View>

      <Card hot>
        <Text style={styles.cardTitle}>Team Pulse</Text>
        <View style={styles.pulseGrid}>
          <View>
            <Text style={styles.pulseValue}>{goalPercent}%</Text>
            <Text style={styles.pulseLabel}>Weekly goal</Text>
          </View>
          <View style={styles.pulseSide}>
            <Text style={styles.pulseMetric}>Readiness {pulse.readiness}/100</Text>
            <Text style={styles.pulseMetric}>Completion {pulse.compliance}%</Text>
            <Text style={[styles.pulseMetric, { color: pulse.riskCount ? colours.amber : colours.green }]}>{pulse.riskCount} need review</Text>
          </View>
        </View>
        <ProgressBar value={goalPercent} colour={goalPercent >= 75 ? colours.green : colours.amber} height={10} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Members Needing Review</Text>
        {membersNeedingReview.length ? membersNeedingReview.map((member) => (
          <View key={member.id} style={styles.reviewRow}>
            <View>
              <Text style={styles.reviewName}>{member.gymName || member.name}</Text>
              <Text style={styles.reviewMeta}>Ready {member.readiness} - Comply {member.compliance}% - Load {member.load}</Text>
            </View>
            <Text style={[styles.riskBadge, { color: member.risk === 'High' ? colours.red : colours.amber }]}>{member.risk}</Text>
          </View>
        )) : <Text style={styles.body}>No members are currently flagged.</Text>}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Assignment Centre</Text>
        <Text style={styles.body}>Use Coach View to assign one member, a group, or the whole squad. Keep member completion simple: done, effort, quick note.</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Notes and Feedback</Text>
        <Text style={styles.body}>
          {latestNote ? `${latestNote.memberName}: ${latestNote.note}` : 'Member notes and Too Easy / About Right / Too Hard responses will appear here.'}
        </Text>
        <Text style={styles.footerNote}>{readinessLogs.length} readiness logs available for review.</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Backend Roadmap</Text>
        {['squads', 'squad_memberships', 'member_invites', 'assignments', 'assignment_exercises', 'workout_completions', 'team_activity', 'member_privacy_settings'].map((table) => (
          <View key={table} style={styles.schemaRow}>
            <Ionicons name="server-outline" size={15} color={colours.cyan} />
            <Text style={styles.schemaText}>{table}</Text>
          </View>
        ))}
        <Text style={styles.footerNote}>Next production step: replace member query links with random invite tokens, expiry, role claim flow, RLS, and Team Pulse from completion rows.</Text>
      </Card>
    </Screen>
  );
}

export function SquadScreen(props: Props) {
  const [mode, setMode] = useState<'coach' | 'member'>(props.initialMode ?? 'coach');
  const activeMember = props.members[0] ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.switchWrap}>
        <ModeSwitch mode={mode} onModeChange={setMode} />
      </View>
      {mode === 'coach' ? (
        <InstructorScreen {...props} />
      ) : (
        <MemberScreen
          member={activeMember}
          members={props.members}
          groups={props.groups}
          workoutCompletions={props.workoutCompletions}
          cloudTeamActivity={props.cloudTeamActivity}
          onUpdateMember={props.onUpdateMember}
          onCompleteWorkout={props.onCompleteWorkout}
          onAddSession={props.onAddSession}
          cloudEnabled={props.cloudEnabled}
          cloudStatus={props.cloudStatus}
          pendingSyncCount={props.pendingSyncCount}
          onCloudSync={props.onCloudSync}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },
  switchWrap: { paddingHorizontal: 14, paddingTop: 10, backgroundColor: colours.background },
  modeSwitch: { minHeight: touchTarget, borderWidth: 1, borderColor: colours.borderHot, borderRadius: radius.sm, backgroundColor: colours.surface, flexDirection: 'row', padding: 4, gap: 4 },
  modeButton: { flex: 1, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  modeButtonActive: { backgroundColor: colours.cyan },
  modeText: { color: colours.cyan, fontSize: 12, fontWeight: '900' },
  modeTextActive: { color: colours.background },
  content: { flex: 1 },
  header: { gap: 4 },
  kicker: { ...typography.label, color: colours.cyan },
  title: { color: colours.text, fontSize: 30, lineHeight: 34, fontWeight: '900' },
  cardTitle: { ...typography.h4, color: colours.text, marginBottom: 12 },
  pulseGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 12 },
  pulseValue: { color: colours.green, fontSize: 54, lineHeight: 58, fontWeight: '900' },
  pulseLabel: { ...typography.caption, color: colours.muted },
  pulseSide: { flex: 1, justifyContent: 'center', gap: 5 },
  pulseMetric: { color: colours.textSoft, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  reviewRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: colours.borderSoft },
  reviewName: { color: colours.text, fontSize: 14, fontWeight: '900' },
  reviewMeta: { ...typography.caption, color: colours.muted, marginTop: 3 },
  riskBadge: { fontSize: 12, fontWeight: '900' },
  body: { ...typography.body, color: colours.textSoft },
  footerNote: { ...typography.caption, color: colours.muted, marginTop: 10, lineHeight: 18 },
  schemaRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colours.borderSoft },
  schemaText: { color: colours.textSoft, fontSize: 13, fontWeight: '900' },
});
