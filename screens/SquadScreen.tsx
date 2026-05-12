import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InstructorScreen } from './InstructorScreen';
import { MemberScreen } from './MemberScreen';
import { Screen } from '../components/Screen';
import { ProgressBar } from '../components/ProgressBar';
import { colours, radius, touchTarget, typography } from '../theme';
import type { SquadMember, TrainingGroup, TrainingSession, ProgrammeTemplate } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';
import type { CloudInvite, CloudTeamActivity } from '../lib/squadCloud';

type InstructorProps = React.ComponentProps<typeof InstructorScreen>;

type Props = InstructorProps & {
  onCompleteWorkout: (completion: WorkoutCompletion) => void;
  onAddSession: (session: TrainingSession) => void;
  initialMode?: 'pulse' | 'coach' | 'member';
  cloudTeamActivity?: CloudTeamActivity[];
  cloudInvites?: CloudInvite[];
};

type Mode = 'pulse' | 'coach' | 'member';

// ── Helpers ─────────────────────────────────────────────────────

function readinessTone(score: number) {
  if (score >= 75) return colours.green;
  if (score >= 60) return colours.amber;
  return colours.red;
}

function riskTone(risk: SquadMember['risk']) {
  if (risk === 'Low')    return colours.green;
  if (risk === 'Medium') return colours.amber;
  return colours.red;
}

function buildPulse(members: SquadMember[], completions: WorkoutCompletion[]) {
  if (!members.length) return { readiness: 0, compliance: 0, riskCount: 0, weeklyVolume: 0 };
  const readiness  = Math.round(members.reduce((s, m) => s + m.readiness,  0) / members.length);
  const compliance = Math.round(members.reduce((s, m) => s + m.compliance, 0) / members.length);
  const riskCount  = members.filter(m => m.risk !== 'Low').length;
  const weeklyVolume = members.reduce((s, m) => s + (m.weeklyVolume ?? 0), 0);
  return { readiness, compliance, riskCount, weeklyVolume };
}

