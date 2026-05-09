import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colours, typography } from '../theme';
import type { RuckEstimate } from '../lib/h2f';

function loadZone(ratio: number) {
  if (ratio < 0.15) return { label: 'LIGHT', color: colours.green };
  if (ratio < 0.27) return { label: 'MODERATE', color: colours.amber };
  return { label: 'HEAVY', color: colours.red };
}

function Stepper({
  onDecrement,
  onIncrement,
}: {
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={onDecrement} hitSlop={6}>
        <Ionicons name="remove" size={16} color={colours.text} />
      </Pressable>
      <Pressable style={styles.stepBtn} onPress={onIncrement} hitSlop={6}>
        <Ionicons name="add" size={16} color={colours.text} />
      </Pressable>
    </View>
  );
}

function RouteRow({
  icon,
  label,
  value,
  onDecrement,
  onIncrement,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  color?: string;
}) {
  return (
    <View style={styles.routeRow}>
      <Ionicons name={icon as any} size={12} color={colours.muted} />
      <Text style={styles.routeLabel}>{label}</Text>
      <View style={styles.routeControls}>
        <Pressable style={styles.routeStepBtn} onPress={onDecrement} hitSlop={6}>
          <Ionicons name="remove" size={13} color={colours.muted} />
        </Pressable>
        <Text style={[styles.routeValue, color ? { color } : null]}>{value}</Text>
        <Pressable style={styles.routeStepBtn} onPress={onIncrement} hitSlop={6}>
          <Ionicons name="add" size={13} color={colours.muted} />
        </Pressable>
      </View>
    </View>
  );
}

