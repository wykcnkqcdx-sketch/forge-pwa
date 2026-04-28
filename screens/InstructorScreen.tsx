import React, { useState } from 'react';
import { Alert, Linking, Text, TextInput, View, StyleSheet, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { colours } from '../theme';
import { SquadMember, trainingGroups, wearableConnections } from '../data/mockData';

interface InstructorScreenProps {
  pinEnabled: boolean;
  members: SquadMember[];
  onSetPin: () => void;
  onWipe: () => void;
  onExport: () => void;
  onImport: () => void;
  onAddMember: (member: SquadMember) => void;
}

const appInviteUrl = 'https://wykcnkqcdx-sketch.github.io/forge-pwa/';

export function InstructorScreen({ pinEnabled, members, onSetPin, onWipe, onExport, onImport, onAddMember }: InstructorScreenProps) {
  const [groups, setGroups] = useState(trainingGroups);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(trainingGroups[0]?.id ?? 'alpha');

  const groupScores = useMemo(() => {
    return groups.map((group) => {
      const groupMembers = members.filter((member) => member.groupId === group.id);
      const readiness = groupMembers.length
        ? Math.round(groupMembers.reduce((total, member) => total + member.readiness, 0) / groupMembers.length)
        : 0;
      const compliance = groupMembers.length
        ? Math.round(groupMembers.reduce((total, member) => total + member.compliance, 0) / groupMembers.length)
        : 0;
      const load = groupMembers.length
        ? Math.round(groupMembers.reduce((total, member) => total + member.load, 0) / groupMembers.length)
        : 0;
      const teamScore = Math.round(readiness * 0.5 + compliance * 0.3 + Math.max(0, 100 - load) * 0.2);

      return { ...group, members: groupMembers, readiness, compliance, load, teamScore };
    });
  }, [groups, members]);

  const atRiskCount = useMemo(() => members.filter((member) => member.risk !== 'Low').length, [members]);
  const averageTeamScore = useMemo(() => Math.round(groupScores.reduce((total, group) => total + group.teamScore, 0) / groupScores.length) || 0, [groupScores]);

  function createGroup() {
    const nextNumber = groups.length + 1;
    const nextId = `custom-${Date.now()}`;
    setGroups((current) => [
      ...current,
      {
        id: nextId,
        name: `Group ${nextNumber}`,
        focus: 'Custom programme',
        targetScore: 78,
      },
    ]);
    setSelectedGroupId(nextId);
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
      const subject = encodeURIComponent('Join FORGE Tactical Fitness');
      const body = encodeURIComponent(
        `You have been added to the FORGE Tactical Fitness squad dashboard.\n\nOpen the app here:\n${appInviteUrl}\n\nFor now, the coach tracks your metrics locally. Shared login and live team sync will need a backend account system.`
      );
      Linking.openURL(`mailto:${trimmedEmail}?subject=${subject}&body=${body}`).catch(() => {
        Alert.alert('Member invited', `${trimmedName} was added. Copy the app link and send it to ${trimmedEmail}.`);
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
            <Text style={styles.actionMeta}>{pinEnabled ? 'App lock active' : 'Protect local data'}</Text>
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
            <Text style={styles.actionMeta}>Destroy local data</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.grid}>
        <MetricCard icon="people" label="Members" value={`${members.length}`} sub="active squad" />
        <MetricCard icon="podium" label="Team Score" value={`${averageTeamScore}`} sub={`${atRiskCount} need review`} tone={atRiskCount > 2 ? colours.amber : colours.green} />
      </View>

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
          <Pressable style={styles.createButton} onPress={createGroup}>
            <Text style={styles.createButtonText}>Create</Text>
          </Pressable>
        </View>
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
          <Pressable style={styles.assignButton} onPress={() => Alert.alert('Assign Training', 'Select a training block to assign to the squad. (Backend sync required for live updates)')}>
            <Text style={styles.assignButtonText}>Assign</Text>
          </Pressable>
        </View>

        {members.map((member) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.headerRow}>
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.muted}>
                  {groups.find((group) => group.id === member.groupId)?.name ?? 'Unassigned'} - {member.inviteStatus ?? 'Manual'} - Compliance {member.compliance}% - Risk {member.risk}
                </Text>
                {member.email && <Text style={styles.memberEmail}>{member.email}</Text>}
              </View>
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
            </View>
            <ProgressBar value={member.readiness} />
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
