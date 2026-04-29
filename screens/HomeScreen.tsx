import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { BodyMap, BodyMapView, PainMap, choirSegments } from '../components/BodyMap';
import { buildPerformanceProfile, sortSessionsByDate } from '../lib/performance';
import { buildH2FDomains, buildPrescriptiveGuidance, calculateWHtR } from '../lib/h2f';
import { colours, touchTarget } from '../theme';
import { TrainingSession } from '../data/mockData';

function domainTone(status: 'GREEN' | 'AMBER' | 'RED') {
  if (status === 'GREEN') return colours.green;
  if (status === 'AMBER') return colours.amber;
  return colours.red;
}

export function HomeScreen({
  sessions,
  goToRuck,
  goToAnalytics,
}: {
  sessions: TrainingSession[];
  goToRuck: () => void;
  goToAnalytics: () => void;
  deleteSession: (id: string) => void;
  editSession: (id: string, updates: Partial<TrainingSession>) => void;
}) {
  const [waistCm, setWaistCm] = useState('88');
  const [heightCm, setHeightCm] = useState('180');
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [bodyMapView, setBodyMapView] = useState<BodyMapView>('anterior');
  const [selectedPainLevel, setSelectedPainLevel] = useState(4);
  const [painMap, setPainMap] = useState<PainMap>({
    P09: 6,
    P10: 6,
    P15: 4,
  });
  const performance = buildPerformanceProfile(sessions);
  const domains = useMemo(() => buildH2FDomains(sessions), [sessions]);
  const guidance = buildPrescriptiveGuidance(sessions, 6.25, performance.loadRisk === 'High' ? 'down' : 'flat');
  const whtr = calculateWHtR(Number(waistCm), Number(heightCm));
  const loadedKm = sessions
    .filter((session) => session.type === 'Ruck')
    .reduce((total, session) => total + (session.loadKg ?? 0) * (session.durationMinutes / 60) * 5.2, 0);
  const recentSessions = sortSessionsByDate(sessions).slice(0, 3);
  const hotspots = choirSegments
    .map((segment) => ({ ...segment, level: painMap[segment.id] ?? 0 }))
    .filter((segment) => segment.level > 0)
    .sort((a, b) => b.level - a.level)
    .slice(0, 3);
  const lowerBackLoadFlag = sessions.some((session) => session.type === 'Ruck' && (session.loadKg ?? 0) >= 18)
    && ((painMap.P09 ?? 0) >= 5 || (painMap.P10 ?? 0) >= 5);

  function markInjury(segmentId: string) {
    setSelectedSegment(segmentId);
    setPainMap((current) => ({ ...current, [segmentId]: selectedPainLevel }));
    Haptics.notificationAsync(
      selectedPainLevel >= 7 ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
    );
  }

  function setIntensity(level: number) {
    setSelectedPainLevel(level);
    if (selectedSegment) {
      setPainMap((current) => ({ ...current, [selectedSegment]: level }));
    }
    Haptics.impactAsync(level >= 7 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
  }

  function completeCriticalEvent(action: () => void) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    action();
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>H2F 2026 LOCAL-ONLY</Text>
          <Text style={styles.title}>Tactical Readiness</Text>
        </View>
        <View style={styles.opsecBadge}>
          <Ionicons name="shield-checkmark" size={18} color={colours.cyan} />
          <Text style={styles.opsecText}>AES-256</Text>
        </View>
      </View>

      <Card hot>
        <View style={styles.readinessRow}>
          <View>
            <Text style={styles.label}>PRESCRIPTIVE MODEL</Text>
            <Text style={[styles.readinessValue, { color: performance.readinessTone }]}>{performance.readiness}</Text>
          </View>
          <View style={styles.readinessCopy}>
            <Text style={[styles.status, { color: performance.readinessTone }]}>{performance.readinessBand}</Text>
            <Text style={styles.body}>{guidance}</Text>
          </View>
        </View>
        <ProgressBar value={performance.readiness} colour={performance.readinessTone} />
      </Card>

      <View style={styles.domainGrid}>
        {domains.map((domain) => {
          const tone = domainTone(domain.status);
          return (
            <View key={domain.id} style={styles.domainCard}>
              <View style={styles.domainHeader}>
                <Text style={styles.domainLabel}>{domain.label}</Text>
                <View style={[styles.dot, { backgroundColor: tone }]} />
              </View>
              <Text style={[styles.domainValue, { color: tone }]}>{domain.value}</Text>
              <Text style={styles.domainDetail}>{domain.detail}</Text>
            </View>
          );
        })}
      </View>

      <Card accent={colours.cyan}>
        <Text style={styles.sectionTitle}>Loaded Movement</Text>
        <Text style={styles.body}>Track loaded miles, not just distance. Current estimate: {Math.round(loadedKm)} kg-km across ruck work.</Text>
        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={() => completeCriticalEvent(goToRuck)}>
            <Ionicons name="footsteps" size={20} color={colours.background} />
            <Text style={styles.primaryButtonText}>Ruck Calculator</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => completeCriticalEvent(goToAnalytics)}>
            <Ionicons name="analytics" size={20} color={colours.cyan} />
            <Text style={styles.secondaryButtonText}>Intel</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Body Composition</Text>
        <Text style={styles.body}>2026 WHtR mandate target: under 0.55.</Text>
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>WAIST CM</Text>
            <TextInput value={waistCm} onChangeText={setWaistCm} keyboardType="numeric" style={styles.input} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>HEIGHT CM</Text>
            <TextInput value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" style={styles.input} />
          </View>
        </View>
        <View style={styles.whtrResult}>
          <Text style={[styles.whtrValue, { color: whtr.compliant ? colours.green : colours.red }]}>
            {whtr.ratio.toFixed(3)}
          </Text>
          <Text style={styles.body}>
            {whtr.compliant ? `Compliant with ${whtr.marginCm} cm margin.` : `${Math.abs(whtr.marginCm)} cm over threshold.`}
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Injury Report</Text>
        <Text style={styles.body}>Tap a CHOIR segment, then paint pain intensity from muted green to tactical red.</Text>
        <View style={styles.intensityRow}>
          {[0, 2, 4, 6, 8, 10].map((level) => (
            <Pressable
              key={level}
              style={[
                styles.intensityButton,
                {
                  backgroundColor: level <= 0 ? colours.cyanDim : level <= 3 ? colours.cyan : level <= 6 ? colours.amber : colours.red,
                  borderColor: selectedPainLevel === level ? colours.text : 'transparent',
                },
              ]}
              onPress={() => setIntensity(level)}
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
        <View style={styles.hotspotPanel}>
          <Text style={styles.hotspotTitle}>HPT Hotspots</Text>
          {hotspots.length ? hotspots.map((segment) => (
            <View key={segment.id} style={styles.hotspotRow}>
              <Text style={styles.hotspotName}>{segment.id} {segment.label}</Text>
              <Text style={[styles.hotspotScore, { color: segment.level >= 7 ? colours.red : segment.level >= 4 ? colours.amber : colours.cyan }]}>
                {segment.level}/10
              </Text>
            </View>
          )) : (
            <Text style={styles.body}>No musculoskeletal reports logged.</Text>
          )}
          {lowerBackLoadFlag && (
            <Text style={styles.hotspotAlert}>
              Lower-back hotspot rising after loaded ruck exposure. Flag for HPT trend review.
            </Text>
          )}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Integration Layer</Text>
        <View style={styles.integrationRow}>
          {['Health Connect', 'Apple Health bridge', 'Garmin/Oura/Whoop FHIR'].map((label) => (
            <View key={label} style={styles.integrationPill}>
              <Text style={styles.integrationText}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.body}>
          Default posture is local-only. Cloud, native health stores, and third-party APIs stay opt-in with normalized FHIR-shaped records.
        </Text>
      </Card>

      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>Recent Load</Text>
        <Text style={styles.label}>LAST 3</Text>
      </View>
      {recentSessions.map((session) => (
        <View key={session.id} style={styles.sessionRow}>
          <Text style={styles.sessionTitle}>{session.title}</Text>
          <Text style={styles.sessionMeta}>{session.type} | {session.durationMinutes} min | RPE {session.rpe}</Text>
        </View>
      ))}
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
    fontSize: 30,
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
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  readinessValue: {
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '900',
  },
  readinessCopy: {
    flex: 1,
  },
  status: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  label: {
    color: colours.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  body: {
    color: colours.textSoft,
    fontSize: 18,
    lineHeight: 27,
  },
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  domainCard: {
    width: '48%',
    minHeight: 126,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colours.panel,
  },
  domainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  domainLabel: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  domainValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
  },
  domainDetail: {
    color: colours.textSoft,
    fontSize: 18,
    lineHeight: 25,
    marginTop: 6,
  },
  sectionTitle: {
    color: colours.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
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
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
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
    fontSize: 18,
    fontWeight: '900',
  },
  whtrResult: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
  },
  whtrValue: {
    fontSize: 34,
    fontWeight: '900',
  },
  integrationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  integrationPill: {
    minHeight: touchTarget,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderHot,
    paddingHorizontal: 12,
    backgroundColor: colours.cyanDim,
  },
  integrationText: {
    color: colours.cyan,
    fontSize: 18,
    fontWeight: '900',
  },
  intensityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 14,
  },
  intensityButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intensityText: {
    color: colours.text,
    fontSize: 18,
    fontWeight: '900',
  },
  hotspotPanel: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#151816',
    marginTop: 12,
    gap: 8,
  },
  hotspotTitle: {
    color: colours.text,
    fontSize: 20,
    fontWeight: '900',
  },
  hotspotRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
  },
  hotspotName: {
    flex: 1,
    color: colours.textSoft,
    fontSize: 18,
    fontWeight: '800',
  },
  hotspotScore: {
    fontSize: 18,
    fontWeight: '900',
  },
  hotspotAlert: {
    color: colours.red,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 25,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionRow: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colours.panel,
  },
  sessionTitle: {
    color: colours.text,
    fontSize: 14,
    fontWeight: '900',
  },
  sessionMeta: {
    color: colours.muted,
    fontSize: 18,
    marginTop: 3,
  },
});
