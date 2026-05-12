import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colours, radius } from '../theme';
import type { TrainingSession } from '../data/mockData';

const WEEKS        = 8;
const CHART_H      = 110;
const BAR_RADIUS   = 4;

type WeekBucket = {
  load:    number;
  label:   string;
  isCurrent: boolean;
};

function buildBuckets(sessions: TrainingSession[]): WeekBucket[] {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  return Array.from({ length: WEEKS }, (_, i) => {
    const weeksAgo = WEEKS - 1 - i;
    const end = new Date(now);
    end.setDate(now.getDate() - weeksAgo * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const load = sessions
      .filter(s => {
        if (!s.completedAt) return false;
        const t = new Date(s.completedAt).getTime();
        return t >= start.getTime() && t <= end.getTime();
      })
      .reduce((sum, s) => sum + s.durationMinutes * s.rpe, 0);

    const label = weeksAgo === 0
      ? 'NOW'
      : start.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });

    return { load, label, isCurrent: weeksAgo === 0 };
  });
}

function barTone(load: number, avg: number): string {
  if (load === 0) return colours.border;
  const r = load / Math.max(1, avg);
  if (r >= 1.4)  return colours.red;
  if (r >= 1.15) return colours.amber;
  return colours.green;
}

export function WeeklyLoadChart({ sessions }: { sessions: TrainingSession[] }) {
  const buckets = useMemo(() => buildBuckets(sessions), [sessions]);

  const maxLoad = useMemo(() => Math.max(1, ...buckets.map(b => b.load)), [buckets]);
  const nonEmpty = buckets.filter(b => b.load > 0);
  const avgLoad  = nonEmpty.length
    ? Math.round(nonEmpty.reduce((s, b) => s + b.load, 0) / nonEmpty.length)
    : 0;

  const avgLineY = avgLoad > 0
    ? CHART_H - Math.round((avgLoad / maxLoad) * CHART_H)
    : null;

  const currentLoad = buckets[WEEKS - 1].load;
  const trend = nonEmpty.length >= 2
    ? currentLoad >= buckets[WEEKS - 2].load ? 'up' : 'down'
    : null;

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <View>
          <Text style={st.title}>WEEKLY LOAD</Text>
          <Text style={st.sub}>Training impulse (TRIMP) per week</Text>
        </View>
        <View style={st.headerRight}>
          {avgLoad > 0 && (
            <Text style={st.avg}>{avgLoad.toLocaleString()} avg</Text>
          )}
          {trend && (
            <Text style={[st.trend, { color: trend === 'up' ? colours.amber : colours.green }]}>
              {trend === 'up' ? '↑' : '↓'} vs last
            </Text>
          )}
        </View>
      </View>

      {/* Chart */}
      <View style={[st.chart, { height: CHART_H }]}>
        {/* Average line */}
        {avgLineY !== null && (
          <View style={[st.avgLine, { top: avgLineY }]} />
        )}

        {/* Bars */}
        {buckets.map((b, i) => {
          const barH = b.load > 0 ? Math.max(4, Math.round((b.load / maxLoad) * CHART_H)) : 2;
          const tone = barTone(b.load, avgLoad);
          return (
            <View key={i} style={st.barCol}>
              {b.load > 0 && (
                <Text style={[st.barVal, { color: tone }]} numberOfLines={1}>
                  {b.load >= 1000 ? `${(b.load / 1000).toFixed(1)}k` : String(b.load)}
                </Text>
              )}
              <View
                style={[
                  st.bar,
                  {
                    height: barH,
                    backgroundColor: b.isCurrent ? tone : `${tone}90`,
                    borderRadius: BAR_RADIUS,
                    borderWidth: b.isCurrent ? 1 : 0,
                    borderColor: b.isCurrent ? tone : 'transparent',
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* X-axis labels */}
      <View style={st.labels}>
        {buckets.map((b, i) => (
          <Text
            key={i}
            style={[st.xLabel, b.isCurrent && { color: colours.cyan }]}
            numberOfLines={1}
          >
            {b.label}
          </Text>
        ))}
      </View>

      {/* Legend */}
      <View style={st.legend}>
        {([
          [colours.green, 'Normal'],
          [colours.amber, 'Elevated (+15%)'],
          [colours.red,   'Spike (+40%)'],
        ] as const).map(([c, l]) => (
          <View key={l} style={st.legendItem}>
            <View style={[st.legendDot, { backgroundColor: c }]} />
            <Text style={st.legendText}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 8 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: colours.muted,
  },
  sub: {
    fontSize: 10,
    fontWeight: '700',
    color: colours.textSoft,
    marginTop: 2,
  },
  headerRight: { alignItems: 'flex-end', gap: 2 },
  avg: { fontSize: 11, fontWeight: '900', color: colours.muted, letterSpacing: 0.4 },
  trend: { fontSize: 10, fontWeight: '900' },

  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    position: 'relative',
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: `${colours.muted}50`,
  },

  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  barVal: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  bar: {
    width: '100%',
  },

  labels: {
    flexDirection: 'row',
    gap: 5,
  },
  xLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 7,
    fontWeight: '900',
    color: colours.muted,
    letterSpacing: 0.2,
  },

  legend: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 8, fontWeight: '700', color: colours.muted },
});
