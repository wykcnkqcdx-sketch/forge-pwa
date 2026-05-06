import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, shadow } from '../theme';
import type { ReadinessLog } from '../data/domain';

interface ReadinessModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (log: ReadinessLog) => void;
}

export function ReadinessModal({ visible, onClose, onSave }: ReadinessModalProps) {
  const [sleepInput, setSleepInput] = useState('3');
  const [sorenessInput, setSorenessInput] = useState('3');
  const [stressInput, setStressInput] = useState('3');

  useEffect(() => {
    if (visible) {
      setSleepInput('3');
      setSorenessInput('3');
      setStressInput('3');
    }
  }, [visible]);

  function handleSave() {
    onSave({
      id: `readiness-${Date.now()}`,
      date: new Date().toISOString(),
      sleepQuality: (parseInt(sleepInput) || 3) as ReadinessLog['sleepQuality'],
      soreness: (parseInt(sorenessInput) || 3) as ReadinessLog['soreness'],
      stress: (parseInt(stressInput) || 3) as ReadinessLog['stress'],
      hydration: 'Adequate',
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalPanel, shadow.card]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Daily Readiness</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colours.text} />
            </Pressable>
          </View>
          <Text style={styles.inputLabel}>SLEEP QUALITY (1-5)</Text>
          <TextInput style={styles.input} keyboardType="number-pad" maxLength={1} value={sleepInput} onChangeText={setSleepInput} />
          <Text style={styles.inputLabel}>MUSCLE SORENESS (1-5)</Text>
          <TextInput style={styles.input} keyboardType="number-pad" maxLength={1} value={sorenessInput} onChangeText={setSorenessInput} />
          <Text style={styles.inputLabel}>OVERALL STRESS (1-5)</Text>
          <TextInput style={styles.input} keyboardType="number-pad" maxLength={1} value={stressInput} onChangeText={setStressInput} />
          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Log</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.62)' },
  modalPanel: { borderWidth: 1, borderColor: colours.border, borderRadius: 20, padding: 18, backgroundColor: colours.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { color: colours.text, fontSize: 20, fontWeight: '900' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  inputLabel: { color: colours.muted, fontSize: 10, fontWeight: '900', marginBottom: 6, letterSpacing: 1.2 },
  input: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 14,
    color: colours.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '800',
  },
  saveBtn: { alignItems: 'center', backgroundColor: colours.cyan, borderRadius: 16, paddingVertical: 13, marginTop: 4 },
  saveBtnText: { color: colours.background, fontSize: 15, fontWeight: '900' },
});