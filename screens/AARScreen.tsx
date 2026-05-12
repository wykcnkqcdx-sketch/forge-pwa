import React, { useRef, useState } from 'react';
import {
  Pressable, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { RuckRing } from '../components/graphics/RuckRing';
import { Screen } from '../components/Screen';
import { colours, radius, shadow, touchTarget, typography } from '../theme';
import { formatElapsed } from '../utils/ruck';
import type { RuckScoreBreakdown } from '../utils/ruckScore';
import { ForgeStamp } from '../components/ForgeStamp';
import { PR_META, type PRType } from '../lib/personalRecords';

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

function scoreColour(score: number) {
  if (score >= 80) return colours.green;
  if (score >= 65) return colours.cyan;
  if (score >= 50) return colours.amber;
  return colours.red;
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
  newPRs?:            PRType[];
  note:               string;
  onNoteChange:       (note: string) => void;
  onSave:             () => void;
  onResume:           () => void;
  onDiscard:          () => void;
};

export function AARScreen({
  ruckScore, distanceKm, elapsedSeconds, paceMinPerKm,
  loadKg, ascentM, checkpointsReached, checkpointsTotal,
  sessionTitle, newPRs, note, onNoteChange, onSave, onResume, onDiscard,
}: AARScreenProps) {
  const shareCardRef  = useRef<View>(null);
  const [showStamp, setShowStamp] = useState(true);

  const ring     = ruckRingValues(ruckScore.factors);
  const pace     = formatPace(paceMinPerKm);
  const time     = formatElapsed(elapsedSeconds);
  const cpText   = checkpointsTotal
    ? `${checkpointsReached ?? 0}/${checkpointsTotal} CP`
    : null;
  const sTone    = scoreColour(ruckScore.score);

  async function handleShare() {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare && shareCardRef.current) {
        const uri = await captureRef(shareCardRef, {
          format: 'png',
          quality: 1.0,
          result: 'tmpfile',
        });
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your FORGE AAR',
          UTI: 'public.png',
        });
        return;
      }
    } catch {
      // fall through to text share
    }
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
    <View style={styles.container}>
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

      {/* ── Personal Records ───────────────────────────────── */}
      {newPRs && newPRs.length > 0 && (
        <View style={styles.prRow}>
          {newPRs.map(pr => (
            <View key={pr} style={styles.prChip}>
              <Ionicons name={PR_META[pr].icon as any} size={12} color={colours.background} />
              <Text style={styles.prChipText}>{PR_META[pr].label.toUpperCase()}</Text>
            </View>
          ))}
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
          <Text style={[styles.totalValue, { color: sTone }]}>{ruckScore.score}</Text>
        </View>
      </View>

      {/* ── Shareable AAR card ─────────────────────────────── */}
      <View
        ref={shareCardRef}
        collapsable={false}
        style={card.root}
      >
        {/* Card header */}
        <View style={card.header}>
          <Text style={card.brand}>◈ FORGE</Text>
          <Text style={card.subtitle}>AFTER ACTION REVIEW</Text>
        </View>

        {/* Ring + score */}
        <View style={card.hero}>
          <RuckRing
            score={ruckScore.score}
            distance={ring.distance}
            load={ring.load}
            pace={ring.pace}
            elevation={ring.elevation}
            size={130}
            showLabels={false}
            animate={false}
          />
          <View style={card.heroRight}>
            <Text style={card.scoreLabel}>RUCK SCORE</Text>
            <Text style={[card.scoreValue, { color: sTone }]}>{ruckScore.score}</Text>
            <Text style={card.scoreMax}>/100</Text>
            <Text style={card.timeText}>{time}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={card.statsRow}>
          <CardStat value={`${distanceKm.toFixed(1)}`} unit="KM"   />
          <View style={card.statDivider} />
          <CardStat value={`${loadKg}`}                unit="KG"   />
          <View style={card.statDivider} />
          <CardStat value={pace}                       unit="/KM"  />
          <View style={card.statDivider} />
          <CardStat value={`${Math.round(ascentM)}`}  unit="M ELV"/>
        </View>

        {/* Finding */}
        <Text style={card.finding} numberOfLines={2}>{ruckScore.finding}</Text>

        {/* Footer */}
        <View style={card.footer}>
          <Text style={card.footerText}>FIELD READY · FORGE RUCK READINESS</Text>
        </View>
      </View>

      {/* Share button — outside captured area */}
      <Pressable style={styles.shareBtn} onPress={handleShare}>
        <Ionicons name="share-outline" size={16} color={colours.background} />
        <Text style={styles.shareBtnText}>SHARE AAR CARD</Text>
      </Pressable>

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
    {showStamp && (
      <ForgeStamp score={ruckScore.score} onDone={() => setShowStamp(false)} />
    )}
    </View>
  );
}

// ── Card stat sub-component ──────────────────────────────────────

function CardStat({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={card.statCell}>
      <Text style={card.statValue}>{value}</Text>
      <Text style={card.statUnit}>{unit}</Text>
    </View>
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

// ── Share card styles ────────────────────────────────────────────

const GOLD = colours.cyan; // sand/gold primary

const card = StyleSheet.create({
  root: {
    backgroundColor: colours.background,
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.glow,
  },
  header: {
    backgroundColor: '#0D1412',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${GOLD}30`,
  },
  brand: {
    color: GOLD,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  subtitle: {
    color: colours.muted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 16,
  },
  heroRight: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 1,
  },
  scoreLabel: {
    color: colours.muted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  scoreValue: {
    fontSize: 64,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 66,
  },
  scoreMax: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: -4,
  },
  timeText: {
    color: colours.textSoft,
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 6,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colours.border,
    paddingVertical: 12,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: colours.border,
  },
  statValue: {
    color: colours.text,
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    color: colours.muted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  finding: {
    color: colours.textSoft,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 17,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  footer: {
    backgroundColor: `${GOLD}10`,
    borderTopWidth: 1,
    borderTopColor: `${GOLD}28`,
    paddingHorizontal: 18,
    paddingVertical: 9,
    alignItems: 'center',
  },
  footerText: {
    color: `${GOLD}80`,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
});

// ── Screen styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

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

  // PR chips
  prRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colours.cyan,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  prChipText: {
    color: colours.background,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

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

  // Share button
  shareBtn: {
    minHeight: touchTarget,
    backgroundColor: colours.cyan,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareBtnText: { color: colours.background, fontWeight: '900', fontSize: 12, letterSpacing: 1.4 },

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
