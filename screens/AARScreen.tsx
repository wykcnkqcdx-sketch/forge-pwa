import React, { useRef } from 'react';
import {
  Pressable, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RuckRing } from '../components/graphics/RuckRing';
import { Screen } from '../components/Screen';
import { colours, radius, shadow, touchTarget, typography } from '../theme';
import { formatElapsed } from '../utils/ruck';
import type { RuckScoreBreakdown } from '../utils/ruckScore';

// ── Helpers ─────────────────────────────────────────────────────

function formatPace(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ruckRingValues(factors: RuckScoreBreakdown['factors']) {
  const get = (label: string, max: number) => {
    const f = factors.find(x => x.label === label);
    return f ? Math.round(Math.min(100, (f.points / max) * 100)) : 0;
  };
  return {
    distance:  get('Distance',  20),
    load:      get('Load',      22),
    pace:      get('Pace',      20),
    elevation: get('Elevation', 16),
  };
}

// ── Score bar ────────────────────────────────────────────────────

function ScoreBar({ label, value, max, points }: {
  label: string; value: string; max: number; points: number;
}) {
  const pct = Math.min(1, points / max);
  return (
    <View style={bar.row}>
      <Text style={bar.label}>{label}</Text>
      <View style={bar.track}>
        <View style={[bar.fill, { flex: pct, backgroundColor: colours.cyan }]} />
        <View style={{ flex: 1 - pct }} />
      </View>
      <Text style={bar.value}>{value}</Text>
      <Text style={bar.pts}>{points}</Text>
    </View>
  );
}

const bar = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  label: { width: 72, color: colours.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colours.border, flexDirection: 'row', overflow: 'hidden' },
  fill:  { borderRadius: 2 },
  value: { width: 72, color: colours.textSoft, fontSize: 10, fontWeight: '700', textAlign: 'right' },
  pts:   { width: 20, color: colours.cyan, fontSize: 11, fontWeight: '900', textAlign: 'right', fontVariant: ['tabular-nums'] },
});

// ── Screen ───────────────────────────────────────────────────────

export type AARScreenProps = {
  ruckScore:          RuckScoreBreakdown;
  distanceKm:         number;
  elapsedSeconds:     number;
  paceMinPerKm:       number;
  loadKg:             number;
  ascentM:            number;
  checkpointsReached?: number;
  checkpointsTotal?:  number;
  sessionTitle?:      string;
  note:               string;
  onNoteChange:       (note: string) => void;
  onSave:             () => void;
  onResume:           () => void;
  onDiscard:          () => void;
};

