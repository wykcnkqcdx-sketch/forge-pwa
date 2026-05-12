import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { buildPerformanceProfile } from '../lib/performance';
import { getLatestReadinessLog, isReadinessStale } from '../lib/readiness';
import { getCurrentStreak, getLongestStreak, getLast7DayFlags, streakMilestoneLabel } from '../lib/streak';
import { secureGetItem, secureSetItem, secureRemoveItem } from '../lib/secureStorage';
import { colours, radius, shadow, touchTarget, typography } from '../theme';
import { BodyMap, BodyMapView, PainMap, choirSegments } from '../components/BodyMap';
import { getProtocol } from '../lib/injuryProtocols';
import { responsiveSpacing, statusColors } from '../utils/styling';
import type { SquadMember, TrainingSession } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';

function isThisWeek(dateIso?: string) {
  if (!dateIso) return false;
  const date = new Date(dateIso);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return date >= start && date <= now;
}

function formatOneDecimal(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function readinessBand(score: number): { label: string; sub: string; tone: string } {
  if (score >= 75) return { label: 'FIELD READY',  sub: 'Moderate session recommended', tone: colours.green };
  if (score >= 60) return { label: 'MODERATE',     sub: 'Keep load steady today',        tone: colours.amber };
  return              { label: 'RECOVER',          sub: 'Recovery priority',              tone: colours.red   };
}

export function HomeScreen({
  sessions,
  goToRuck,
  goToAnalytics,
  goToTrain,
  goToReadiness,
  goToLogbook,
  readinessLogs = [],
  workoutCompletions = [],
  member,
}: {
  sessions: TrainingSession[];
  goToRuck: () => void;
  goToAnalytics: () => void;
  goToFuel?: () => void;
  goToTrain?: () => void;
  goToReadiness?: () => void;
  goToLogbook?: () => void;
  readinessLogs?: ReadinessLog[];
  workoutCompletions?: WorkoutCompletion[];
  member?: SquadMember | null;
  secondaryActionLabel?: string;
}) {
  const performance = useMemo(() => buildPerformanceProfile(sessions), [sessions]);
  const latestReadiness = useMemo(
    () => getLatestReadinessLog(readinessLogs, member?.id),
    [member?.id, readinessLogs],
  );
  const readinessStale = isReadinessStale(latestReadiness);
  const readinessScore = performance.readiness;
  const band = readinessBand(readinessScore);

  const weeklyRuckKm = useMemo(() =>
    sessions
      .filter(s => s.type === 'Ruck' && isThisWeek(s.completedAt))
      .reduce((total, s) => {
        const km = s.ruckMission?.targetDistanceKm ?? (s.durationMinutes / 60) * 5.2;
        return total + km;
      }, 0),
    [sessions],
  );

  const loadMoved = useMemo(() =>
    sessions
      .filter(s => s.type === 'Ruck' && isThisWeek(s.completedAt) && s.loadKg)
      .reduce((total, s) => {
        const km = s.ruckMission?.targetDistanceKm ?? (s.durationMinutes / 60) * 5.2;
        return total + (s.loadKg ?? 0) * km;
      }, 0),
    [sessions],
  );

  const streak = useMemo(
    () => member?.streakDays ?? getCurrentStreak(sessions),
    [member?.streakDays, sessions],
  );
  const longestStreak = useMemo(() => getLongestStreak(sessions), [sessions]);
  const last7 = useMemo(() => getLast7DayFlags(sessions), [sessions]);

  const [weeklyGoalKm, setWeeklyGoalKm] = useState<number | null>(null);
  const [goalModalOpen, setGoalModalOpen]   = useState(false);
  const [goalInput, setGoalInput]           = useState('');

  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [bodyMapView, setBodyMapView] = useState<BodyMapView>('anterior');
  const [selectedPainLevel, setSelectedPainLevel] = useState(4);
  const [painMap, setPainMap] = useState<PainMap>({});
  const hotspots = choirSegments
    .map((seg) => ({ ...seg, level: painMap[seg.id] ?? 0 }))
    .filter((seg) => seg.level > 0)
    .sort((a, b) => b.level - a.level)
    .slice(0, 3);
  const lowerBackLoadFlag =
    sessions.some((s) => s.type === 'Ruck' && (s.loadKg ?? 0) >= 18) &&
    ((painMap.P09 ?? 0) >= 5 || (painMap.P10 ?? 0) >= 5);

  function markInjury(segmentId: string) {
    setSelectedSegment(segmentId);
    setPainMap((cur) => ({ ...cur, [segmentId]: selectedPainLevel }));
  }

  function setPainIntensity(level: number) {
    setSelectedPainLevel(level);
    if (selectedSegment) setPainMap((cur) => ({ ...cur, [selectedSegment]: level }));
  }

  useEffect(() => {
    secureGetItem('forge:weeklyRuckGoalKm').then(val => {
      const n = val ? Number(val) : null;
      if (n && n > 0) setWeeklyGoalKm(n);
    });
  }, []);

  async function handleSaveGoal() {
    const km = Math.round(Number(goalInput));
    if (!km || km <= 0 || km > 500) return;
    await secureSetItem('forge:weeklyRuckGoalKm', String(km));
    setWeeklyGoalKm(km);
    setGoalModalOpen(false);
    setGoalInput('');
  }

  async function handleClearGoal() {
    await secureRemoveItem('forge:weeklyRuckGoalKm');
    setWeeklyGoalKm(null);
    setGoalModalOpen(false);
    setGoalInput('');
  }

  const orders = useMemo(() => {
    const assigned = member?.assignmentSession;
    if (goToReadiness && (!latestReadiness || readinessStale)) {
      return {
        title: 'Readiness check',
        detail: 'Two minutes. Sleep, soreness, hydration and pain flags.',
        action: 'COMPLETE READINESS CHECK',
        icon: 'body-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.amber,
        onPress: goToReadiness,
      };
    }
    if (assigned && assigned.status !== 'completed') {
      return {
        title: assigned.title,
        detail: assigned.coachNote ?? `${assigned.type} assigned by coach.`,
        action: assigned.type === 'Ruck' ? 'START RUCK' : 'START SESSION',
        icon: assigned.type === 'Ruck' ? ('footsteps-outline' as const) : ('barbell-outline' as const),
        tone: band.tone,
        onPress: assigned.type === 'Ruck' ? goToRuck : goToTrain,
      };
    }
    if (performance.loadRisk === 'High' || performance.readinessBand === 'RED') {
      return {
        title: 'Mobility reset',
        detail: '20–30 min. Bring load down before the next hard effort.',
        action: 'LOG WORKOUT',
        icon: 'body-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.red,
        onPress: goToTrain,
      };
    }
    if (weeklyRuckKm < 6) {
      return {
        title: '6 km ruck · 15 kg load',
        detail: 'Zone 2 pace. Add checkpoints if training outdoors.',
        action: 'START RUCK',
        icon: 'footsteps-outline' as keyof typeof Ionicons.glyphMap,
        tone: colours.cyan,
        onPress: goToRuck,
      };
    }
    return {
      title: 'Strength block',
      detail: 'Compound work plus carries. Keep effort at RPE 7.',
      action: 'LOG WORKOUT',
      icon: 'barbell-outline' as keyof typeof Ionicons.glyphMap,
      tone: colours.green,
      onPress: goToTrain,
    };
  }, [goToReadiness, goToRuck, goToTrain, latestReadiness, member?.assignmentSession, performance.loadRisk, performance.readinessBand, readinessStale, band.tone, weeklyRuckKm]);

  const alerts = useMemo(() => {
    const list: Array<{ label: string; tone: string; icon: keyof typeof Ionicons.glyphMap }> = [];
    if (!latestReadiness || readinessStale) list.push({ label: 'Readiness check due', tone: colours.amber, icon: 'time-outline' });
    if (latestReadiness?.hydration === 'Poor') list.push({ label: 'Hydration low', tone: colours.amber, icon: 'water-outline' });
    if ((latestReadiness?.pain ?? 0) >= 4) list.push({ label: 'Pain flag needs review', tone: colours.red, icon: 'alert-circle-outline' });
    if (performance.loadRisk === 'High') list.push({ label: 'Training load high', tone: colours.red, icon: 'flame-outline' });
    return list.length
      ? list
      : [{ label: 'No injury flags', tone: colours.green, icon: 'shield-checkmark-outline' as const }];
  }, [latestReadiness, performance.loadRisk, readinessStale]);

  const lastRuck = useMemo(() =>
    sessions
      .filter(s => s.type === 'Ruck' && s.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0] ?? null,
    [sessions],
  );

  const squadCompliance = member ? Math.round(member.compliance) : null;
  const lastCompletion = workoutCompletions[0];

  return (
    <Screen>
      {/* ── Header ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandName}>FORGE</Text>
          <Text style={[styles.brandKicker, { color: band.tone }]}>{band.label}</Text>
        </View>
        <Pressable style={styles.readinessBadge} onPress={goToReadiness}>
          <Text style={[styles.readinessNum, { color: band.tone }]}>{readinessScore}</Text>
          <Text style={styles.readinessLabel}>READINESS</Text>
        </Pressable>
      </View>

      {/* ── Today's Orders ───────────────────────────────────── */}
      <Card hot accent={orders.tone}>
        <View style={styles.ordersHeader}>
          <Text style={styles.sectionLabel}>TODAY'S ORDERS</Text>
          <Ionicons name={orders.icon} size={18} color={orders.tone} />
        </View>
        <View style={styles.divider} />
        <Text style={[styles.ordersTitle, { color: orders.tone }]}>{orders.title}</Text>
        <Text style={styles.ordersDetail}>{orders.detail}</Text>
        <Pressable
          style={[styles.ctaButton, { backgroundColor: orders.tone }]}
          onPress={orders.onPress}
        >
          <Ionicons name={orders.icon} size={16} color={colours.background} />
          <Text style={styles.ctaText}>{orders.action}</Text>
        </Pressable>
      </Card>

      {/* ── Stat tiles ───────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <Pressable
          style={[styles.statTile, styles.statTilePress]}
          onPress={() => { setGoalInput(weeklyGoalKm ? String(weeklyGoalKm) : ''); setGoalModalOpen(true); }}
        >
          <Text style={styles.tileLabel}>RUCK WEEK</Text>
          <Text style={[
            styles.tileValue,
            weeklyGoalKm != null && {
              color: weeklyRuckKm >= weeklyGoalKm ? colours.green : colours.cyan,
            },
          ]}>
            {formatOneDecimal(weeklyRuckKm)}
          </Text>
          <Text style={styles.tileUnit}>
            {weeklyGoalKm != null ? `/ ${weeklyGoalKm} km` : 'km'}
          </Text>
          {weeklyGoalKm == null && (
            <Text style={styles.tileHint}>SET GOAL</Text>
          )}
          {weeklyGoalKm != null && (
            <View style={styles.goalBarBg}>
              <View style={[
                styles.goalBarFill,
                {
                  width: `${Math.min(100, (weeklyRuckKm / weeklyGoalKm) * 100)}%` as any,
                  backgroundColor: weeklyRuckKm >= weeklyGoalKm ? colours.green : colours.cyan,
                },
              ]} />
            </View>
          )}
        </Pressable>
        <View style={styles.statTile}>
          <Text style={styles.tileLabel}>LOAD MOVED</Text>
          <Text style={styles.tileValue}>{Math.round(loadMoved)}</Text>
          <Text style={styles.tileUnit}>kg·km</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.tileLabel}>STREAK</Text>
          <View style={styles.streakDots}>
            {last7.map((active, i) => (
              <View key={i} style={[styles.streakDot, active && styles.streakDotActive]} />
            ))}
          </View>
          <Text style={[styles.tileValue, streak >= 3 && { color: colours.cyan }]}>{streak}</Text>
          <Text style={styles.tileUnit}>days</Text>
          {streakMilestoneLabel(streak) && (
            <View style={styles.streakMilestone}>
              <Text style={styles.streakMilestoneText}>{streakMilestoneLabel(streak)}</Text>
            </View>
          )}
          {longestStreak > streak && (
            <Text style={styles.streakBest}>BEST {longestStreak}</Text>
          )}
        </View>
      </View>

      {/* ── Last ruck ────────────────────────────────────────── */}
      {lastRuck && <LastRuckCard session={lastRuck} onPress={goToLogbook} />}

      {/* ── Squad Pulse ──────────────────────────────────────── */}
      {squadCompliance !== null && (
        <Card>
          <View style={styles.squadHeader}>
            <Text style={styles.sectionLabel}>SQUAD PULSE</Text>
            <Ionicons name="people-outline" size={16} color={colours.muted} />
          </View>
          <View style={styles.squadCompliance}>
            <Text style={[styles.squadPct, { color: squadCompliance >= 75 ? colours.green : colours.amber }]}>
              {squadCompliance}%
            </Text>
            <Text style={styles.squadSub}>complete this week</Text>
          </View>
          <ProgressBar
            value={squadCompliance}
            colour={squadCompliance >= 75 ? colours.green : colours.amber}
            height={6}
          />
          {lastCompletion && (
            <Text style={styles.squadNote}>
              Last: {lastCompletion.assignment} — {lastCompletion.effort.toLowerCase()}
            </Text>
          )}
        </Card>
      )}

      {/* ── Field status ─────────────────────────────────────── */}
      <View style={styles.statusCard}>
        <Text style={styles.sectionLabel}>FIELD STATUS</Text>
        {alerts.map((alert) => (
          <View key={alert.label} style={styles.alertRow}>
            <Ionicons name={alert.icon} size={14} color={alert.tone} />
            <Text style={[styles.alertText, { color: alert.tone }]}>{alert.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Injury Report ────────────────────────────────────── */}
      <Card>
        <Text style={styles.cardTitle}>Injury Report</Text>
        <Text style={styles.muted}>Tap a CHOIR segment, then set pain intensity.</Text>
        <View style={styles.intensityRow}>
          {[0, 2, 4, 6, 8, 10].map((level) => (
            <Pressable
              key={level}
              style={[
                styles.intensityButton,
                {
                  backgroundColor:
                    level <= 0 ? colours.cyanDim : level <= 3 ? colours.cyan : level <= 6 ? colours.amber : colours.red,
                  borderColor: selectedPainLevel === level ? colours.text : 'transparent',
                },
              ]}
              onPress={() => setPainIntensity(level)}
              accessibilityRole="button"
              accessibilityLabel={`Set pain intensity ${level} out of 10`}
            >
              <Text style={[styles.intensityText, level > 0 && { color: colours.background }]}>{level}</Text>
            </Pressable>
          ))}
        </View>
        <BodyMap
          activeView={bodyMapView}
          painMap={painMap}
          selectedSegment={selectedSegment}
          selectedPainLevel={selectedPainLevel}
          onChangeView={setBodyMapView}
          onSelect={markInjury}
        />
        <View style={[styles.hotspotPanel, shadow.subtle]}>
          <Text style={styles.hotspotTitle}>HPT Hotspots</Text>
          {hotspots.length ? (
            hotspots.map((seg) => (
              <View key={seg.id} style={styles.hotspotRow}>
                <Text style={styles.hotspotName}>{seg.id} {seg.label}</Text>
                <Text style={[styles.hotspotScore, { color: seg.level >= 7 ? colours.red : seg.level >= 4 ? colours.amber : colours.cyan }]}>
                  {seg.level}/10
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No musculoskeletal reports logged.</Text>
          )}
          {lowerBackLoadFlag && (
            <Text style={styles.hotspotAlert}>
              Lower-back hotspot rising after loaded ruck exposure. Flag for HPT trend review.
            </Text>
          )}
        </View>

        {selectedSegment && (painMap[selectedSegment] ?? 0) > 0 && (() => {
          const proto = getProtocol(selectedSegment);
          const pain = painMap[selectedSegment] ?? 0;
          const severity = pain >= 7 ? 'severe' : pain >= 4 ? 'moderate' : 'mild';
          const modalityColor = proto.modality === 'ice' ? colours.cyan : proto.modality === 'heat' ? colours.amber : colours.violet;
          return (
            <View style={styles.protoPanel}>
              <View style={styles.protoHeader}>
                <Ionicons name="medkit-outline" size={16} color={colours.red} />
                <Text style={styles.protoTitle}>Recovery Protocol</Text>
                <View style={[styles.protoSeverityBadge, { borderColor: pain >= 7 ? colours.red : pain >= 4 ? colours.amber : colours.cyan }]}>
                  <Text style={[styles.protoSeverityText, { color: pain >= 7 ? colours.red : pain >= 4 ? colours.amber : colours.cyan }]}>{severity.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.protoRegion}>{proto.region}</Text>
              <Text style={styles.protoMuscles}>{proto.muscles.join(' · ')}</Text>

              <View style={styles.protoSection}>
                <Text style={styles.protoSectionLabel}>ACUTE MANAGEMENT</Text>
                <Text style={styles.protoBody}>{proto.acuteManagement}</Text>
                <View style={[styles.protoModalityPill, { borderColor: modalityColor }]}>
                  <Text style={[styles.protoModalityText, { color: modalityColor }]}>{proto.modality.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.protoSection}>
                <Text style={styles.protoSectionLabel}>RETURN TO TRAIN</Text>
                <View style={styles.rttRow}>
                  {(['mild', 'moderate', 'severe'] as const).map((s) => (
                    <View key={s} style={[styles.rttCard, s === severity && styles.rttCardActive]}>
                      <Text style={[styles.rttCardLabel, s === severity && { color: colours.text }]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
                      <Text style={[styles.rttCardDays, s === severity && { color: colours.cyan }]}>{proto.returnToTrainDays[s]}d</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.muted, { marginTop: 4 }]}>Estimated days at {severity} severity (pain {pain}/10)</Text>
              </View>

              <View style={styles.protoSection}>
                <Text style={styles.protoSectionLabel}>STRETCHING</Text>
                {proto.stretches.map((s, i) => (
                  <View key={i} style={styles.protoItem}>
                    <View style={styles.protoItemHeader}>
                      <Text style={styles.protoItemName}>{s.name}</Text>
                      <Text style={styles.protoItemMeta}>{s.duration}</Text>
                    </View>
                    <Text style={styles.protoBody}>{s.instruction}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.protoSection}>
                <Text style={styles.protoSectionLabel}>RECOVERY EXERCISES</Text>
                {proto.recoveryExercises.map((ex, i) => (
                  <View key={i} style={styles.protoItem}>
                    <View style={styles.protoItemHeader}>
                      <Text style={styles.protoItemName}>{ex.name}</Text>
                      <Text style={styles.protoItemMeta}>{ex.sets} × {ex.reps}</Text>
                    </View>
                    <Text style={styles.protoBody}>{ex.notes}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.protoSection}>
                <Text style={styles.protoSectionLabel}>MAINTENANCE</Text>
                {proto.maintenanceExercises.map((ex, i) => (
                  <View key={i} style={styles.protoMaintenanceRow}>
                    <Ionicons name="checkmark-circle-outline" size={13} color={colours.green} />
                    <Text style={styles.protoBody}>{ex}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.protoSection}>
                <Text style={styles.protoSectionLabel}>INJURY PREVENTION</Text>
                {proto.preventionTips.map((tip, i) => (
                  <View key={i} style={styles.protoMaintenanceRow}>
                    <Ionicons name="shield-checkmark-outline" size={13} color={colours.violet} />
                    <Text style={styles.protoBody}>{tip}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.medicalDisclaimer}>* Protocol is guidance only. Consult a physiotherapist or medical officer for injuries that are severe, persistent, or involve neurological symptoms.</Text>
            </View>
          );
        })()}
      </Card>

      {/* ── Analytics link ───────────────────────────────────── */}
      <Pressable style={styles.analyticsLink} onPress={goToAnalytics}>
        <Text style={styles.analyticsText}>Readiness + load analytics</Text>
        <Ionicons name="chevron-forward" size={14} color={colours.cyan} />
      </Pressable>

      {/* ── Weekly goal modal ────────────────────────────────── */}
      <Modal visible={goalModalOpen} transparent animationType="fade">
        <Pressable style={gm.overlay} onPress={() => setGoalModalOpen(false)}>
          <Pressable style={gm.panel} onPress={() => {}}>
            <Text style={gm.kicker}>RUCK GOAL</Text>
            <Text style={gm.title}>Weekly Distance</Text>
            <Text style={gm.body}>Target km for the rolling 7-day window.</Text>

            <View style={gm.presets}>
              {[10, 15, 20, 25, 30].map(n => (
                <Pressable
                  key={n}
                  style={[gm.preset, goalInput === String(n) && gm.presetActive]}
                  onPress={() => setGoalInput(String(n))}
                >
                  <Text style={[gm.presetText, goalInput === String(n) && gm.presetTextActive]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={gm.input}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="Custom km"
              placeholderTextColor={colours.soft}
              value={goalInput}
              onChangeText={setGoalInput}
            />

            <Pressable style={gm.saveBtn} onPress={handleSaveGoal}>
              <Text style={gm.saveBtnText}>SET GOAL</Text>
            </Pressable>

            {weeklyGoalKm != null && (
              <Pressable style={gm.clearBtn} onPress={handleClearGoal}>
                <Text style={gm.clearBtnText}>Clear goal</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

// ── Last Ruck Card ───────────────────────────────────────────────

function scoreTone(score: number) {
  if (score >= 80) return colours.green;
  if (score >= 65) return colours.cyan;
  if (score >= 50) return colours.amber;
  return colours.red;
}

function formatRuckDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();
}

function formatPaceShort(session: TrainingSession) {
  const km = session.ruckMission?.targetDistanceKm ?? (session.durationMinutes / 60) * 5.2;
  if (km <= 0) return '--';
  const minPerKm = session.durationMinutes / km;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function LastRuckCard({ session, onPress }: { session: TrainingSession; onPress?: () => void }) {
  const tone = scoreTone(session.score);
  const km = (session.ruckMission?.targetDistanceKm ?? (session.durationMinutes / 60) * 5.2).toFixed(1);
  const pace = formatPaceShort(session);
  const date = session.completedAt ? formatRuckDate(session.completedAt) : '';

  return (
    <Pressable style={lr.card} onPress={onPress} disabled={!onPress}>
      <View style={lr.left}>
        <Text style={lr.label}>LAST RUCK</Text>
        <Text style={lr.title} numberOfLines={1}>{session.title}</Text>
        <View style={lr.metaRow}>
          <Text style={lr.meta}>{km} km</Text>
          {session.loadKg ? <><Text style={lr.dot}>·</Text><Text style={lr.meta}>{session.loadKg} kg</Text></> : null}
          <Text style={lr.dot}>·</Text>
          <Text style={lr.meta}>{pace}/km</Text>
        </View>
      </View>
      <View style={lr.right}>
        <View style={[lr.scoreBadge, { borderColor: `${tone}45`, backgroundColor: `${tone}10` }]}>
          <Text style={[lr.scoreVal, { color: tone }]}>{session.score}</Text>
          <Text style={lr.scoreUnit}>SCORE</Text>
        </View>
        <Text style={lr.date}>{date}</Text>
        {onPress && <Ionicons name="chevron-forward" size={14} color={colours.muted} />}
      </View>
    </Pressable>
  );
}

const lr = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  left: { flex: 1, gap: 3 },
  label: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2,
    color: colours.muted,
    textTransform: 'uppercase',
  },
  title: {
    color: colours.text,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  meta: { color: colours.muted, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dot: { color: colours.border, fontSize: 11, fontWeight: '900' },
  right: { alignItems: 'flex-end', gap: 4 },
  scoreBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreVal: { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 24 },
  scoreUnit: { color: colours.muted, fontSize: 6, fontWeight: '900', letterSpacing: 1.5 },
  date: { color: colours.soft, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
});

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 4,
  },
  brandName: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    color: colours.text,
    lineHeight: 44,
  },
  brandKicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.5,
    marginTop: 2,
  },
  readinessBadge: {
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  readinessNum: {
    fontSize: 56,
    fontWeight: '900',
    lineHeight: 58,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  readinessLabel: {
    ...typography.label,
    color: colours.muted,
    textAlign: 'right',
  },

  // Today's Orders
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    ...typography.label,
    color: colours.muted,
  },
  divider: {
    height: 1,
    backgroundColor: colours.borderSoft,
    marginBottom: 12,
  },
  ordersTitle: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  ordersDetail: {
    ...typography.body,
    color: colours.textSoft,
    marginBottom: 16,
  },
  ctaButton: {
    minHeight: touchTarget,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    color: colours.background,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.2,
  },

  // Stat tiles
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    flex: 1,
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    padding: 12,
    alignItems: 'center',
  },
  tileLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: colours.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  tileValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colours.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  tileUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: colours.soft,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  statTilePress: {
    overflow: 'hidden',
  },
  tileHint: {
    fontSize: 7,
    fontWeight: '900',
    color: colours.muted,
    letterSpacing: 1,
    marginTop: 4,
  },
  goalBarBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colours.border,
  },
  goalBarFill: {
    height: 3,
  },
  streakDots: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
    marginTop: 2,
  },
  streakDot: {
    width: 5,
    height: 5,
    borderRadius: 2,
    backgroundColor: colours.border,
  },
  streakDotActive: {
    backgroundColor: colours.cyan,
  },
  streakMilestone: {
    marginTop: 4,
    backgroundColor: `${colours.cyan}20`,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  streakMilestoneText: {
    color: colours.cyan,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  streakBest: {
    color: colours.muted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 3,
  },

  // Squad Pulse
  squadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  squadCompliance: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  squadPct: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 38,
    fontVariant: ['tabular-nums'],
  },
  squadSub: {
    ...typography.caption,
    color: colours.muted,
  },
  squadNote: {
    ...typography.caption,
    color: colours.muted,
    marginTop: 8,
  },

  // Field Status
  statusCard: {
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    padding: 14,
    gap: 2,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 32,
    borderTopWidth: 1,
    borderTopColor: colours.borderSoft,
    marginTop: 4,
  },
  alertText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  // Analytics link
  analyticsLink: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: radius.sm,
    backgroundColor: colours.cyanDim,
    ...shadow.subtle,
  },
  analyticsText: {
    color: colours.cyan,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  muted: { ...typography.caption, color: colours.muted },
  intensityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing('sm'), marginVertical: responsiveSpacing('md') },
  intensityButton: { width: 44, height: 44, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  intensityText: { color: colours.text, fontSize: 14, fontWeight: '900' },
  hotspotPanel: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 8, padding: responsiveSpacing('md'), backgroundColor: colours.panel, marginTop: responsiveSpacing('md'), gap: 6 },
  hotspotTitle: { ...typography.h4, color: colours.text, marginBottom: 4 },
  hotspotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: responsiveSpacing('md'), paddingVertical: 6, borderTopWidth: 1, borderColor: colours.borderSoft },
  hotspotName: { flex: 1, ...typography.caption, color: colours.textSoft, fontWeight: '800' },
  hotspotScore: { ...typography.caption, fontWeight: '900' },
  hotspotAlert: { ...typography.caption, color: colours.red, fontWeight: '900', lineHeight: 17, marginTop: 4 },
  protoPanel: { marginTop: responsiveSpacing('md'), borderWidth: 1, borderColor: statusColors(colours.red).borderMed, borderRadius: 12, padding: responsiveSpacing('md'), backgroundColor: statusColors(colours.red).bgMed, gap: 2 },
  protoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  protoTitle: { color: colours.text, fontWeight: '900', fontSize: 15, flex: 1 },
  protoSeverityBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  protoSeverityText: { ...typography.label, fontWeight: '900', letterSpacing: 1 },
  protoRegion: { color: colours.text, fontWeight: '900', fontSize: 16, marginBottom: 2 },
  protoMuscles: { ...typography.caption, color: colours.textSoft, lineHeight: 17, marginBottom: 6 },
  protoSection: { marginTop: responsiveSpacing('md'), gap: 6 },
  protoSectionLabel: { ...typography.label, color: colours.muted, letterSpacing: 1.5, marginBottom: 2 },
  protoBody: { ...typography.caption, color: colours.textSoft, lineHeight: 17, flex: 1 },
  protoModalityPill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  protoModalityText: { ...typography.label, fontWeight: '900', letterSpacing: 1 },
  rttRow: { flexDirection: 'row', gap: responsiveSpacing('sm') },
  rttCard: { flex: 1, borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 8, paddingVertical: 8, alignItems: 'center', backgroundColor: colours.surface },
  rttCardActive: { borderColor: colours.cyan, backgroundColor: statusColors(colours.cyan).bgMed },
  rttCardLabel: { ...typography.label, color: colours.muted, marginBottom: 2 },
  rttCardDays: { color: colours.muted, fontWeight: '900', fontSize: 18 },
  protoItem: { borderTopWidth: 1, borderTopColor: colours.borderSoft, paddingTop: 6, gap: 3 },
  protoItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  protoItemName: { color: colours.text, fontWeight: '800', fontSize: 13, flex: 1 },
  protoItemMeta: { ...typography.label, color: colours.cyan, fontWeight: '900' },
  protoMaintenanceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 3 },
  medicalDisclaimer: { ...typography.caption, color: colours.amber, fontStyle: 'italic', marginTop: responsiveSpacing('md'), lineHeight: 14 },
});

// ── Goal modal styles ────────────────────────────────────────────

const gm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11,15,14,0.80)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    backgroundColor: colours.surface,
    borderRadius: 22,
    padding: 24,
    margin: 24,
    minWidth: 300,
    maxWidth: 380,
    gap: 12,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    color: colours.cyan,
    letterSpacing: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colours.text,
    marginTop: -4,
  },
  body: {
    fontSize: 13,
    color: colours.textSoft,
    lineHeight: 19,
  },
  presets: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  preset: {
    flex: 1,
    minWidth: 44,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    alignItems: 'center',
  },
  presetActive: {
    backgroundColor: `${colours.cyan}20`,
    borderColor: colours.cyan,
  },
  presetText: {
    fontSize: 15,
    fontWeight: '900',
    color: colours.muted,
  },
  presetTextActive: {
    color: colours.cyan,
  },
  input: {
    backgroundColor: colours.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colours.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colours.text,
  },
  saveBtn: {
    backgroundColor: colours.cyan,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: {
    color: colours.background,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.2,
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  clearBtnText: {
    color: colours.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
