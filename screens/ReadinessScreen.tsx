import React, { useState } from 'react';
import { Alert, View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { getAppleHealthCapability, getAppleHealthPreview } from '../lib/appleHealth';
import { colours, touchTarget } from '../theme';
import { SquadMember } from '../data/mockData';
import type { ReadinessLog } from '../data/domain';
import { getLatestReadinessLog, isReadinessCheckedInToday, isReadinessStale } from '../lib/readiness';

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

function FactorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: 1 | 2 | 3 | 4 | 5;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <View style={styles.factorRow}>
      <Text style={styles.factorRowLabel}>{label}</Text>
      <View style={styles.factorScale}>
        {([1, 2, 3, 4, 5] as const).map((item) => {
          const active = item === value;
          return (
            <Pressable
              key={item}
              style={[styles.factorScaleButton, active && styles.factorScaleButtonActive]}
              onPress={() => onChange(item)}
            >
              <Text style={[styles.factorScaleText, active && styles.factorScaleTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ReadinessScreen({
  member,
  readinessLogs = [],
  onSubmitReadiness,
  onUpdateMember,
  onCompleteCheckIn,
}: {
  member: SquadMember;
  readinessLogs?: ReadinessLog[];
  onSubmitReadiness?: (log: ReadinessLog) => void;
  onUpdateMember?: (id: string, updates: Partial<SquadMember>) => void;
  onCompleteCheckIn?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
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
    const risk = deriveMemberRisk(
      readinessCheck.pain,
      readinessCheck.illness,
      readinessCheck.soreness,
      readinessCheck.sleepQuality,
    );

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    Alert.alert('Apple Health', capability.message);
  }

  function syncAppleHealth() {
    if (!onUpdateMember) return;
    const capability = getAppleHealthCapability();
    if (capability.status !== 'module_pending') {
      Alert.alert('Apple Health Sync', capability.message);
      return;
    }
    Alert.alert(
      'Apple Health Sync',
      'The app shell is ready, but the native HealthKit adapter is still the next build step. Once installed, sleep, resting HR, HRV, and workouts can sync here.',
    );
    onUpdateMember(member.id, {
      deviceSyncProvider: 'Apple Health',
      deviceSyncStatus: 'Ready',
      deviceLastSyncAt: new Date().toISOString(),
    });
  }

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>DAILY CHECK-IN</Text>
          <Text style={styles.title}>{member.gymName || member.name}</Text>
        </View>
        <View style={styles.opsecBadge}>
          <Ionicons name="shield-checkmark" size={16} color={colours.cyan} />
          <Text style={styles.opsecText}>Offline · Private</Text>
        </View>
      </View>

      {/* Already checked in today */}
      {checkedInToday && latestLog && (
        <View style={styles.todayBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colours.green} />
          <View style={styles.todayCopy}>
            <Text style={styles.todayTitle}>Checked in today</Text>
            <Text style={styles.todayDetail}>
              Sleep {latestLog.sleepHours ?? '--'}h · {latestLog.hydration} hydration · Soreness {latestLog.soreness}/5
            </Text>
          </View>
        </View>
      )}

      {/* Tactical System Check */}
      <Card accent={colours.amber}>
        <Text style={styles.sectionTitle}>Tactical System Check</Text>
        <Text style={styles.body}>{checkedInToday ? 'Already submitted today — update below to override.' : 'Fast morning check-in. Smart defaults keep this under 30 seconds.'}</Text>

        <View style={styles.quickCheckRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>SLEEP HOURS</Text>
            <TextInput
              value={readinessCheck.sleepHours}
              onChangeText={(v) => setReadinessCheck((c) => ({ ...c, sleepHours: v.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>HYDRATION</Text>
            <View style={styles.hydrationRow}>
              {(['Poor', 'Adequate', 'Optimal'] as const).map((item) => {
                const active = readinessCheck.hydration === item;
                return (
                  <Pressable
                    key={item}
                    style={[styles.hydrationPill, active && styles.hydrationPillActive]}
                    onPress={() => setReadinessCheck((c) => ({ ...c, hydration: item }))}
                  >
                    <Text style={[styles.hydrationText, active && styles.hydrationTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <FactorRow label="Sleep Quality" value={readinessCheck.sleepQuality} onChange={(v) => setReadinessCheck((c) => ({ ...c, sleepQuality: v }))} />
        <FactorRow label="Soreness" value={readinessCheck.soreness} onChange={(v) => setReadinessCheck((c) => ({ ...c, soreness: v }))} />
        <FactorRow label="Pain" value={readinessCheck.pain} onChange={(v) => setReadinessCheck((c) => ({ ...c, pain: v }))} />
        <FactorRow label="Mood" value={readinessCheck.mood} onChange={(v) => setReadinessCheck((c) => ({ ...c, mood: v }))} />
        <FactorRow label="Illness" value={readinessCheck.illness} onChange={(v) => setReadinessCheck((c) => ({ ...c, illness: v }))} />

        {readinessCheck.pain >= 3 ? (
          <View style={styles.painTagPanel}>
            <Text style={styles.label}>PAIN LOCATION</Text>
            <View style={styles.painTagRow}>
              {(['Knee', 'Back', 'Shoulder', 'Hip', 'Ankle', 'Other'] as const).map((item) => {
                const active = readinessCheck.painArea === item;
                return (
                  <Pressable
                    key={item}
                    style={[styles.painTag, active && styles.painTagActive]}
                    onPress={() => setReadinessCheck((c) => ({ ...c, painArea: item }))}
                  >
                    <Text style={[styles.painTagText, active && styles.painTagTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={styles.limitRow}
              onPress={() => setReadinessCheck((c) => ({ ...c, limitsTraining: !c.limitsTraining }))}
            >
              <View style={[styles.toggleDot, readinessCheck.limitsTraining && styles.toggleDotActive]} />
              <Text style={styles.ghostText}>
                {readinessCheck.limitsTraining
                  ? 'This is limiting training today'
                  : 'No major training limitation from this pain'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.quickCheckRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>REST HR</Text>
            <TextInput
              value={readinessCheck.restingHR}
              onChangeText={(v) => setReadinessCheck((c) => ({ ...c, restingHR: v.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
              style={styles.input}
              placeholder="Optional"
              placeholderTextColor={colours.soft}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>HRV</Text>
            <TextInput
              value={readinessCheck.hrv}
              onChangeText={(v) => setReadinessCheck((c) => ({ ...c, hrv: v.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
              style={styles.input}
              placeholder="Optional"
              placeholderTextColor={colours.soft}
            />
          </View>
        </View>

        {latestLog ? (
          <View style={styles.checkInStampRow}>
            <Text style={styles.checkInStamp}>
              Last check-in:{' '}
              {new Date(latestLog.date).toLocaleDateString(undefined, {
                weekday: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {logIsStale && (
              <View style={styles.staleBadge}>
                <Ionicons name="warning-outline" size={11} color={colours.amber} />
                <Text style={styles.staleText}>Stale</Text>
              </View>
            )}
          </View>
        ) : null}
        {feedback ? <Text style={styles.checkInFeedback}>{feedback}</Text> : null}

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={submitReadinessReport}
          disabled={submitting}
        >
          <Ionicons name="send" size={18} color={colours.background} />
          <Text style={styles.submitButtonText}>{submitting ? 'Submitting…' : 'Submit Report'}</Text>
        </Pressable>
      </Card>

      {/* Apple Health */}
      <Card>
        <Text style={styles.sectionTitle}>Apple Health</Text>
        <Text style={styles.body}>
          Prepare member sync for Apple Watch and iPhone Health data. Shell is ready for HealthKit wiring in a native build.
        </Text>
        <View style={styles.integrationRow}>
          <View style={styles.integrationPill}>
            <Text style={styles.integrationText}>{member.deviceSyncStatus ?? 'Disconnected'}</Text>
          </View>
          <View style={styles.integrationPill}>
            <Text style={styles.integrationText}>{member.deviceSyncProvider ?? 'No Provider'}</Text>
          </View>
        </View>
        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={connectAppleHealth}>
            <Ionicons name="watch" size={18} color={colours.background} />
            <Text style={styles.primaryButtonText}>Connect</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={syncAppleHealth}>
            <Ionicons name="sync" size={18} color={colours.cyan} />
            <Text style={styles.secondaryButtonText}>Sync Now</Text>
          </Pressable>
        </View>
        <View style={styles.factorGrid}>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>Sleep</Text>
            <Text style={styles.factorValue}>{appleHealthPreview?.sleepHours ? `${appleHealthPreview.sleepHours}h` : '--'}</Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>Rest HR</Text>
            <Text style={styles.factorValue}>{appleHealthPreview?.restingHR ?? '--'}</Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>HRV</Text>
            <Text style={styles.factorValue}>{appleHealthPreview?.hrv ?? '--'}</Text>
          </View>
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>Last Sync</Text>
            <Text style={styles.factorValue}>
              {appleHealthPreview?.lastSyncAt
                ? new Date(appleHealthPreview.lastSyncAt).toLocaleDateString(undefined, {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '--'}
            </Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  kicker: {
    color: colours.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: colours.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  opsecBadge: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colours.cyanDim,
  },
  opsecText: {
    color: colours.cyan,
    fontSize: 11,
    fontWeight: '900',
  },
  sectionTitle: {
    color: colours.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  body: {
    color: colours.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  label: {
    color: colours.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  quickCheckRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    alignItems: 'flex-start',
  },
  inputGroup: {
    flex: 1,
  },
  input: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    color: colours.text,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 12,
    marginTop: 6,
    fontSize: 16,
    fontWeight: '900',
  },
  hydrationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  hydrationPill: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  hydrationPillActive: {
    borderColor: `${colours.cyan}80`,
    backgroundColor: colours.cyanDim,
  },
  hydrationText: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  hydrationTextActive: {
    color: colours.cyan,
  },
  factorRow: {
    marginTop: 12,
    gap: 6,
  },
  factorRowLabel: {
    color: colours.text,
    fontSize: 13,
    fontWeight: '800',
  },
  factorScale: {
    flexDirection: 'row',
    gap: 8,
  },
  factorScaleButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  factorScaleButtonActive: {
    borderColor: `${colours.amber}70`,
    backgroundColor: colours.amberDim,
  },
  factorScaleText: {
    color: colours.textSoft,
    fontSize: 14,
    fontWeight: '900',
  },
  factorScaleTextActive: {
    color: colours.amber,
  },
  painTagPanel: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  painTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  painTag: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  painTagActive: {
    borderColor: `${colours.red}60`,
    backgroundColor: colours.redDim,
  },
  painTagText: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  painTagTextActive: {
    color: colours.red,
  },
  limitRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  toggleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colours.borderHot,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  toggleDotActive: {
    backgroundColor: colours.cyan,
  },
  ghostText: {
    flex: 1,
    color: colours.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  todayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: `${colours.green}40`,
    borderRadius: 10,
    padding: 12,
    backgroundColor: `${colours.green}0D`,
  },
  todayCopy: { flex: 1 },
  todayTitle: { color: colours.green, fontSize: 13, fontWeight: '900' },
  todayDetail: { color: colours.textSoft, fontSize: 12, marginTop: 2 },
  checkInStampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  checkInStamp: {
    color: colours.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  staleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: `${colours.amber}50`,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: `${colours.amber}12`,
  },
  staleText: {
    color: colours.amber,
    fontSize: 10,
    fontWeight: '900',
  },
  checkInFeedback: {
    color: colours.green,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 8,
  },
  submitButton: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    marginTop: 14,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colours.background,
    fontWeight: '900',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  primaryButton: {
    minHeight: touchTarget,
    flex: 1,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: colours.background,
    fontWeight: '900',
    fontSize: 14,
  },
  secondaryButton: {
    minHeight: touchTarget,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderHot,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: colours.cyan,
    fontWeight: '900',
    fontSize: 14,
  },
  integrationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  integrationPill: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderHot,
    paddingHorizontal: 12,
    backgroundColor: colours.cyanDim,
  },
  integrationText: {
    color: colours.cyan,
    fontSize: 12,
    fontWeight: '900',
  },
  factorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  factorItem: {
    width: '23%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  factorLabel: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
  },
  factorValue: {
    color: colours.text,
    fontSize: 13,
    fontWeight: '900',
  },
});
