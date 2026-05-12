import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, radius, touchTarget, typography } from '../theme';
import type { RuckCheckpoint, RuckMissionPlan } from '../data/domain';
import type { TrainingSession } from '../data/mockData';
import { saveActiveRuckPlan } from '../lib/ruckRouteStore';

// ── Types ────────────────────────────────────────────────────────

type MarkType = NonNullable<RuckCheckpoint['markType']>;

const MARK_TYPES: Array<{ key: MarkType; label: string; colour: string; icon: string }> = [
  { key: 'checkpoint',   label: 'CP',      colour: colours.cyan,   icon: 'flag-outline' },
  { key: 'rv',           label: 'RV',      colour: colours.violet, icon: 'location-outline' },
  { key: 'water',        label: 'WATER',   colour: '#4FC3F7',      icon: 'water-outline' },
  { key: 'medic',        label: 'MEDIC',   colour: colours.red,    icon: 'medkit-outline' },
  { key: 'hazard',       label: 'HAZARD',  colour: colours.amber,  icon: 'warning-outline' },
  { key: 'objective',    label: 'OBJ',     colour: colours.green,  icon: 'navigate-outline' },
  { key: 'observation',  label: 'OBS',     colour: colours.muted,  icon: 'eye-outline' },
];

function markConfig(type: MarkType) {
  return MARK_TYPES.find(m => m.key === type) ?? MARK_TYPES[0];
}

// ── Helpers ──────────────────────────────────────────────────────

