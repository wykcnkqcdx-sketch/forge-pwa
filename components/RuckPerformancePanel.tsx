import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Card } from './Card';
import { colours, typography } from '../theme';
import type { RuckEstimate } from '../lib/h2f';
import type { RuckScoreBreakdown } from '../utils/ruckScore';

const GAUGE_SIZE = 104;
const STROKE = 9;
const R = (GAUGE_SIZE - STROKE) / 2;
const CX = GAUGE_SIZE / 2;
const CY = GAUGE_SIZE / 2;
const START_DEG = 135;
const SWEEP_DEG = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(startDeg: number, endDeg: number) {
  const s = polar(CX, CY, R, endDeg);
  const e = polar(CX, CY, R, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 0 ${e.x} ${e.y}`;
}

function scoreColor(score: number) {
  if (score < 150) return colours.green;
  if (score < 300) return colours.amber;
  return colours.red;
}

function loadZone(ratio: number): { label: string; color: string } {
  if (ratio < 0.15) return { label: 'LIGHT', color: colours.green };
  if (ratio < 0.27) return { label: 'MODERATE', color: colours.amber };
  return { label: 'HEAVY', color: colours.red };
}

function ScoreGauge({ score, maxScore = 420 }: { score: number; maxScore?: number }) {
  const progress = Math.min(score / maxScore, 1);
  const sweepProgress = SWEEP_DEG * progress;
  const color = scoreColor(score);
  const bgPath = arc(START_DEG, START_DEG + SWEEP_DEG);
  const fgPath = sweepProgress > 1 ? arc(START_DEG, START_DEG + sweepProgress) : '';

  return (
    <View style={styles.gaugeContainer}>
      <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
        <Path d={bgPath} stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} fill="none" strokeLinecap="round" />
        {fgPath ? <Path d={fgPath} stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round" /> : null}
      </Svg>
      <View style={styles.gaugeCenter}>
        <Text style={[styles.gaugeScore, { color }]}>{score}</Text>
        <Text style={styles.gaugeLabel}>SCORE</Text>
      </View>
    </View>
  );
}

type MetricCellProps = { label: string; value: string; sub?: string; color?: string; border?: boolean };
function MetricCell({ label, value, sub, color = colours.text, border = false }: MetricCellProps) {
  return (
    <View style={[styles.metricCell, border && styles.metricCellBorder]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

export function RuckPerformancePanel({
  score,
  pandolf,
  distanceKm,
  loadKg,
  breakdown,
}: {
  score: number;
  pandolf: RuckEstimate;
  distanceKm: number;
  loadKg: number;
  breakdown?: RuckScoreBreakdown;
}) {
  const zone = loadZone(pandolf.loadRatio);

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>PERFORMANCE</Text>
        <View style={[styles.zoneBadge, { borderColor: zone.color + '55', backgroundColor: zone.color + '18' }]}>
          <View style={[styles.zoneDot, { backgroundColor: zone.color }]} />
          <Text style={[styles.zoneLabel, { color: zone.color }]}>{zone.label} LOAD</Text>
        </View>
      </View>

      <View style={styles.body}>
        <ScoreGauge score={score} />
        <View style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            <MetricCell label="OUTPUT" value={`${pandolf.wattsCorrected}W`} sub="corrected" color={colours.cyan} />
            <MetricCell label="KCAL/HR" value={`${pandolf.metabolicCostKcalHour}`} sub="metabolic" color={colours.amber} border />
          </View>
          <View style={[styles.metricsRow, styles.metricsRowTop]}>
            <MetricCell label="LOAD RATIO" value={pandolf.loadRatio.toFixed(2)} sub="load/body" color={zone.color} />
            <MetricCell label="KG·KM" value={`${Math.round(distanceKm * loadKg)}`} sub="vol. load" color={colours.textSoft} border />
          </View>
        </View>
      </View>

      <Text style={styles.footnote}>
        Pandolf model with {pandolf.loadRatio >= 0.27 ? '+27% heavy-load correction applied' : 'standard load correction'}
      </Text>
      {breakdown ? (
        <View style={styles.breakdownPanel}>
          <Text style={styles.breakdownTitle}>Why this score</Text>
          {breakdown.factors.map((factor) => (
            <View key={factor.label} style={styles.factorRow}>
              <Text style={styles.factorLabel}>{factor.label}</Text>
              <Text style={styles.factorValue}>{factor.value}</Text>
              <Text style={styles.factorPoints}>{factor.points}</Text>
            </View>
          ))}
          <Text style={styles.finding}>{breakdown.finding}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { ...typography.label, color: colours.muted, letterSpacing: 1.4 },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  zoneDot: { width: 5, height: 5, borderRadius: 3 },
  zoneLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  gaugeContainer: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    position: 'relative',
  },
  gaugeCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, lineHeight: 28 },
  gaugeLabel: { ...typography.label, color: colours.muted, letterSpacing: 1.2, fontSize: 8 },
  metricsGrid: { flex: 1, gap: 1 },
  metricsRow: { flexDirection: 'row' },
  metricsRowTop: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 10,
    paddingTop: 10,
  },
  metricCell: { flex: 1, gap: 2 },
  metricCellBorder: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    paddingLeft: 12,
  },
  metricLabel: { fontSize: 8, fontWeight: '900', color: colours.muted, letterSpacing: 1 },
  metricValue: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  metricSub: { fontSize: 8, color: colours.muted, fontWeight: '700', letterSpacing: 0.4 },
  footnote: { ...typography.caption, color: colours.muted, marginTop: 12, lineHeight: 16 },
  breakdownPanel: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 12,
    paddingTop: 12,
    gap: 7,
  },
  breakdownTitle: { ...typography.label, color: colours.cyan },
  factorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factorLabel: { flex: 1, color: colours.textSoft, fontSize: 12, fontWeight: '900' },
  factorValue: { color: colours.muted, fontSize: 11, fontWeight: '800' },
  factorPoints: { width: 28, color: colours.cyan, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  finding: { color: colours.text, fontSize: 12, lineHeight: 18, fontWeight: '900', marginTop: 3 },
});
