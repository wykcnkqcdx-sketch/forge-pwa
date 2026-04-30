import React, { useMemo, useState } from 'react';
import { Alert, Linking, Platform, Text, TextInput, View, StyleSheet, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { buildCoachGuidance, buildProgrammeRecommendation, ProgrammeBuilderInput } from '../lib/aiGuidance';
import { colours } from '../theme';
import { type AssignedExerciseBlock, exerciseLibrary, ExerciseCategory, SquadMember, TrainingGroup, trainingModes, TrainingSession, wearableConnections } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';

interface InstructorScreenProps {
  pinEnabled: boolean;
  sessions: TrainingSession[];
  members: SquadMember[];
  groups: TrainingGroup[];
  readinessLogs: ReadinessLog[];
  workoutCompletions: WorkoutCompletion[];
  onSetPin: () => void;
  onWipe: () => void;
  onExport: () => void;
  onImport: () => void;
  onAddMember: (member: SquadMember) => void;
  onDeleteMember: (id: string) => void;
  onUpdateMember: (id: string, updates: Partial<SquadMember>) => void;
  onAddGroup: (group: TrainingGroup) => void;
  cloudEnabled: boolean;
  cloudStatus: 'local' | 'auth' | 'syncing' | 'synced' | 'error';
  cloudEmail: string | null;
  onCloudSync: () => void;
  onCloudSignOut: () => void;
}

const appInviteUrl = 'https://wykcnkqcdx-sketch.github.io/forge-pwa/';
const assignmentTemplates = [...new Set([...trainingModes.map((mode) => mode.title), 'Recovery Walk', 'Mobility Reset'])];
const assignmentCategories: Array<'All' | ExerciseCategory> = ['All', 'Strength', 'Resistance', 'Cardio', 'Workout', 'Mobility'];

function completionTone(type: WorkoutCompletion['completionType']) {
  if (type === 'quick_log') return colours.amber;
  if (type === 'ad_hoc') return colours.violet;
  return colours.green;
}

function formatReadinessFactor(label: string, log?: ReadinessLog) {
  switch (label) {
    case 'Sleep':
      return log?.sleepHours ? `${log.sleepHours}h` : log?.sleepQuality ? `${log.sleepQuality}/5` : '--';
    case 'Soreness':
      return log?.soreness ? `${log.soreness}/5` : '--';
    case 'Pain':
      return log?.pain ? `${log.pain}/5` : '--';
    case 'Hydration':
      return log?.hydration ?? '--';
    case 'Mood':
      return log?.mood ? `${log.mood}/5` : '--';
    case 'Illness':
      return log?.illness ? `${log.illness}/5` : '--';
    case 'Rest HR':
      return log?.restingHR ? `${log.restingHR}` : '--';
    case 'HRV':
      return log?.hrv ? `${log.hrv}` : '--';
    default:
      return '--';
  }
}

function parseDose(dose: string) {
  const setsRepsMatch = dose.match(/(\d+)\s*x\s*(\d+)/i);
  if (setsRepsMatch) {
    return {
      sets: Number.parseInt(setsRepsMatch[1], 10),
      reps: Number.parseInt(setsRepsMatch[2], 10),
    };
  }

  const minutesMatch = dose.match(/(\d+)\s*mins?/i);
  if (minutesMatch) {
    return {
      durationMinutes: Number.parseInt(minutesMatch[1], 10),
    };
  }

  return {};
}

function buildAssignedExerciseBlock(
  exercise: (typeof exerciseLibrary)[number],
  coachPinned: boolean
): AssignedExerciseBlock {
  const parsedDose = parseDose(exercise.dose);
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    dose: exercise.dose,
    coachPinned,
    prescribed: {
      sets: parsedDose.sets,
      reps: parsedDose.reps,
      load: undefined,
      loadUnit: 'kg',
      durationMinutes: parsedDose.durationMinutes,
      restSeconds: undefined,
    },
    status: 'assigned',
  };
}