function formatPace(minPerKm: number) {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`;
}

function buildEmptyCP(index: number): RuckCheckpoint {
  return {
    id: `plan-cp-${Date.now()}-${index}`,
    label: `CP ${index + 1}`,
    markType: 'checkpoint',
    source: 'manual',
    status: 'planned',
    latitude: null,
    longitude: null,
    altitude: null,
    accuracy: null,
    timestamp: Date.now(),
  };
}

function lastRucks(sessions: TrainingSession[], limit = 3) {
  return sessions
    .filter(s => s.type === 'Ruck')
    .sort((a, b) => {
      const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bt - at;
    })
    .slice(0, limit);
}

// ── Distance selector ────────────────────────────────────────────

const DIST_PRESETS = [3, 5, 8, 10, 15, 20];

function DistanceSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={ds.row}>
      {DIST_PRESETS.map(d => {
        const active = value === d;
        return (
          <Pressable
            key={d}
            style={[ds.chip, active && ds.chipActive]}
            onPress={() => onChange(d)}
          >
            <Text style={[ds.chipText, active && ds.chipTextActive]}>{d}</Text>
          </Pressable>
        );
      })}
      <Pressable style={[ds.chip, ds.chipStep]} onPress={() => onChange(Math.max(1, value - 1))}>
        <Ionicons name="remove" size={14} color={colours.muted} />
      </Pressable>
      <View style={[ds.chip, ds.chipCustom]}>
        <Text style={ds.chipTextActive}>{value}</Text>
        <Text style={ds.chipKm}>km</Text>
      </View>
      <Pressable style={[ds.chip, ds.chipStep]} onPress={() => onChange(value + 1)}>
        <Ionicons name="add" size={14} color={colours.muted} />
      </Pressable>
    </View>
  );
}

const ds = StyleSheet.create({
  row:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.panel,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive:     { backgroundColor: colours.cyan, borderColor: colours.cyan },
  chipCustom:     { flexDirection: 'row', gap: 3, borderColor: colours.borderHot, backgroundColor: colours.panelHot },
  chipStep:       { paddingHorizontal: 10 },
  chipText:       { color: colours.muted, fontSize: 13, fontWeight: '900' },
  chipTextActive: { color: colours.background, fontSize: 13, fontWeight: '900' },
  chipKm:         { color: colours.background, fontSize: 9, fontWeight: '900' },
});

// ── Load selector ────────────────────────────────────────────────

const LOAD_PRESETS = [0, 10, 15, 18, 20, 25];

function LoadSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={ds.row}>
      {LOAD_PRESETS.map(kg => {
        const active = value === kg;
        return (
          <Pressable
            key={kg}
            style={[ds.chip, active && { backgroundColor: colours.amber, borderColor: colours.amber }]}
            onPress={() => onChange(kg)}
          >
            <Text style={[ds.chipText, active && ds.chipTextActive]}>{kg}kg</Text>
          </Pressable>
        );
      })}
      <Pressable style={[ds.chip, ds.chipStep]} onPress={() => onChange(Math.max(0, value - 1))}>
        <Ionicons name="remove" size={14} color={colours.muted} />
      </Pressable>
      <View style={[ds.chip, { borderColor: `${colours.amber}50`, backgroundColor: colours.amberDim }]}>
        <Text style={{ color: colours.amber, fontSize: 13, fontWeight: '900' }}>{value}kg</Text>
      </View>
      <Pressable style={[ds.chip, ds.chipStep]} onPress={() => onChange(value + 1)}>
        <Ionicons name="add" size={14} color={colours.muted} />
      </Pressable>
    </View>
  );
}

// ── Mission profile diagram ──────────────────────────────────────

function MissionProfile({
  distanceKm,
  checkpoints,
}: {
  distanceKm: number;
  checkpoints: RuckCheckpoint[];
}) {
  if (distanceKm <= 0) return null;
  const placed = checkpoints.filter(cp =>
    cp.latitude != null && cp.longitude != null
  );
  const evenlySpaced = checkpoints.length > 0 && placed.length === 0;

  return (
    <View style={mp.container}>
      {/* Route line */}
      <View style={mp.track} />
      {/* Start dot */}
      <View style={[mp.dot, mp.dotStart]}>
        <Text style={mp.dotLabel}>START</Text>
      </View>
      {/* Evenly spaced CP markers (when no geo coords) */}
      {evenlySpaced && checkpoints.map((cp, i) => {
        const pct = ((i + 1) / (checkpoints.length + 1)) * 100;
        const cfg = markConfig(cp.markType ?? 'checkpoint');
        return (
          <View key={cp.id} style={[mp.dot, { left: `${pct}%`, backgroundColor: cfg.colour, borderColor: cfg.colour }]}>
            <Text style={[mp.dotLabel, { color: cfg.colour }]}>{cp.label}</Text>
          </View>
        );
      })}
      {/* Finish dot */}
      <View style={[mp.dot, mp.dotFinish]}>
        <Text style={mp.dotLabel}>{distanceKm}km</Text>
      </View>
    </View>
  );
}

const mp = StyleSheet.create({
  container: {
    height: 48,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: colours.border,
    top: 23,
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colours.cyan,
    backgroundColor: colours.cyan,
    top: 19,
    marginLeft: -5,
    alignItems: 'center',
  },
  dotStart: { left: 8 },
  dotFinish: { right: 8, marginLeft: 0 },
  dotLabel: {
    position: 'absolute',
    top: 12,
    color: colours.muted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    width: 40,
    left: -15,
  },
});

// ── Checkpoint row ───────────────────────────────────────────────

function CheckpointRow({
  cp,
  index,
  onLabelChange,
  onTypeChange,
  onRemove,
}: {
  cp: RuckCheckpoint;
  index: number;
  onLabelChange: (id: string, label: string) => void;
  onTypeChange:  (id: string, type: MarkType) => void;
  onRemove:      (id: string) => void;
}) {
  const [showTypes, setShowTypes] = useState(false);
  const cfg = markConfig(cp.markType ?? 'checkpoint');

  return (
    <View style={cr.wrap}>
      <View style={[cr.typeDot, { backgroundColor: cfg.colour }]} />
      <View style={cr.body}>
        <View style={cr.topRow}>
          <TextInput
            style={cr.input}
            value={cp.label}
            onChangeText={t => onLabelChange(cp.id, t)}
            placeholder={`Checkpoint ${index + 1}`}
            placeholderTextColor={colours.soft}
            maxLength={20}
          />
          <Pressable style={cr.typeBtn} onPress={() => setShowTypes(v => !v)}>
            <Text style={[cr.typeLabel, { color: cfg.colour }]}>{cfg.label}</Text>
            <Ionicons name={showTypes ? 'chevron-up' : 'chevron-down'} size={11} color={colours.muted} />
          </Pressable>
          <Pressable style={cr.removeBtn} onPress={() => onRemove(cp.id)}>
            <Ionicons name="close" size={14} color={colours.muted} />
          </Pressable>
        </View>
        {showTypes && (
          <View style={cr.typeRow}>
            {MARK_TYPES.map(m => (
              <Pressable
                key={m.key}
                style={[cr.typeChip, cp.markType === m.key && { borderColor: m.colour, backgroundColor: `${m.colour}18` }]}
                onPress={() => { onTypeChange(cp.id, m.key); setShowTypes(false); }}
              >
                <Ionicons name={m.icon as any} size={10} color={cp.markType === m.key ? m.colour : colours.muted} />
                <Text style={[cr.typeChipText, cp.markType === m.key && { color: m.colour }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const cr = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: colours.borderSoft,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 14,
    flexShrink: 0,
  },
  body: { flex: 1, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    color: colours.text,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderColor: colours.border,
  },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.xs,
    backgroundColor: colours.layer1,
    borderWidth: 1,
    borderColor: colours.border,
  },
  typeLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.0 },
  removeBtn: { padding: 4 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.layer1,
  },
  typeChipText: { color: colours.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
});

// ── Props ────────────────────────────────────────────────────────

export type RoutePlannerScreenProps = {
  sessions:      TrainingSession[];
  onLaunchRuck:  () => void;
  onGoToRuckRing?: () => void;
};

// ── Main screen ──────────────────────────────────────────────────

export function RoutePlannerScreen({ sessions, onLaunchRuck, onGoToRuckRing }: RoutePlannerScreenProps) {
  const [distanceKm,  setDistanceKm]  = useState(8);
  const [loadKg,      setLoadKg]      = useState(15);
  const [targetPace,  setTargetPace]  = useState(9.0);  // min/km
  const [checkpoints, setCheckpoints] = useState<RuckCheckpoint[]>([]);
  const [launching,   setLaunching]   = useState(false);

  const targetMinutes = Math.round(distanceKm * targetPace);
  const loadMovedKgKm = Math.round(distanceKm * loadKg);
  const recentRucks   = useMemo(() => lastRucks(sessions), [sessions]);

  const avgRecentPace = useMemo(() => {
    const rucks = recentRucks.filter(r => r.ruckMission);
    if (!rucks.length) return null;
    const paces = rucks.map(r => r.ruckMission!.targetMinutes / r.ruckMission!.targetDistanceKm);
    return paces.reduce((s, p) => s + p, 0) / paces.length;
  }, [recentRucks]);

  // Pre-fill pace from recent ruck history
  useEffect(() => {
    if (avgRecentPace != null && avgRecentPace > 0) setTargetPace(Math.round(avgRecentPace * 10) / 10);
  }, [avgRecentPace]);

  function addCP() {
    setCheckpoints(prev => [...prev, buildEmptyCP(prev.length)]);
  }

  function updateLabel(id: string, label: string) {
    setCheckpoints(prev => prev.map(cp => cp.id === id ? { ...cp, label } : cp));
  }

  function updateType(id: string, type: MarkType) {
    setCheckpoints(prev => prev.map(cp => cp.id === id ? { ...cp, markType: type } : cp));
  }

  function removeCP(id: string) {
    setCheckpoints(prev => prev.filter(cp => cp.id !== id));
  }

  async function launchRuck() {
    if (launching) return;
    setLaunching(true);
    const plan: RuckMissionPlan = {
      targetDistanceKm: distanceKm,
      targetMinutes,
      checkpointIntervalKm: distanceKm > 0 && checkpoints.length > 0
        ? Math.round((distanceKm / (checkpoints.length + 1)) * 10) / 10
        : 2,
      checkpointIndex: 0,
      finishMode: 'target',
      plannedCheckpoints: checkpoints,
      selectedCheckpointId: checkpoints[0]?.id ?? null,
    };
    try {
      await saveActiveRuckPlan(plan);
    } catch {
      // non-fatal — RuckScreen will still work without the persisted plan
    }
    setLaunching(false);
    onLaunchRuck();
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <Text style={styles.kicker}>ROUTE PLANNER</Text>
          <Text style={styles.title}>Mission Brief</Text>
        </View>
        {onGoToRuckRing && (
          <Pressable style={styles.ringLink} onPress={onGoToRuckRing}>
            <Ionicons name="analytics-outline" size={13} color={colours.cyan} />
            <Text style={styles.ringLinkText}>RUCK RING</Text>
          </Pressable>
        )}
      </View>

      {/* Distance */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TARGET DISTANCE</Text>
        <DistanceSelector value={distanceKm} onChange={setDistanceKm} />
      </View>

      {/* Load */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>RUCK LOAD</Text>
        <LoadSelector value={loadKg} onChange={setLoadKg} />
      </View>

      {/* Pace */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TARGET PACE (min/km)</Text>
        <View style={styles.paceRow}>
          <Pressable style={styles.paceBtn} onPress={() => setTargetPace(p => Math.max(4, Math.round((p - 0.5) * 10) / 10))}>
            <Ionicons name="remove" size={18} color={colours.text} />
          </Pressable>
          <View style={styles.paceCentre}>
            <Text style={styles.paceValue}>{formatPace(targetPace)}</Text>
            <Text style={styles.paceUnit}>per km</Text>
          </View>
          <Pressable style={styles.paceBtn} onPress={() => setTargetPace(p => Math.min(25, Math.round((p + 0.5) * 10) / 10))}>
            <Ionicons name="add" size={18} color={colours.text} />
          </Pressable>
        </View>
        {avgRecentPace != null && (
          <Text style={styles.paceHint}>
            Based on your last {recentRucks.length} ruck{recentRucks.length !== 1 ? 's' : ''}: avg {formatPace(avgRecentPace)}/km
          </Text>
        )}
      </View>

      {/* Mission summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryVal, { color: colours.cyan }]}>{distanceKm}km</Text>
            <Text style={styles.summaryLabel}>DISTANCE</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryVal, { color: colours.amber }]}>{loadKg}kg</Text>
            <Text style={styles.summaryLabel}>LOAD</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryVal, { color: colours.green }]}>{formatDuration(targetMinutes)}</Text>
            <Text style={styles.summaryLabel}>EST TIME</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryVal, { color: colours.violet }]}>{loadMovedKgKm}</Text>
            <Text style={styles.summaryLabel}>KG·KM</Text>
          </View>
        </View>

        {/* Mission profile diagram */}
        {checkpoints.length > 0 && (
          <MissionProfile distanceKm={distanceKm} checkpoints={checkpoints} />
        )}
      </View>

      {/* Checkpoints */}
      <View style={styles.section}>
        <View style={styles.cpHeader}>
          <Text style={styles.sectionLabel}>CHECKPOINTS ({checkpoints.length})</Text>
          <Pressable style={styles.addCpBtn} onPress={addCP}>
            <Ionicons name="add" size={14} color={colours.cyan} />
            <Text style={styles.addCpText}>ADD</Text>
          </Pressable>
        </View>

        {checkpoints.length === 0 ? (
          <View style={styles.cpEmpty}>
            <Ionicons name="flag-outline" size={22} color={colours.border} />
            <Text style={styles.cpEmptyText}>No checkpoints planned — tap ADD to mark key waypoints on your route.</Text>
          </View>
        ) : (
          <View style={styles.cpList}>
            {checkpoints.map((cp, i) => (
              <CheckpointRow
                key={cp.id}
                cp={cp}
                index={i}
                onLabelChange={updateLabel}
                onTypeChange={updateType}
                onRemove={removeCP}
              />
            ))}
          </View>
        )}
      </View>

      {/* Recent rucks reference */}
      {recentRucks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECENT RUCKS</Text>
          <View style={styles.historyList}>
            {recentRucks.map(r => {
              const plan = r.ruckMission;
              const dateStr = r.completedAt
                ? new Date(r.completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                : '';
              return (
                <Pressable
                  key={r.id}
                  style={styles.historyRow}
                  onPress={() => {
                    if (plan) {
                      setDistanceKm(plan.targetDistanceKm);
                      const pace = plan.targetMinutes / plan.targetDistanceKm;
                      setTargetPace(Math.round(pace * 10) / 10);
                    }
                    if (r.loadKg != null) setLoadKg(r.loadKg);
                  }}
                >
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyTitle} numberOfLines={1}>{r.title}</Text>
                    <Text style={styles.historyMeta}>
                      {plan ? `${plan.targetDistanceKm}km · ${plan.targetMinutes}min` : `${r.durationMinutes}min`}
                      {r.loadKg != null ? ` · ${r.loadKg}kg` : ''}
                    </Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyDate}>{dateStr}</Text>
                    <Text style={styles.historyApply}>USE</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Launch button */}
      <Pressable
        style={[styles.launchBtn, launching && styles.launchBtnDisabled]}
        onPress={launchRuck}
        disabled={launching}
      >
        <View style={styles.launchInner}>
          <View style={styles.launchTextGroup}>
            <Text style={styles.launchLabel}>{launching ? 'SAVING PLAN…' : 'BEGIN MISSION'}</Text>
            <Text style={styles.launchSub}>
              {distanceKm}km · {loadKg}kg · {formatDuration(targetMinutes)}
              {checkpoints.length > 0 ? ` · ${checkpoints.length} CP` : ''}
            </Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={28} color={colours.background} />
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colours.background },
  content: { padding: 14, gap: 20, paddingBottom: 60 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  header: { gap: 4, flex: 1 },
  kicker: { ...typography.label, color: colours.cyan },
  title:  { color: colours.text, fontSize: 30, lineHeight: 34, fontWeight: '900' },
  ringLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colours.borderHot,
    backgroundColor: colours.cyanDim,
    marginTop: 4,
  },
  ringLinkText: { color: colours.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },

  section:      { gap: 12 },
  sectionLabel: { ...typography.label, color: colours.muted },

  // Pace
  paceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  paceBtn: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.layer2,
  },
  paceCentre: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  paceValue: {
    color: colours.cyan,
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  paceUnit: {
    ...typography.label,
    fontSize: 8,
    color: colours.muted,
  },
  paceHint: {
    ...typography.caption,
    color: colours.soft,
    fontSize: 11,
  },

  // Summary card
  summaryCard: {
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: radius.sm,
    padding: 14,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryStat: { flex: 1, alignItems: 'center', gap: 3 },
  summaryVal:  { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  summaryLabel:{ ...typography.label, fontSize: 7 },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: colours.border,
  },

  // Checkpoints
  cpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addCpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colours.borderHot,
    backgroundColor: colours.cyanDim,
    minHeight: 32,
  },
  addCpText: { color: colours.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  cpEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: colours.panel,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colours.border,
  },
  cpEmptyText: { flex: 1, color: colours.muted, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  cpList: {
    backgroundColor: colours.panel,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colours.border,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },

  // Recent rucks
  historyList: {
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colours.borderSoft,
    minHeight: 56,
    gap: 12,
  },
  historyLeft:  { flex: 1 },
  historyTitle: { color: colours.text, fontSize: 13, fontWeight: '900' },
  historyMeta:  { color: colours.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  historyRight: { alignItems: 'flex-end', gap: 3 },
  historyDate:  { color: colours.muted, fontSize: 11, fontWeight: '700' },
  historyApply: { color: colours.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },

  // Launch button
  launchBtn: {
    backgroundColor: colours.green,
    borderRadius: radius.sm,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  launchBtnDisabled: { opacity: 0.6 },
  launchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  launchTextGroup: { gap: 3 },
  launchLabel: {
    color: colours.background,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1.4,
  },
  launchSub: {
    color: 'rgba(11,15,14,0.65)',
    fontSize: 11,
    fontWeight: '700',
  },
});
