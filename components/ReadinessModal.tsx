import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, shadow, typography } from '../theme';
import { responsiveSpacing, statusColors } from '../utils/styling';
import type { ReadinessLog } from '../data/domain';

interface ReadinessModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (log: ReadinessLog) => void;
}

type RatingKey = 'sleep' | 'soreness' | 'stress' | 'mood';

const RATING_CONFIGS: Array<{
  key: RatingKey;
  label: string;
  icon: string;
  labels: [string, string, string, string, string];
  tone: (v: number) => string;
}> = [
  {
    key: 'sleep',
    label: 'Sleep Quality',
    icon: 'moon-outline',
    labels: ['Poor', 'Bad', 'OK', 'Good', 'Great'],
    tone: (v) => v >= 4 ? colours.green : v >= 3 ? colours.cyan : v >= 2 ? colours.amber : colours.red,
  },
  {
    key: 'soreness',
    label: 'Muscle Soreness',
    icon: 'body-outline',
    labels: ['None', 'Mild', 'Mod', 'High', 'Very High'],
    tone: (v) => v <= 2 ? colours.green : v === 3 ? colours.amber : colours.red,
  },
  {
    key: 'stress',
    label: 'Overall Stress',
    icon: 'pulse-outline',
    labels: ['None', 'Low', 'Mod', 'High', 'Max'],
    tone: (v) => v <= 2 ? colours.green : v === 3 ? colours.amber : colours.red,
  },
  {
    key: 'mood',
    label: 'Mood / Motivation',
    icon: 'happy-outline',
    labels: ['Low', 'Flat', 'OK', 'Good', 'High'],
    tone: (v) => v >= 4 ? colours.green : v >= 3 ? colours.cyan : v >= 2 ? colours.amber : colours.red,
  },
];

const HYDRATION_OPTIONS: ReadinessLog['hydration'][] = ['Poor', 'Adequate', 'Optimal'];
const HYDRATION_TONES: Record<string, string> = {
  Poor: colours.red,
  Adequate: colours.amber,
  Optimal: colours.green,
};