export function AARScreen({
  ruckScore, distanceKm, elapsedSeconds, paceMinPerKm,
  loadKg, ascentM, checkpointsReached, checkpointsTotal,
  sessionTitle, note, onNoteChange, onSave, onResume, onDiscard,
}: AARScreenProps) {
  const ring = ruckRingValues(ruckScore.factors);
  const pace = formatPace(paceMinPerKm);
  const time = formatElapsed(elapsedSeconds);
  const cpText = checkpointsTotal
    ? `${checkpointsReached ?? 0}/${checkpointsTotal} CP`
    : null;

  async function handleShare() {
    const text = [
      '◈ FORGE AFTER ACTION REVIEW',
      '─────────────────────────',
      `${distanceKm.toFixed(2)} KM  ·  ${loadKg} KG  ·  ${pace}/KM`,
      `TIME ${time}  ·  ELEV ${Math.round(ascentM)} M`,
      '',
      `RUCK SCORE  ${ruckScore.score}`,
      '',
      `Finding: ${ruckScore.finding}`,
      `Next action: ${ruckScore.recommendation}`,
      '─────────────────────────',
      'Tracked with FORGE',
    ].join('\n');
    await Share.share({ message: text, title: 'FORGE AAR' });
  }

  return (
    <Screen>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.kicker}>AFTER ACTION REVIEW</Text>
        <Text style={styles.title}>{sessionTitle ?? 'Ruck Complete'}</Text>
      </View>

      {/* ── Ruck Ring hero ─────────────────────────────────── */}
      <View style={styles.ringWrapper}>
        <RuckRing
          score={ruckScore.score}
          distance={ring.distance}
          load={ring.load}
          pace={ring.pace}
          elevation={ring.elevation}
          size={220}
          showLabels
          animate
        />
      </View>

      {/* ── Key stats ──────────────────────────────────────── */}
      <View style={styles.statsGrid}>
        <StatTile value={`${distanceKm.toFixed(2)}`} unit="KM"   label="DISTANCE" />
        <StatTile value={`${loadKg}`}                 unit="KG"   label="LOAD"     />
        <StatTile value={pace}                        unit="/KM"  label="PACE"     mono />
        <StatTile value={`${Math.round(ascentM)}`}   unit="M"    label="ELEVATION"/>
      </View>
      {cpText && (
        <View style={styles.cpRow}>
          <Ionicons name="flag-outline" size={14} color={colours.cyan} />
          <Text style={styles.cpText}>{cpText} checkpoints reached · {time} total time</Text>
        </View>
      )}

      {/* ── Finding + recommendation ───────────────────────── */}
      <View style={styles.findingCard}>
        <Text style={styles.sectionLabel}>FINDING</Text>
        <Text style={styles.findingText}>{ruckScore.finding}</Text>
        <View style={styles.findingDivider} />
        <Text style={styles.sectionLabel}>NEXT ACTION</Text>
        <Text style={styles.recommendText}>{ruckScore.recommendation}</Text>
      </View>

      {/* ── Score breakdown ────────────────────────────────── */}
      <View style={styles.breakdownCard}>
        <Text style={styles.sectionLabel}>SCORE BREAKDOWN</Text>
        {ruckScore.factors.map(f => {
          const maxMap: Record<string, number> = {
            Distance: 20, Load: 22, Elevation: 16,
            Terrain: 12, Pace: 20, Execution: 10,
          };
          return (
            <ScoreBar
              key={f.label}
              label={f.label}
              value={f.value}
              max={maxMap[f.label] ?? 20}
              points={f.points}
            />
          );
        })}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>RUCK SCORE</Text>
          <Text style={[styles.totalValue, { color: colours.cyan }]}>{ruckScore.score}</Text>
        </View>
      </View>

      {/* ── FORGE AAR shareable card ───────────────────────── */}
      <View style={styles.shareCard}>
        <View style={styles.shareCardInner}>
          <View style={styles.shareCardHeader}>
            <Text style={styles.shareCardBrand}>◈ FORGE</Text>
            <Text style={styles.shareCardLabel}>AFTER ACTION REVIEW</Text>
          </View>
          <View style={styles.shareStatRow}>
            <Text style={styles.shareStat}>{distanceKm.toFixed(2)} KM</Text>
            <Text style={styles.shareStatSep}>·</Text>
            <Text style={styles.shareStat}>{loadKg} KG</Text>
            <Text style={styles.shareStatSep}>·</Text>
            <Text style={styles.shareStat}>{pace}/KM</Text>
          </View>
          <View style={styles.shareScoreRow}>
            <Text style={styles.shareScoreLabel}>RUCK SCORE</Text>
            <Text style={styles.shareScoreValue}>{ruckScore.score}</Text>
          </View>
          <Text style={styles.shareFinding} numberOfLines={2}>{ruckScore.finding}</Text>
        </View>
        <Pressable style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={16} color={colours.background} />
          <Text style={styles.shareButtonText}>SHARE AAR CARD</Text>
        </Pressable>
      </View>

      {/* ── Session note ───────────────────────────────────── */}
      <TextInput
        value={note}
        onChangeText={onNoteChange}
        placeholder="Session note — kit, terrain, pain, weather..."
        placeholderTextColor={colours.soft}
        style={styles.noteInput}
        multiline
        textAlignVertical="top"
      />

      {/* ── Actions ────────────────────────────────────────── */}
      <View style={styles.actions}>
        <Pressable style={styles.saveBtn} onPress={onSave}>
          <Ionicons name="checkmark" size={18} color={colours.background} />
          <Text style={styles.saveBtnText}>SAVE TO LOGBOOK</Text>
        </Pressable>
        <Pressable style={styles.resumeBtn} onPress={onResume}>
          <Ionicons name="play" size={16} color={colours.green} />
          <Text style={[styles.secondaryText, { color: colours.green }]}>Resume</Text>
        </Pressable>
        <Pressable style={styles.discardBtn} onPress={onDiscard}>
          <Ionicons name="trash-outline" size={16} color={colours.red} />
          <Text style={[styles.secondaryText, { color: colours.red }]}>Discard</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

// ── Stat tile sub-component ──────────────────────────────────────

function StatTile({ value, unit, label, mono = false }: {
  value: string; unit: string; label: string; mono?: boolean;
}) {
  return (
    <View style={tile.wrap}>
      <Text style={tile.label}>{label}</Text>
      <View style={tile.valRow}>
        <Text style={[tile.value, mono && tile.mono]}>{value}</Text>
        <Text style={tile.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const tile = StyleSheet.create({
  wrap:   { flex: 1, backgroundColor: colours.panel, borderWidth: 1, borderColor: colours.border, borderRadius: radius.sm, padding: 12, alignItems: 'center' },
  label:  { fontSize: 8, fontWeight: '900', letterSpacing: 1.4, color: colours.muted, textTransform: 'uppercase', marginBottom: 4 },
  valRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  value:  { fontSize: 24, fontWeight: '900', color: colours.text, fontVariant: ['tabular-nums'] },
  mono:   { fontSize: 18, letterSpacing: 0.5 },
  unit:   { fontSize: 10, fontWeight: '700', color: colours.soft },
});

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header:  { gap: 4 },
  kicker:  { ...typography.label, color: colours.cyan },
  title:   { color: colours.text, fontSize: 30, lineHeight: 34, fontWeight: '900' },

  // Ring hero
  ringWrapper: { alignItems: 'center', paddingVertical: 8 },

  // Stats grid
  statsGrid: { flexDirection: 'row', gap: 8 },
  cpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6,
  },
  cpText: { color: colours.muted, fontSize: 11, fontWeight: '700' },

  // Finding
  findingCard: {
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    padding: 14,
    gap: 6,
  },
  sectionLabel:  { ...typography.label, color: colours.muted },
  findingText:   { color: colours.text, fontSize: 15, fontWeight: '900', lineHeight: 22 },
  findingDivider:{ height: 1, backgroundColor: colours.borderSoft, marginVertical: 4 },
  recommendText: { color: colours.textSoft, fontSize: 13, fontWeight: '700', lineHeight: 20 },

  // Breakdown
  breakdownCard: {
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    padding: 14,
    gap: 4,
  },
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colours.borderSoft, marginTop: 8, paddingTop: 8 },
  totalLabel:{ fontSize: 10, fontWeight: '900', letterSpacing: 1.6, color: colours.muted, textTransform: 'uppercase' },
  totalValue:{ fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },

  // Share card
  shareCard: {
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.glow,
  },
  shareCardInner: {
    backgroundColor: colours.background,
    padding: 18,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  shareCardHeader: { gap: 2 },
  shareCardBrand:  { color: colours.cyan, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  shareCardLabel:  { ...typography.label, color: colours.muted },
  shareStatRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareStat:       { color: colours.text, fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  shareStatSep:    { color: colours.border, fontSize: 14, fontWeight: '900' },
  shareScoreRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  shareScoreLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 2, color: colours.muted, textTransform: 'uppercase' },
  shareScoreValue: { color: colours.cyan, fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 44 },
  shareFinding:    { color: colours.textSoft, fontSize: 11, fontWeight: '700', lineHeight: 17 },
  shareButton:     { minHeight: touchTarget, backgroundColor: colours.cyan, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareButtonText: { color: colours.background, fontWeight: '900', fontSize: 12, letterSpacing: 1.2 },

  // Note
  noteInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    padding: 12,
    color: colours.text,
    backgroundColor: colours.inputBg,
    fontSize: 13,
    fontWeight: '600',
  },

  // Actions
  actions:     { gap: 10 },
  saveBtn:     { minHeight: touchTarget, backgroundColor: colours.cyan, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { color: colours.background, fontWeight: '900', fontSize: 13, letterSpacing: 1.2 },
  resumeBtn:   { minHeight: 44, borderWidth: 1, borderColor: `${colours.green}40`, borderRadius: radius.sm, backgroundColor: colours.greenDim, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  discardBtn:  { minHeight: 44, borderWidth: 1, borderColor: `${colours.red}40`, borderRadius: radius.sm, backgroundColor: colours.redDim, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
});