// ── Mode switch ──────────────────────────────────────────────────

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tabs: Array<{ key: Mode; icon: string; label: string }> = [
    { key: 'pulse',  icon: 'pulse-outline',     label: 'PULSE' },
    { key: 'coach',  icon: 'clipboard-outline',  label: 'COACH' },
    { key: 'member', icon: 'flash-outline',      label: 'MEMBER' },
  ];
  return (
    <View style={sw.bar}>
      {tabs.map(tab => {
        const active = mode === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[sw.tab, active && sw.tabActive]}
            onPress={() => onChange(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={14}
              color={active ? colours.background : colours.muted}
            />
            <Text style={[sw.label, active && sw.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const sw = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: radius.sm,
    backgroundColor: colours.surface,
    padding: 4,
    gap: 4,
    minHeight: touchTarget,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.xs,
  },
  tabActive: {
    backgroundColor: colours.cyan,
  },
  label: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  labelActive: {
    color: colours.background,
  },
});

// ── Member card ──────────────────────────────────────────────────

function MemberCard({ member }: { member: SquadMember }) {
  const tone = readinessTone(member.readiness);
  const rt   = riskTone(member.risk);
  return (
    <View style={mc.card}>
      {/* Left accent */}
      <View style={[mc.accent, { backgroundColor: rt }]} />

      <View style={mc.body}>
        <View style={mc.topRow}>
          <Text style={mc.name} numberOfLines={1}>{member.gymName || member.name}</Text>
          <View style={[mc.riskChip, { borderColor: `${rt}50`, backgroundColor: `${rt}12` }]}>
            <Text style={[mc.riskText, { color: rt }]}>{member.risk.toUpperCase()}</Text>
          </View>
        </View>

        <View style={mc.metrics}>
          <View style={mc.metric}>
            <Text style={[mc.metricVal, { color: tone }]}>{member.readiness}</Text>
            <Text style={mc.metricLabel}>READY</Text>
          </View>
          <View style={mc.metric}>
            <Text style={mc.metricVal}>{member.compliance}%</Text>
            <Text style={mc.metricLabel}>COMPLY</Text>
          </View>
          {member.streakDays != null && (
            <View style={mc.metric}>
              <Text style={[mc.metricVal, member.streakDays >= 3 ? { color: colours.cyan } : {}]}>
                {member.streakDays}
              </Text>
              <Text style={mc.metricLabel}>STREAK</Text>
            </View>
          )}
          <View style={mc.metric}>
            <Text style={[mc.metricVal, { color: riskTone(member.risk === 'High' ? 'High' : member.risk === 'Medium' ? 'Medium' : 'Low') }]}>
              {member.load}
            </Text>
            <Text style={mc.metricLabel}>LOAD</Text>
          </View>
        </View>

        {member.lastWorkoutTitle && (
          <Text style={mc.lastWorkout} numberOfLines={1}>
            Last: {member.lastWorkoutTitle}
            {member.lastWorkoutNote ? ` — ${member.lastWorkoutNote}` : ''}
          </Text>
        )}
        {member.assignmentSession && member.assignmentSession.status !== 'completed' && (
          <View style={mc.assignRow}>
            <Ionicons name="flag-outline" size={11} color={colours.amber} />
            <Text style={mc.assignText} numberOfLines={1}>
              Assigned: {member.assignmentSession.title}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const mc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  accent: {
    width: 3,
    opacity: 0.85,
  },
  body: {
    flex: 1,
    padding: 12,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    color: colours.text,
    fontSize: 14,
    fontWeight: '900',
  },
  riskChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  riskText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  metrics: {
    flexDirection: 'row',
    gap: 12,
  },
  metric: {
    alignItems: 'center',
    gap: 1,
  },
  metricVal: {
    color: colours.text,
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 22,
  },
  metricLabel: {
    color: colours.muted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  lastWorkout: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  assignText: {
    flex: 1,
    color: colours.amber,
    fontSize: 11,
    fontWeight: '700',
  },
});

// ── Squad Pulse view ─────────────────────────────────────────────

function SquadPulseView({
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
  const pulse = useMemo(
    () => buildPulse(members, workoutCompletions),
    [members, workoutCompletions],
  );
  const flagged = useMemo(
    () => members.filter(m => m.risk !== 'Low' || m.readiness < 60 || m.compliance < 70),
    [members],
  );
  const healthy = useMemo(
    () => members.filter(m => m.risk === 'Low' && m.readiness >= 75 && m.compliance >= 70),
    [members],
  );
  const complianceTone = pulse.compliance >= 75 ? colours.green : colours.amber;
  const latestNote = workoutCompletions.find(c => c.note?.trim());

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.kicker}>SQUAD PULSE</Text>
        <Text style={styles.title}>{members.length} members · {groups.length} group{groups.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Pulse summary card */}
      <View style={styles.pulseCard}>
        <View style={styles.pulseTop}>
          <View>
            <Text style={[styles.pulseBig, { color: complianceTone }]}>{pulse.compliance}%</Text>
            <Text style={styles.pulseSubLabel}>complete this week</Text>
          </View>
          <View style={styles.pulseSide}>
            <View style={styles.pulseStat}>
              <Text style={[styles.pulseStatVal, { color: readinessTone(pulse.readiness) }]}>{pulse.readiness}</Text>
              <Text style={styles.pulseStatLabel}>AVG READINESS</Text>
            </View>
            <View style={styles.pulseStat}>
              <Text style={[styles.pulseStatVal, { color: pulse.riskCount > 0 ? colours.amber : colours.green }]}>
                {pulse.riskCount}
              </Text>
              <Text style={styles.pulseStatLabel}>NEED REVIEW</Text>
            </View>
            <View style={styles.pulseStat}>
              <Text style={[styles.pulseStatVal, { color: colours.green }]}>{healthy.length}</Text>
              <Text style={styles.pulseStatLabel}>FIELD READY</Text>
            </View>
          </View>
        </View>
        <ProgressBar value={pulse.compliance} colour={complianceTone} height={6} />
        {latestNote && (
          <Text style={styles.pulseNote}>
            {latestNote.memberName}: {latestNote.note}
          </Text>
        )}
      </View>

      {/* Flagged members */}
      {flagged.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>NEEDS REVIEW</Text>
            <View style={[styles.countChip, { backgroundColor: colours.amberDim, borderColor: `${colours.amber}40` }]}>
              <Text style={[styles.countText, { color: colours.amber }]}>{flagged.length}</Text>
            </View>
          </View>
          {flagged.map(m => <MemberCard key={m.id} member={m} />)}
        </View>
      )}

      {/* Healthy members */}
      {healthy.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>FIELD READY</Text>
            <View style={[styles.countChip, { backgroundColor: colours.greenDim, borderColor: `${colours.green}40` }]}>
              <Text style={[styles.countText, { color: colours.green }]}>{healthy.length}</Text>
            </View>
          </View>
          {healthy.map(m => <MemberCard key={m.id} member={m} />)}
        </View>
      )}

      {/* Remaining members not in either bucket */}
      {members.filter(m => !flagged.includes(m) && !healthy.includes(m)).map(m => (
        <MemberCard key={m.id} member={m} />
      ))}

      {/* Readiness log count */}
      {readinessLogs.length > 0 && (
        <View style={styles.logNote}>
          <Ionicons name="document-text-outline" size={13} color={colours.muted} />
          <Text style={styles.logNoteText}>{readinessLogs.length} readiness logs available for review</Text>
        </View>
      )}
    </Screen>
  );
}

// ── Main screen ──────────────────────────────────────────────────

export function SquadScreen(props: Props) {
  const [mode, setMode] = useState<Mode>(props.initialMode ?? 'pulse');
  const activeMember = props.members[0] ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.switchWrap}>
        <ModeSwitch mode={mode} onChange={setMode} />
      </View>

      {mode === 'pulse' && (
        <SquadPulseView
          members={props.members}
          groups={props.groups}
          workoutCompletions={props.workoutCompletions}
          readinessLogs={props.readinessLogs ?? []}
        />
      )}

      {mode === 'coach' && <InstructorScreen {...props} />}

      {mode === 'member' && (
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
  container:  { flex: 1, backgroundColor: colours.background },
  switchWrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, backgroundColor: colours.background },

  // Header
  header: { gap: 4 },
  kicker: { ...typography.label, color: colours.cyan },
  title:  { color: colours.text, fontSize: 30, lineHeight: 34, fontWeight: '900' },

  // Pulse card
  pulseCard: {
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: radius.sm,
    padding: 14,
    gap: 10,
  },
  pulseTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  pulseBig: { fontSize: 52, fontWeight: '900', lineHeight: 56, fontVariant: ['tabular-nums'] },
  pulseSubLabel: { ...typography.caption, color: colours.muted },
  pulseSide: { flex: 1, gap: 8 },
  pulseStat: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  pulseStatVal: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pulseStatLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2, color: colours.muted, textTransform: 'uppercase' },
  pulseNote: { ...typography.caption, color: colours.muted, lineHeight: 17 },

  // Sections
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: { ...typography.label, color: colours.muted },
  countChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  countText: { fontSize: 10, fontWeight: '900' },

  // Log note
  logNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  logNoteText: { ...typography.caption, color: colours.muted },
});
