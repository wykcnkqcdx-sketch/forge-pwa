import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colours, radius } from '../theme';
import type { ReadinessLog } from '../data/domain';

const DAYS    = 14;
const CHART_H = 72;

function computeScore(log: ReadinessLog): number {
  const hydPenalty = log.hydration === 'Optimal' ? 0 : log.hydration === 'Adequate' ? 4 : 10;
  const score =
    100
    - (5 - log.sleepQuality) * 8
    - log.soreness * 4
    - (log.pain    ?? 1) * 6
    - (5 - (log.mood    ?? 3)) * 4
    - (log.illness ?? 1) * 7
    - hydPenalty;
  return Math.max(25, Math.min(98, Math.round(score)));
}

function barTone(score: number): string {
  if (score >= 75) return colours.green;
  if (score >= 50) return colours.amber;
  return colours.red;
}

function toLocalDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

type DayBar = {
  score:   number | null;
  isToday: boolean;
  label:   string;
};

function buildBars(logs: ReadinessLog[], memberId?: string): DayBar[] {
  const byDay = new Map<string, ReadinessLog>();
  for (const log of logs) {
    if (memberId && log.memberId && log.memberId !== memberId) continue;
    const k = toLocalDay(log.date);
    const prev = byDay.get(k);
    if (!prev || new Date(log.date) > new Date(prev.date)) byDay.set(k, log);
  }

  const today = todayKey();
  return Array.from({ length: DAYS }, (_, i) => {
    const ago = DAYS - 1 - i;
    const k   = dayKey(ago);
    const log = byDay.get(k);
    const d   = new Date();
    d.setDate(d.getDate() - ago);
    return {
      score:   log ? computeScore(log) : null,
      isToday: k === today,
      label:   ago === 0 ? 'TODAY' : ago === 7 ? '7D' : '',
    };
  });
}

export function ReadinessTrendCard({
  readinessLogs,
  memberId,
}: {
  readinessLogs: ReadinessLog[];
  memberId?: string;
}) {
  const bars = useMemo(
    () => buildBars(readinessLogs, memberId),
    [readinessLogs, memberId],
  );

  const scoredBars = bars.filter(b => b.score !== null);
  if (scoredBars.length < 2) return null;

  const avg   = Math.round(scoredBars.reduce((s, b) => s + b.score!, 0) / scoredBars.length);
  const trend = scoredBars.length >= 2
    ? scoredBars[scoredBars.length - 1].score! - scoredBars[scoredBars.length - 2].score!
    : 0;

  const avgLineY = CHART_H - Math.round((avg / 100) * CHART_H);

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <Text style={st.title}>14-DAY READINESS</Text>
        <View style={st.headerRight}>
          <Text style={st.avg}>avg {avg}</Text>
          {trend !== 0 && (
            <Text style={[st.trend, { color: trend > 0 ? colours.green : colours.red }]}>
              {trend > 0 ? `+${trend}` : trend} today
            </Text>
          )}
        </View>
      </View>

      {/* Chart */}
      <View style={[st.chart, { height: CHART_H }]}>
        {/* Avg line */}
        <View style={[st.avgLine, { top: avgLineY }]} />

        {bars.map((bar, i) => {
          const h = bar.score != null
            ? Math.max(4, Math.round((bar.score / 100) * CHART_H))
            : 2;
          const tone = bar.score != null ? barTone(bar.score) : colours.border;
          return (
            <View key={i} style={st.barCol}>
              <View
                style={[
                  st.bar,
                  {
                    height: h,
                    backgroundColor: bar.score != null ? `${tone}${bar.isToday ? 'FF' : '90'}` : colours.border,
                    borderRadius: BAR_R,
                    borderWidth: bar.isToday ? 1 : 0,
                    borderColor: tone,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* X labels */}
      <View style={st.xRow}>
        {bars.map((bar, i) => (
          <Text key={i} style={[st.xLabel, bar.isToday && st.xLabelToday]}>
            {bar.label}
          </Text>
        ))}
      </View>

      {/* Legend */}
      <View style={st.legend}>
        {([
          [colours.green, '≥75 Ready'],
          [colours.amber, '50–74 Moderate'],
          [colours.red,   '<50 Recover'],
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

const BAR_R = 3;

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
  headerRight:  { alignItems: 'flex-end', gap: 2 },
  avg:          { fontSize: 11, fontWeight: '900', color: colours.muted },
  trend:        { fontSize: 10, fontWeight: '900' },

  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    position: 'relative',
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: `${colours.muted}45`,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
  },

  xRow: { flexDirection: 'row', gap: 3 },
  xLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 6,
    fontWeight: '900',
    color: colours.muted,
  },
  xLabelToday: { color: colours.cyan },

  legend:     { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot:  { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 7, fontWeight: '700', color: colours.muted },
});
