import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { colours, typography } from '../theme';
import type { RuckSplit } from '../data/domain';
import { formatElapsed } from '../utils/ruck';
import { responsiveSpacing } from '../utils/styling';

export function RuckSplitsCard({ splits }: { splits: RuckSplit[] }) {
  const latestSplit = splits[splits.length - 1] ?? null;

  return (
    <Card>
      <View style={styles.navHeader}>
        <View>
          <Text style={styles.cardTitle}>1km Splits</Text>
          <Text style={styles.muted}>{splits.length > 0 ? `${splits.length} completed` : 'Auto records while GPS moves'}</Text>
        </View>
        <View style={styles.splitBadge}>
          <Text style={styles.splitBadgeValue}>{latestSplit ? `${Math.round(latestSplit.splitSeconds / 60)}m` : '--'}</Text>
          <Text style={styles.splitBadgeLabel}>LAST</Text>
        </View>
      </View>

      {splits.length === 0 ? (
        <Text style={styles.navGuide}>Your first split appears when the tracked route reaches 1km.</Text>
      ) : (
        <View style={styles.splitList}>
          {splits.slice(-5).map((split) => (
            <View key={split.km} style={styles.splitRow}>
              <Text style={styles.splitKm}>KM {split.km}</Text>
              <Text style={styles.splitValue}>{formatElapsed(split.splitSeconds)}</Text>
              <Text style={styles.splitMeta}>{formatElapsed(split.elapsedSeconds)} total</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  navHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: responsiveSpacing('md') },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  muted: { ...typography.caption, color: colours.muted },
  navGuide: { color: colours.textSoft, fontSize: 13, lineHeight: 19, marginTop: 12 },
  splitBadge: {
    minWidth: 58,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  splitBadgeValue: { color: colours.cyan, fontSize: 15, fontWeight: '900' },
  splitBadgeLabel: { ...typography.label, color: colours.muted, letterSpacing: 1 },
  splitList: { marginTop: 12, gap: 8 },
  splitRow: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
  },
  splitKm: { ...typography.caption, color: colours.text, fontWeight: '900', width: 52 },
  splitValue: { color: colours.cyan, fontSize: 15, fontWeight: '900', flex: 1, textAlign: 'center' },
  splitMeta: { ...typography.caption, color: colours.muted, fontWeight: '800', width: 84, textAlign: 'right' },
});