export function InstructorScreen({
  pinEnabled,
  sessions,
  members,
  groups,
  readinessLogs,
  workoutCompletions,
  onSetPin,
  onWipe,
  onExport,
  onImport,
  onAddMember,
  onDeleteMember,
  onUpdateMember,
  onAddGroup,
  cloudEnabled,
  cloudStatus,
  cloudEmail,
  onCloudSync,
  onCloudSignOut,
}: InstructorScreenProps) {
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberGymName, setNewMemberGymName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupFocus, setNewGroupFocus] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? 'alpha');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentMemberId, setAssignmentMemberId] = useState('');
  const [assignmentGroupId, setAssignmentGroupId] = useState(groups[0]?.id ?? 'alpha');
  const [assignmentLabel, setAssignmentLabel] = useState(assignmentTemplates[0]);
  const [assignmentFeedback, setAssignmentFeedback] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [stagedAssignmentExercises, setStagedAssignmentExercises] = useState<AssignedExerciseBlock[]>([]);
  const [assignmentCategory, setAssignmentCategory] = useState<'All' | ExerciseCategory>('All');
  const [programmeGoal, setProgrammeGoal] = useState<ProgrammeBuilderInput['goal']>('Tactical Hybrid');
  const [programmeDays, setProgrammeDays] = useState<ProgrammeBuilderInput['daysPerWeek']>(3);
  const [programmeMinutes, setProgrammeMinutes] = useState<ProgrammeBuilderInput['sessionMinutes']>(45);
  const [programmeEquipment, setProgrammeEquipment] = useState<ProgrammeBuilderInput['equipment']>('Full Gym');
  const [programmeReadiness, setProgrammeReadiness] = useState<ProgrammeBuilderInput['readiness']>('Standard');

  const groupScores = useMemo(() => {
    return groups.map((group) => {
      const groupMembers = members.filter((member) => member.groupId === group.id);
      const readiness = groupMembers.length
        ? Math.round(groupMembers.reduce((total: number, member) => total + member.readiness, 0) / groupMembers.length)
        : 0;
      const compliance = groupMembers.length
        ? Math.round(groupMembers.reduce((total: number, member) => total + member.compliance, 0) / groupMembers.length)
        : 0;
      const load = groupMembers.length
        ? Math.round(groupMembers.reduce((total: number, member) => total + member.load, 0) / groupMembers.length)
        : 0;
      const teamScore = Math.round(readiness * 0.5 + compliance * 0.3 + Math.max(0, 100 - load) * 0.2);

      return { ...group, members: groupMembers, readiness, compliance, load, teamScore };
    });
  }, [groups, members]);

  const atRiskCount = useMemo(() => members.filter((member) => member.risk !== 'Low').length, [members]);
  const averageTeamScore = useMemo(() => Math.round(groupScores.reduce((total: number, group) => total + group.teamScore, 0) / groupScores.length) || 0, [groupScores]);
  const coachGuidance = useMemo(() => buildCoachGuidance(members, sessions), [members, sessions]);
  const programmeRecommendation = useMemo(
    () =>
      buildProgrammeRecommendation({
        goal: programmeGoal,
        daysPerWeek: programmeDays,
        sessionMinutes: programmeMinutes,
        equipment: programmeEquipment,
        readiness: programmeReadiness,
      }),
    [programmeDays, programmeEquipment, programmeGoal, programmeMinutes, programmeReadiness]
  );
  const latestCompletionByMember = useMemo(() => {
    const mapped = new Map<string, WorkoutCompletion>();
    workoutCompletions.forEach((completion) => {
      const existing = mapped.get(completion.memberId);
      if (!existing || new Date(completion.completedAt).getTime() > new Date(existing.completedAt).getTime()) {
        mapped.set(completion.memberId, completion);
      }
    });
    return mapped;
  }, [workoutCompletions]);
  const notedCompletions = useMemo(
    () => workoutCompletions.filter((completion) => completion.note?.trim()).slice(0, 6),
    [workoutCompletions]
  );
  const latestReadinessByMember = useMemo(() => {
    const mapped = new Map<string, ReadinessLog>();
    readinessLogs.forEach((log) => {
      if (!log.memberId) return;
      const existing = mapped.get(log.memberId);
      if (!existing || new Date(log.date).getTime() > new Date(existing.date).getTime()) {
        mapped.set(log.memberId, log);
      }
    });
    return mapped;
  }, [readinessLogs]);
  const selectedAssignmentMember = members.find((member) => member.id === assignmentMemberId) ?? null;
  const selectedAssignmentGroup = groups.find((group) => group.id === assignmentGroupId) ?? null;
  const selectedAssignmentMode = trainingModes.find((mode) => mode.title === assignmentLabel) ?? null;
  const suggestedAssignmentExercises = useMemo(() => {
    if (!selectedAssignmentMode) return [];
    return selectedAssignmentMode.defaultExerciseIds
      .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
      .map((exercise) => buildAssignedExerciseBlock(exercise, selectedAssignmentMode.coachPinnedExerciseIds?.includes(exercise.id) ?? false));
  }, [selectedAssignmentMode]);
  const activeAssignmentExercises = stagedAssignmentExercises.length ? stagedAssignmentExercises : suggestedAssignmentExercises;
  const activeAssignmentExerciseIds = activeAssignmentExercises.map((exercise) => exercise.exerciseId);
  const assignmentLibrary = (assignmentCategory === 'All'
    ? exerciseLibrary
    : exerciseLibrary.filter((exercise) => exercise.category === assignmentCategory))
    .filter((exercise) => !selectedAssignmentMode || selectedAssignmentMode.type === 'Run' ? exercise.category === 'Cardio' : true);
  const cloudTone = cloudStatus === 'synced'
    ? colours.green
    : cloudStatus === 'syncing'
      ? colours.cyan
      : cloudStatus === 'error'
        ? colours.red
        : colours.amber;

  function createGroup() {
    const trimmedName = newGroupName.trim();
    const trimmedFocus = newGroupFocus.trim();
    if (!trimmedName) {
      Alert.alert('Team name required', 'Enter a team name before creating a new team.');
      return;
    }

    if (groups.some((group) => group.name.toLowerCase() === trimmedName.toLowerCase())) {
      Alert.alert('Team exists', 'A team with that name already exists.');
      return;
    }

    const nextId = `custom-${Date.now()}`;
    onAddGroup({
      id: nextId,
      name: trimmedName,
      focus: trimmedFocus || 'Custom programme',
      targetScore: 78,
    });
    setSelectedGroupId(nextId);
    setAssignmentGroupId(nextId);
    setNewGroupName('');
    setNewGroupFocus('');
  }

  function confirmDeleteMember(member: SquadMember) {
    const deleteMember = () => {
      onDeleteMember(member.id);
      if (assignmentMemberId === member.id) {
        setAssignmentMemberId('');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${member.name} from the squad dashboard?`)) {
        deleteMember();
      }
      return;
    }

    Alert.alert('Delete member', `Remove ${member.name} from the squad dashboard?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deleteMember },
    ]);
  }

  function addMember() {
    const trimmedName = newMemberName.trim();
    const trimmedGymName = newMemberGymName.trim();
    const trimmedEmail = newMemberEmail.trim().toLowerCase();
    if (!trimmedName) {
      Alert.alert('Name required', 'Enter a team member name before adding them.');
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Email check', 'Enter a valid email address or leave email blank for manual tracking.');
      return;
    }

    const memberId = `member-${Date.now()}`;
    const inviteSubject = 'Join FORGE Tactical Fitness';
    const displayName = trimmedGymName || trimmedName;
    const inviteParams = new URLSearchParams({
      member: memberId,
      name: trimmedName,
      gym: displayName,
      group: selectedGroupId,
    });
    if (trimmedEmail) inviteParams.set('email', trimmedEmail);
    const inviteUrl = `${appInviteUrl}?${inviteParams.toString()}`;
    const inviteBody = `You've been invited by your coach, ${displayName}.\n\nOpen your FORGE member portal here:\n${inviteUrl}\n\nYou will see your assigned training and team progress. Shared login and live team sync still need backend team storage.`;

    onAddMember({
      id: memberId,
      groupId: selectedGroupId,
      name: trimmedName,
      gymName: displayName,
      email: trimmedEmail || undefined,
      readiness: 72,
      compliance: 80,
      risk: 'Low',
      load: 65,
      inviteStatus: trimmedEmail ? 'Invited' : 'Manual',
      ghostMode: false,
      streakDays: 0,
      weeklyVolume: 0,
      hypeCount: 0,
    });

    setNewMemberName('');
    setNewMemberGymName('');
    setNewMemberEmail('');

    if (trimmedEmail) {
      const subject = encodeURIComponent(inviteSubject);
      const body = encodeURIComponent(inviteBody);
      const mailtoUrl = `mailto:${trimmedEmail}?subject=${subject}&body=${body}`;

      if (Platform.OS === 'web') {
        window.location.href = mailtoUrl;
        window.alert(`${displayName} was added. Your email app should open with the invite draft. If it does not, send them this link: ${inviteUrl}`);
        return;
      }

      Linking.openURL(mailtoUrl)
        .then(() => {
          Alert.alert('Member invited', `${displayName} was added and an invite draft was opened.`);
        })
        .catch(() => {
          Alert.alert('Member added', `${displayName} was added. Copy the invite link and send it to ${trimmedEmail}.`);
        });
    } else {
      Alert.alert('Member added', `${displayName} is now tracked manually in this squad.`);
    }
  }

  function handleWearableConnect(name: string, status: string) {
    if (status === 'Planned') {
      Alert.alert('Connection planned', `${name} needs OAuth/API credentials before live sync can be enabled.`);
      return;
    }

    Alert.alert('Connection ready', `${name} can be connected once device permissions are granted.`);
  }

  function showMessage(title: string, message: string) {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  }

  function toggleAssignmentPanel() {
    const nextOpen = !assignmentOpen;
    if (nextOpen) {
      if (!assignmentMemberId && members[0]) {
        setAssignmentMemberId(members[0].id);
      }
      if (!groups.some((group) => group.id === assignmentGroupId) && groups[0]) {
        setAssignmentGroupId(groups[0].id);
      }
      const member = members.find((item) => item.id === assignmentMemberId) ?? members[0];
      const mode = trainingModes.find((item) => item.title === (member?.assignment ?? assignmentLabel)) ?? selectedAssignmentMode ?? trainingModes[0];
      setAssignmentLabel(mode.title);
      setStagedAssignmentExercises(member?.assignmentSession?.exercises ?? mode.defaultExerciseIds
        .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
        .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
        .map((exercise) => buildAssignedExerciseBlock(exercise, mode.coachPinnedExerciseIds?.includes(exercise.id) ?? false)));
      setAssignmentNote(member?.assignmentSession?.coachNote ?? '');
      setAssignmentFeedback('');
    }
    setAssignmentOpen(nextOpen);
  }

  function handleAssignmentTemplateChange(nextLabel: string) {
    setAssignmentLabel(nextLabel);
    const mode = trainingModes.find((item) => item.title === nextLabel);
    setStagedAssignmentExercises(mode?.defaultExerciseIds
      .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
      .map((exercise) => buildAssignedExerciseBlock(exercise, mode.coachPinnedExerciseIds?.includes(exercise.id) ?? false)) ?? []);
  }

  function toggleAssignmentExercise(exerciseId: string) {
    const exercise = exerciseLibrary.find((item) => item.id === exerciseId);
    if (!exercise) return;

    setStagedAssignmentExercises((current) => {
      const exists = current.some((item) => item.exerciseId === exerciseId);
      if (exists) return current.filter((item) => item.exerciseId !== exerciseId);

      return [
        ...current,
        buildAssignedExerciseBlock(exercise, selectedAssignmentMode?.coachPinnedExerciseIds?.includes(exercise.id) ?? false),
      ];
    });
  }

  function updateStagedExercise(exerciseId: string, updates: Partial<AssignedExerciseBlock['prescribed']>) {
    setStagedAssignmentExercises((current) => current.map((exercise) => (
      exercise.exerciseId === exerciseId
        ? {
            ...exercise,
            prescribed: {
              ...exercise.prescribed,
              ...updates,
            },
          }
        : exercise
    )));
  }

  function applyAssignment() {
    if (!members.length) {
      showMessage('No members', 'Add a team member before applying an assignment.');
      return;
    }

    const member = selectedAssignmentMember ?? members[0];
    const group = selectedAssignmentGroup ?? groups[0];
    if (!member || !group) {
      showMessage('Pick a group', 'Create or select a group before applying an assignment.');
      return;
    }

    const assignmentMode = selectedAssignmentMode;
    const chosenExerciseIds = activeAssignmentExerciseIds;
    const chosenExercises = activeAssignmentExercises;
    onUpdateMember(member.id, {
      groupId: group.id,
      assignment: assignmentLabel,
      pinnedExerciseIds: assignmentMode?.coachPinnedExerciseIds?.filter((id) => chosenExerciseIds.includes(id))
        ?? chosenExerciseIds.slice(0, 2),
      assignmentSession: {
        id: `assign-${member.id}-${Date.now()}`,
        title: assignmentLabel,
        type: assignmentMode?.type ?? 'Workout',
        status: 'assigned',
        assignedAt: new Date().toISOString(),
        coachNote: assignmentNote.trim() || undefined,
        exercises: chosenExercises.map((exercise) => ({
          ...exercise,
          coachPinned: assignmentMode?.coachPinnedExerciseIds?.includes(exercise.exerciseId) ?? exercise.coachPinned ?? false,
          status: 'assigned',
        })),
      },
    });
    const message = `${member.name} is now assigned to ${assignmentLabel} in ${group.name}.`;
    setAssignmentMemberId(member.id);
    setAssignmentGroupId(group.id);
    setAssignmentFeedback(message);
    setAssignmentOpen(false);
    setAssignmentNote('');
    setStagedAssignmentExercises([]);
    showMessage('Assignment saved', message);
  }

  function loadProgrammeIntoStage() {
    const mode = trainingModes.find((item) => item.title === programmeRecommendation.assignmentTitle) ?? trainingModes[0];
    const nextExercises = programmeRecommendation.exerciseIds
      .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
      .map((exercise) => buildAssignedExerciseBlock(exercise, mode.coachPinnedExerciseIds?.includes(exercise.id) ?? false));

    setAssignmentLabel(programmeRecommendation.assignmentTitle);
    setAssignmentNote(programmeRecommendation.coachNote);
    setStagedAssignmentExercises(nextExercises);
    setAssignmentOpen(true);
    if (!assignmentMemberId && members[0]) setAssignmentMemberId(members[0].id);
    if (!assignmentGroupId && groups[0]) setAssignmentGroupId(groups[0].id);
    setAssignmentFeedback(`AI plan loaded: ${programmeRecommendation.assignmentTitle}. Review the staged session, then deploy.`);
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.muted}>Coach console</Text>
          <Text style={styles.title}>Squad Dashboard</Text>
        </View>
      </View>

      <Card>
        <Text style={styles.cardTitle}>Security & Backup</Text>
        <View style={styles.actionGrid}>
          <Pressable onPress={onSetPin} style={[styles.actionButton, { borderColor: `${colours.amber}40`, backgroundColor: colours.amberDim }]}>
            <Text style={[styles.actionLabel, { color: colours.amber }]}>{pinEnabled ? 'Change PIN' : 'Set PIN'}</Text>
            <Text style={styles.actionMeta}>{pinEnabled ? 'App lock active' : 'Local app lock'}</Text>
          </Pressable>
          <Pressable onPress={onExport} style={[styles.actionButton, { borderColor: `${colours.cyan}40`, backgroundColor: colours.cyanDim }]}>
            <Text style={[styles.actionLabel, { color: colours.cyan }]}>Export</Text>
            <Text style={styles.actionMeta}>Download backup</Text>
          </Pressable>
          <Pressable onPress={onImport} style={[styles.actionButton, { borderColor: `${colours.green}40`, backgroundColor: colours.greenDim }]}>
            <Text style={[styles.actionLabel, { color: colours.green }]}>Import</Text>
            <Text style={styles.actionMeta}>Restore backup</Text>
          </Pressable>
          <Pressable onPress={onWipe} style={[styles.actionButton, { borderColor: `${colours.red}40`, backgroundColor: colours.redDim }]}>
            <Text style={[styles.actionLabel, { color: colours.red }]}>Wipe</Text>
            <Text style={styles.actionMeta}>Clear local data</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Cloud Access</Text>
          <View style={styles.cloudActions}>
            {cloudEnabled ? (
              <Pressable
                style={[
                  styles.cloudSyncButton,
                  (!cloudEmail || cloudStatus === 'syncing') && styles.cloudSyncButtonDisabled,
                ]}
                onPress={onCloudSync}
                disabled={!cloudEmail || cloudStatus === 'syncing'}
              >
                <Text style={styles.cloudSyncText}>{cloudStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}</Text>
              </Pressable>
            ) : null}
            {cloudEnabled && cloudEmail ? (
              <Pressable style={styles.cloudSignOutButton} onPress={onCloudSignOut}>
                <Text style={styles.cloudSignOutText}>Sign Out</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={[styles.cloudBadge, { borderColor: `${cloudTone}40`, backgroundColor: `${cloudTone}12` }]}>
          <Text style={[styles.cloudBadgeText, { color: cloudTone }]}>
            {cloudEnabled ? cloudStatus.toUpperCase() : 'LOCAL ONLY'}
          </Text>
        </View>
        <Text style={styles.cloudCopy}>
          {cloudEnabled
            ? cloudEmail
              ? `${cloudEmail} is connected. Sessions, members, and completions auto-sync when the connection is healthy. Use Sync Now anytime you want an immediate refresh.`
              : 'Backend keys are configured. Sign in to enable auth, database sync, and shared team storage.'
            : 'Add Supabase keys to enable login auth and cloud database sync. Until then, the app keeps working from local storage.'}
        </Text>
      </Card>

      <View style={styles.grid}>
        <MetricCard icon="people" label="Members" value={`${members.length}`} sub="active squad" />
        <MetricCard icon="podium" label="Team Score" value={`${averageTeamScore}`} sub={`${atRiskCount} need review`} tone={atRiskCount > 2 ? colours.amber : colours.green} />
      </View>

      <Card style={{ ...styles.aiCard, borderColor: `${coachGuidance.tone}40` }}>
        <Text style={[styles.cardTitle, { color: coachGuidance.tone }]}>AI Coach Guidance</Text>
        <Text style={styles.aiSummary}>{coachGuidance.summary}</Text>
        <Text style={styles.aiAction}>{coachGuidance.action}</Text>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Member Completions</Text>
          <Text style={styles.muted}>latest {Math.min(5, workoutCompletions.length)}</Text>
        </View>
        {workoutCompletions.length ? workoutCompletions.slice(0, 5).map((completion) => (
          <View key={completion.id} style={styles.completionRow}>
            <View style={styles.memberCopy}>
              <View style={styles.completionHeader}>
                <Text style={styles.memberName}>{completion.memberName}</Text>
                <View
                  style={[
                    styles.completionBadge,
                    {
                      borderColor: `${completionTone(completion.completionType)}50`,
                      backgroundColor: `${completionTone(completion.completionType)}12`,
                    },
                  ]}
                >
                  <Text style={[styles.completionBadgeText, { color: completionTone(completion.completionType) }]}>
                    {completion.completionType === 'quick_log' ? 'QUICK LOG' : completion.completionType.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.muted}>
                {completion.assignment} - {completion.sessionKind} - {completion.durationMinutes} min - {completion.effort} - +{completion.volume}
              </Text>
              {completion.note && <Text style={styles.memberNote}>Note: {completion.note}</Text>}
            </View>
            <Text style={styles.completionTime}>
              {new Date(completion.completedAt).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )) : (
          <Text style={styles.inviteHelp}>No member workout completions yet.</Text>
        )}
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Coach Notes</Text>
          <Text style={styles.muted}>{notedCompletions.length ? `latest ${notedCompletions.length}` : 'no notes yet'}</Text>
        </View>
        {notedCompletions.length ? notedCompletions.map((completion) => (
          <View key={`note-${completion.id}`} style={styles.noteRow}>
            <View style={styles.memberCopy}>
              <Text style={styles.memberName}>{completion.memberName}</Text>
              <Text style={styles.muted}>
                {completion.assignment} - {completion.durationMinutes} min - {completion.effort}
              </Text>
              <Text style={styles.coachMessage}>{completion.note}</Text>
            </View>
            <Text style={styles.completionTime}>
              {new Date(completion.completedAt).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )) : (
          <Text style={styles.inviteHelp}>Member notes will show up here after they finish a workout or quick log.</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Add Team Member</Text>
        <TextInput
          style={styles.memberInput}
          value={newMemberName}
          onChangeText={setNewMemberName}
          placeholder="Name or callsign"
          placeholderTextColor={colours.soft}
        />
        <TextInput
          style={styles.memberInput}
          value={newMemberGymName}
          onChangeText={setNewMemberGymName}
          placeholder="Gym name for member portal"
          placeholderTextColor={colours.soft}
        />
        <TextInput
          style={styles.memberInput}
          value={newMemberEmail}
          onChangeText={setNewMemberEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="Email for invite link"
          placeholderTextColor={colours.soft}
        />
        <View style={styles.groupPicker}>
          {groups.map((group) => {
            const isActive = group.id === selectedGroupId;
            return (
              <Pressable
                key={group.id}
                style={[styles.groupPickerPill, isActive && styles.groupPickerPillActive]}
                onPress={() => setSelectedGroupId(group.id)}
              >
                <Text style={[styles.groupPickerText, isActive && styles.groupPickerTextActive]}>{group.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable style={styles.addMemberButton} onPress={addMember}>
          <Text style={styles.addMemberButtonText}>{newMemberEmail.trim() ? 'Add & Invite Member' : 'Add Manual Member'}</Text>
        </Pressable>
        <Text style={styles.inviteHelp}>
          Email sends the live app link. They can open/install the PWA, but shared logins and automatic team sync need a backend next.
        </Text>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Groups</Text>
        </View>
        <TextInput
          style={styles.memberInput}
          value={newGroupName}
          onChangeText={setNewGroupName}
          placeholder="New team name, e.g. Delta"
          placeholderTextColor={colours.soft}
        />
        <TextInput
          style={styles.memberInput}
          value={newGroupFocus}
          onChangeText={setNewGroupFocus}
          placeholder="Focus, e.g. Ruck recovery"
          placeholderTextColor={colours.soft}
        />
        <Pressable style={styles.addMemberButton} onPress={createGroup}>
          <Text style={styles.addMemberButtonText}>Create Team</Text>
        </Pressable>
        {groupScores.map((group) => {
          const scoreColour = group.teamScore >= group.targetScore ? colours.green : group.teamScore >= 65 ? colours.amber : colours.red;
          return (
            <View key={group.id} style={styles.groupCard}>
              <View style={styles.groupTop}>
                <View style={styles.memberCopy}>
                  <Text style={styles.memberName}>{group.name}</Text>
                  <Text style={styles.muted}>
                    {group.focus} - {group.members.length || 'No'} members
                  </Text>
                </View>
                <View style={styles.groupScore}>
                  <Text style={[styles.memberScore, { color: scoreColour }]}>{group.teamScore}</Text>
                  <Text style={styles.scoreMeta}>TEAM</Text>
                </View>
              </View>
              <ProgressBar value={group.teamScore} colour={scoreColour} />
              <View style={styles.groupStats}>
                <Text style={styles.groupStat}>Ready {group.readiness}</Text>
                <Text style={styles.groupStat}>Comply {group.compliance}%</Text>
                <Text style={styles.groupStat}>Load {group.load}</Text>
              </View>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Wearable Connections</Text>
        {wearableConnections.map((connection) => {
          const statusColour = connection.status === 'Connected'
            ? colours.green
            : connection.status === 'Ready'
              ? colours.cyan
              : colours.amber;

          return (
            <View key={connection.id} style={styles.connectionRow}>
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{connection.name}</Text>
                <Text style={styles.muted}>{connection.signal}</Text>
              </View>
              <Pressable
                style={[styles.connectionBadge, { borderColor: `${statusColour}50`, backgroundColor: `${statusColour}12` }]}
                onPress={() => handleWearableConnect(connection.name, connection.status)}
              >
                <Text style={[styles.connectionText, { color: statusColour }]}>{connection.status}</Text>
              </Pressable>
            </View>
          );
        })}
        <Text style={styles.connectionNote}>
          Apple Health can work through device permissions. Garmin, Fitbit, and Strava need OAuth/API setup before live sync.
        </Text>
      </Card>

      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Squad Readiness</Text>
          <Pressable style={styles.assignButton} onPress={toggleAssignmentPanel}>
            <Text style={styles.assignButtonText}>{assignmentOpen ? 'Close' : 'Assign'}</Text>
          </Pressable>
        </View>
        {assignmentFeedback ? (
          <View style={styles.assignmentFeedback}>
            <Text style={styles.assignmentFeedbackText}>{assignmentFeedback}</Text>
          </View>
        ) : null}

        {assignmentOpen ? (
          <View style={styles.assignmentPanel}>
            <Text style={styles.assignmentLabel}>Select member</Text>
            <View style={styles.assignmentWrap}>
              {members.length ? members.map((member) => {
                const active = member.id === assignmentMemberId;
                return (
                  <Pressable
                    key={member.id}
                    style={[styles.assignmentPill, active && styles.assignmentPillActive]}
                    onPress={() => setAssignmentMemberId(member.id)}
                  >
                    <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{member.name}</Text>
                  </Pressable>
                );
              }) : <Text style={styles.emptyAssignmentText}>Add a member first.</Text>}
            </View>

            <Text style={styles.assignmentLabel}>Assign to group</Text>
            <View style={styles.assignmentWrap}>
              {groups.map((group) => {
                const active = group.id === assignmentGroupId;
                return (
                  <Pressable
                    key={group.id}
                    style={[styles.assignmentPill, active && styles.assignmentPillActive]}
                    onPress={() => setAssignmentGroupId(group.id)}
                  >
                    <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{group.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.assignmentLabel}>Training block</Text>
            <View style={styles.assignmentWrap}>
              {assignmentTemplates.map((item) => {
                const active = item === assignmentLabel;
                return (
                  <Pressable
                    key={item}
                    style={[styles.assignmentPill, active && styles.assignmentPillActive]}
                    onPress={() => handleAssignmentTemplateChange(item)}
                  >
                    <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.assignmentLabel}>Exercise category</Text>
            <View style={styles.assignmentWrap}>
              {assignmentCategories.map((item) => {
                const active = item === assignmentCategory;
                return (
                  <Pressable
                    key={item}
                    style={[styles.assignmentPill, active && styles.assignmentPillActive]}
                    onPress={() => setAssignmentCategory(item)}
                  >
                    <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.assignmentLabel}>Select exercises for this member</Text>
            <View style={styles.assignmentExerciseList}>
              {assignmentLibrary.map((exercise) => {
                const active = activeAssignmentExerciseIds.includes(exercise.id);
                const coachPick = selectedAssignmentMode?.coachPinnedExerciseIds?.includes(exercise.id);
                return (
                  <Pressable
                    key={exercise.id}
                    style={[styles.assignmentExerciseItem, active && styles.assignmentExerciseItemActive]}
                    onPress={() => toggleAssignmentExercise(exercise.id)}
                  >
                    <View style={styles.memberCopy}>
                      <Text style={[styles.memberName, active && styles.assignmentExerciseNameActive]}>{exercise.name}</Text>
                      <Text style={styles.muted}>{exercise.category} - {exercise.dose}</Text>
                    </View>
                    <View style={styles.assignmentExerciseRight}>
                      {coachPick ? <Text style={styles.assignmentCoachPick}>Coach Pick</Text> : null}
                      <Text style={[styles.assignmentSelectText, active && styles.assignmentSelectTextActive]}>{active ? 'Selected' : 'Select'}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.assignmentLabel}>Coach note</Text>
            <TextInput
              style={[styles.memberInput, styles.assignmentNoteInput]}
              value={assignmentNote}
              onChangeText={setAssignmentNote}
              placeholder="What should this member focus on today?"
              placeholderTextColor={colours.soft}
              multiline
            />

            <Text style={styles.assignmentLabel}>Staged session</Text>
            {activeAssignmentExercises.length ? (
              <View style={styles.stageList}>
                {activeAssignmentExercises.map((exercise) => (
                  <View key={exercise.exerciseId} style={styles.stageCard}>
                    <View style={styles.stageHeader}>
                      <View style={styles.memberCopy}>
                        <Text style={styles.memberName}>{exercise.name}</Text>
                        <Text style={styles.muted}>{exercise.dose}</Text>
                      </View>
                      <Pressable style={styles.stageRemove} onPress={() => toggleAssignmentExercise(exercise.exerciseId)}>
                        <Text style={styles.stageRemoveText}>Remove</Text>
                      </Pressable>
                    </View>
                    <View style={styles.stageInputs}>
                      <View style={styles.stageInputBlock}>
                        <Text style={styles.stageInputLabel}>Sets</Text>
                        <TextInput
                          style={styles.stageInput}
                          value={exercise.prescribed?.sets ? String(exercise.prescribed.sets) : ''}
                          onChangeText={(value) => updateStagedExercise(exercise.exerciseId, { sets: value ? Number.parseInt(value.replace(/[^0-9]/g, ''), 10) : undefined })}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={colours.soft}
                        />
                      </View>
                      <View style={styles.stageInputBlock}>
                        <Text style={styles.stageInputLabel}>Reps</Text>
                        <TextInput
                          style={styles.stageInput}
                          value={exercise.prescribed?.reps ? String(exercise.prescribed.reps) : ''}
                          onChangeText={(value) => updateStagedExercise(exercise.exerciseId, { reps: value ? Number.parseInt(value.replace(/[^0-9]/g, ''), 10) : undefined })}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={colours.soft}
                        />
                      </View>
                      <View style={styles.stageInputBlock}>
                        <Text style={styles.stageInputLabel}>Load</Text>
                        <TextInput
                          style={styles.stageInput}
                          value={exercise.prescribed?.load ? String(exercise.prescribed.load) : ''}
                          onChangeText={(value) => updateStagedExercise(exercise.exerciseId, { load: value ? Number.parseInt(value.replace(/[^0-9]/g, ''), 10) : undefined })}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={colours.soft}
                        />
                      </View>
                      <View style={styles.stageInputBlock}>
                        <Text style={styles.stageInputLabel}>Min</Text>
                        <TextInput
                          style={styles.stageInput}
                          value={exercise.prescribed?.durationMinutes ? String(exercise.prescribed.durationMinutes) : ''}
                          onChangeText={(value) => updateStagedExercise(exercise.exerciseId, { durationMinutes: value ? Number.parseInt(value.replace(/[^0-9]/g, ''), 10) : undefined })}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={colours.soft}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyAssignmentText}>Add exercises to the staged session before deploy.</Text>
            )}

            <View style={styles.assignmentSummary}>
              <Text style={styles.assignmentSummaryText}>
                {selectedAssignmentMember?.name ?? members[0]?.name ?? 'No member'} {'->'} {selectedAssignmentGroup?.name ?? groups[0]?.name ?? 'No group'} / {assignmentLabel} / {activeAssignmentExerciseIds.length} exercises
              </Text>
            </View>

            <Pressable style={styles.applyAssignmentButton} onPress={applyAssignment}>
              <Text style={styles.applyAssignmentText}>Apply Assignment</Text>
            </Pressable>
          </View>
        ) : null}

        {members.map((member) => {
          const latestCompletion = latestCompletionByMember.get(member.id);
          const latestTone = latestCompletion ? completionTone(latestCompletion.completionType) : colours.borderSoft;
          const latestReadiness = latestReadinessByMember.get(member.id);

          return (
          <View key={member.id} style={styles.memberCard}>
            {latestCompletion ? (
              <View style={[styles.memberCompletionBanner, { borderColor: `${latestTone}50`, backgroundColor: `${latestTone}12` }]}>
                <Text style={[styles.memberCompletionBannerText, { color: latestTone }]}>
                  Completed {latestCompletion.assignment} - {latestCompletion.durationMinutes} min - {latestCompletion.effort}
                </Text>
              </View>
            ) : null}
            <View style={styles.headerRow}>
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.muted}>
                  {groups.find((group) => group.id === member.groupId)?.name ?? 'Unassigned'} - {member.inviteStatus ?? 'Manual'} - Compliance {member.compliance}% - Risk {member.risk}
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
                <Text
                  style={[
                    styles.memberScore,
                    member.readiness < 50
                      ? { color: colours.red }
                      : member.readiness < 70
                        ? { color: colours.amber }
                        : { color: colours.cyan },
                  ]}
                >
                  {member.readiness}
                </Text>
                <Pressable style={styles.deleteMemberButton} onPress={() => confirmDeleteMember(member)}>
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
        })}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Programme Builder</Text>
        <Text style={styles.programmeCopy}>
          AI-assisted programme planning grounded in progressive overload, movement balance, and appropriate weekly volume.
        </Text>

        <Text style={styles.assignmentLabel}>Goal</Text>
        <View style={styles.assignmentWrap}>
          {(['Strength Base', 'Hypertrophy', 'Conditioning', 'Recovery', 'Tactical Hybrid'] as const).map((item) => {
            const active = item === programmeGoal;
            return (
              <Pressable
                key={item}
                style={[styles.assignmentPill, active && styles.assignmentPillActive]}
                onPress={() => setProgrammeGoal(item)}
              >
                <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.assignmentLabel}>Days per week</Text>
        <View style={styles.assignmentWrap}>
          {[2, 3, 4, 5].map((item) => {
            const active = item === programmeDays;
            return (
              <Pressable
                key={item}
                style={[styles.assignmentPill, active && styles.assignmentPillActive]}
                onPress={() => setProgrammeDays(item as ProgrammeBuilderInput['daysPerWeek'])}
              >
                <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item} days</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.assignmentLabel}>Session length</Text>
        <View style={styles.assignmentWrap}>
          {[30, 45, 60].map((item) => {
            const active = item === programmeMinutes;
            return (
              <Pressable
                key={item}
                style={[styles.assignmentPill, active && styles.assignmentPillActive]}
                onPress={() => setProgrammeMinutes(item as ProgrammeBuilderInput['sessionMinutes'])}
              >
                <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item} min</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.assignmentLabel}>Equipment</Text>
        <View style={styles.assignmentWrap}>
          {(['Full Gym', 'Minimal Kit', 'Bodyweight'] as const).map((item) => {
            const active = item === programmeEquipment;
            return (
              <Pressable
                key={item}
                style={[styles.assignmentPill, active && styles.assignmentPillActive]}
                onPress={() => setProgrammeEquipment(item)}
              >
                <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.assignmentLabel}>Readiness mode</Text>
        <View style={styles.assignmentWrap}>
          {(['Conservative', 'Standard', 'Push'] as const).map((item) => {
            const active = item === programmeReadiness;
            return (
              <Pressable
                key={item}
                style={[styles.assignmentPill, active && styles.assignmentPillActive]}
                onPress={() => setProgrammeReadiness(item)}
              >
                <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.programmeInsight, { borderColor: `${programmeRecommendation.tone}40`, backgroundColor: `${programmeRecommendation.tone}10` }]}>
          <Text style={[styles.programmeTitle, { color: programmeRecommendation.tone }]}>{programmeRecommendation.assignmentTitle}</Text>
          <Text style={styles.programmeText}>{programmeRecommendation.summary}</Text>
          <Text style={styles.programmeMeta}>Rationale: {programmeRecommendation.rationale}</Text>
          <Text style={styles.programmeMeta}>Weekly target: {programmeRecommendation.weeklyVolume}</Text>
          <Text style={styles.programmeMeta}>Intensity: {programmeRecommendation.intensity}</Text>
          <Text style={styles.programmeMeta}>Coach cue: {programmeRecommendation.coachNote}</Text>
        </View>

        <View style={styles.programmeScienceList}>
          {programmeRecommendation.scienceNotes.map((item) => (
            <View key={item} style={styles.programmeScienceRow}>
              <Text style={styles.programmeScienceBullet}>+</Text>
              <Text style={styles.programmeScienceText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.programmeExerciseGrid}>
          {programmeRecommendation.exerciseIds.map((id) => {
            const exercise = exerciseLibrary.find((item) => item.id === id);
            if (!exercise) return null;
            return (
              <View key={id} style={styles.programmeExerciseChip}>
                <Text style={styles.programmeExerciseName}>{exercise.name}</Text>
                <Text style={styles.programmeExerciseDose}>{exercise.dose}</Text>
              </View>
            );
          })}
        </View>

        <Pressable style={styles.programmeLoadButton} onPress={loadProgrammeIntoStage}>
          <Text style={styles.programmeLoadButtonText}>Load AI Plan Into Stage</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colours.muted, fontSize: 13 },
  title: { color: colours.text, fontSize: 32, fontWeight: '900', marginBottom: 16 },
  grid: { flexDirection: 'row', gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: 12 },
  cardTitleFlush: { marginBottom: 0 },
  cloudActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createButton: {
    borderWidth: 1,
    borderColor: `${colours.cyan}50`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colours.cyanDim,
  },
  createButtonText: { color: colours.cyan, fontSize: 12, fontWeight: '900' },
  assignButton: { backgroundColor: colours.cyan, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14 },
  assignButtonText: { color: '#07111E', fontWeight: '900' },
  cloudSyncButton: {
    borderWidth: 1,
    borderColor: `${colours.cyan}40`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colours.cyanDim,
  },
  cloudSyncButtonDisabled: {
    opacity: 0.45,
  },
  cloudSyncText: { color: colours.cyan, fontSize: 12, fontWeight: '900' },
  cloudSignOutButton: {
    borderWidth: 1,
    borderColor: `${colours.red}40`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colours.redDim,
  },
  cloudSignOutText: { color: colours.red, fontSize: 12, fontWeight: '900' },
  cloudBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cloudBadgeText: { fontSize: 11, fontWeight: '900' },
  cloudCopy: { color: colours.textSoft, fontSize: 13, lineHeight: 19, marginTop: 10 },
  aiCard: {
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  aiSummary: { color: colours.text, fontSize: 14, lineHeight: 20 },
  aiAction: { color: colours.textSoft, fontSize: 13, lineHeight: 19, marginTop: 10 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionButton: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 74,
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '900' },
  actionMeta: { color: colours.muted, fontSize: 11, marginTop: 4 },
  memberInput: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    color: colours.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  groupPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  groupPickerPill: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  groupPickerPillActive: {
    borderColor: `${colours.cyan}70`,
    backgroundColor: colours.cyanDim,
  },
  groupPickerText: { color: colours.muted, fontSize: 11, fontWeight: '900' },
  groupPickerTextActive: { color: colours.cyan },
  addMemberButton: {
    alignItems: 'center',
    backgroundColor: colours.cyan,
    borderRadius: 14,
    paddingVertical: 12,
  },
  addMemberButtonText: { color: colours.background, fontSize: 14, fontWeight: '900' },
  inviteHelp: { color: colours.textSoft, fontSize: 12, lineHeight: 18, marginTop: 10 },
  assignmentPanel: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 12,
  },
  assignmentLabel: { color: colours.muted, fontSize: 11, fontWeight: '900', marginBottom: 8 },
  assignmentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  assignmentExerciseList: { gap: 8, marginBottom: 12 },
  assignmentExerciseItem: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  assignmentExerciseItemActive: {
    borderColor: `${colours.cyan}70`,
    backgroundColor: colours.cyanDim,
  },
  assignmentExerciseRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  assignmentCoachPick: {
    color: colours.amber,
    fontSize: 10,
    fontWeight: '900',
  },
  assignmentSelectText: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  assignmentSelectTextActive: {
    color: colours.cyan,
  },
  assignmentExerciseNameActive: {
    color: colours.cyan,
  },
  assignmentNoteInput: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  stageList: {
    gap: 8,
    marginBottom: 12,
  },
  stageCard: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  stageRemove: {
    borderWidth: 1,
    borderColor: `${colours.red}40`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colours.redDim,
  },
  stageRemoveText: {
    color: colours.red,
    fontSize: 11,
    fontWeight: '900',
  },
  stageInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  stageInputBlock: {
    flex: 1,
  },
  stageInputLabel: {
    color: colours.muted,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 6,
  },
  stageInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    color: colours.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '800',
  },
  assignmentPill: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  assignmentPillActive: {
    borderColor: `${colours.cyan}70`,
    backgroundColor: colours.cyanDim,
  },
  assignmentPillText: { color: colours.muted, fontSize: 11, fontWeight: '900' },
  assignmentPillTextActive: { color: colours.cyan },
  assignmentFeedback: {
    borderWidth: 1,
    borderColor: `${colours.green}50`,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colours.greenDim,
    marginBottom: 12,
  },
  assignmentFeedbackText: { color: colours.green, fontSize: 12, fontWeight: '900' },
  assignmentSummary: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.16)',
    marginBottom: 12,
  },
  assignmentSummaryText: { color: colours.textSoft, fontSize: 12, fontWeight: '900' },
  emptyAssignmentText: { color: colours.muted, fontSize: 12, fontWeight: '800' },
  applyAssignmentButton: {
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colours.cyan,
    paddingVertical: 12,
  },
  applyAssignmentText: { color: colours.background, fontSize: 14, fontWeight: '900' },
  memberCard: {
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    backgroundColor: 'rgba(0,0,0,0.18)',
    marginBottom: 10,
  },
  memberCopy: { flex: 1 },
  memberName: { color: colours.text, fontWeight: '900' },
  memberPortalName: { color: colours.amber, fontSize: 11, fontWeight: '800', marginTop: 3 },
  memberEmail: { color: colours.cyan, fontSize: 11, fontWeight: '800', marginTop: 3 },
  memberDeviceSync: { color: colours.violet, fontSize: 11, fontWeight: '800', marginTop: 3 },
  memberAssignment: { color: colours.green, fontSize: 11, fontWeight: '800', marginTop: 3 },
  memberAssignmentStatus: { color: colours.amber, fontSize: 11, fontWeight: '800', marginTop: 3 },
  memberExerciseMeta: { color: colours.cyan, fontSize: 11, fontWeight: '700', marginTop: 3 },
  memberPainArea: { color: colours.red, fontSize: 11, fontWeight: '800', marginTop: 3 },
  memberNote: { color: colours.textSoft, fontSize: 11, fontWeight: '700', marginTop: 3 },
  memberScore: { fontSize: 22, fontWeight: '900' },
  memberActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  deleteMemberButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: `${colours.red}50`,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.redDim,
  },
  deleteMemberText: { color: colours.red, fontSize: 12, fontWeight: '900' },
  factorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  factorItem: { flex: 1, minWidth: '22%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  factorLabel: { color: colours.muted, fontSize: 9, fontWeight: '800', marginBottom: 2 },
  factorValue: { color: colours.text, fontSize: 12, fontWeight: '900' },
  readinessStamp: { color: colours.muted, fontSize: 11, fontWeight: '700', marginTop: 8 },
  groupCard: {
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    backgroundColor: 'rgba(0,0,0,0.18)',
    marginBottom: 10,
  },
  groupTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  groupScore: { alignItems: 'flex-end' },
  scoreMeta: { color: colours.soft, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  groupStats: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  groupStat: { color: colours.muted, fontSize: 11, fontWeight: '800' },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 9,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  connectionBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  connectionText: { fontSize: 10, fontWeight: '900' },
  connectionNote: { color: colours.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  completionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
    paddingVertical: 10,
  },
  noteRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
    paddingVertical: 10,
  },
  coachMessage: {
    color: colours.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    marginTop: 5,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  completionBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  completionBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  memberCompletionBanner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  memberCompletionBannerText: {
    fontSize: 11,
    fontWeight: '900',
  },
  memberCompletionMeta: {
    color: colours.amber,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  completionTime: { color: colours.cyan, fontSize: 11, fontWeight: '900', textAlign: 'right' },
  programmeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  programmeCopy: { color: colours.textSoft, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  programmeInsight: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  programmeTitle: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  programmeText: { color: colours.text, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  programmeMeta: { color: colours.textSoft, fontSize: 12, lineHeight: 18, marginTop: 8 },
  programmeScienceList: { gap: 8, marginTop: 12 },
  programmeScienceRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  programmeScienceBullet: { color: colours.cyan, fontSize: 12, fontWeight: '900', marginTop: 1 },
  programmeScienceText: { flex: 1, color: colours.textSoft, fontSize: 12, lineHeight: 18, fontWeight: '800' },
  programmeExerciseGrid: { gap: 8, marginTop: 12 },
  programmeExerciseChip: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  programmeExerciseName: { color: colours.text, fontSize: 13, fontWeight: '900' },
  programmeExerciseDose: { color: colours.muted, fontSize: 11, fontWeight: '800', marginTop: 4 },
  programmeLoadButton: {
    alignItems: 'center',
    backgroundColor: colours.green,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  programmeLoadButtonText: { color: colours.background, fontSize: 14, fontWeight: '900' },
});
