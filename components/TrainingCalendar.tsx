import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colours, typography } from '../theme';
import type { TrainingSession } from '../data/domain';
import { statusColors } from '../utils/styling';

type Props = {
  sessions: TrainingSession[];
};

const SESSION_COLOURS: Record<TrainingSession['type'], string> = {
  Ruck: colours.cyan,
  Run: colours.green,
  Strength: colours.amber,
  Resistance: colours.sand,
  Cardio: '#9B59B6',
  Workout: colours.cyan,
  Mobility: '#27AE60',
};

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function isoDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function TrainingCalendar({ sessions }: Props) {
  const { weeks, monthLabels } = useMemo(() => {
    const today = startOfDay(new Date());
    const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0 ... Sun=6
    const calStart = new Date(today);
    calStart.setDate(today.getDate() - dayOfWeek - 21); // 4 full weeks back

    const sessionMap: Record<string, TrainingSession[]> = {};
    for (const s of sessions) {
      if (!s.completedAt) continue;
      const key = s.completedAt.slice(0, 10);
      if (!sessionMap[key]) sessionMap[key] = [];
      sessionMap[key].push(s);
    }

    const weeksArr: Array<Array<{ date: string; types: TrainingSession['type'][]; isToday: boolean; isFuture: boolean; maxRpe: number }>> = [];
    const todayStr = isoDateStr(today);
    const monthLabelSet: Array<{ label: string; col: number }> = [];
    let lastMonth = -1;

    for (let w = 0; w < 4; w++) {
      const week: typeof weeksArr[0] = [];
      for (let d = 0; d < 7; d++) {
        const cell = new Date(calStart);
        cell.setDate(calStart.getDate() + w * 7 + d);
        const dateStr = isoDateStr(cell);
        if (w === 0 && cell.getMonth() !== lastMonth) {
          lastMonth = cell.getMonth();
          monthLabelSet.push({ label: cell.toLocaleString('default', { month: 'short' }).toUpperCase(), col: d });
        }
        const daySessions = sessionMap[dateStr] ?? [];
        const maxRpe = daySessions.reduce((max, s) => Math.max(max, s.rpe || 0), 0);
        week.push({
          date: dateStr,
          types: daySessions.map(s => s.type),
          isToday: dateStr === todayStr,
          isFuture: cell > today,
          maxRpe,
        });
      }
      weeksArr.push(week);
    }

    return { weeks: weeksArr, monthLabels: monthLabelSet };
  }, [sessions]);

  return (
    <View style={styles.container}>
      <View style={styles.dayRow}>
        {DAY_LABELS.map((d, i) => (
          <Text key={i} style={styles.dayLabel}>{d}</Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((cell) => (
            <View
              key={cell.date}
              style={[
                styles.cell,
                cell.maxRpe >= 8 && { backgroundColor: statusColors(colours.red).bgMed, borderColor: statusColors(colours.red).borderMed, borderWidth: 1 },
                cell.maxRpe >= 5 && cell.maxRpe < 8 && { backgroundColor: statusColors(colours.amber).bgMed, borderColor: statusColors(colours.amber).borderMed, borderWidth: 1 },
                cell.maxRpe > 0 && cell.maxRpe < 5 && { backgroundColor: statusColors(colours.green).bgMed, borderColor: statusColors(colours.green).borderMed, borderWidth: 1 },
                cell.isToday && styles.cellToday,
                cell.isFuture && styles.cellFuture,
              ]}
            >
              {cell.types.length === 0 ? (
                <View style={[styles.dot, styles.dotEmpty]} />
              ) : cell.types.length === 1 ? (
                <View style={[styles.dot, { backgroundColor: SESSION_COLOURS[cell.types[0]] }]} />
              ) : (
                <View style={styles.multiDotRow}>
                  {cell.types.slice(0, 3).map((t, i) => (
                    <View key={i} style={[styles.dotSmall, { backgroundColor: SESSION_COLOURS[t] }]} />
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      ))}
      <View style={styles.legend}>
        {Object.entries(SESSION_COLOURS).map(([type, color]) => (
          <View key={type} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{type}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: statusColors(colours.red).bgMed, borderColor: statusColors(colours.red).borderMed, borderWidth: 1 }]} />
          <Text style={styles.legendLabel}>High RPE (8-10)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: statusColors(colours.amber).bgMed, borderColor: statusColors(colours.amber).borderMed, borderWidth: 1 }]} />
          <Text style={styles.legendLabel}>Med RPE (5-7)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  dayRow: { flexDirection: 'row', marginBottom: 2 },
  dayLabel: { flex: 1, textAlign: 'center', ...typography.caption, color: colours.muted, fontSize: 10 },
  weekRow: { flexDirection: 'row', gap: 3 },
  cell: {
    flex: 1, aspectRatio: 1, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  cellToday: { borderWidth: 1, borderColor: colours.cyan },
  cellFuture: { opacity: 0.3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotEmpty: { backgroundColor: 'rgba(255,255,255,0.08)' },
  dotSmall: { width: 5, height: 5, borderRadius: 3 },
  multiDotRow: { flexDirection: 'row', gap: 2, flexWrap: 'wrap', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { ...typography.caption, color: colours.muted, fontSize: 10 },
});
