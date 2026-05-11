import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Text, TextInput, View, StyleSheet, Pressable, FlatList } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { buildCoachGuidance } from '../lib/aiGuidance';
import { colours } from '../theme';
import { type AssignedExerciseBlock, exerciseLibrary, ExerciseCategory, ProgrammeTemplate, SquadMember, TrainingGroup, trainingModes, TrainingSession, wearableConnections } from '../data/mockData';
import type { AssignmentDeployment, ReadinessLog, WorkoutCompletion } from '../data/domain';
import { showAlert, showConfirm } from '../lib/dialogs';
import { createCloudMemberInvite } from '../lib/cloudInvites';
import { clearLatestInviteLink, loadLatestInviteLink, saveLatestInviteLink, type LatestInviteLink } from '../lib/latestInviteLink';
import type { CloudInvite, CloudTeamPulse } from '../lib/squadCloud';
import { SquadMemberCard, completionTone } from '../components/SquadMemberCard';
import { ProgrammeBuilder } from '../components/ProgrammeBuilder';
import { buildAssignmentDeliveryHealth, buildAssignmentDeliveryRows, firstAssignmentWithLocalOnly, firstAssignmentWithPending } from '../utils/assignmentDelivery';
import { buildInviteHealth, displayInviteStatus } from '../utils/inviteHealth';
import { cloudInviteLabel, countCloudInvites, filterCloudInvites, firstStaleCloudInvite, type CloudInviteFilter } from '../utils/inviteQueue';
import { groupInviteLifecycle } from '../utils/inviteLifecycle';

interface InstructorScreenProps {
  pinEnabled: boolean;
  sessions: TrainingSession[];
  members: SquadMember[];
  groups: TrainingGroup[];
  programmeTemplates: ProgrammeTemplate[];
  readinessLogs: ReadinessLog[];
  workoutCompletions: WorkoutCompletion[];
  assignmentDeployments?: AssignmentDeployment[];
  onSetPin: () => void;
  onWipe: () => void;
  onExport: () => void;
  onImport: () => void;
  onAddMember: (member: SquadMember) => void;
  onDeleteMember: (id: string) => void;
  onUpdateMember: (id: string, updates: Partial<SquadMember>) => void;
  onAddAssignmentDeployment?: (deployment: AssignmentDeployment) => void;
  onAddGroup: (group: TrainingGroup) => void;
  onAddProgrammeTemplate: (template: ProgrammeTemplate) => void;
  onDeleteProgrammeTemplate: (id: string) => void;
  cloudEnabled: boolean;
  cloudStatus: 'local' | 'auth' | 'syncing' | 'synced' | 'error';
  cloudEmail: string | null;
  cloudSquadId?: string | null;
  cloudTeamPulse?: CloudTeamPulse | null;
  cloudInvites?: CloudInvite[];
  pendingSyncCount?: number;
  onCloudSync: () => void;
  onCloudSignOut: () => void;
  onRevokeCloudInvite?: (inviteId: string) => Promise<void>;
  googleSheetsEndpoint: string;
  onChangeGoogleSheetsEndpoint: (value: string) => void;
  onExportGoogleSheets: () => void;
  googleSheetsExporting: boolean;
  googleSheetsMessage: string;
}

const appInviteUrl = 'https://wykcnkqcdx-sketch.github.io/forge-pwa/';
const assignmentTemplates = [...new Set([...trainingModes.map((mode) => mode.title), 'Recovery Walk', 'Mobility Reset'])];
const assignmentCategories: Array<'All' | ExerciseCategory> = ['All', 'Strength', 'Resistance', 'Cardio', 'Workout', 'Mobility'];
const coachNudgeTemplates = {
  recovery: {
    label: 'Recovery Walk',
    note: 'Recovery priority today: easy walk only, nasal-breathing pace, stop if pain climbs. Log how it felt.',
    exerciseIds: ['zone-2-run', 'mobility-reset', 'calf-ankle-rock'],
  },
  mobility: {
    label: 'Mobility Reset',
    note: 'Mobility priority today: move slowly, avoid painful range, and note any area that still feels restricted.',
    exerciseIds: ['mobility-reset', 'hip-airplane', 'thoracic-rotation', 'calf-ankle-rock'],
  },
} as const;

function createUuid() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

function inferAssignmentType(title: string): TrainingSession['type'] {
  const normalized = title.toLowerCase();
  if (normalized.includes('ruck')) return 'Ruck';
  if (normalized.includes('run')) return 'Run';
  if (normalized.includes('cardio')) return 'Cardio';
  if (normalized.includes('strength')) return 'Strength';
  if (normalized.includes('resistance')) return 'Resistance';
  if (normalized.includes('mobility') || normalized.includes('recovery')) return 'Mobility';
  return 'Workout';
}

function assignmentTargetState(member: SquadMember | null, cloudEnabled: boolean) {
  if (!member) return { label: 'No target', detail: 'Pick a member before applying this assignment.', tone: colours.muted };
  if (member.cloudMembershipId) {
    return {
      label: 'Cloud-ready target',
      detail: `Assignment will sync to member portal ${member.cloudMembershipId.slice(0, 8)}...`,
      tone: colours.green,
    };
  }
  if (!cloudEnabled) return { label: 'Local target', detail: 'Cloud is not configured, so this stays on this device.', tone: colours.muted };
  if (member.inviteStatus === 'Invited') return { label: 'Invite pending', detail: 'Member must accept their secure invite before cloud delivery.', tone: colours.amber };
  if (member.inviteStatus === 'Joined') return { label: 'Accepted, sync needed', detail: 'Use Sync Now to attach the cloud membership target.', tone: colours.cyan };
  return { label: 'Manual/local target', detail: 'Create a secure invite before assigning across devices.', tone: colours.textSoft };
}

type AssignmentScope = 'member' | 'group' | 'squad';
type DeliveryFocus = 'localOnly' | 'pending' | null;

function cloudInviteDisplayStatus(invite: CloudInvite): CloudInvite['status'] {
  return displayInviteStatus(invite, new Date());
}

const cloudInviteFilters: Array<{ key: CloudInviteFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'stale', label: 'Stale' },
  { key: 'pending', label: 'Pending' },
  { key: 'expired', label: 'Expired' },
  { key: 'revoked', label: 'Revoked' },
  { key: 'accepted', label: 'Accepted' },
];

function assignmentScopeState(targets: SquadMember[], scope: AssignmentScope, cloudEnabled: boolean) {
  if (scope === 'member') return assignmentTargetState(targets[0] ?? null, cloudEnabled);
  if (!targets.length) return { label: 'No targets', detail: 'No members match this assignment scope.', tone: colours.muted };
  const ready = targets.filter((member) => member.cloudMembershipId).length;
  const label = scope === 'group' ? 'Group assignment' : 'Whole squad assignment';
  if (!cloudEnabled) return { label, detail: `${targets.length} local target${targets.length === 1 ? '' : 's'}. Cloud delivery is unavailable.`, tone: colours.muted };
  if (ready === targets.length) return { label, detail: `${ready}/${targets.length} members are cloud-ready.`, tone: colours.green };
  if (ready > 0) return { label, detail: `${ready}/${targets.length} members are cloud-ready. Others will stay local until invites are accepted and synced.`, tone: colours.amber };
  return { label, detail: `${targets.length} local or pending target${targets.length === 1 ? '' : 's'}. Send invites and sync before cloud delivery.`, tone: colours.textSoft };
}