export function RuckSessionSetupCard({
  bodyMassKg,
  weightKg,
  distanceKm,
  plannedAscentM,
  terrainFactor,
  pandolf,
  onBodyMassChange,
  onWeightChange,
  onDistanceChange,
  onAscentChange,
  onTerrainChange,
}: {
  bodyMassKg: number;
  weightKg: number;
  distanceKm: number;
  plannedAscentM: number;
  terrainFactor: number;
  pandolf: RuckEstimate;
  onBodyMassChange: (amount: number) => void;
  onWeightChange: (amount: number) => void;
  onDistanceChange: (amount: number) => void;
  onAscentChange: (amount: number) => void;
  onTerrainChange: (amount: number) => void;
}) {
  const loadRatio = bodyMassKg > 0 ? weightKg / bodyMassKg : 0;
  const zone = loadZone(loadRatio);
  const barPct = Math.min(loadRatio / 0.35, 1);

  return (
    <>
      {/* ── LOAD PARAMETERS ───────────────────────── */}
      <Card>
        <View style={styles.sectionHeader}>
          <Ionicons name="barbell-outline" size={12} color={colours.muted} />
          <Text style={styles.sectionLabel}>LOAD PARAMETERS</Text>
        </View>

        <View style={styles.loadGrid}>
          <View style={styles.loadCell}>
            <Text style={styles.loadCellLabel}>BODY MASS</Text>
            <Text style={styles.loadCellValue}>
              {bodyMassKg}
              <Text style={styles.loadCellUnit}>kg</Text>
            </Text>
            <Stepper onDecrement={() => onBodyMassChange(-1)} onIncrement={() => onBodyMassChange(1)} />
          </View>

          <View style={[styles.loadCell, styles.loadCellDivider]}>
            <Text style={styles.loadCellLabel}>PACK WEIGHT</Text>
            <Text style={[styles.loadCellValue, { color: zone.color }]}>
              {weightKg}
              <Text style={[styles.loadCellUnit, { color: zone.color }]}>kg</Text>
            </Text>
            <Stepper onDecrement={() => onWeightChange(-1)} onIncrement={() => onWeightChange(1)} />
          </View>
        </View>

        <View style={styles.ratioBlock}>
          <View style={styles.ratioBarTrack}>
            <View style={[styles.ratioBarFill, { width: `${barPct * 100}%` as any, backgroundColor: zone.color }]} />
            <View style={[styles.ratioMarker, { left: '43%' as any }]} />
            <View style={[styles.ratioMarker, { left: '77%' as any }]} />
          </View>
          <View style={styles.ratioRow}>
            <Text style={styles.ratioText}>
              LOAD RATIO{' '}
              <Text style={{ color: zone.color, fontWeight: '900' }}>{loadRatio.toFixed(2)}</Text>
            </Text>
            <View style={[styles.zonePill, { borderColor: zone.color + '55', backgroundColor: zone.color + '18' }]}>
              <View style={[styles.zoneDot, { backgroundColor: zone.color }]} />
              <Text style={[styles.zoneText, { color: zone.color }]}>{zone.label}</Text>
            </View>
          </View>
          <View style={styles.ratioZoneLabels}>
            <Text style={[styles.ratioZoneLabel, { color: colours.green }]}>LIGHT</Text>
            <Text style={[styles.ratioZoneLabel, { color: colours.amber }]}>MODERATE</Text>
            <Text style={[styles.ratioZoneLabel, { color: colours.red }]}>HEAVY</Text>
          </View>
        </View>
      </Card>

      {/* ── ROUTE PARAMETERS ──────────────────────── */}
      <Card>
        <View style={styles.sectionHeader}>
          <Ionicons name="trail-sign-outline" size={12} color={colours.muted} />
          <Text style={styles.sectionLabel}>ROUTE PARAMETERS</Text>
        </View>

        <View style={styles.routeList}>
          <RouteRow
            icon="walk-outline"
            label="DISTANCE"
            value={`${distanceKm}km`}
            color={colours.cyan}
            onDecrement={() => onDistanceChange(-1)}
            onIncrement={() => onDistanceChange(1)}
          />
          <RouteRow
            icon="trending-up-outline"
            label="ASCENT"
            value={`${plannedAscentM}m`}
            color={colours.amber}
            onDecrement={() => onAscentChange(-50)}
            onIncrement={() => onAscentChange(50)}
          />
          <RouteRow
            icon="layers-outline"
            label="TERRAIN"
            value={`${terrainFactor.toFixed(1)}×`}
            onDecrement={() => onTerrainChange(-0.1)}
            onIncrement={() => onTerrainChange(0.1)}
          />
        </View>

        <View style={styles.analysisStrip}>
          <View style={styles.analysisStat}>
            <Text style={[styles.analysisValue, { color: colours.cyan }]}>{pandolf.wattsCorrected}W</Text>
            <Text style={styles.analysisLabel}>OUTPUT</Text>
          </View>
          <View style={[styles.analysisStat, styles.analysisStatDivider]}>
            <Text style={[styles.analysisValue, { color: colours.amber }]}>{pandolf.metabolicCostKcalHour}</Text>
            <Text style={styles.analysisLabel}>KCAL/HR</Text>
          </View>
          <View style={[styles.analysisStat, styles.analysisStatDivider]}>
            <Text style={styles.analysisValue}>{Math.round(distanceKm * weightKg)}</Text>
            <Text style={styles.analysisLabel}>KG·KM</Text>
          </View>
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
  },
  sectionLabel: { ...typography.label, color: colours.muted, letterSpacing: 1.4 },

  loadGrid: { flexDirection: 'row' },
  loadCell: { flex: 1, paddingVertical: 4, gap: 6, alignItems: 'center' },
  loadCellDivider: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
  },
  loadCellLabel: { fontSize: 8, fontWeight: '900', color: colours.muted, letterSpacing: 1.2 },
  loadCellValue: { fontSize: 32, fontWeight: '900', color: colours.text, letterSpacing: -1, lineHeight: 38 },
  loadCellUnit: { fontSize: 14, fontWeight: '700', color: colours.textSoft },
  stepper: { flexDirection: 'row', gap: 10, marginTop: 4 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  ratioBlock: { marginTop: 16, gap: 8 },
  ratioBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    position: 'relative',
  },
  ratioBarFill: { height: '100%', borderRadius: 3 },
  ratioMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  ratioRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ratioText: { ...typography.label, color: colours.muted, letterSpacing: 0.6 },
  zonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  zoneDot: { width: 5, height: 5, borderRadius: 3 },
  zoneText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  ratioZoneLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  ratioZoneLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },

  routeList: { gap: 2 },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  routeLabel: { ...typography.label, color: colours.muted, letterSpacing: 1, flex: 1 },
  routeControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  routeValue: { color: colours.text, fontSize: 15, fontWeight: '900', width: 58, textAlign: 'center' },

  analysisStrip: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  analysisStat: { flex: 1, alignItems: 'center', gap: 3 },
  analysisStatDivider: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
  },
  analysisValue: { fontSize: 18, fontWeight: '900', color: colours.text, letterSpacing: -0.3 },
  analysisLabel: { fontSize: 8, fontWeight: '900', color: colours.muted, letterSpacing: 1 },
});
