import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colours, typography } from '../theme';
import type { TrainingSession } from '../data/domain';

type Props = {
  sessions: TrainingSession[];
};

const SESSION_COLOURS: Record<TrainingSession['type'], string> = {
  Ruck:       colours.cyan,
  Run:        colours.green,
  Strength:   colours.amber,
  Resistance: colours.sand,
  Cardio:     '#9B59B6',
  Workout:    '#5DADE2',
  Mobility:   '#27AE60',
};

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function isoDateStr(d: Date): string { return d.toISOString().slice(0, 10); }
function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

export function TrainingCalendar({ sessions }: Props) {
  const { weeks, maxWeekLoad } = useMemo(() => {
    const today = startOfDay(new Date());
    const dayOfWeek = (today.getDay() + 6) % 7;
    const calStart = new Date(today);
    calStart.setDate(today.getDate() - dayOfWeek - 21);

    const sessionMap: Record<string, TrainingSession[]> = {};
    for (const s of sessions) {
      if (!s.completedAt) continue;
      const key = s.completedAt.slice(0, 10);
      if (!sessionMap[key]) sessionMap[key] = [];
      sessionMap[key].push(s);
    }

    const todayStr = isoDateStr(today);
    let maxWeekLoad = 1;

    const weeksArr = Array.from({ length: 4 }, (_, w) => {
      let weekLoad = 0;
      let sessionCount = 0;
      let monthLabel = '';

      const days = Array.from({ length: 7 }, (_, d) => {
        const cell = new Date(calStart);
        cell.setDate(calStart.getDate() + w * 7 + d);
        const dateStr = isoDateStr(cell);
        const daySessions = sessionMap[dateStr] ?? [];
        const maxRpe = daySessions.reduce((max, s) => Math.max(max, s.rpe || 0), 0);
        const load = daySessions.reduce((sum, s) => sum + (s.durationMinutes || 30) * (s.rpe || 5), 0);
        weekLoad += load;
        sessionCount += daySessions.length;
        if (d === 0) {
          monthLabel = cell.toLocaleString('default', { month: 'short' }).toUpperCase()
            + ' ' + cell.getDate()
            + '–' + (() => { const e = new Date(cell); e.setDate(e.getDate() + 6); return e.getDate(); })();
        }
        return {
          date: dateStr,
          day: cell.getDate(),
          types: daySessions.map(s => s.type),
          isToday: dateStr === todayStr,
          isFuture: cell > today,
          maxRpe,
          load,
          isNewMonth: cell.getDate() === 1 && d > 0,
        };
      });

      if (weekLoad > maxWeekLoad) maxWeekLoad = weekLoad;
      return { days, weekLoad, sessionCount, monthLabel };
    });

    return { weeks: weeksArr, maxWeekLoad };
  }, [sessions]);

  return (
    <View style={styles.container}>
      {/* Day header */}
      <View style={styles.headerRow}>
        {DAY_LABELS.map((d, i) => (
          <Text key={i} style={[styles.dayLabel, (i === 5 || i === 6) && styles.dayLabelWeekend]}>{d}</Text>
        ))}
        <View style={styles.loadColHeader}>
          <Text style={styles.loadColLabel}>LOAD</Text>
        </View>
      </View>

      {weeks.map((week, wi) => {
        const loadPct = maxWeekLoad > 1 ? week.weekLoad / maxWeekLoad : 0;
        const loadColor = loadPct > 0.75 ? colours.red : loadPct > 0.45 ? colours.amber : colours.cyan;
        return (
          <View key={wi} style={styles.weekBlock}>
            <Text style={styles.weekLabel}>{week.monthLabel}</Text>
            <View style={styles.weekRow}>
              {week.days.map((cell) => {
                const primaryType = cell.types[0] as TrainingSession['type'] | undefined;
                const primaryHex = primaryType ? SESSION_COLOURS[primaryType] : null;
                const isActive = cell.types.length > 0;
                const bgOpacity = cell.maxRpe >= 8 ? 0.30 : cell.maxRpe >= 5 ? 0.18 : isActive ? 0.11 : 0;

                return (
                  <View
                    key={cell.date}
                    style={[
                      styles.cell,
                      isActive && primaryHex && { backgroundColor: `rgba(${hexToRgb(primaryHex)},${bgOpacity})` },
                      cell.isToday && styles.cellToday,
                      cell.maxRpe >= 8 && styles.cellHighRpe,
                      cell.isFuture && styles.cellFuture,
                    ]}
                  >
                    {/* New-month dot indicator */}
                    {cell.isNewMonth && <View style={styles.newMonthDot} />}

                    {/* Date number */}
                    <Text style={[
                      styles.cellDay,
                      isActive && styles.cellDayActive,
                      cell.isToday && styles.cellDayToday,
                    ]}>
                      {cell.day}
                    </Text>

                    {/* Session type strips at bottom */}
                    {isActive && (
                      <View style={styles.typeStrips}>
                        {cell.types.slice(0, 4).map((t, i) => (
                          <View
                            key={i}
                            style={[styles.typeStrip, { backgroundColor: SESSION_COLOURS[t as TrainingSession['type']] }]}
                          />
                        ))}
                      </View>
                    )}

                    {/* RPE badge top-right */}
                    {cell.maxRpe >= 8 && (
                      <View style={styles.rpeBadge}>
                        <Text style={styles.rpeBadgeText}>{cell.maxRpe}</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Week load bar column */}
              <View style={styles.loadCol}>
                <View style={styles.loadBarBg}>
                  <View style={[styles.loadBarFill, { height: `${Math.round(loadPct * 100)}%`, backgroundColor: loadColor }]} />
                </View>
                <Text style={[styles.loadCount, { color: loadColor }]}>{week.sessionCount}</Text>
              </View>
            </View>
          </View>
        );
      })}

      {/* Legend */}
      <View style={styles.legend}>
        {(Object.entries(SESSION_COLOURS) as [TrainingSession['type'], string][]).map(([type, color]) => (
          <View key={type} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{type}</Text>
          </View>
        ))}
      </View>

      {/* Scale note */}
      <Text style={styles.scaleNote}>Load bar = week TRIMP relative to 4-week peak. Numbers = sessions.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },

  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 1 },
  dayLabel: { flex: 1, textAlign: 'center', ...typography.caption, color: colours.muted, fontSize: 11, fontWeight: '800' },
  dayLabelWeekend: { color: colours.violet },
  loadColHeader: { width: 32, alignItems: 'center' },
  loadColLabel: { ...typography.label, color: colours.muted, fontSize: 8, letterSpacing: 1 },

  weekBlock: { marginBottom: 6 },
  weekLabel: { ...typography.label, color: colours.soft, fontSize: 9, letterSpacing: 1, marginBottom: 3, marginLeft: 1 },
  weekRow: { flexDirection: 'row', gap: 3, alignItems: 'stretch' },

  cell: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    paddingTop: 5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cellToday: {
    borderColor: colours.cyan,
    borderWidth: 2,
    backgroundColor: 'rgba(143,166,59,0.10)',
  },
  cellHighRpe: {
    borderColor: colours.red,
  },
  cellFuture: { opacity: 0.22 },

  cellDay: {
    fontSize: 13,
    fontWeight: '700',
    color: colours.muted,
    lineHeight: 14,
    alignSelf: 'center',
  },
  cellDayActive: { color: colours.textSoft },
  cellDayToday: { color: colours.cyan, fontWeight: '900' },

  typeStrips: { flexDirection: 'row', width: '100%', height: 4, borderRadius: 0 },
  typeStrip: { flex: 1 },

  rpeBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colours.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeBadgeText: { color: '#fff', fontSize: 7, fontWeight: '900' },

  newMonthDot: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colours.violet,
  },

  loadCol: { width: 28, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  loadBarBg: { flex: 1, width: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, justifyContent: 'flex-end', overflow: 'hidden' },
  loadBarFill: { width: '100%', borderRadius: 3, minHeight: 3 },
  loadCount: { fontSize: 10, fontWeight: '900', lineHeight: 11 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 2 },
  legendLabel: { ...typography.caption, color: colours.muted, fontSize: 10 },

  scaleNote: { ...typography.caption, color: colours.soft, fontSize: 9, marginTop: 4, lineHeight: 13 },
});
