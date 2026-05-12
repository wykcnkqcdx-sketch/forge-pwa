import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, radius } from '../theme';
import { getBestSessions, PR_META, type PRType } from '../lib/personalRecords';
import type { TrainingSession } from '../data/domain';

const PR_ORDER: PRType[] = [
  'bestRuckDistance',
  'bestRuckLoad',
  'bestRuckScore',
  'bestRuckPace',
  'bestSessionScore',
  'longestSession',
];

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
}

export function PRRecordsCard({ sessions }: { sessions: TrainingSession[] }) {
  const records = useMemo(() => getBestSessions(sessions), [sessions]);
  const entries = PR_ORDER.map(type => ({ type, record: records[type] })).filter(e => e.record != null);

  if (entries.length === 0) return null;

  return (
    <View style={st.root}>
      <Text style={st.title}>PERSONAL RECORDS</Text>
      <View style={st.grid}>
        {entries.map(({ type, record }) => {
          const meta = PR_META[type];
          return (
            <View key={type} style={st.cell}>
              <View style={st.iconWrap}>
                <Ionicons name={meta.icon as any} size={14} color={colours.cyan} />
              </View>
              <Text style={st.value}>{record!.formattedValue}</Text>
              <Text style={st.label}>{meta.label.toUpperCase()}</Text>
              <Text style={st.sessionTitle} numberOfLines={1}>{record!.session.title}</Text>
              <Text style={st.date}>{formatDate(record!.session.completedAt)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 10 },
  title: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: colours.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: '47%',
    backgroundColor: colours.surface,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    padding: 10,
    gap: 3,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${colours.cyan}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  value: {
    fontSize: 20,
    fontWeight: '900',
    color: colours.cyan,
    fontVariant: ['tabular-nums'],
    lineHeight: 24,
  },
  label: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: colours.muted,
  },
  sessionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colours.text,
    marginTop: 4,
  },
  date: {
    fontSize: 9,
    fontWeight: '600',
    color: colours.soft,
  },
});
