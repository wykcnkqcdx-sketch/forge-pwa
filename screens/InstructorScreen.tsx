import React, { useMemo, useState } from 'react';
import { Alert, Linking, Platform, Text, TextInput, View, StyleSheet, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { buildCoachGuidance } from '../lib/aiGuidance';
import { colours } from '../theme';
import { SquadMember, TrainingGroup, trainingModes, TrainingSession, wearableConnections } from '../data/mockData';

interface InstructorScreenProps {
  pinEnabled: boolean;
  sessions: TrainingSession[];
  members: SquadMember[];
  groups: TrainingGroup[];
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
  onCloudSignOut: () => void;
}

const appInviteUrl = 'https://wykcnkqcdx-sketch.github.io/forge-pwa/';
const assignmentTemplates = [...new Set([...trainingModes.map((mode) => mode.title), 'Recovery Walk', 'Mobility Reset'])];

export function InstructorScreen({
  pinEnabled,
  sessions,
  members,
  groups,
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
  onCloudSignOut,
}: InstructorScreenProps) {
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupFocus, setNewGroupFocus] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? 'alpha');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentMemberId, setAssignmentMemberId] = useState('');
  const [assignmentGroupId, setAssignmentGroupId] = useState(groups[0]?.id ?? 'alpha');
  const [assignmentLabel, setAssignmentLabel] = useState(assignmentTemplates[0]);
  const [assignmentFeedback, setAssignmentFeedback] = useState('');

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
  const selectedAssignmentMember = members.find((member) => member.id === assignmentMemberId) ?? null;
  const selectedAssignmentGroup = groups.find((group) => group.id === assignmentGroupId) ?? null;
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
    const trimmedEmail = newMemberEmail.trim().toLowerCase();
    if (!trimmedName) {
      Alert.alert('Name required', 'Enter a team member name before adding them.');
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Email check', 'Enter a valid email address or leave email blank for manual tracking.');
      return;
    }

    const inviteSubject = 'Join FORGE Tactical Fitness';
    const inviteBody = `You have been added to the FORGE Tactical Fitness squad dashboard.\n\nOpen the app here:\n${appInviteUrl}\n\nFor now, the coach tracks your metrics locally. Shared login and live team sync will need a backend account system.`;

    onAddMember({
      id: `member-${Date.now()}`,
      groupId: selectedGroupId,
      name: trimmedName,
      email: trimmedEmail || undefined,
      readiness: 72,
      compliance: 80,
      risk: 'Low',
      load: 65,
      inviteStatus: trimmedEmail ? 'Invited' : 'Manual',
    });

    setNewMemberName('');
    setNewMemberEmail('');

    if (trimmedEmail) {
      const subject = encodeURIComponent(inviteSubject);
      const body = encodeURIComponent(inviteBody);
      const mailtoUrl = `mailto:${trimmedEmail}?subject=${subject}&body=${body}`;

      if (Platform.OS === 'web') {
        window.location.href = mailtoUrl;
        window.alert(`${trimmedName} was added. Your email app should open with the invite draft. If it does not, send them this link: ${appInviteUrl}`);
        return;
      }

      Linking.openURL(mailtoUrl)
        .then(() => {
          Alert.alert('Member invited', `${trimmedName} was added and an invite draft was opened.`);
        })
        .catch(() => {
          Alert.alert('Member added', `${trimmedName} was added. Copy the app link and send it to ${trimmedEmail}.`);
        });
    } else {
      Alert.alert('Member added', `${trimmedName} is now tracked manually in this squad.`);
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
      setAssignmentFeedback('');
    }
    setAssignmentOpen(nextOpen);
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

    onUpdateMember(member.id, { groupId: group.id, assignment: assignmentLabel });
    const message = `${member.name} is now assigned to ${assignmentLabel} in ${group.name}.`;
    setAssignmentMemberId(member.id);
    setAssignmentGroupId(group.id);
    setAssignmentFeedback(message);
    setAssignmentOpen(false);
    showMessage('Assignment saved', message);
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
          {cloudEnabled && cloudEmail ? (
            <Pressable style={styles.cloudSignOutButton} onPress={onCloudSignOut}>
              <Text style={styles.cloudSignOutText}>Sign Out</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.cloudBadge, { borderColor: `${cloudTone}40`, backgroundColor: `${cloudTone}12` }]}>
          <Text style={[styles.cloudBadgeText, { color: cloudTone }]}>
            {cloudEnabled ? cloudStatus.toUpperCase() : 'LOCAL ONLY'}
          </Text>
        </View>
        <Text style={styles.cloudCopy}>
          {cloudEnabled
            ? cloudEmail
              ? `${cloudEmail} is connected. Sessions and members sync to the backend when cloud status is healthy.`
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
                    onPress={() => setAssignmentLabel(item)}
                  >
                    <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.assignmentSummary}>
              <Text style={styles.assignmentSummaryText}>
                {selectedAssignmentMember?.name ?? members[0]?.name ?? 'No member'} {'->'} {selectedAssignmentGroup?.name ?? groups[0]?.name ?? 'No group'} / {assignmentLabel}
              </Text>
            </View>

            <Pressable style={styles.applyAssignmentButton} onPress={applyAssignment}>
              <Text style={styles.applyAssignmentText}>Apply Assignment</Text>
            </Pressable>
          </View>
        ) : null}

        {members.map((member) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.headerRow}>
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.muted}>
                  {groups.find((group) => group.id === member.groupId)?.name ?? 'Unassigned'} - {member.inviteStatus ?? 'Manual'} - Compliance {member.compliance}% - Risk {member.risk}
                </Text>
                {member.email && <Text style={styles.memberEmail}>{member.email}</Text>}
                {member.assignment && <Text style={styles.memberAssignment}>Assigned: {member.assignment}</Text>}
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
                <Text style={styles.factorValue}>--</Text>
              </View>
            ))}
          </View>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Programme Builder</Text>
        <View style={styles.programmeGrid}>
          {['Strength', 'Resistance', 'Cardio', 'Workout', 'Ruck', 'Mobility'].map((item) => (
            <View key={item} style={styles.programmeCard}>
              <Text style={styles.programmeText}>{item}</Text>
            </View>
          ))}
        </View>
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
  memberEmail: { color: colours.cyan, fontSize: 11, fontWeight: '800', marginTop: 3 },
  memberAssignment: { color: colours.green, fontSize: 11, fontWeight: '800', marginTop: 3 },
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
  programmeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  programmeCard: {
    width: '47%',
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  programmeText: { color: colours.text, fontWeight: '900' },
});
