import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colours } from '../theme';
import { useResponsive } from '../utils/responsive';
import type { TrainingSession } from '../data/mockData';

const COLS = 13;
const ROWS = 7;
const GAP  = 2;

type DayCell = {
  date:   Date;
  trimp:  number;
  today:  boolean;
  future: boolean;
};

function cellColour(trimp: number): string {
  if (trimp === 0)   return colours.border;
  if (trimp < 100)   return `${colours.cyan}50`;
  if (trimp < 250)   return `${colours.cyan}85`;
  return colours.cyan;
}

function buildColumns(sessions: TrainingSession[]): Array<{
  cells:      DayCell[];
  monthLabel: string | null;
}> {
  const trimpByDay = new Map<string, number>();
  for (const s of sessions) {
    if (!s.completedAt) continue;
    const key = new Date(s.completedAt).toDateString();
    trimpByDay.set(key, (trimpByDay.get(key) ?? 0) + s.durationMinutes * s.rpe);
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayStr = now.toDateString();

  // Monday of the current week
  const dow = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));

  // Earliest Monday to show (12 weeks back)
  const startDate = new Date(weekStart);
  startDate.setDate(weekStart.getDate() - 12 * 7);

  const cols: Array<{ cells: DayCell[]; monthLabel: string | null }> = [];
  let lastMonth = -1;

  for (let w = 0; w < COLS; w++) {
    const cells: DayCell[] = [];
    let monthLabel: string | null = null;

    for (let d = 0; d < ROWS; d++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + w * 7 + d);
      const dateStr = date.toDateString();
      const future  = date > now;
      cells.push({
        date,
        trimp:  trimpByDay.get(dateStr) ?? 0,
        today:  dateStr === todayStr,
        future,
      });
    }

    // Month label: show on the column whose Monday starts a new month
    const colMonday = cells[0].date;
    if (colMonday.getMonth() !== lastMonth) {
      lastMonth  = colMonday.getMonth();
      monthLabel = colMonday.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
    }

    cols.push({ cells, monthLabel });
  }

  return cols;
}

export function TrainingHeatmap({ sessions }: { sessions: TrainingSession[] }) {
  const { hPad, width } = useResponsive();
  const cellSize = Math.floor((width - hPad * 2 - GAP * (COLS - 1)) / COLS);
  const borderRadius = Math.max(2, Math.floor(cellSize / 5));

  const columns = useMemo(() => buildColumns(sessions), [sessions]);

  const activeDays = useMemo(() => {
    return new Set(
      sessions
        .filter(s => s.completedAt)
        .map(s => new Date(s.completedAt!).toDateString()),
    ).size;
  }, [sessions]);

  return (
    <View style={st.root}>
      <View style={st.header}>
        <Text style={st.label}>ACTIVITY</Text>
        <Text style={st.count}>{activeDays} active days</Text>
      </View>

      <View style={[st.grid, { gap: GAP }]}>
        {columns.map((col, ci) => (
          <View key={ci} style={[st.col, { gap: GAP }]}>
            <Text style={[st.monthLabel, { width: cellSize }]} numberOfLines={1}>
              {col.monthLabel ?? ''}
            </Text>
            {col.cells.map((cell, ri) => (
              <View
                key={ri}
                style={[
                  st.cell,
                  {
                    width:  cellSize,
                    height: cellSize,
                    borderRadius,
                    backgroundColor: cell.future
                      ? 'transparent'
                      : cellColour(cell.trimp),
                  },
                  cell.today && st.todayCell,
                ]}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={st.legend}>
        <Text style={st.legendLabel}>LESS</Text>
        {[0, 60, 160, 300].map(t => (
          <View
            key={t}
            style={[st.legendDot, { backgroundColor: cellColour(t), borderRadius }]}
          />
        ))}
        <Text style={st.legendLabel}>MORE</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root:   { gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:  { fontSize: 8, fontWeight: '900', letterSpacing: 1.8, color: colours.muted },
  count:  { fontSize: 10, fontWeight: '700', color: colours.textSoft },

  grid: { flexDirection: 'row' },
  col:  { flexDirection: 'column' },

  monthLabel: {
    fontSize:      6,
    fontWeight:    '900',
    color:         colours.muted,
    height:        10,
    textAlign:     'center',
    letterSpacing: 0.4,
  },

  cell: {
    // width/height/borderRadius set inline from cellSize
  },
  todayCell: {
    borderWidth: 1,
    borderColor: colours.cyan,
  },

  legend:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  legendLabel:{ fontSize: 7, fontWeight: '900', color: colours.muted, letterSpacing: 0.8 },
  legendDot:  { width: 8, height: 8 },
});
