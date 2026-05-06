import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ProgressBar } from './ProgressBar';
import { colours, typography } from '../theme';
import { responsiveSpacing, statusColors } from '../utils/styling';
import type { SquadMember, TrainingGroup } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';

export function completionTone(type: WorkoutCompletion['completionType']) {
  if (type === 'quick_log') return colours.amber;
  if (type === 'ad_hoc') return colours.violet;
  return colours.green;
}

export function formatReadinessFactor(label: string, log?: ReadinessLog) {
  switch (label) {
    case 'Sleep': return log?.sleepHours ? `${log.sleepHours}h` : log?.sleepQuality ? `${log.sleepQuality}/5` : '--';
    case 'Soreness': return log?.soreness ? `${log.soreness}/5` : '--';
    case 'Pain': return log?.pain ? `${log.pain}/5` : '--';
    case 'Hydration': return log?.hydration ?? '--';
    case 'Mood': return log?.mood ? `${log.mood}/5` : '--';
    case 'Illness': return log?.illness ? `${log.illness}/5` : '--';
    case 'Rest HR': return log?.restingHR ? `${log.restingHR}` : '--';
    case 'HRV': return log?.hrv ? `${log.hrv}` : '--';
    default: return '--';
  }
}

interface Props {
  member: SquadMember;
  group?: TrainingGroup;
  latestCompletion?: WorkoutCompletion;
  latestReadiness?: ReadinessLog;
  onDelete: (member: SquadMember) => void;
}

export function SquadMemberCard({ member, group, latestCompletion, latestReadiness, onDelete }: Props) {
  const latestTone = latestCompletion ? completionTone(latestCompletion.completionType) : colours.borderSoft;

  return (
    <View style={styles.memberCard}>
      {latestCompletion ? (
        <View style={[styles.memberCompletionBanner, { borderColor: statusColors(latestTone).borderMed, backgroundColor: statusColors(latestTone).bgMed }]}>
          <Text style={[styles.memberCompletionBannerText, { color: latestTone }]}>
            Completed {latestCompletion.assignment} - {latestCompletion.durationMinutes} min - {latestCompletion.effort}
          </Text>
        </View>
      ) : null}
      <View style={styles.headerRow}>
        <View style={styles.memberCopy}>
          <Text style={styles.memberName}>{member.name}</Text>
          <Text style={styles.muted}>
            {group?.name ?? 'Unassigned'} - {member.inviteStatus ?? 'Manual'} - Compliance {member.compliance}% - Risk {member.risk}
          </Text>
          {member.gymName && <Text style={styles.memberPortalName}>Portal: {member.gymName}{member.ghostMode ? ' - Ghost Mode' : ''}</Text>}
          {member.email && <Text style={styles.memberEmail}>{member.email}</Text>}
          {member.deviceSyncProvider && <Text style={styles.memberDeviceSync}>{member.deviceSyncProvider} - {member.deviceSyncStatus ?? 'Disconnected'}</Text>}
          {member.assignment && <Text style={styles.memberAssignment}>Assigned: {member.assignment}</Text>}
          {member.assignmentSession?.status ? <Text style={styles.memberAssignmentStatus}>Session: {member.assignmentSession.status}</Text> : null}
          {member.assignmentSession?.coachNote ? <Text style={styles.memberNote}>Coach note: {member.assignmentSession.coachNote}</Text> : null}
          {member.assignmentSession?.exercises?.length ? (
            <Text style={styles.memberExerciseMeta}>{member.assignmentSession.exercises.length} assigned exercises uploaded to member app</Text>
          ) : null}
          {latestCompletion ? (
            <Text style={styles.memberCompletionMeta}>
              Last sync: {latestCompletion.sessionKind} - {latestCompletion.volume} volume
            </Text>
          ) : null}
          {latestReadiness?.painArea ? <Text style={styles.memberPainArea}>Pain area: {latestReadiness.painArea}{latestReadiness.limitsTraining ? ' - limits training' : ''}</Text> : null}
          {member.lastWorkoutNote && <Text style={styles.memberNote}>Note: {member.lastWorkoutNote}</Text>}
        </View>
        <View style={styles.memberActions}>
          <Text style={[styles.memberScore, member.readiness < 50 ? { color: colours.red } : member.readiness < 70 ? { color: colours.amber } : { color: colours.cyan }]}>
            {member.readiness}
          </Text>
          <Pressable style={styles.deleteMemberButton} onPress={() => onDelete(member)}>
            <Text style={styles.deleteMemberText}>Delete</Text>
          </Pressable>
        </View>
      </View>
      <ProgressBar value={member.readiness} />
      <View style={styles.factorGrid}>
        {['Sleep', 'Soreness', 'Pain', 'Hydration', 'Mood', 'Illness', 'Rest HR', 'HRV'].map(factor => (
          <View key={factor} style={styles.factorItem}>
            <Text style={styles.factorLabel}>{factor}</Text>
            <Text style={styles.factorValue}>{formatReadinessFactor(factor, latestReadiness)}</Text>
          </View>
        ))}
      </View>
      {latestReadiness ? <Text style={styles.readinessStamp}>Check-in {new Date(latestReadiness.date).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  memberCard: { borderColor: colours.border, borderWidth: 1, borderRadius: 18, padding: responsiveSpacing('md'), backgroundColor: 'rgba(0,0,0,0.18)', marginBottom: responsiveSpacing('sm') },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: responsiveSpacing('md') },
  memberCopy: { flex: 1 },
  memberName: { color: colours.text, fontWeight: '900' },
  muted: { color: colours.muted, ...typography.caption },
  memberPortalName: { color: colours.amber, ...typography.caption, fontWeight: '800', marginTop: 3 },
  memberEmail: { color: colours.cyan, ...typography.caption, fontWeight: '800', marginTop: 3 },
  memberDeviceSync: { color: colours.violet, ...typography.caption, fontWeight: '800', marginTop: 3 },
  memberAssignment: { color: colours.green, ...typography.caption, fontWeight: '800', marginTop: 3 },
  memberAssignmentStatus: { color: colours.amber, ...typography.caption, fontWeight: '800', marginTop: 3 },
  memberExerciseMeta: { color: colours.cyan, ...typography.caption, fontWeight: '700', marginTop: 3 },
  memberPainArea: { color: colours.red, ...typography.caption, fontWeight: '800', marginTop: 3 },
  memberNote: { color: colours.textSoft, ...typography.caption, fontWeight: '700', marginTop: 3 },
  memberScore: { fontSize: 22, fontWeight: '900' },
  memberActions: { alignItems: 'flex-end', gap: responsiveSpacing('sm') },
  deleteMemberButton: { minHeight: 52, borderWidth: 1, borderColor: statusColors(colours.red).borderMed, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: statusColors(colours.red).bgMed },
  deleteMemberText: { color: colours.red, ...typography.caption, fontWeight: '900' },
  factorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: responsiveSpacing('md') },
  factorItem: { flex: 1, minWidth: '22%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  factorLabel: { color: colours.muted, ...typography.label, marginBottom: 2 },
  factorValue: { color: colours.text, ...typography.caption, fontWeight: '900' },
  readinessStamp: { color: colours.muted, ...typography.caption, fontWeight: '700', marginTop: responsiveSpacing('sm') },
  memberCompletionBanner: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: responsiveSpacing('sm') },
  memberCompletionBannerText: { ...typography.caption, fontWeight: '900' },
  memberCompletionMeta: { color: colours.amber, ...typography.caption, fontWeight: '800', marginTop: 3 },
});