import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colours, typography } from '../theme';
import { TrainingSession } from '../data/mockData';
import { getRuckMissionBrief, type RuckMissionBrief } from '../lib/aiGuidance';
import { responsiveSpacing } from '../utils/styling';

export function RuckMissionBriefCard({
  targetDistanceKm,
  targetMinutes,
  weightKg,
  sessions,
}: {
  targetDistanceKm: number;
  targetMinutes: number;
  weightKg: number;
  sessions: TrainingSession[];
}) {
  const [missionBrief, setMissionBrief] = useState<RuckMissionBrief | null>(null);
  const [missionBriefLoading, setMissionBriefLoading] = useState(false);

  async function requestBrief() {
    setMissionBriefLoading(true);
    setMissionBrief(null);
    const brief = await getRuckMissionBrief(targetDistanceKm, targetMinutes, weightKg, null, sessions);
    setMissionBrief(brief);
    setMissionBriefLoading(false);
  }

  return (
    <Card>
      <View style={styles.navHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Mission Brief</Text>
          <Text style={styles.muted}>Claude tactical assessment for this ruck</Text>
        </View>
        <Pressable
          style={[styles.briefBtn, missionBriefLoading && { opacity: 0.5 }]}
          disabled={missionBriefLoading}
          onPress={requestBrief}
        >
          <Ionicons name="flash-outline" size={12} color={colours.cyan} />
          <Text style={styles.briefBtnText}>{missionBriefLoading ? 'THINKING...' : 'BRIEF ME'}</Text>
        </Pressable>
      </View>

      {missionBrief && (
        <View style={[styles.briefResult, { borderColor: missionBrief.tone }]}>
          <View style={styles.briefStatusRow}>
            <View style={[styles.briefStatusBadge, { backgroundColor: missionBrief.tone }]}>
              <Text style={styles.briefStatusText}>{missionBrief.status}</Text>
            </View>
            <Text style={[styles.briefRec, { flex: 1 }]}>{missionBrief.recommendation}</Text>
          </View>
          <Text style={styles.briefLine}>
            <Text style={[styles.briefLineLabel, { color: missionBrief.tone }]}>LOAD  </Text>
            {missionBrief.loadGuidance}
          </Text>
          <Text style={styles.briefLine}>
            <Text style={[styles.briefLineLabel, { color: missionBrief.tone }]}>PACE  </Text>
            {missionBrief.paceGuidance}
          </Text>
        </View>
      )}

      {!missionBrief && !missionBriefLoading && (
        <Text style={styles.muted}>Tap BRIEF ME for a Claude-powered GO / CAUTION / NO-GO assessment based on your load, pace target, and recent training.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  muted: { ...typography.caption, color: colours.muted },
  navHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: responsiveSpacing('md') },
  briefBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.4)',
    backgroundColor: 'rgba(103,232,249,0.08)',
  },
  briefBtnText: { color: colours.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  briefResult: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 8,
  },
  briefStatusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  briefStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  briefStatusText: { color: colours.background, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  briefRec: { color: colours.text, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  briefLine: { color: colours.text, fontSize: 12, lineHeight: 18 },
  briefLineLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
});
