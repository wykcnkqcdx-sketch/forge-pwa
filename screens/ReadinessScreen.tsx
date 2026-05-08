import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { ReadinessRing } from '../components/graphics/ReadinessRing';
import { TacticalDivider } from '../components/ui/TacticalDivider';
import { StatusChip } from '../components/ui/StatusChip';
import { getAppleHealthCapability, getAppleHealthPreview } from '../lib/appleHealth';
import { colours, touchTarget, radius, shadows } from '../theme';
import { useResponsive } from '../utils/responsive';
import { SquadMember } from '../data/mockData';
import type { ReadinessLog, InjuryLog } from '../data/domain';
import { getLatestReadinessLog, isReadinessCheckedInToday, isReadinessStale } from '../lib/readiness';
import { showAlert } from '../lib/dialogs';

function calculateMemberReadiness(check: {
  sleepQuality: number;
  soreness: number;
  pain: number;
  mood: number;
  illness: number;
  hydration: ReadinessLog['hydration'];
}) {
  const hydrationPenalty = check.hydration === 'Optimal' ? 0 : check.hydration === 'Adequate' ? 4 : 10;
  const score =
    100
    - (5 - check.sleepQuality) * 8
    - check.soreness * 4
    - check.pain * 6
    - (5 - check.mood) * 4
    - check.illness * 7
    - hydrationPenalty;
  return Math.max(25, Math.min(98, Math.round(score)));
}

function deriveMemberRisk(pain: number, illness: number, soreness: number, sleepQuality: number): SquadMember['risk'] {
  if (pain >= 4 || illness >= 4) return 'High';
  if (pain >= 3 || soreness >= 4 || sleepQuality <= 2) return 'Medium';
  return 'Low';
}

function scoreToTone(score: number) {
  if (score >= 75) return colours.green;
  if (score >= 50) return colours.amber;
  return colours.red;
}

