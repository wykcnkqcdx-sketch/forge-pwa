import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, shadow } from '../theme';
import type { TrainingSession } from '../data/mockData';

export type SessionEditModalProps = {
  visible: boolean;
  session: TrainingSession | null;
  onClose: () => void;
  onSave: (id: string, score: number, durationMinutes: number) => void;
};

export function SessionEditModal({ visible, session, onClose, onSave }: SessionEditModalProps) {
  const [editScore, setEditScore] = useState('');
  const [editDuration, setEditDuration] = useState('');

  useEffect(() => {
    if (session) {
      setEditScore(String(session.score));
      setEditDuration(String(session.durationMinutes));
    } else {
      setEditScore('');
      setEditDuration('');
    }
  }, [session]);

  function handleSave() {
    if (!session) return;
    const newScore = parseInt(editScore, 10);
    const newDuration = parseInt(editDuration, 10);

    if (isNaN(newScore) || isNaN(newDuration)) {
      Alert.alert('Invalid Input', 'Score and duration must be numbers.');
      return;
    }

    onSave(session.id, newScore, newDuration);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalPanel, shadow.card]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Session</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colours.text} />
            </Pressable>
          </View>
          <Text style={styles.inputLabel}>SCORE</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={editScore}
            onChangeText={setEditScore}
          />
          <Text style={styles.inputLabel}>DURATION (MINS)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={editDuration}
            onChangeText={setEditDuration}
          />
          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  modalPanel: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: 20,
    padding: 18,
    backgroundColor: colours.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    color: colours.text,
    fontSize: 20,
    fontWeight: '900',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  inputLabel: {
    color: colours.muted,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: 1.2,
  },
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
  saveBtn: {
    alignItems: 'center',
    backgroundColor: colours.cyan,
    borderRadius: 16,
    paddingVertical: 13,
    marginTop: 4,
  },
  saveBtnText: {
    color: colours.background,
    fontSize: 15,
    fontWeight: '900',
  },
});