function RatingRow({
  label,
  icon,
  value,
  onChange,
  labelSet,
  tone,
}: {
  label: string;
  icon: string;
  value: number;
  onChange: (v: number) => void;
  labelSet: string[];
  tone: (v: number) => string;
}) {
  return (
    <View style={styles.ratingBlock}>
      <View style={styles.ratingHeader}>
        <Ionicons name={icon as any} size={14} color={colours.muted} />
        <Text style={styles.ratingLabel}>{label}</Text>
        {value > 0 && (
          <Text style={[styles.ratingSelected, { color: tone(value) }]}>{labelSet[value - 1]}</Text>
        )}
      </View>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          const col = tone(n);
          return (
            <Pressable
              key={n}
              style={[
                styles.ratingBtn,
                active && { backgroundColor: `${col}30`, borderColor: col },
              ]}
              onPress={() => onChange(n)}
            >
              <Text style={[styles.ratingBtnNum, active && { color: col }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ReadinessModal({ visible, onClose, onSave }: ReadinessModalProps) {
  const [sleep, setSleep] = useState(3);
  const [soreness, setSoreness] = useState(2);
  const [stress, setStress] = useState(2);
  const [mood, setMood] = useState(3);
  const [hydration, setHydration] = useState<ReadinessLog['hydration']>('Adequate');
  const [sleepHours, setSleepHours] = useState('7');
  const [restingHR, setRestingHR] = useState('');
  const [hrv, setHrv] = useState('');

  useEffect(() => {
    if (visible) {
      setSleep(3); setSoreness(2); setStress(2); setMood(3);
      setHydration('Adequate'); setSleepHours('7'); setRestingHR(''); setHrv('');
    }
  }, [visible]);

  function handleSave() {
    onSave({
      id: `readiness-${Date.now()}`,
      date: new Date().toISOString(),
      sleepQuality: sleep as ReadinessLog['sleepQuality'],
      sleepHours: parseFloat(sleepHours) || undefined,
      soreness: soreness as ReadinessLog['soreness'],
      stress: stress as ReadinessLog['stress'],
      mood: mood as ReadinessLog['mood'],
      hydration,
      restingHR: restingHR ? parseInt(restingHR, 10) : undefined,
      hrv: hrv ? parseInt(hrv, 10) : undefined,
    });
    onClose();
  }

  const readinessScore = Math.round(((sleep / 5) * 35) + ((1 - (soreness - 1) / 4) * 25) + ((1 - (stress - 1) / 4) * 25) + ((mood / 5) * 15));
  const scoreTone = readinessScore >= 75 ? colours.green : readinessScore >= 55 ? colours.amber : colours.red;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalPanel, shadow.card]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Daily Check-In</Text>
              <Text style={styles.modalSub}>Readiness log — takes 30 seconds</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colours.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Live readiness preview */}
            <View style={[styles.scorePreview, { borderColor: `${scoreTone}50` }]}>
              <Text style={styles.scorePreviewLabel}>READINESS ESTIMATE</Text>
              <Text style={[styles.scorePreviewValue, { color: scoreTone }]}>{readinessScore}</Text>
            </View>

            {/* 1-5 rating rows */}
            {RATING_CONFIGS.map((cfg) => {
              const val = cfg.key === 'sleep' ? sleep : cfg.key === 'soreness' ? soreness : cfg.key === 'stress' ? stress : mood;
              const setter = cfg.key === 'sleep' ? setSleep : cfg.key === 'soreness' ? setSoreness : cfg.key === 'stress' ? setStress : setMood;
              return (
                <RatingRow
                  key={cfg.key}
                  label={cfg.label}
                  icon={cfg.icon}
                  value={val}
                  onChange={setter}
                  labelSet={cfg.labels}
                  tone={cfg.tone}
                />
              );
            })}

            {/* Hydration */}
            <View style={styles.ratingBlock}>
              <View style={styles.ratingHeader}>
                <Ionicons name="water-outline" size={14} color={colours.muted} />
                <Text style={styles.ratingLabel}>Hydration</Text>
              </View>
              <View style={styles.ratingRow}>
                {HYDRATION_OPTIONS.map((opt) => {
                  const active = hydration === opt;
                  const col = HYDRATION_TONES[opt];
                  return (
                    <Pressable
                      key={opt}
                      style={[styles.hydrationBtn, active && { backgroundColor: `${col}30`, borderColor: col }]}
                      onPress={() => setHydration(opt)}
                    >
                      <Text style={[styles.hydrationBtnText, active && { color: col }]}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Sleep hours */}
            <View style={styles.numRow}>
              <View style={styles.numField}>
                <Text style={styles.numLabel}>SLEEP HOURS</Text>
                <TextInput
                  style={styles.numInput}
                  keyboardType="decimal-pad"
                  maxLength={4}
                  value={sleepHours}
                  onChangeText={setSleepHours}
                  placeholderTextColor={colours.muted}
                  placeholder="7.5"
                />
              </View>
              <View style={styles.numField}>
                <Text style={styles.numLabel}>RESTING HR (bpm)</Text>
                <TextInput
                  style={styles.numInput}
                  keyboardType="number-pad"
                  maxLength={3}
                  value={restingHR}
                  onChangeText={setRestingHR}
                  placeholderTextColor={colours.muted}
                  placeholder="optional"
                />
              </View>
              <View style={styles.numField}>
                <Text style={styles.numLabel}>HRV (ms)</Text>
                <TextInput
                  style={styles.numInput}
                  keyboardType="number-pad"
                  maxLength={3}
                  value={hrv}
                  onChangeText={setHrv}
                  placeholderTextColor={colours.muted}
                  placeholder="optional"
                />
              </View>
            </View>

            <Pressable style={[styles.saveBtn, { backgroundColor: scoreTone }]} onPress={handleSave}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colours.background} />
              <Text style={styles.saveBtnText}>LOG CHECK-IN</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  modalPanel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.surface,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colours.borderSoft,
  },
  modalTitle: { color: colours.text, fontSize: 20, fontWeight: '900' },
  modalSub: { ...typography.caption, color: colours.muted, marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: 20, gap: 16 },

  scorePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  scorePreviewLabel: { ...typography.label, color: colours.muted, letterSpacing: 1.2 },
  scorePreviewValue: { fontSize: 32, fontWeight: '900' },

  ratingBlock: { gap: 8 },
  ratingHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingLabel: { ...typography.label, color: colours.text, fontWeight: '800', flex: 1 },
  ratingSelected: { ...typography.label, fontWeight: '900' },
  ratingRow: { flexDirection: 'row', gap: 6 },
  ratingBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBtnNum: { fontSize: 16, fontWeight: '900', color: colours.muted },

  hydrationBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hydrationBtnText: { ...typography.label, color: colours.muted, fontWeight: '800' },

  numRow: { flexDirection: 'row', gap: responsiveSpacing('sm') },
  numField: { flex: 1 },
  numLabel: { ...typography.label, color: colours.muted, letterSpacing: 1, marginBottom: 6, fontSize: 9 },
  numInput: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    color: colours.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
  },
  saveBtnText: { color: colours.background, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});