function FactorRow({
  label,
  value,
  onChange,
  accent = colours.amber,
}: {
  label: string;
  value: 1 | 2 | 3 | 4 | 5;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
  accent?: string;
}) {
  const { fs } = useResponsive();
  const LABELS: Record<number, string> = { 1: 'Poor', 2: 'Low', 3: 'OK', 4: 'Good', 5: 'Great' };

  return (
    <View style={factorStyles.row}>
      <View style={factorStyles.topRow}>
        <Text style={[factorStyles.label, { fontSize: fs(12, { min: 11, max: 14 }) }]}>{label}</Text>
        <Text style={[factorStyles.valueLabel, { color: accent, fontSize: fs(11, { min: 10, max: 13 }) }]}>{value} — {LABELS[value]}</Text>
      </View>
      <View style={factorStyles.scale}>
        {([1, 2, 3, 4, 5] as const).map((item) => {
          const active = item === value;
          const itemTone = item <= 2 ? colours.red : item === 3 ? colours.amber : colours.green;
          return (
            <Pressable
              key={item}
              style={[
                factorStyles.btn,
                { borderColor: active ? `${itemTone}70` : colours.borderSoft, backgroundColor: active ? `${itemTone}18` : colours.layer1 },
              ]}
              onPress={() => onChange(item)}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${item}`}
            >
              <Text style={[factorStyles.btnText, { color: active ? itemTone : colours.muted, fontSize: fs(13, { min: 12, max: 15 }) }]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const factorStyles = StyleSheet.create({
  row: { gap: 6, marginTop: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colours.text, fontWeight: '800' },
  valueLabel: { fontWeight: '900' },
  scale: { flexDirection: 'row', gap: 6 },
  btn: {
    flex: 1,
    height: 40,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontWeight: '900' },
});

export function ReadinessScreen({
  member,
  readinessLogs = [],
  injuryLogs = [],
  onSubmitReadiness,
  onUpdateMember,
  onCompleteCheckIn,
  onAddInjuryLog,
  onDeleteInjuryLog,
  onResolveInjuryLog,
}: {
  member: SquadMember;
  readinessLogs?: ReadinessLog[];
  injuryLogs?: InjuryLog[];
  onSubmitReadiness?: (log: ReadinessLog) => void;
  onUpdateMember?: (id: string, updates: Partial<SquadMember>) => void;
  onCompleteCheckIn?: () => void;
  onAddInjuryLog?: (log: InjuryLog) => void;
  onDeleteInjuryLog?: (id: string) => void;
  onResolveInjuryLog?: (id: string) => void;
}) {
  const { fs, sp, isTablet } = useResponsive();
  const [submitting, setSubmitting] = useState(false);
  const [showInjuryForm, setShowInjuryForm] = useState(false);
  const [injuryBodyArea, setInjuryBodyArea] = useState<InjuryLog['bodyArea']>('Knee');
  const [injurySeverity, setInjurySeverity] = useState<InjuryLog['severity']>(2);
  const [injuryDesc, setInjuryDesc] = useState('');
  const [injuryLimits, setInjuryLimits] = useState(false);
  const [readinessCheck, setReadinessCheck] = useState({
    sleepHours: '7',
    sleepQuality: 3 as 1 | 2 | 3 | 4 | 5,
    soreness: 2 as 1 | 2 | 3 | 4 | 5,
    pain: 1 as 1 | 2 | 3 | 4 | 5,
    hydration: 'Adequate' as ReadinessLog['hydration'],
    mood: 3 as 1 | 2 | 3 | 4 | 5,
    illness: 1 as 1 | 2 | 3 | 4 | 5,
    restingHR: '',
    hrv: '',
    painArea: 'Knee' as NonNullable<ReadinessLog['painArea']>,
    limitsTraining: false,
  });
  const [feedback, setFeedback] = useState('');

  const latestLog = getLatestReadinessLog(readinessLogs, member.id);
  const checkedInToday = isReadinessCheckedInToday(latestLog);
  const logIsStale = isReadinessStale(latestLog);
  const appleHealthPreview = getAppleHealthPreview(member);

  const liveScore = calculateMemberReadiness(readinessCheck);
  const liveTone = scoreToTone(liveScore);

  function submitReadinessReport() {
    if (submitting) return;
    const sleepHours = Number.parseInt(readinessCheck.sleepHours, 10);
    if (!Number.isFinite(sleepHours) || sleepHours <= 0) {
      setFeedback('Add your sleep hours before sending the report.');
      return;
    }
    setSubmitting(true);
    const now = new Date().toISOString();
    const readinessScore = calculateMemberReadiness(readinessCheck);
    const risk = deriveMemberRisk(readinessCheck.pain, readinessCheck.illness, readinessCheck.soreness, readinessCheck.sleepQuality);

    onSubmitReadiness?.({
      id: `readiness-${member.id}-${Date.now()}`,
      date: now,
      memberId: member.id,
      memberName: member.gymName || member.name,
      groupId: member.groupId,
      sleepHours,
      sleepQuality: readinessCheck.sleepQuality,
      soreness: readinessCheck.soreness,
      stress: (6 - readinessCheck.mood) as 1 | 2 | 3 | 4 | 5,
      pain: readinessCheck.pain,
      hydration: readinessCheck.hydration,
      mood: readinessCheck.mood,
      illness: readinessCheck.illness,
      painArea: readinessCheck.pain >= 3 ? readinessCheck.painArea : undefined,
      limitsTraining: readinessCheck.pain >= 3 ? readinessCheck.limitsTraining : undefined,
      restingHR: readinessCheck.restingHR.trim() ? Number.parseInt(readinessCheck.restingHR, 10) : undefined,
      hrv: readinessCheck.hrv.trim() ? Number.parseInt(readinessCheck.hrv, 10) : undefined,
    });

    onUpdateMember?.(member.id, { readiness: readinessScore, risk });
    setFeedback('System check submitted. Sending you to Train.');
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      setSubmitting(false);
      onCompleteCheckIn?.();
    }, 450);
  }

  function connectAppleHealth() {
    if (!onUpdateMember) return;
    const capability = getAppleHealthCapability();
    onUpdateMember(member.id, {
      deviceSyncProvider: 'Apple Health',
      deviceSyncStatus: capability.status === 'module_pending' ? 'Ready' : 'Unsupported',
      deviceConnectedAt: new Date().toISOString(),
    });
    showAlert('Apple Health', capability.message);
  }

  function syncAppleHealth() {
    if (!onUpdateMember) return;
    const capability = getAppleHealthCapability();
    if (capability.status !== 'module_pending') { showAlert('Apple Health Sync', capability.message); return; }
    showAlert('Apple Health Sync', 'The app shell is ready, but the native HealthKit adapter is still the next build step. Once installed, sleep, resting HR, HRV, and workouts can sync here.');
    onUpdateMember(member.id, { deviceSyncProvider: 'Apple Health', deviceSyncStatus: 'Ready', deviceLastSyncAt: new Date().toISOString() });
  }

  return (
    <Screen>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { fontSize: fs(9, { min: 8, max: 11 }) }]}>DAILY CHECK-IN · TACTICAL</Text>
          <Text style={[styles.title, { fontSize: fs(24, { min: 19, max: 30 }) }]}>{member.gymName || member.name}</Text>
        </View>
        <View style={styles.opsecBadge}>
          <Ionicons name="shield-checkmark" size={13} color={colours.cyan} />
          <Text style={[styles.opsecText, { fontSize: fs(10, { min: 9, max: 11 }) }]}>Private</Text>
        </View>
      </View>

      {/* ── Today banner ────────────────────────────────────── */}
      {checkedInToday && latestLog && (
        <View style={styles.todayBanner}>
          <Ionicons name="checkmark-circle" size={16} color={colours.green} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.todayTitle, { fontSize: fs(13, { min: 12, max: 15 }) }]}>Checked in today</Text>
            <Text style={[styles.todayDetail, { fontSize: fs(12, { min: 11, max: 13 }) }]}>
              Sleep {latestLog.sleepHours ?? '--'}h · {latestLog.hydration} hydration · Soreness {latestLog.soreness}/5
            </Text>
          </View>
          <StatusChip variant="go" label="DONE" size="sm" />
        </View>
      )}

      {/* ── Live score preview ───────────────────────────────── */}
      <Card>
        <View style={styles.liveScoreRow}>
          <ReadinessRing score={liveScore} tone={liveTone} size={isTablet ? 96 : 80} strokeWidth={isTablet ? 9 : 7} label="LIVE" />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.liveScoreLabel, { fontSize: fs(10, { min: 9, max: 12 }) }]}>READINESS PREVIEW</Text>
            <Text style={[styles.liveScoreValue, { color: liveTone, fontSize: fs(28, { min: 22, max: 36 }) }]}>{liveScore}</Text>
            <Text style={[styles.liveScoreSub, { fontSize: fs(12, { min: 11, max: 14 }) }]}>
              {liveScore >= 75 ? 'Ready for full training' : liveScore >= 50 ? 'Usable — moderate intensity' : 'Recovery priority today'}
            </Text>
            <ProgressBar value={liveScore} colour={liveTone} height={4} />
          </View>
        </View>
      </Card>

      {/* ── Tactical System Check ───────────────────────────── */}
      <Card accent={colours.amber}>
        <Text style={[styles.sectionTitle, { fontSize: fs(17, { min: 14, max: 21 }) }]}>Tactical System Check</Text>
        <Text style={[styles.body, { fontSize: fs(12, { min: 11, max: 14 }) }]}>
          {checkedInToday ? 'Already submitted today — update below to override.' : 'Fast morning check-in. Smart defaults keep this under 30 seconds.'}
        </Text>

        {/* Sleep + Hydration row */}
        <View style={[styles.quickCheckRow, { gap: sp(10) }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>SLEEP HOURS</Text>
            <TextInput
              value={readinessCheck.sleepHours}
              onChangeText={(v) => setReadinessCheck((c) => ({ ...c, sleepHours: v.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
              style={[styles.input, { fontSize: fs(18, { min: 15, max: 22 }) }]}
              placeholder="7"
              placeholderTextColor={colours.soft}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={[styles.fieldLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>HYDRATION</Text>
            <View style={[styles.pillRow, { gap: sp(5), marginTop: 6 }]}>
              {(['Poor', 'Adequate', 'Optimal'] as const).map((item) => {
                const active = readinessCheck.hydration === item;
                const hydTone = item === 'Poor' ? colours.red : item === 'Adequate' ? colours.amber : colours.green;
                return (
                  <Pressable
                    key={item}
                    style={[styles.hydPill, { borderColor: active ? `${hydTone}65` : colours.borderSoft, backgroundColor: active ? `${hydTone}14` : colours.layer1 }]}
                    onPress={() => setReadinessCheck((c) => ({ ...c, hydration: item }))}
                  >
                    <Text style={[styles.hydPillText, { color: active ? hydTone : colours.muted, fontSize: fs(11, { min: 10, max: 13 }) }]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <TacticalDivider tone={colours.amber} />

        {/* Factor scales */}
        <FactorRow label="Sleep Quality" value={readinessCheck.sleepQuality} onChange={(v) => setReadinessCheck((c) => ({ ...c, sleepQuality: v }))} />
        <FactorRow label="Soreness" value={readinessCheck.soreness} onChange={(v) => setReadinessCheck((c) => ({ ...c, soreness: v }))} />
        <FactorRow label="Pain Level" value={readinessCheck.pain} onChange={(v) => setReadinessCheck((c) => ({ ...c, pain: v }))} accent={colours.red} />
        <FactorRow label="Mood" value={readinessCheck.mood} onChange={(v) => setReadinessCheck((c) => ({ ...c, mood: v }))} />
        <FactorRow label="Illness" value={readinessCheck.illness} onChange={(v) => setReadinessCheck((c) => ({ ...c, illness: v }))} accent={colours.red} />

        {/* Pain location */}
        {readinessCheck.pain >= 3 ? (
          <View style={[styles.painPanel, { marginTop: sp(14) }]}>
            <Text style={[styles.fieldLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>PAIN LOCATION</Text>
            <View style={[styles.pillRow, { flexWrap: 'wrap', marginTop: sp(8), gap: sp(7) }]}>
              {(['Knee', 'Back', 'Shoulder', 'Hip', 'Ankle', 'Other'] as const).map((item) => {
                const active = readinessCheck.painArea === item;
                return (
                  <Pressable
                    key={item}
                    style={[styles.painPill, { borderColor: active ? `${colours.red}65` : colours.borderSoft, backgroundColor: active ? colours.redDim : colours.layer1 }]}
                    onPress={() => setReadinessCheck((c) => ({ ...c, painArea: item }))}
                  >
                    <Text style={[styles.painPillText, { color: active ? colours.red : colours.muted, fontSize: fs(11, { min: 10, max: 13 }) }]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.toggleRow} onPress={() => setReadinessCheck((c) => ({ ...c, limitsTraining: !c.limitsTraining }))}>
              <View style={[styles.toggleKnob, readinessCheck.limitsTraining && styles.toggleKnobActive]} />
              <Text style={[styles.toggleText, { fontSize: fs(12, { min: 11, max: 14 }) }]}>
                {readinessCheck.limitsTraining ? 'Limiting training today' : 'No major training limitation'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <TacticalDivider tone={colours.amber} />

        {/* Optional metrics */}
        <View style={[styles.quickCheckRow, { gap: sp(10), marginTop: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>RESTING HR</Text>
            <TextInput
              value={readinessCheck.restingHR}
              onChangeText={(v) => setReadinessCheck((c) => ({ ...c, restingHR: v.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
              style={[styles.input, { fontSize: fs(16, { min: 14, max: 18 }) }]}
              placeholder="Optional"
              placeholderTextColor={colours.soft}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>HRV</Text>
            <TextInput
              value={readinessCheck.hrv}
              onChangeText={(v) => setReadinessCheck((c) => ({ ...c, hrv: v.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
              style={[styles.input, { fontSize: fs(16, { min: 14, max: 18 }) }]}
              placeholder="Optional"
              placeholderTextColor={colours.soft}
            />
          </View>
        </View>

        {/* Timestamp + stale badge */}
        {latestLog ? (
          <View style={styles.stampRow}>
            <Ionicons name="time-outline" size={12} color={colours.muted} />
            <Text style={[styles.stampText, { fontSize: fs(11, { min: 10, max: 12 }) }]}>
              Last: {new Date(latestLog.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
            {logIsStale && <StatusChip variant="stale" size="sm" />}
          </View>
        ) : null}

        {feedback ? (
          <View style={styles.feedbackRow}>
            <Ionicons name="checkmark-circle" size={14} color={colours.green} />
            <Text style={[styles.feedbackText, { fontSize: fs(12, { min: 11, max: 14 }) }]}>{feedback}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.submitBtn, { backgroundColor: liveTone }, submitting && styles.submitBtnDisabled]}
          onPress={submitReadinessReport}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Submit readiness report"
        >
          <Ionicons name={submitting ? 'hourglass-outline' : 'send'} size={isTablet ? 20 : 17} color={colours.background} />
          <Text style={[styles.submitBtnText, { fontSize: fs(14, { min: 13, max: 16 }) }]}>{submitting ? 'Submitting…' : 'Submit Report'}</Text>
        </Pressable>
      </Card>

      {/* ── Injury Tracker ──────────────────────────────────── */}
      <Card accent={colours.red}>
        <View style={styles.injuryHeader}>
          <Text style={[styles.sectionTitle, { fontSize: fs(17, { min: 14, max: 21 }) }]}>Injury Tracker</Text>
          <Pressable
            style={[styles.injuryToggleBtn, { borderColor: `${colours.red}55`, backgroundColor: showInjuryForm ? colours.redDim : colours.layer1 }]}
            onPress={() => setShowInjuryForm(v => !v)}
          >
            <Ionicons name={showInjuryForm ? 'close' : 'add'} size={13} color={colours.red} />
            <Text style={[styles.injuryToggleBtnText, { fontSize: fs(11, { min: 10, max: 12 }) }]}>{showInjuryForm ? 'Cancel' : 'Log Injury'}</Text>
          </Pressable>
        </View>

        {showInjuryForm && (
          <View style={styles.injuryForm}>
            <Text style={[styles.fieldLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>BODY AREA</Text>
            <View style={[styles.pillRow, { flexWrap: 'wrap', marginTop: sp(8), gap: sp(7) }]}>
              {(['Knee', 'Back', 'Shoulder', 'Hip', 'Ankle', 'Neck', 'Other'] as const).map((area) => (
                <Pressable
                  key={area}
                  style={[styles.painPill, { borderColor: injuryBodyArea === area ? `${colours.red}65` : colours.borderSoft, backgroundColor: injuryBodyArea === area ? colours.redDim : colours.layer1 }]}
                  onPress={() => setInjuryBodyArea(area)}
                >
                  <Text style={[styles.painPillText, { color: injuryBodyArea === area ? colours.red : colours.muted, fontSize: fs(11, { min: 10, max: 13 }) }]}>{area}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { fontSize: fs(9, { min: 8, max: 10 }), marginTop: sp(14) }]}>SEVERITY</Text>
            <View style={[styles.pillRow, { gap: sp(7), marginTop: sp(8) }]}>
              {([1, 2, 3, 4, 5] as const).map((n) => {
                const active = injurySeverity === n;
                const sevTone = n <= 2 ? colours.green : n === 3 ? colours.amber : colours.red;
                return (
                  <Pressable
                    key={n}
                    style={[styles.sevBtn, { borderColor: active ? `${sevTone}70` : colours.borderSoft, backgroundColor: active ? `${sevTone}18` : colours.layer1 }]}
                    onPress={() => setInjurySeverity(n)}
                  >
                    <Text style={[styles.sevBtnText, { color: active ? sevTone : colours.muted, fontSize: fs(14, { min: 12, max: 16 }) }]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { fontSize: fs(9, { min: 8, max: 10 }), marginTop: sp(14) }]}>NOTES</Text>
            <TextInput
              value={injuryDesc}
              onChangeText={setInjuryDesc}
              style={[styles.textArea, { fontSize: fs(13, { min: 12, max: 15 }) }]}
              placeholder="Describe the injury…"
              placeholderTextColor={colours.soft}
              multiline
              numberOfLines={3}
            />

            <Pressable style={styles.toggleRow} onPress={() => setInjuryLimits(v => !v)}>
              <View style={[styles.toggleKnob, injuryLimits && styles.toggleKnobActive]} />
              <Text style={[styles.toggleText, { fontSize: fs(12, { min: 11, max: 14 }) }]}>
                {injuryLimits ? 'Limits training' : 'No major training limitation'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.injurySaveBtn, shadows.subtle]}
              onPress={() => {
                const log: InjuryLog = { id: `injury-${Date.now()}`, date: new Date().toISOString(), memberId: member.id, bodyArea: injuryBodyArea, severity: injurySeverity, description: injuryDesc.trim() || undefined, limitsTraining: injuryLimits, updatedAt: new Date().toISOString() };
                onAddInjuryLog?.(log);
                setShowInjuryForm(false);
                setInjuryDesc('');
                setInjurySeverity(2);
                setInjuryLimits(false);
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
            >
              <Ionicons name="save-outline" size={isTablet ? 17 : 14} color={colours.background} />
              <Text style={[styles.injurySaveBtnText, { fontSize: fs(13, { min: 12, max: 15 }) }]}>Save Injury</Text>
            </Pressable>
          </View>
        )}

        {injuryLogs.length === 0 && !showInjuryForm ? (
          <Text style={[styles.body, { fontSize: fs(12, { min: 11, max: 14 }) }]}>No injuries logged. Tap "Log Injury" to track an injury.</Text>
        ) : (
          injuryLogs.map((inj) => {
            const sevTone = inj.severity >= 4 ? colours.red : inj.severity >= 3 ? colours.amber : colours.green;
            return (
              <View key={inj.id} style={styles.injuryRow}>
                <View style={[styles.injurySevDot, { backgroundColor: sevTone }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.injuryRowTitle, { fontSize: fs(13, { min: 12, max: 15 }) }]}>
                    {inj.bodyArea} · Sev {inj.severity}/5{inj.limitsTraining ? ' · Limits Training' : ''}
                  </Text>
                  {inj.description ? <Text style={[styles.injuryRowDesc, { fontSize: fs(12, { min: 11, max: 13 }) }]}>{inj.description}</Text> : null}
                  <Text style={[styles.injuryRowDate, { fontSize: fs(11, { min: 10, max: 12 }) }]}>
                    {new Date(inj.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    {inj.resolvedDate ? ` → Resolved ${new Date(inj.resolvedDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  {!inj.resolvedDate && (
                    <Pressable onPress={() => onResolveInjuryLog?.(inj.id)} style={styles.injuryActionBtn} accessibilityLabel="Mark resolved">
                      <Ionicons name="checkmark-circle-outline" size={18} color={colours.green} />
                    </Pressable>
                  )}
                  <Pressable onPress={() => onDeleteInjuryLog?.(inj.id)} style={styles.injuryActionBtn} accessibilityLabel="Delete injury">
                    <Ionicons name="trash-outline" size={18} color={colours.red} />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </Card>

      {/* ── Apple Health ────────────────────────────────────── */}
      <Card>
        <Text style={[styles.sectionTitle, { fontSize: fs(17, { min: 14, max: 21 }) }]}>Apple Health</Text>
        <Text style={[styles.body, { fontSize: fs(12, { min: 11, max: 14 }) }]}>
          Prepare member sync for Apple Watch and iPhone Health data. Shell is ready for HealthKit wiring in a native build.
        </Text>
        <View style={[styles.pillRow, { gap: sp(8), marginTop: sp(8), marginBottom: sp(4) }]}>
          <View style={styles.integrationPill}>
            <Text style={[styles.integrationPillText, { fontSize: fs(11, { min: 10, max: 13 }) }]}>{member.deviceSyncStatus ?? 'Disconnected'}</Text>
          </View>
          <View style={styles.integrationPill}>
            <Text style={[styles.integrationPillText, { fontSize: fs(11, { min: 10, max: 13 }) }]}>{member.deviceSyncProvider ?? 'No Provider'}</Text>
          </View>
        </View>
        <View style={[styles.actionRow, { gap: sp(8) }]}>
          <Pressable style={styles.primaryBtn} onPress={connectAppleHealth} accessibilityRole="button">
            <Ionicons name="watch" size={isTablet ? 18 : 16} color={colours.background} />
            <Text style={[styles.primaryBtnText, { fontSize: fs(13, { min: 12, max: 15 }) }]}>Connect</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={syncAppleHealth} accessibilityRole="button">
            <Ionicons name="sync" size={isTablet ? 18 : 16} color={colours.cyan} />
            <Text style={[styles.secondaryBtnText, { fontSize: fs(13, { min: 12, max: 15 }) }]}>Sync Now</Text>
          </Pressable>
        </View>
        <View style={[styles.healthGrid, { gap: sp(8) }]}>
          {[
            { label: 'Sleep', value: appleHealthPreview?.sleepHours ? `${appleHealthPreview.sleepHours}h` : '--' },
            { label: 'Rest HR', value: String(appleHealthPreview?.restingHR ?? '--') },
            { label: 'HRV', value: String(appleHealthPreview?.hrv ?? '--') },
            { label: 'Last Sync', value: appleHealthPreview?.lastSyncAt ? new Date(appleHealthPreview.lastSyncAt).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '--' },
          ].map(item => (
            <View key={item.label} style={styles.healthTile}>
              <Text style={[styles.healthTileLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>{item.label}</Text>
              <Text style={[styles.healthTileValue, { fontSize: fs(13, { min: 12, max: 15 }) }]}>{item.value}</Text>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  kicker: { color: colours.cyan, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  title: { color: colours.text, fontWeight: '900', letterSpacing: -0.3, marginTop: 4 },
  opsecBadge: { minHeight: 40, borderWidth: 1, borderColor: colours.borderHot, borderRadius: radius.sm, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colours.cyanDim },
  opsecText: { color: colours.cyan, fontWeight: '900' },
  todayBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: `${colours.green}40`, borderRadius: radius.sm, padding: 12, backgroundColor: `${colours.green}0C` },
  todayTitle: { color: colours.green, fontWeight: '900' },
  todayDetail: { color: colours.textSoft, fontWeight: '700', marginTop: 2 },
  liveScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  liveScoreLabel: { color: colours.muted, fontWeight: '900', letterSpacing: 1.8, textTransform: 'uppercase' },
  liveScoreValue: { fontWeight: '900', letterSpacing: -1 },
  liveScoreSub: { color: colours.textSoft, fontWeight: '700' },
  sectionTitle: { color: colours.text, fontWeight: '900', marginBottom: 6 },
  body: { color: colours.textSoft, lineHeight: 18, fontWeight: '700', marginBottom: 4 },
  fieldLabel: { color: colours.muted, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  quickCheckRow: { flexDirection: 'row', marginTop: 12, alignItems: 'flex-start' },
  pillRow: { flexDirection: 'row' },
  hydPill: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  hydPillText: { fontWeight: '900' },
  painPanel: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: radius.sm, padding: 12, backgroundColor: colours.layer1 },
  painPill: { minHeight: 34, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  painPillText: { fontWeight: '900' },
  input: { minHeight: touchTarget, borderWidth: 1, borderColor: colours.inputBorder, borderRadius: radius.sm, color: colours.text, backgroundColor: colours.inputBg, paddingHorizontal: 12, marginTop: 6, fontWeight: '900', textAlign: 'center' },
  textArea: { borderWidth: 1, borderColor: colours.inputBorder, borderRadius: radius.sm, color: colours.text, backgroundColor: colours.inputBg, paddingHorizontal: 12, paddingTop: 10, marginTop: 6, minHeight: 70, textAlignVertical: 'top', fontWeight: '700' },
  toggleRow: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colours.borderHot, backgroundColor: 'rgba(0,0,0,0.24)' },
  toggleKnobActive: { backgroundColor: colours.cyan, borderColor: colours.cyan },
  toggleText: { flex: 1, color: colours.textSoft, fontWeight: '800' },
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  stampText: { color: colours.muted, fontWeight: '700' },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: `${colours.green}0F`, borderWidth: 1, borderColor: `${colours.green}35`, borderRadius: radius.xs, padding: 10, marginTop: 10 },
  feedbackText: { color: colours.green, fontWeight: '900' },
  submitBtn: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.sm, marginTop: 14 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colours.background, fontWeight: '900' },
  injuryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  injuryToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.xs, borderWidth: 1 },
  injuryToggleBtnText: { color: colours.red, fontWeight: '900' },
  injuryForm: { borderTopWidth: 1, borderTopColor: colours.borderSoft, paddingTop: 14, marginTop: 4, gap: 0 },
  sevBtn: { flex: 1, height: 42, borderRadius: radius.xs, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sevBtnText: { fontWeight: '900' },
  injurySaveBtn: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.sm, backgroundColor: colours.red, marginTop: 14 },
  injurySaveBtnText: { color: colours.background, fontWeight: '900' },
  injuryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colours.borderSoft },
  injurySevDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  injuryRowTitle: { color: colours.text, fontWeight: '800' },
  injuryRowDesc: { color: colours.textSoft, fontWeight: '700', marginTop: 2 },
  injuryRowDate: { color: colours.muted, fontWeight: '700', marginTop: 2 },
  injuryActionBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', marginTop: 12 },
  primaryBtn: { minHeight: touchTarget, flex: 1, borderRadius: radius.sm, backgroundColor: colours.cyan, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  primaryBtnText: { color: colours.background, fontWeight: '900' },
  secondaryBtn: { minHeight: touchTarget, flex: 1, borderRadius: radius.sm, borderWidth: 1, borderColor: colours.borderHot, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, backgroundColor: colours.cyanDim },
  secondaryBtnText: { color: colours.cyan, fontWeight: '900' },
  integrationPill: { minHeight: 34, justifyContent: 'center', borderRadius: radius.xs, borderWidth: 1, borderColor: colours.borderHot, paddingHorizontal: 12, backgroundColor: colours.cyanDim },
  integrationPillText: { color: colours.cyan, fontWeight: '900' },
  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  healthTile: { width: '23%', flexGrow: 1, backgroundColor: colours.layer1, borderRadius: radius.xs, paddingVertical: 10, alignItems: 'center', gap: 4 },
  healthTileLabel: { color: colours.muted, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  healthTileValue: { color: colours.text, fontWeight: '900' },
});
