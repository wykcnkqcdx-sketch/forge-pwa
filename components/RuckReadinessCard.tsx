import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { colours, typography } from '../theme';
import { responsiveSpacing, statusColors } from '../utils/styling';

type ReadinessCheck = {
  label: string;
  value: string;
  tone: string;
};

export type RuckReadiness = {
  blockingIssues: number;
  status: string;
  tone: string;
  checks: ReadinessCheck[];
};

export function RuckReadinessCard({ readiness }: { readiness: RuckReadiness }) {
  return (
    <Card>
      <View style={styles.navHeader}>
        <View>
          <Text style={styles.cardTitle}>Route Readiness</Text>
          <Text style={styles.muted}>{readiness.blockingIssues === 0 ? 'Plan checks clear' : `${readiness.blockingIssues} item(s) need attention`}</Text>
        </View>
        <View style={[styles.readinessBadge, { borderColor: statusColors(readiness.tone).borderMed, backgroundColor: statusColors(readiness.tone).bgMed }]}>
          <Text style={[styles.readinessBadgeText, { color: readiness.tone }]}>{readiness.status}</Text>
        </View>
      </View>

      <View style={styles.readinessList}>
        {readiness.checks.map((check) => (
          <View key={check.label} style={styles.readinessRow}>
            <View style={[styles.readinessDot, { backgroundColor: check.tone }]} />
            <Text style={styles.readinessLabel}>{check.label}</Text>
            <Text style={[styles.readinessValue, { color: check.tone }]}>{check.value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  navHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: responsiveSpacing('md') },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  muted: { ...typography.caption, color: colours.muted },
  readinessBadge: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  readinessBadgeText: { ...typography.caption, fontWeight: '900', letterSpacing: 0.8 },
  readinessList: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  readinessRow: {
    minHeight: 42,
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  readinessDot: { width: 8, height: 8, borderRadius: 4 },
  readinessLabel: { ...typography.caption, color: colours.text, fontWeight: '900', flex: 1 },
  readinessValue: { ...typography.caption, fontWeight: '900', textAlign: 'right' },
});
