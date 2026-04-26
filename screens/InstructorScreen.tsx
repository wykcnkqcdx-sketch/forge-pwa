import React from 'react';
import { Text, View, StyleSheet, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { colours } from '../theme';
import { squadMembers } from '../data/mockData';

interface InstructorScreenProps {
  pinEnabled: boolean;
  onSetPin: () => void;
  onWipe: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function InstructorScreen({ pinEnabled, onSetPin, onWipe, onExport, onImport }: InstructorScreenProps) {
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
        <MetricCard icon="people" label="Members" value="24" sub="active squad" />
        <MetricCard icon="warning" label="At Risk" value="3" sub="needs review" tone={colours.red} />
      </View>

      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Squad Readiness</Text>
          <Pressable style={styles.assignButton}>
            <Text style={styles.assignButtonText}>Assign</Text>
          </Pressable>
        </View>

        {squadMembers.map((member) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.headerRow}>
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.muted}>
                  Compliance {member.compliance}% - Risk {member.risk}
                </Text>
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
          {['Run', 'Ruck', 'Strength', 'Mobility'].map((item) => (
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
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: 12 },
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
  memberScore: { fontSize: 22, fontWeight: '900' },
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