export function parseDose(dose: string) {
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

export function buildAssignedExerciseBlock(
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

function buildExerciseBlocksFromIds(exerciseIds: string[]) {
  return exerciseIds
    .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
    .map((exercise, index) => buildAssignedExerciseBlock(exercise, index === 0));
}

export function InstructorScreen({
  pinEnabled,
  sessions,
  members,
  groups,
  programmeTemplates,
  readinessLogs,
  workoutCompletions,
  assignmentDeployments = [],
  onSetPin,
  onWipe,
  onExport,
  onImport,
  onAddMember,
  onDeleteMember,
  onUpdateMember,
  onAddAssignmentDeployment,
  onAddGroup,
  onAddProgrammeTemplate,
  onDeleteProgrammeTemplate,
  cloudEnabled,
  cloudStatus,
  cloudEmail,
  cloudSquadId,
  cloudTeamPulse,
  cloudInvites = [],
  pendingSyncCount = 0,
  onCloudSync,
  onCloudSignOut,
  onRevokeCloudInvite,
  googleSheetsEndpoint,
  onChangeGoogleSheetsEndpoint,
  onExportGoogleSheets,
  googleSheetsExporting,
  googleSheetsMessage,
}: InstructorScreenProps) {
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberGymName, setNewMemberGymName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupFocus, setNewGroupFocus] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? 'alpha');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentScope, setAssignmentScope] = useState<AssignmentScope>('member');
  const [assignmentMemberId, setAssignmentMemberId] = useState('');
  const [assignmentGroupId, setAssignmentGroupId] = useState(groups[0]?.id ?? 'alpha');
  const [assignmentLabel, setAssignmentLabel] = useState(assignmentTemplates[0]);
  const [assignmentFeedback, setAssignmentFeedback] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [stagedAssignmentExercises, setStagedAssignmentExercises] = useState<AssignedExerciseBlock[]>([]);
  const [assignmentCategory, setAssignmentCategory] = useState<'All' | ExerciseCategory>('All');
  const [selectedDeploymentKey, setSelectedDeploymentKey] = useState<string | null>(null);
  const [deliveryFocus, setDeliveryFocus] = useState<DeliveryFocus>(null);
  const [selectedReviewMemberId, setSelectedReviewMemberId] = useState<string | null>(null);
  const [cloudInviteFilter, setCloudInviteFilter] = useState<CloudInviteFilter>('all');
  const [cloudInviteLimit, setCloudInviteLimit] = useState(5);
  const [cloudInviteSearch, setCloudInviteSearch] = useState('');
  const [latestInviteLink, setLatestInviteLink] = useState<LatestInviteLink | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLatestInviteLink()
      .then((link) => {
        if (!cancelled) setLatestInviteLink(link);
      })
      .catch((error) => {
        console.error('Failed to load latest invite link', error);
      });
    return () => { cancelled = true; };
  }, []);

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
  const assignmentTargets = useMemo(() => {
    if (assignmentScope === 'squad') return members;
    if (assignmentScope === 'group') return members.filter((member) => member.groupId === assignmentGroupId);
    return [selectedAssignmentMember ?? members[0]].filter((member): member is SquadMember => Boolean(member));
  }, [assignmentGroupId, assignmentScope, members, selectedAssignmentMember]);
  const selectedTargetState = assignmentScopeState(assignmentTargets, assignmentScope, cloudEnabled);
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
  const membersNeedingReview = useMemo(() => {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    return members
      .map((member) => {
        const latestReadiness = latestReadinessByMember.get(member.id);
        const latestCompletion = latestCompletionByMember.get(member.id);
        const recentHardFeedback = workoutCompletions.filter((completion) => (
          completion.memberId === member.id
          && completion.effort === 'Too Hard'
          && now - new Date(completion.completedAt).getTime() <= weekMs
        ));
        const pendingAssignments = assignmentDeployments.filter((deployment) => {
          if (!deployment.targetMemberIds.includes(member.id)) return false;
          if (deployment.completedMemberIds?.includes(member.id)) return false;
          return !workoutCompletions.some((completion) => (
            completion.memberId === member.id
            && completion.assignment === deployment.title
            && new Date(completion.completedAt).getTime() >= new Date(deployment.assignedAt).getTime()
          ));
        });
        const reasons: Array<{ label: string; tone: string }> = [];

        if (member.risk === 'High') reasons.push({ label: 'High risk', tone: colours.red });
        if (member.risk === 'Medium') reasons.push({ label: 'Risk watch', tone: colours.amber });
        if (member.readiness < 60) reasons.push({ label: `Ready ${member.readiness}`, tone: colours.red });
        if (member.compliance < 70) reasons.push({ label: `Comply ${member.compliance}%`, tone: colours.amber });
        if (member.load > 85) reasons.push({ label: `Load ${member.load}`, tone: colours.amber });
        if (latestReadiness?.limitsTraining || (latestReadiness?.pain ?? 0) >= 4) {
          const painLabel = latestReadiness?.painArea ? `Pain ${latestReadiness.painArea}` : 'Pain flag';
          reasons.push({ label: painLabel, tone: colours.red });
        }
        if (recentHardFeedback.length) reasons.push({ label: 'Too hard', tone: colours.amber });
        if (pendingAssignments.length) reasons.push({ label: `${pendingAssignments.length} pending`, tone: colours.cyan });

        const reviewScore = reasons.reduce((score, reason) => score + (reason.tone === colours.red ? 3 : 1), 0);
        return { member, latestCompletion, latestReadiness, pendingAssignments, reasons, reviewScore };
      })
      .filter((entry) => entry.reasons.length)
      .sort((a, b) => b.reviewScore - a.reviewScore || a.member.readiness - b.member.readiness)
      .slice(0, 5);
  }, [assignmentDeployments, latestCompletionByMember, latestReadinessByMember, members, workoutCompletions]);
  const teamPulse = useMemo(() => {
    const weeklyVolume = members.reduce((total, member) => total + (member.weeklyVolume ?? 0), 0);
    const readiness = members.length ? Math.round(members.reduce((total, member) => total + member.readiness, 0) / members.length) : 0;
    const compliance = members.length ? Math.round(members.reduce((total, member) => total + member.compliance, 0) / members.length) : 0;
    const weeklyGoal = Math.max(1000, groups.length * 2500);
    const goalPercent = Math.min(100, Math.round((weeklyVolume / weeklyGoal) * 100));
    const completionsThisWeek = workoutCompletions.filter((completion) => {
      const completedAt = new Date(completion.completedAt).getTime();
      return Date.now() - completedAt <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    return { weeklyVolume, readiness, compliance, weeklyGoal, goalPercent, completionsThisWeek };
  }, [groups.length, members, workoutCompletions]);
  const displayedTeamPulse = cloudTeamPulse
    ? {
      weeklyVolume: cloudTeamPulse.weeklyVolume,
      readiness: teamPulse.readiness,
      compliance: cloudTeamPulse.completionRate,
      weeklyGoal: cloudTeamPulse.weeklyGoal,
      goalPercent: cloudTeamPulse.goalPercent,
      completionsThisWeek: cloudTeamPulse.completionsThisWeek,
      source: 'cloud' as const,
    }
    : { ...teamPulse, source: 'local' as const };
  const lifecycleCounts = useMemo(() => {
    const targetReady = members.filter((member) => member.cloudMembershipId).length;
    const invited = members.filter((member) => !member.cloudMembershipId && member.inviteStatus === 'Invited').length;
    const acceptedNeedsSync = members.filter((member) => !member.cloudMembershipId && member.inviteStatus === 'Joined').length;
    const manual = members.filter((member) => !member.cloudMembershipId && (!member.inviteStatus || member.inviteStatus === 'Manual')).length;
    return { targetReady, invited, acceptedNeedsSync, manual };
  }, [members]);
  const inviteLifecycleGroups = useMemo(() => groupInviteLifecycle(members), [members]);
  const cloudInviteCounts = useMemo(() => countCloudInvites(cloudInvites), [cloudInvites]);
  const inviteHealth = useMemo(() => buildInviteHealth(members, cloudInvites), [cloudInvites, members]);
  const firstStaleInvite = useMemo(() => firstStaleCloudInvite(cloudInvites), [cloudInvites]);
  const firstStaleInviteLabel = firstStaleInvite ? cloudInviteLabel(firstStaleInvite) : '';
  function setCloudInviteQueueFilter(filter: CloudInviteFilter) {
    setCloudInviteFilter(filter);
    setCloudInviteLimit(5);
  }
  const filteredCloudInvites = useMemo(() => (
    filterCloudInvites(cloudInvites, cloudInviteFilter, cloudInviteSearch)
  ), [cloudInviteFilter, cloudInviteSearch, cloudInvites]);
  const visibleCloudInvites = filteredCloudInvites.slice(0, cloudInviteLimit);
  const fallbackAssignmentHistory = useMemo(() => {
    const grouped = new Map<string, {
      key: string;
      title: string;
      assignedAt: string;
      targetNames: string[];
      targetCount: number;
      cloudReadyCount: number;
      localOnlyCount?: number;
      completedCount: number;
      exerciseCount: number;
      effortCounts?: AssignmentDeployment['effortCounts'];
      latestFeedback?: AssignmentDeployment['latestFeedback'];
      targetMemberIds?: string[];
      completedMemberIds?: string[];
      deliveryRows?: ReturnType<typeof buildAssignmentDeliveryRows>['rows'];
    }>();

    members.forEach((member) => {
      const session = member.assignmentSession;
      if (!session) return;
      const key = `${session.title}-${session.assignedAt.slice(0, 16)}`;
      const existing = grouped.get(key) ?? {
        key,
        title: session.title,
        assignedAt: session.assignedAt,
        targetNames: [],
        targetCount: 0,
        cloudReadyCount: 0,
        completedCount: 0,
        exerciseCount: session.exercises.length,
      };
      const completed = session.status === 'completed' || workoutCompletions.some((completion) => (
        completion.memberId === member.id
        && (completion.assignmentId === session.id || completion.assignment === session.title)
        && new Date(completion.completedAt).getTime() >= new Date(session.assignedAt).getTime()
      ));

      existing.targetMemberIds = [...(existing.targetMemberIds ?? []), member.id];
      existing.completedMemberIds = completed ? [...(existing.completedMemberIds ?? []), member.id] : existing.completedMemberIds;
      existing.targetNames.push(member.gymName || member.name);
      existing.targetCount += 1;
      existing.cloudReadyCount += member.cloudMembershipId ? 1 : 0;
      existing.localOnlyCount = existing.targetCount - existing.cloudReadyCount;
      existing.completedCount += completed ? 1 : 0;
      existing.exerciseCount = Math.max(existing.exerciseCount, session.exercises.length);
      existing.deliveryRows = buildAssignmentDeliveryRows({
        assignmentTitle: existing.title,
        assignedAt: existing.assignedAt,
        targetMemberIds: existing.targetMemberIds,
        targetNames: existing.targetNames,
        cloudReadyMemberIds: members.filter((item) => item.cloudMembershipId).map((item) => item.id),
        completedMemberIds: existing.completedMemberIds,
        members,
        workoutCompletions,
      }).rows;
      grouped.set(key, existing);
    });

    return Array.from(grouped.values())
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime())
      .slice(0, 5);
  }, [members, workoutCompletions]);
  const assignmentHistory = useMemo(() => {
    if (!assignmentDeployments.length) return fallbackAssignmentHistory;
    return assignmentDeployments.slice(0, 5).map((deployment) => {
      const completedCount = deployment.completedMemberIds?.length ?? deployment.targetMemberIds.filter((memberId) => workoutCompletions.some((completion) => (
          completion.memberId === memberId
          && completion.assignment === deployment.title
          && new Date(completion.completedAt).getTime() >= new Date(deployment.assignedAt).getTime()
        ))).length;

      const delivery = buildAssignmentDeliveryRows({
        assignmentTitle: deployment.title,
        assignedAt: deployment.assignedAt,
        targetMemberIds: deployment.targetMemberIds,
        targetNames: deployment.targetNames,
        cloudReadyMemberIds: deployment.cloudReadyMemberIds,
        completedMemberIds: deployment.completedMemberIds,
        members,
        workoutCompletions,
      });

      return {
        key: deployment.id,
        title: deployment.title,
        assignedAt: deployment.assignedAt,
        targetMemberIds: deployment.targetMemberIds,
        targetNames: deployment.targetNames,
        targetCount: deployment.targetMemberIds.length,
        cloudReadyCount: delivery.cloudDeliveredCount,
        localOnlyCount: delivery.localOnlyCount,
        completedCount,
        exerciseCount: deployment.exerciseCount,
        effortCounts: deployment.effortCounts,
        latestFeedback: deployment.latestFeedback,
        completedMemberIds: deployment.completedMemberIds,
        deliveryRows: delivery.rows,
      };
    });
  }, [assignmentDeployments, fallbackAssignmentHistory, members, workoutCompletions]);
  const assignmentDeliveryHealth = useMemo(() => buildAssignmentDeliveryHealth(assignmentHistory), [assignmentHistory]);
  const firstLocalOnlyAssignment = useMemo(() => firstAssignmentWithLocalOnly(assignmentHistory), [assignmentHistory]);
  const firstPendingAssignment = useMemo(() => firstAssignmentWithPending(assignmentHistory), [assignmentHistory]);
  const selectedDeployment = assignmentHistory.find((assignment) => assignment.key === selectedDeploymentKey) ?? null;
  const selectedDeploymentTargets = useMemo(() => {
    if (!selectedDeployment) return [];
    const rows = selectedDeployment.deliveryRows ?? [];
    if (deliveryFocus === 'localOnly') {
      return [...rows].sort((a, b) => Number(b.deliveryLabel === 'Local only') - Number(a.deliveryLabel === 'Local only'));
    }
    if (deliveryFocus === 'pending') {
      return [...rows].sort((a, b) => Number(b.completionLabel === 'Pending') - Number(a.completionLabel === 'Pending'));
    }
    return rows;
  }, [deliveryFocus, selectedDeployment]);
  const deliveryToneColor = (tone: string) => tone === 'success' ? colours.green : colours.amber;

  function createGroup() {
    const trimmedName = newGroupName.trim();
    const trimmedFocus = newGroupFocus.trim();
    if (!trimmedName) {
      showAlert('Team name required', 'Enter a team name before creating a new team.');
      return;
    }

    if (groups.some((group) => group.name.toLowerCase() === trimmedName.toLowerCase())) {
      showAlert('Team exists', 'A team with that name already exists.');
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
    showConfirm(
      'Delete member',
      `Remove ${member.name} from the squad dashboard?`,
      () => {
        onDeleteMember(member.id);
        if (assignmentMemberId === member.id) setAssignmentMemberId('');
      },
      'Delete'
    );
  }

  async function createSecureInviteForMember(
    member: Pick<SquadMember, 'name' | 'gymName' | 'email' | 'groupId'> & Partial<Pick<SquadMember, 'id'>>,
    context: 'added' | 'resent' = 'resent',
    refreshCloudRows = false,
  ) {
    const inviteSubject = 'Join FORGE Tactical Fitness';
    const { inviteUrl, expiresAt, trimmedEmail, displayName, storageNote } = await createCloudMemberInvite({
      appBaseUrl: appInviteUrl,
      cloudEnabled,
      cloudSquadId,
      member,
    });
    const latestLink = {
      url: inviteUrl,
      label: displayName,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    if (context === 'resent' && member.id) {
      onUpdateMember(member.id, { inviteStatus: 'Invited', email: trimmedEmail || member.email, updatedAt: new Date().toISOString() });
    }
    setLatestInviteLink(latestLink);
    saveLatestInviteLink(latestLink).catch((error) => console.error('Failed to save latest invite link', error));

    const inviteBody = `You've been invited to FORGE Tactical Fitness.\n\nOpen your secure FORGE member portal invite here:\n${inviteUrl}\n\nThis invite expires on ${new Date(expiresAt).toLocaleDateString()}.\n\nCoach note: ${storageNote}`;

    if (!trimmedEmail) {
      showAlert('Secure invite created', `${displayName} does not have an email saved. Send them this link:\n\n${inviteUrl}`);
      if (refreshCloudRows) onCloudSync();
      return inviteUrl;
    }

    const subject = encodeURIComponent(inviteSubject);
    const body = encodeURIComponent(inviteBody);
    const mailtoUrl = `mailto:${trimmedEmail}?subject=${subject}&body=${body}`;

    if (Platform.OS === 'web') {
      window.location.href = mailtoUrl;
      window.alert(`${displayName} was ${context === 'added' ? 'added' : 'queued for a new invite'}. Your email app should open with the invite draft. If it does not, send them this link: ${inviteUrl}`);
      if (refreshCloudRows) onCloudSync();
      return inviteUrl;
    }

    Linking.openURL(mailtoUrl)
      .then(() => {
        showAlert(context === 'added' ? 'Member invited' : 'Invite ready', `${displayName} ${context === 'added' ? 'was added and an invite draft was opened' : 'has a fresh invite draft'}.`);
        if (refreshCloudRows) onCloudSync();
      })
      .catch(() => {
        showAlert('Invite link ready', `Copy this invite link and send it to ${trimmedEmail}:\n\n${inviteUrl}`);
        if (refreshCloudRows) onCloudSync();
      });

    return inviteUrl;
  }

  async function copyInviteUrl(inviteUrl: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
        return true;
      }
    } catch (error) {
      console.error('Failed to copy invite link', error);
    }
    return false;
  }

  async function copyInviteLinkForMember(
    member: Pick<SquadMember, 'name' | 'gymName' | 'email' | 'groupId'> & Partial<Pick<SquadMember, 'id'>>,
    refreshCloudRows = false,
  ) {
    const { inviteUrl, expiresAt, trimmedEmail, displayName, storageNote } = await createCloudMemberInvite({
      appBaseUrl: appInviteUrl,
      cloudEnabled,
      cloudSquadId,
      member,
    });
    const latestLink = {
      url: inviteUrl,
      label: displayName,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    if (member.id) {
      onUpdateMember(member.id, { inviteStatus: 'Invited', email: trimmedEmail || member.email, updatedAt: new Date().toISOString() });
    }
    setLatestInviteLink(latestLink);
    saveLatestInviteLink(latestLink).catch((error) => console.error('Failed to save latest invite link', error));

    const copied = await copyInviteUrl(inviteUrl);
    const expiry = new Date(expiresAt).toLocaleDateString();
    showAlert(
      copied ? 'Invite link copied' : 'Invite link ready',
      copied
        ? `${displayName}'s invite link is on your clipboard. Expires ${expiry}.\n\n${storageNote}`
        : `Copy this invite link and send it to ${displayName}:\n\n${inviteUrl}\n\nExpires ${expiry}.\n\n${storageNote}`,
    );
    if (refreshCloudRows) onCloudSync();
    return inviteUrl;
  }

  async function copyLatestInviteLink() {
    if (!latestInviteLink) return;
    const copied = await copyInviteUrl(latestInviteLink.url);
    showAlert(
      copied ? 'Invite link copied' : 'Invite link ready',
      copied
        ? `${latestInviteLink.label}'s latest invite link is on your clipboard.`
        : `Copy this invite link and send it to ${latestInviteLink.label}:\n\n${latestInviteLink.url}`,
    );
  }

  async function clearLatestInviteRecovery() {
    setLatestInviteLink(null);
    try {
      await clearLatestInviteLink();
    } catch (error) {
      console.error('Failed to clear latest invite link', error);
    }
  }

  function renderLatestInviteRow() {
    if (!latestInviteLink) return null;
    return (
      <View style={styles.latestInviteRow}>
        <View style={styles.memberCopy}>
          <Text style={styles.memberName}>Latest invite: {latestInviteLink.label}</Text>
          <Text style={styles.muted}>Expires {new Date(latestInviteLink.expiresAt).toLocaleDateString()}</Text>
        </View>
        <View style={styles.inviteOpsActions}>
          <Pressable style={styles.inviteOpsButton} onPress={() => { void copyLatestInviteLink(); }}>
            <Text style={styles.inviteOpsButtonText}>Copy Again</Text>
          </Pressable>
          <Pressable style={[styles.inviteOpsButton, styles.inviteOpsDangerButton]} onPress={() => { void clearLatestInviteRecovery(); }}>
            <Text style={[styles.inviteOpsButtonText, styles.inviteOpsDangerText]}>Clear</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  async function resendCloudInvite(invite: CloudInvite) {
    await createSecureInviteForMember({
      name: invite.displayName || invite.gymName || invite.email || 'FORGE Member',
      gymName: invite.gymName,
      email: invite.email,
      groupId: invite.squadId,
    }, 'resent', true);
  }

  async function copyCloudInviteLink(invite: CloudInvite) {
    await copyInviteLinkForMember({
      name: invite.displayName || invite.gymName || invite.email || 'FORGE Member',
      gymName: invite.gymName,
      email: invite.email,
      groupId: invite.squadId,
    }, true);
  }

  function markInviteManual(member: SquadMember) {
    showConfirm(
      'Mark manual',
      `Clear invite state for ${member.gymName || member.name} and keep them as a local/manual roster member?`,
      () => {
        onUpdateMember(member.id, {
          inviteStatus: 'Manual',
          cloudMembershipId: undefined,
          updatedAt: new Date().toISOString(),
        });
      },
      'Mark Manual',
    );
  }

  function confirmRevokeCloudInvite(invite: CloudInvite) {
    if (!onRevokeCloudInvite) return;
    const label = invite.gymName || invite.displayName || invite.email || 'this invite';
    showConfirm(
      'Revoke invite',
      `Revoke the pending cloud invite for ${label}? The existing link will stop working.`,
      () => { void onRevokeCloudInvite(invite.id); },
      'Revoke',
    );
  }

  async function addMember() {
    const trimmedName = newMemberName.trim();
    const trimmedGymName = newMemberGymName.trim();
    const trimmedEmail = newMemberEmail.trim().toLowerCase();
    if (!trimmedName) {
      showAlert('Name required', 'Enter a team member name before adding them.');
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      showAlert('Email check', 'Enter a valid email address or leave email blank for manual tracking.');
      return;
    }

    const memberId = `member-${Date.now()}`;
    const displayName = trimmedGymName || trimmedName;
    const nextMember: SquadMember = {
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
    };

    onAddMember(nextMember);

    setNewMemberName('');
    setNewMemberGymName('');
    setNewMemberEmail('');

    if (trimmedEmail) {
      await createSecureInviteForMember(nextMember, 'added');
    } else {
      showAlert('Member added', `${displayName} is now tracked manually in this squad.`);
    }
  }

  function handleWearableConnect(name: string, status: string) {
    if (status === 'Planned') {
      showAlert('Connection planned', `${name} needs OAuth/API credentials before live sync can be enabled.`);
      return;
    }

    showAlert('Connection ready', `${name} can be connected once device permissions are granted.`);
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
    const nudge = Object.values(coachNudgeTemplates).find((template) => template.label === nextLabel);
    if (nudge) {
      setAssignmentNote(nudge.note);
      setStagedAssignmentExercises(buildExerciseBlocksFromIds([...nudge.exerciseIds]));
      return;
    }
    const mode = trainingModes.find((item) => item.title === nextLabel);
    setStagedAssignmentExercises(mode?.defaultExerciseIds
      .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
      .map((exercise) => buildAssignedExerciseBlock(exercise, mode.coachPinnedExerciseIds?.includes(exercise.id) ?? false)) ?? []);
  }

  function loadCoachNudge(kind: keyof typeof coachNudgeTemplates, memberId: string) {
    if (!memberId) {
      showAlert('Pick a member', 'Add or select a member before loading a coach nudge.');
      return;
    }
    const template = coachNudgeTemplates[kind];
    setAssignmentScope('member');
    setAssignmentMemberId(memberId);
    setAssignmentLabel(template.label);
    setAssignmentNote(template.note);
    setStagedAssignmentExercises(buildExerciseBlocksFromIds([...template.exerciseIds]));
    setAssignmentFeedback(`${template.label} nudge loaded. Review and assign when ready.`);
    setAssignmentOpen(true);
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
      showAlert('No members', 'Add a team member before applying an assignment.');
      return;
    }

    const group = selectedAssignmentGroup ?? groups[0];
    const targets = assignmentTargets;
    if (!targets.length || !group) {
      showAlert('Pick a target', 'Choose a member, group, or squad before applying an assignment.');
      return;
    }

    const assignmentMode = selectedAssignmentMode;
    const assignmentType = assignmentMode?.type ?? inferAssignmentType(assignmentLabel);
    const chosenExerciseIds = activeAssignmentExerciseIds;
    const chosenExercises = activeAssignmentExercises;

    targets.forEach((target) => {
      const targetGroupId = assignmentScope === 'group'
        ? group.id
        : assignmentScope === 'squad'
          ? target.groupId
          : group.id;
      onUpdateMember(target.id, {
        groupId: targetGroupId,
        assignment: assignmentLabel,
        pinnedExerciseIds: assignmentMode?.coachPinnedExerciseIds?.filter((id) => chosenExerciseIds.includes(id))
          ?? chosenExerciseIds.slice(0, 2),
        assignmentSession: {
          id: createUuid(),
          title: assignmentLabel,
          type: assignmentType,
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
    });
    const cloudReadyCount = targets.filter((target) => target.cloudMembershipId).length;
    const scopeLabel = assignmentScope === 'member'
      ? targets[0].name
      : assignmentScope === 'group'
        ? group.name
        : 'whole squad';
    const message = `${assignmentLabel} assigned to ${scopeLabel}: ${targets.length} target${targets.length === 1 ? '' : 's'}, ${cloudReadyCount} cloud-ready.`;
    onAddAssignmentDeployment?.({
      id: createUuid(),
      title: assignmentLabel,
      scope: assignmentScope,
      groupId: assignmentScope === 'squad' ? undefined : group.id,
      groupName: assignmentScope === 'squad' ? undefined : group.name,
      targetMemberIds: targets.map((target) => target.id),
      targetNames: targets.map((target) => target.gymName || target.name),
      cloudReadyMemberIds: targets.filter((target) => target.cloudMembershipId).map((target) => target.id),
      exerciseCount: chosenExercises.length,
      assignedAt: new Date().toISOString(),
      coachNote: assignmentNote.trim() || undefined,
    });
    setAssignmentMemberId(targets[0].id);
    setAssignmentGroupId(group.id);
    setAssignmentFeedback(message);
    setAssignmentOpen(false);
    setAssignmentNote('');
    setStagedAssignmentExercises([]);
    showAlert('Assignment saved', message);
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.muted}>Coach console</Text>
          <Text style={styles.title}>Squad Dashboard</Text>
        </View>
      </View>

      <Card hot>
        <View style={styles.pulseHeader}>
          <View>
            <Text style={styles.muted}>Team Pulse</Text>
            <Text style={styles.pulseValue}>{displayedTeamPulse.goalPercent}%</Text>
          </View>
          <View style={styles.pulseSummary}>
            <Text style={styles.pulseMetric}>Readiness {displayedTeamPulse.readiness}/100</Text>
            <Text style={styles.pulseMetric}>Completion {displayedTeamPulse.compliance}%</Text>
            <Text style={[styles.pulseMetric, { color: atRiskCount ? colours.amber : colours.green }]}>{atRiskCount} need review</Text>
          </View>
        </View>
        <ProgressBar value={displayedTeamPulse.goalPercent} colour={displayedTeamPulse.goalPercent >= 75 ? colours.green : displayedTeamPulse.goalPercent >= 45 ? colours.amber : colours.red} />
        <View style={styles.pulseStatRow}>
          <Text style={styles.pulseStat}>{displayedTeamPulse.weeklyVolume.toLocaleString()} / {displayedTeamPulse.weeklyGoal.toLocaleString()} weekly volume</Text>
          <Text style={styles.pulseStat}>{displayedTeamPulse.completionsThisWeek} completions this week</Text>
        </View>
        <Text style={styles.pulseSource}>{displayedTeamPulse.source === 'cloud' ? 'Source: Supabase completion rows' : 'Source: local device state'}</Text>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Members Needing Review</Text>
          <Text style={styles.muted}>{membersNeedingReview.length || 'none'}</Text>
        </View>
        {membersNeedingReview.length ? membersNeedingReview.map((entry) => (
          <View key={`review-${entry.member.id}`}>
            <Pressable
              style={styles.reviewRow}
              onPress={() => setSelectedReviewMemberId((current) => current === entry.member.id ? null : entry.member.id)}
            >
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{entry.member.gymName || entry.member.name}</Text>
                <Text style={styles.muted}>Ready {entry.member.readiness} - Comply {entry.member.compliance}% - Load {entry.member.load}</Text>
                <View style={styles.reviewTags}>
                  {entry.reasons.slice(0, 4).map((reason) => (
                    <View key={`${entry.member.id}-${reason.label}`} style={[styles.reviewTag, { borderColor: `${reason.tone}55`, backgroundColor: `${reason.tone}18` }]}>
                      <Text style={[styles.reviewTagText, { color: reason.tone }]}>{reason.label}</Text>
                    </View>
                  ))}
                </View>
                {entry.latestCompletion?.note ? (
                  <Text style={styles.assignmentHistoryFeedback}>{entry.latestCompletion.note}</Text>
                ) : null}
              </View>
              <Text style={[styles.reviewRisk, { color: entry.member.risk === 'High' ? colours.red : entry.member.risk === 'Medium' ? colours.amber : colours.cyan }]}>
                {entry.pendingAssignments.length ? `${entry.pendingAssignments.length} PEND` : entry.member.risk}
              </Text>
            </Pressable>
            {selectedReviewMemberId === entry.member.id ? (
              <View style={styles.reviewDetailPanel}>
                <View style={styles.reviewDetailGrid}>
                  <View style={styles.reviewDetailStat}>
                    <Text style={styles.scoreMeta}>READINESS</Text>
                    <Text style={[styles.reviewDetailValue, { color: entry.member.readiness >= 70 ? colours.green : entry.member.readiness >= 55 ? colours.amber : colours.red }]}>
                      {entry.member.readiness}
                    </Text>
                  </View>
                  <View style={styles.reviewDetailStat}>
                    <Text style={styles.scoreMeta}>COMPLIANCE</Text>
                    <Text style={[styles.reviewDetailValue, { color: entry.member.compliance >= 75 ? colours.green : colours.amber }]}>
                      {entry.member.compliance}%
                    </Text>
                  </View>
                  <View style={styles.reviewDetailStat}>
                    <Text style={styles.scoreMeta}>LOAD</Text>
                    <Text style={[styles.reviewDetailValue, { color: entry.member.load > 85 ? colours.red : colours.text }]}>
                      {entry.member.load}
                    </Text>
                  </View>
                </View>
                <Text style={styles.reviewDetailLine}>
                  Latest completion: {entry.latestCompletion ? `${entry.latestCompletion.assignment} - ${entry.latestCompletion.effort}` : 'No completion logged yet'}
                </Text>
                <Text style={styles.reviewDetailLine}>
                  Readiness note: {entry.latestReadiness ? `Pain ${entry.latestReadiness.pain ?? 0}/5${entry.latestReadiness.painArea ? ` - ${entry.latestReadiness.painArea}` : ''}` : 'No readiness check yet'}
                </Text>
                {entry.pendingAssignments.length ? (
                  <View style={styles.reviewPendingList}>
                    {entry.pendingAssignments.slice(0, 3).map((deployment) => (
                      <Text key={`${entry.member.id}-${deployment.id}`} style={styles.reviewDetailLine}>Pending: {deployment.title}</Text>
                    ))}
                  </View>
                ) : null}
                <View style={styles.reviewActionRow}>
                  <Pressable
                    style={styles.reviewActionButton}
                    onPress={() => loadCoachNudge('recovery', entry.member.id)}
                  >
                    <Text style={styles.reviewActionText}>Recovery</Text>
                  </Pressable>
                  <Pressable
                    style={styles.reviewActionButton}
                    onPress={() => loadCoachNudge('mobility', entry.member.id)}
                  >
                    <Text style={styles.reviewActionText}>Mobility</Text>
                  </Pressable>
                  <Pressable
                    style={styles.reviewActionButton}
                    onPress={() => {
                      setAssignmentScope('member');
                      setAssignmentMemberId(entry.member.id);
                      setAssignmentOpen(true);
                    }}
                  >
                    <Text style={styles.reviewActionText}>Assign</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        )) : (
          <Text style={styles.inviteHelp}>No member is currently flagged for readiness, compliance, pain risk, pending work, hard feedback, or excessive load.</Text>
        )}
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Assignment Centre</Text>
            <Text style={styles.inviteHelp}>Assign today&apos;s work to a member or group, then scan completion feedback below.</Text>
          </View>
          <Pressable style={styles.assignButton} onPress={toggleAssignmentPanel}>
            <Text style={styles.assignButtonText}>{assignmentOpen ? 'Close' : 'Assign'}</Text>
          </Pressable>
        </View>
        {assignmentFeedback ? (
          <View style={styles.assignmentFeedback}>
            <Text style={styles.assignmentFeedbackText}>{assignmentFeedback}</Text>
          </View>
        ) : null}
        <View style={styles.assignmentQuickStats}>
          <Text style={styles.assignmentQuickText}>{members.length} members</Text>
          <Text style={styles.assignmentQuickText}>{groups.length} groups</Text>
          <Text style={styles.assignmentQuickText}>{programmeTemplates.length} templates</Text>
        </View>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Assignment History</Text>
          <Text style={styles.muted}>{assignmentHistory.length ? `latest ${assignmentHistory.length}` : 'empty'}</Text>
        </View>
        {assignmentHistory.length ? (
          <View style={styles.deliveryHealthRow}>
            <View style={styles.deliveryHealthMain}>
              <Text style={[styles.deliveryHealthNumber, { color: assignmentDeliveryHealth.needsAction ? colours.amber : colours.green }]}>
                {assignmentDeliveryHealth.needsAction}
              </Text>
              <Text style={styles.deliveryHealthLabel}>Need action</Text>
            </View>
            <View style={styles.deliveryHealthStats}>
              <Text style={styles.deliveryHealthStat}>Cloud {assignmentDeliveryHealth.cloudDelivered}</Text>
              <Pressable
                style={styles.deliveryHealthChip}
                onPress={() => {
                  if (firstLocalOnlyAssignment) {
                    setDeliveryFocus('localOnly');
                    setSelectedDeploymentKey(firstLocalOnlyAssignment.key);
                  }
                }}
              >
                <Text style={styles.deliveryHealthStat}>Local {assignmentDeliveryHealth.localOnly}</Text>
              </Pressable>
              <Text style={styles.deliveryHealthStat}>Done {assignmentDeliveryHealth.completed}</Text>
              <Pressable
                style={styles.deliveryHealthChip}
                onPress={() => {
                  if (firstPendingAssignment) {
                    setDeliveryFocus('pending');
                    setSelectedDeploymentKey(firstPendingAssignment.key);
                  }
                }}
              >
                <Text style={styles.deliveryHealthStat}>Pending {assignmentDeliveryHealth.pending}</Text>
              </Pressable>
              <Text style={styles.deliveryHealthStat}>Delivery {assignmentDeliveryHealth.deliveryPercent}%</Text>
            </View>
          </View>
        ) : null}
        {assignmentHistory.length ? assignmentHistory.map((assignment) => {
          const completionPercent = assignment.targetCount
            ? Math.round((assignment.completedCount / assignment.targetCount) * 100)
            : 0;
          return (
            <View key={assignment.key}>
              <Pressable
                style={styles.assignmentHistoryRow}
                onPress={() => {
                  setDeliveryFocus(null);
                  setSelectedDeploymentKey((current) => current === assignment.key ? null : assignment.key);
                }}
              >
                <View style={styles.memberCopy}>
                  <Text style={styles.memberName}>{assignment.title}</Text>
                  <Text style={styles.muted}>
                    {assignment.targetCount} target{assignment.targetCount === 1 ? '' : 's'} - {assignment.exerciseCount} exercises - {assignment.cloudReadyCount} cloud delivered - {assignment.localOnlyCount ?? Math.max(0, assignment.targetCount - assignment.cloudReadyCount)} local only
                  </Text>
                  <Text style={styles.assignmentHistoryTargets}>
                    Completed {assignment.completedCount} / Pending {Math.max(0, assignment.targetCount - assignment.completedCount)}
                  </Text>
                  <Text style={styles.assignmentHistoryTargets}>
                    {assignment.targetNames.slice(0, 4).join(', ')}{assignment.targetNames.length > 4 ? ` +${assignment.targetNames.length - 4}` : ''}
                  </Text>
                  {assignment.effortCounts ? (
                    <Text style={styles.assignmentHistoryTargets}>
                      Easy {assignment.effortCounts.tooEasy} / Right {assignment.effortCounts.aboutRight} / Hard {assignment.effortCounts.tooHard}
                    </Text>
                  ) : null}
                  {assignment.latestFeedback ? (
                    <Text style={styles.assignmentHistoryFeedback}>
                      {assignment.latestFeedback.memberName}: {assignment.latestFeedback.note || assignment.latestFeedback.effort}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.assignmentHistoryScore}>
                  <Text style={[styles.assignmentHistoryPercent, { color: completionPercent >= 75 ? colours.green : completionPercent >= 40 ? colours.amber : colours.red }]}>
                    {completionPercent}%
                  </Text>
                  <Text style={styles.scoreMeta}>DONE</Text>
                </View>
              </Pressable>
              {selectedDeploymentKey === assignment.key ? (
                <View style={styles.deploymentDetailPanel}>
                  {deliveryFocus ? (
                    <Text style={styles.deploymentFocusLabel}>
                      Focused: {deliveryFocus === 'localOnly' ? 'Local-only targets' : 'Pending targets'}
                    </Text>
                  ) : null}
                  {selectedDeploymentTargets.map((target) => (
                    <View key={target.key} style={styles.deploymentTargetRow}>
                      <View style={styles.memberCopy}>
                        <Text style={styles.memberName}>{target.name}</Text>
                        <Text style={styles.muted}>
                          {target.deliveryLabel} - {target.completionLabel}{target.effort ? ` - ${target.effort}` : ''}
                        </Text>
                        {target.note ? (
                          <Text style={styles.assignmentHistoryFeedback}>{target.note}</Text>
                        ) : null}
                      </View>
                      <View style={styles.deploymentStatusStack}>
                        <Text style={[styles.deploymentStatus, { color: deliveryToneColor(target.deliveryToneKey) }]}>
                          {target.deliveryLabel}
                        </Text>
                        <Text style={[styles.deploymentStatus, { color: deliveryToneColor(target.completionToneKey) }]}>
                          {target.completionLabel}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }) : (
          <Text style={styles.inviteHelp}>Assignments you deploy will appear here with target count, completion count, and cloud readiness.</Text>
        )}
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Notes & Feedback</Text>
          <Text style={styles.muted}>{notedCompletions.length ? `latest ${notedCompletions.length}` : 'quiet'}</Text>
        </View>
        {notedCompletions.length ? notedCompletions.slice(0, 3).map((completion) => (
          <View key={`top-note-${completion.id}`} style={styles.noteRow}>
            <View style={styles.memberCopy}>
              <Text style={styles.memberName}>{completion.memberName}</Text>
              <Text style={styles.muted}>{completion.assignment} - {completion.effort}</Text>
              <Text style={styles.coachMessage}>{completion.note}</Text>
            </View>
            <Text style={styles.completionTime}>
              {new Date(completion.completedAt).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )) : (
          <Text style={styles.inviteHelp}>Too Easy / About Right / Too Hard responses and member notes will appear here.</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Product Focus</Text>
        <Text style={styles.cloudCopy}>
          FORGE is moving from local squad tracking into cloud member onboarding and assignment delivery.
        </Text>
        <View style={styles.schemaGrid}>
          {['squads', 'squad_memberships', 'member_invites', 'assignments', 'assignment_exercises', 'workout_completions', 'team_activity', 'member_privacy_settings'].map((table) => (
            <View key={table} style={styles.schemaPill}>
              <Text style={styles.schemaPillText}>{table}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.inviteHelp}>
          Next phase: claim invite links in-app, hydrate accepted memberships from Supabase, write member completions with squad context, and enforce Ghost Mode in team activity.
        </Text>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Member Lifecycle</Text>
          <Text style={styles.muted}>{lifecycleCounts.targetReady}/{members.length} ready</Text>
        </View>
        <View style={styles.lifecycleGrid}>
          <View style={styles.lifecycleTile}>
            <Text style={[styles.lifecycleNumber, { color: colours.green }]}>{lifecycleCounts.targetReady}</Text>
            <Text style={styles.lifecycleLabel}>Target ready</Text>
          </View>
          <View style={styles.lifecycleTile}>
            <Text style={[styles.lifecycleNumber, { color: colours.amber }]}>{lifecycleCounts.invited}</Text>
            <Text style={styles.lifecycleLabel}>Invited</Text>
          </View>
          <View style={styles.lifecycleTile}>
            <Text style={[styles.lifecycleNumber, { color: colours.cyan }]}>{lifecycleCounts.acceptedNeedsSync}</Text>
            <Text style={styles.lifecycleLabel}>Accepted</Text>
          </View>
          <View style={styles.lifecycleTile}>
            <Text style={[styles.lifecycleNumber, { color: colours.muted }]}>{lifecycleCounts.manual}</Text>
            <Text style={styles.lifecycleLabel}>Manual</Text>
          </View>
        </View>
        <Text style={styles.inviteHelp}>Use Sync Now after a member accepts an invite. Once a target is ready, coach assignments can land in that member&apos;s cloud portal.</Text>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Invite Operations</Text>
          <Text style={styles.muted}>{inviteHealth.needsAction} need action</Text>
        </View>
        <View style={styles.inviteHealthRow}>
          <View style={styles.inviteHealthMain}>
            <Text style={[styles.inviteHealthNumber, { color: inviteHealth.needsAction ? colours.amber : colours.green }]}>{inviteHealth.needsAction}</Text>
            <Text style={styles.inviteHealthLabel}>Need action</Text>
          </View>
          <View style={styles.inviteHealthStats}>
            <Pressable style={styles.inviteHealthChip} onPress={() => setCloudInviteQueueFilter('stale')}>
              <Text style={styles.inviteHealthStat}>Stale {inviteHealth.stalePending}</Text>
            </Pressable>
            <Pressable style={styles.inviteHealthChip} onPress={() => setCloudInviteQueueFilter('expired')}>
              <Text style={styles.inviteHealthStat}>Expired {inviteHealth.expired}</Text>
            </Pressable>
            <Pressable style={styles.inviteHealthChip} onPress={() => setCloudInviteQueueFilter('revoked')}>
              <Text style={styles.inviteHealthStat}>Revoked {inviteHealth.revoked}</Text>
            </Pressable>
            <Pressable style={styles.inviteHealthChip} onPress={() => setCloudInviteQueueFilter('accepted')}>
              <Text style={styles.inviteHealthStat}>Accepted {inviteHealth.acceptedNeedsSync}</Text>
            </Pressable>
            <View style={styles.inviteHealthChip}>
              <Text style={styles.inviteHealthStat}>Ready {inviteHealth.targetReady}</Text>
            </View>
          </View>
          {firstStaleInvite ? (
            <View style={styles.inviteHealthActions}>
              <Pressable style={styles.inviteHealthAction} onPress={() => { void copyCloudInviteLink(firstStaleInvite); }}>
                <Text style={styles.inviteOpsButtonText}>Copy: {firstStaleInviteLabel}</Text>
              </Pressable>
              <Pressable style={styles.inviteHealthAction} onPress={() => { void resendCloudInvite(firstStaleInvite); }}>
                <Text style={styles.inviteOpsButtonText}>Resend: {firstStaleInviteLabel}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        <View style={styles.inviteCloudGrid}>
          <View style={styles.inviteCloudTile}>
            <Text style={[styles.inviteCloudValue, { color: colours.amber }]}>{cloudInviteCounts.pending}</Text>
            <Text style={styles.inviteCloudLabel}>Pending</Text>
          </View>
          <View style={styles.inviteCloudTile}>
            <Text style={[styles.inviteCloudValue, { color: colours.green }]}>{cloudInviteCounts.accepted}</Text>
            <Text style={styles.inviteCloudLabel}>Accepted</Text>
          </View>
          <View style={styles.inviteCloudTile}>
            <Text style={[styles.inviteCloudValue, { color: colours.red }]}>{cloudInviteCounts.expired}</Text>
            <Text style={styles.inviteCloudLabel}>Expired</Text>
          </View>
          <View style={styles.inviteCloudTile}>
            <Text style={[styles.inviteCloudValue, { color: colours.muted }]}>{cloudInviteCounts.revoked}</Text>
            <Text style={styles.inviteCloudLabel}>Revoked</Text>
          </View>
        </View>
        {cloudInvites.length ? (
          <View style={styles.inviteCloudList}>
            {renderLatestInviteRow()}
            <TextInput
              value={cloudInviteSearch}
              onChangeText={(value) => {
                setCloudInviteSearch(value);
                setCloudInviteLimit(5);
              }}
              placeholder="Search cloud invites"
              placeholderTextColor={colours.muted}
              style={styles.inviteSearchInput}
            />
            <View style={styles.inviteFilterRow}>
              {cloudInviteFilters.map((filter) => {
                const active = cloudInviteFilter === filter.key;
                return (
                  <Pressable key={filter.key} style={[styles.inviteFilterButton, active && styles.inviteFilterButtonActive]} onPress={() => {
                    setCloudInviteQueueFilter(filter.key);
                  }}>
                    <Text style={[styles.inviteFilterText, active && styles.inviteFilterTextActive]}>{filter.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {visibleCloudInvites.length ? visibleCloudInvites.map((invite) => {
              const displayStatus = cloudInviteDisplayStatus(invite);
              return (
                <View key={invite.id} style={styles.inviteCloudRow}>
                  <View style={styles.memberCopy}>
                    <Text style={styles.memberName}>{cloudInviteLabel(invite)}</Text>
                    <Text style={styles.muted}>{invite.email ?? 'No email'} - expires {new Date(invite.expiresAt).toLocaleDateString()}</Text>
                  </View>
                  {displayStatus === 'pending' && onRevokeCloudInvite ? (
                    <Pressable style={[styles.inviteOpsButton, styles.inviteOpsDangerButton]} onPress={() => confirmRevokeCloudInvite(invite)}>
                      <Text style={[styles.inviteOpsButtonText, styles.inviteOpsDangerText]}>Revoke</Text>
                    </Pressable>
                  ) : displayStatus === 'expired' || displayStatus === 'revoked' ? (
                    <View style={styles.inviteOpsActions}>
                      <Pressable style={styles.inviteOpsButton} onPress={() => { void resendCloudInvite(invite); }}>
                        <Text style={styles.inviteOpsButtonText}>Resend</Text>
                      </Pressable>
                      <Pressable style={styles.inviteOpsButton} onPress={() => { void copyCloudInviteLink(invite); }}>
                        <Text style={styles.inviteOpsButtonText}>Copy Link</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.inviteOpsReady}>{displayStatus.toUpperCase()}</Text>
                  )}
                </View>
              );
            }) : (
              <Text style={styles.inviteOpsEmpty}>No cloud invites match this filter.</Text>
            )}
            {filteredCloudInvites.length > visibleCloudInvites.length ? (
              <Pressable style={styles.inviteMoreButton} onPress={() => setCloudInviteLimit((limit) => limit + 5)}>
                <Text style={styles.inviteOpsButtonText}>Show {Math.min(5, filteredCloudInvites.length - visibleCloudInvites.length)} more</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            {renderLatestInviteRow()}
            <Text style={styles.inviteOpsEmpty}>No cloud invite rows loaded yet.</Text>
          </>
        )}
        {inviteLifecycleGroups.map((group) => (
          <View key={group.key} style={styles.inviteOpsSection}>
            <View style={styles.inviteOpsHeader}>
              <Text style={styles.inviteOpsTitle}>{group.label}</Text>
              <Text style={styles.inviteOpsCount}>{group.members.length}</Text>
            </View>
            <Text style={styles.inviteOpsAction}>{group.action}</Text>
            {group.members.length ? group.members.slice(0, 4).map((member) => (
              <View key={`${group.key}-${member.id}`} style={styles.inviteOpsRow}>
                <View style={styles.memberCopy}>
                  <Text style={styles.memberName}>{member.gymName || member.name}</Text>
                  <Text style={styles.muted}>{member.email ?? 'No email'}{member.cloudMembershipId ? ` - ${member.cloudMembershipId.slice(0, 8)}...` : ''}</Text>
                </View>
                <View style={styles.inviteOpsActions}>
                  {group.key === 'acceptedNeedsSync' ? (
                    <>
                      <Pressable style={styles.inviteOpsButton} onPress={onCloudSync}>
                        <Text style={styles.inviteOpsButtonText}>Sync</Text>
                      </Pressable>
                      <Pressable style={[styles.inviteOpsButton, styles.inviteOpsDangerButton]} onPress={() => markInviteManual(member)}>
                        <Text style={[styles.inviteOpsButtonText, styles.inviteOpsDangerText]}>Mark Manual</Text>
                      </Pressable>
                    </>
                  ) : group.key === 'invited' ? (
                    <>
                      <Pressable style={styles.inviteOpsButton} onPress={() => { void createSecureInviteForMember(member, 'resent'); }}>
                        <Text style={styles.inviteOpsButtonText}>Send Invite</Text>
                      </Pressable>
                      <Pressable style={styles.inviteOpsButton} onPress={() => { void copyInviteLinkForMember(member); }}>
                        <Text style={styles.inviteOpsButtonText}>Copy Link</Text>
                      </Pressable>
                      <Pressable style={[styles.inviteOpsButton, styles.inviteOpsDangerButton]} onPress={() => markInviteManual(member)}>
                        <Text style={[styles.inviteOpsButtonText, styles.inviteOpsDangerText]}>Mark Manual</Text>
                      </Pressable>
                    </>
                  ) : group.key === 'manual' ? (
                    <>
                      <Pressable style={styles.inviteOpsButton} onPress={() => { void createSecureInviteForMember(member, 'resent'); }}>
                        <Text style={styles.inviteOpsButtonText}>Send Invite</Text>
                      </Pressable>
                      <Pressable style={styles.inviteOpsButton} onPress={() => { void copyInviteLinkForMember(member); }}>
                        <Text style={styles.inviteOpsButtonText}>Copy Link</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text style={styles.inviteOpsReady}>Ready</Text>
                  )}
                </View>
              </View>
            )) : (
              <Text style={styles.inviteOpsEmpty}>No members in this state.</Text>
            )}
            {group.members.length > 4 ? (
              <Text style={styles.inviteOpsEmpty}>+{group.members.length - 4} more</Text>
            ) : null}
          </View>
        ))}
      </Card>

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
              ? pendingSyncCount > 0
                ? `${cloudEmail} is connected. ${pendingSyncCount} record${pendingSyncCount === 1 ? '' : 's'} pending sync.`
                : `${cloudEmail} is connected. Sessions, members, and completions auto-sync when the connection is healthy. Use Sync Now anytime you want an immediate refresh.`
              : 'Backend keys are configured. Sign in to enable auth, database sync, and shared team storage.'
            : 'Add Supabase keys to enable login auth and cloud database sync. Until then, the app keeps working from local storage.'}
        </Text>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, styles.cardTitleFlush]}>Google Sheets Export</Text>
        </View>
        <Text style={styles.cloudCopy}>
          Paste a Google Apps Script web app URL here. FORGE will send raw tabs for members, groups, sessions, assignments, completions, readiness, and programme templates so charts can sit on top of clean data.
        </Text>
        <TextInput
          style={styles.memberInput}
          value={googleSheetsEndpoint}
          onChangeText={onChangeGoogleSheetsEndpoint}
          placeholder="https://script.google.com/macros/s/..."
          placeholderTextColor={colours.soft}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[styles.googleSheetsButton, googleSheetsExporting && styles.cloudSyncButtonDisabled]}
          onPress={onExportGoogleSheets}
          disabled={googleSheetsExporting}
        >
          <Text style={styles.googleSheetsButtonText}>{googleSheetsExporting ? 'Sending...' : 'Send To Google Sheets'}</Text>
        </Pressable>
        {googleSheetsMessage ? <Text style={styles.googleSheetsStatus}>{googleSheetsMessage}</Text> : null}
        <Text style={styles.inviteHelp}>
          Recommended raw tabs: Members, Groups, Sessions, Assignments, Completions, Readiness, Programme Templates.
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
            <Text style={styles.assignmentLabel}>Assignment scope</Text>
            <View style={styles.assignmentWrap}>
              {([
                ['member', 'One member'],
                ['group', 'Group'],
                ['squad', 'Whole squad'],
              ] as const).map(([scope, label]) => {
                const active = scope === assignmentScope;
                return (
                  <Pressable
                    key={scope}
                    style={[styles.assignmentPill, active && styles.assignmentPillActive]}
                    onPress={() => setAssignmentScope(scope)}
                  >
                    <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {assignmentScope === 'member' ? <Text style={styles.assignmentLabel}>Select member</Text> : null}
            {assignmentScope === 'member' ? (
            <View style={styles.assignmentWrap}>
              {members.length ? members.map((member) => {
                const active = member.id === assignmentMemberId;
                const targetState = assignmentTargetState(member, cloudEnabled);
                return (
                  <Pressable
                    key={member.id}
                    style={[styles.assignmentPill, active && styles.assignmentPillActive]}
                    onPress={() => setAssignmentMemberId(member.id)}
                  >
                    <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{member.name}</Text>
                    <Text style={[styles.assignmentPillMeta, active && styles.assignmentPillTextActive, { color: active ? colours.cyan : targetState.tone }]}>
                      {targetState.label}
                    </Text>
                  </Pressable>
                );
              }) : <Text style={styles.emptyAssignmentText}>Add a member first.</Text>}
            </View>
            ) : null}

            {assignmentScope !== 'squad' ? <Text style={styles.assignmentLabel}>{assignmentScope === 'group' ? 'Assign selected group' : 'Assign under group'}</Text> : null}
            {assignmentScope !== 'squad' ? (
              <View style={styles.assignmentWrap}>
                {groups.map((group) => {
                  const active = group.id === assignmentGroupId;
                  const targetCount = members.filter((member) => member.groupId === group.id).length;
                  return (
                    <Pressable
                      key={group.id}
                      style={[styles.assignmentPill, active && styles.assignmentPillActive]}
                      onPress={() => setAssignmentGroupId(group.id)}
                    >
                      <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{group.name}</Text>
                      {assignmentScope === 'group' ? (
                        <Text style={[styles.assignmentPillMeta, active && styles.assignmentPillTextActive]}>{targetCount} targets</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={[styles.assignmentTargetNotice, { borderColor: `${selectedTargetState.tone}50`, backgroundColor: `${selectedTargetState.tone}12` }]}>
              <Text style={[styles.assignmentTargetTitle, { color: selectedTargetState.tone }]}>{selectedTargetState.label}</Text>
              <Text style={styles.assignmentTargetDetail}>{selectedTargetState.detail}</Text>
            </View>

            <Text style={styles.assignmentLabel}>Training block</Text>
            <View style={styles.coachNudgeRow}>
              <Text style={styles.coachNudgeLabel}>Coach nudges</Text>
              {Object.entries(coachNudgeTemplates).map(([key, template]) => (
                <Pressable
                  key={key}
                  style={styles.coachNudgeButton}
                  onPress={() => loadCoachNudge(key as keyof typeof coachNudgeTemplates, assignmentTargets[0]?.id ?? members[0]?.id ?? '')}
                >
                  <Text style={styles.coachNudgeText}>{template.label}</Text>
                </Pressable>
              ))}
            </View>
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
                {assignmentScope === 'member'
                  ? selectedAssignmentMember?.name ?? members[0]?.name ?? 'No member'
                  : assignmentScope === 'group'
                    ? selectedAssignmentGroup?.name ?? groups[0]?.name ?? 'No group'
                    : 'Whole squad'} / {assignmentLabel} / {activeAssignmentExerciseIds.length} exercises / {assignmentTargets.length} targets
              </Text>
              <Text style={styles.assignmentSummaryMeta}>
                This will sync to {assignmentTargets.filter((target) => target.cloudMembershipId).length} member portal{assignmentTargets.filter((target) => target.cloudMembershipId).length === 1 ? '' : 's'}; {assignmentTargets.filter((target) => !target.cloudMembershipId).length} need invite or sync.
              </Text>
              <Text style={[styles.assignmentSummaryMeta, { color: selectedTargetState.tone }]}>{selectedTargetState.label}</Text>
            </View>

            <Pressable style={styles.applyAssignmentButton} onPress={applyAssignment}>
              <Text style={styles.applyAssignmentText}>Apply Assignment</Text>
            </Pressable>
          </View>
        ) : null}

        <FlatList
          data={members}
          keyExtractor={(member) => member.id}
          scrollEnabled={false} // Adapts FlatList to render within outer ScrollView/Screen limits
          renderItem={({ item: member }) => (
            <SquadMemberCard
              member={member}
              group={groups.find((g) => g.id === member.groupId)}
              latestCompletion={latestCompletionByMember.get(member.id)}
              latestReadiness={latestReadinessByMember.get(member.id)}
              cloudEnabled={cloudEnabled}
              onCloudSync={onCloudSync}
              onDelete={confirmDeleteMember}
            />
          )}
        />
      </Card>

      <ProgrammeBuilder
        groups={groups}
        members={members}
        programmeTemplates={programmeTemplates}
        activeAssignmentExercises={activeAssignmentExercises}
        assignmentLabel={assignmentLabel}
        assignmentNote={assignmentNote}
        selectedAssignmentMode={selectedAssignmentMode}
        onAddProgrammeTemplate={onAddProgrammeTemplate}
        onDeleteProgrammeTemplate={onDeleteProgrammeTemplate}
        onUpdateMember={onUpdateMember}
        onLoadIntoStage={(title, note, exercises) => {
          setAssignmentLabel(title);
          setAssignmentNote(note);
          setStagedAssignmentExercises(exercises);
          setAssignmentOpen(true);
          if (!assignmentMemberId && members[0]) setAssignmentMemberId(members[0].id);
          if (!assignmentGroupId && groups[0]) setAssignmentGroupId(groups[0].id);
        }}
        onSetFeedback={setAssignmentFeedback}
      />
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
  pulseHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 },
  pulseValue: { color: colours.green, fontSize: 58, lineHeight: 62, fontWeight: '900' },
  pulseSummary: { flex: 1, gap: 5, alignItems: 'flex-end', paddingTop: 8 },
  pulseMetric: { color: colours.textSoft, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  pulseStatRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  pulseStat: { color: colours.muted, fontSize: 11, fontWeight: '900' },
  pulseSource: { color: colours.cyan, fontSize: 11, fontWeight: '900', marginTop: 8 },
  lifecycleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  lifecycleTile: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
  },
  lifecycleNumber: { fontSize: 26, lineHeight: 30, fontWeight: '900' },
  lifecycleLabel: { color: colours.textSoft, fontSize: 11, fontWeight: '900', marginTop: 4 },
  inviteOpsSection: {
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
    paddingVertical: 10,
    gap: 6,
  },
  inviteOpsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  inviteOpsTitle: { color: colours.text, fontSize: 13, fontWeight: '900' },
  inviteOpsCount: { color: colours.cyan, fontSize: 12, fontWeight: '900' },
  inviteOpsAction: { color: colours.textSoft, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  inviteCloudGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  inviteHealthRow: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inviteHealthMain: { minWidth: 82 },
  inviteHealthNumber: { fontSize: 28, lineHeight: 32, fontWeight: '900' },
  inviteHealthLabel: { color: colours.textSoft, fontSize: 10, fontWeight: '900', marginTop: 2 },
  inviteHealthStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  inviteHealthChip: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  inviteHealthActions: { gap: 6 },
  inviteHealthAction: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  inviteHealthStat: { color: colours.textSoft, fontSize: 10, fontWeight: '900' },
  inviteCloudTile: {
    flex: 1,
    minWidth: 96,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inviteCloudValue: { fontSize: 22, lineHeight: 26, fontWeight: '900' },
  inviteCloudLabel: { color: colours.textSoft, fontSize: 10, fontWeight: '900', marginTop: 3 },
  inviteCloudList: { gap: 6, marginBottom: 10 },
  deliveryHealthRow: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deliveryHealthMain: { minWidth: 82 },
  deliveryHealthNumber: { fontSize: 28, lineHeight: 32, fontWeight: '900' },
  deliveryHealthLabel: { color: colours.textSoft, fontSize: 10, fontWeight: '900', marginTop: 2 },
  deliveryHealthStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  deliveryHealthChip: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  deliveryHealthStat: {
    color: colours.textSoft,
    fontSize: 10,
    fontWeight: '900',
  },
  latestInviteRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: `${colours.cyan}45`,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colours.cyanDim,
    marginBottom: 4,
  },
  inviteSearchInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: colours.text,
    backgroundColor: 'rgba(0,0,0,0.12)',
    fontSize: 12,
    fontWeight: '800',
  },
  inviteFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  inviteFilterButton: {
    minHeight: 32,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  inviteFilterButtonActive: { borderColor: colours.cyan, backgroundColor: colours.cyanDim },
  inviteFilterText: { color: colours.textSoft, fontSize: 11, fontWeight: '900' },
  inviteFilterTextActive: { color: colours.cyan },
  inviteCloudRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  inviteMoreButton: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  inviteOpsRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inviteOpsActions: { alignItems: 'flex-end', gap: 6 },
  inviteOpsButton: {
    borderWidth: 1,
    borderColor: `${colours.cyan}55`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colours.cyanDim,
  },
  inviteOpsButtonText: { color: colours.cyan, fontSize: 11, fontWeight: '900' },
  inviteOpsDangerButton: { borderColor: `${colours.red}45`, backgroundColor: colours.redDim },
  inviteOpsDangerText: { color: colours.red },
  inviteOpsHint: { color: colours.amber, fontSize: 11, fontWeight: '900' },
  inviteOpsReady: { color: colours.green, fontSize: 11, fontWeight: '900' },
  inviteOpsEmpty: { color: colours.muted, fontSize: 11, fontWeight: '800' },
  reviewRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
    paddingVertical: 10,
  },
  reviewRisk: { fontSize: 12, fontWeight: '900' },
  reviewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  reviewTag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reviewTagText: { fontSize: 10, fontWeight: '900' },
  reviewDetailPanel: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  reviewDetailGrid: { flexDirection: 'row', gap: 8 },
  reviewDetailStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  reviewDetailValue: { fontSize: 22, lineHeight: 26, fontWeight: '900', marginTop: 4 },
  reviewDetailLine: { color: colours.textSoft, fontSize: 12, fontWeight: '700' },
  reviewPendingList: { gap: 4 },
  reviewActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reviewActionButton: {
    borderWidth: 1,
    borderColor: `${colours.cyan}45`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colours.cyanDim,
  },
  reviewActionText: { color: colours.cyan, fontSize: 11, fontWeight: '900' },
  assignmentQuickStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  assignmentQuickText: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colours.textSoft,
    fontSize: 11,
    fontWeight: '900',
    backgroundColor: colours.layer1,
  },
  coachNudgeRow: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  coachNudgeLabel: { color: colours.textSoft, fontSize: 11, fontWeight: '900', marginRight: 2 },
  coachNudgeButton: {
    borderWidth: 1,
    borderColor: `${colours.amber}45`,
    borderRadius: 999,
    backgroundColor: `${colours.amber}12`,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  coachNudgeText: { color: colours.amber, fontSize: 11, fontWeight: '900' },
  assignmentHistoryRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
    paddingVertical: 10,
  },
  assignmentHistoryTargets: { color: colours.textSoft, fontSize: 11, fontWeight: '700', marginTop: 3 },
  assignmentHistoryFeedback: { color: colours.amber, fontSize: 11, fontWeight: '800', marginTop: 3 },
  assignmentHistoryScore: { alignItems: 'flex-end' },
  assignmentHistoryPercent: { fontSize: 24, lineHeight: 28, fontWeight: '900' },
  deploymentDetailPanel: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  deploymentFocusLabel: { color: colours.cyan, fontSize: 11, fontWeight: '900', paddingTop: 4 },
  deploymentTargetRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
    paddingVertical: 8,
  },
  deploymentStatus: { fontSize: 11, fontWeight: '900' },
  deploymentStatusStack: { alignItems: 'flex-end', gap: 3 },
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
  googleSheetsButton: {
    alignItems: 'center',
    backgroundColor: colours.green,
    borderRadius: 14,
    paddingVertical: 12,
  },
  googleSheetsButtonText: { color: colours.background, fontSize: 14, fontWeight: '900' },
  googleSheetsStatus: { color: colours.textSoft, fontSize: 12, lineHeight: 18, marginTop: 10 },
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
  schemaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  schemaPill: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colours.layer1,
  },
  schemaPillText: { color: colours.cyan, fontSize: 10, fontWeight: '900' },
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
  assignmentPillMeta: { fontSize: 9, fontWeight: '900', marginTop: 3 },
  assignmentTargetNotice: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  assignmentTargetTitle: { fontSize: 12, fontWeight: '900' },
  assignmentTargetDetail: { color: colours.textSoft, fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 3 },
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
  assignmentSummaryMeta: { fontSize: 11, fontWeight: '900', marginTop: 4 },
  emptyAssignmentText: { color: colours.muted, fontSize: 12, fontWeight: '800' },
  applyAssignmentButton: {
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colours.cyan,
    paddingVertical: 12,
  },
  applyAssignmentText: { color: colours.background, fontSize: 14, fontWeight: '900' },
  memberCopy: { flex: 1 },
  memberName: { color: colours.text, fontWeight: '900' },
  memberNote: { color: colours.textSoft, fontSize: 11, fontWeight: '700', marginTop: 3 },
  memberScore: { fontSize: 22, fontWeight: '900' },
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
  completionTime: { color: colours.cyan, fontSize: 11, fontWeight: '900', textAlign: 'right' },
});
