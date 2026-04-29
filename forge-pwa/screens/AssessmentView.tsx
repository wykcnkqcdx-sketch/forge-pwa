import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { colours } from '../theme';
import { AssessmentRecord } from '../data/domain';

const assessmentTypes = [
  { id: '3RM_TrapBar', label: 'Trap-Bar Deadlift (3RM)', unit: 'kg', icon: 'barbell' },
  { id: 'PushUps_2Min', label: 'Push-Ups (2 Min)', unit: 'reps', icon: 'body' },
  { id: 'Plank_Max', label: 'Plank (Max Time)', unit: 'seconds', icon: 'stopwatch' },
  { id: 'Run_2Mile', label: '2-Mile Run', unit: 'minutes', icon: 'stopwatch' },
  { id: 'PullUps_Max', label: 'Pull-Ups (Max)', unit: 'reps', icon: 'arrow-up' },
  { id: 'Ruck_12Mile', label: '12-Mile Ruck', unit: 'minutes', icon: 'footsteps' },
] as const;

export function AssessmentView() {
  const [records, setRecords] = useState<AssessmentRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('forge:assessments').then((data) => {
      if (data) setRecords(JSON.parse(data));
    });
  }, []);

  function saveRecord(typeId: string, unit: string) {
    const score = parseFloat(inputValue);
    if (isNaN(score)) {
      Alert.alert('Invalid score', 'Please enter a valid number.');
      return;
    }

    const newRecord: AssessmentRecord = {
      id: `assess-${Date.now()}`,
      date: new Date().toISOString(),
      type: typeId as AssessmentRecord['type'],
      score,
      unit: unit as AssessmentRecord['unit'],
    };

    const updated = [newRecord, ...records];
    setRecords(updated);
    AsyncStorage.setItem('forge:assessments', JSON.stringify(updated));
    setActiveId(null);
    setInputValue('');
    Alert.alert('Assessment logged', 'Your benchmark has been updated.');
  }

  function getLatest(typeId: string) {
    // Since we prepend new records, the first one found is the latest.
    return records.find(r => r.type === typeId);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.muted}>Operator readiness</Text>
      <Text style={styles.title}>Benchmarks</Text>

      <Card>
        <Text style={styles.cardTitle}>Standard Assessments</Text>
        {assessmentTypes.map((type) => {
          const latest = getLatest(type.id);
          const isActive = activeId === type.id;

          return (
            <View key={type.id} style={styles.assessCard}>
              <View style={styles.assessHeader}>
                <View style={styles.assessLeft}>
                  <Ionicons name={type.icon as any} size={20} color={colours.cyan} />
                  <Text style={styles.assessName}>{type.label}</Text>
                </View>
                <View style={styles.assessRight}>
                  {latest ? (
                    <Text style={styles.latestScore}>{latest.score} <Text style={styles.latestUnit}>{latest.unit}</Text></Text>
                  ) : (
                    <Text style={styles.untested}>Untested</Text>
                  )}
                </View>
              </View>

              {isActive ? (
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder={`Score in ${type.unit}`}
                    placeholderTextColor={colours.soft}
                    value={inputValue}
                    onChangeText={setInputValue}
                    autoFocus
                  />
                  <Pressable style={styles.saveBtn} onPress={() => saveRecord(type.id, type.unit)}>
                    <Text style={styles.saveBtnText}>Save</Text>
                  </Pressable>
                  <Pressable style={styles.cancelBtn} onPress={() => { setActiveId(null); setInputValue(''); }}>
                    <Ionicons name="close" size={20} color={colours.text} />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.logBtn} onPress={() => { setActiveId(type.id); setInputValue(''); }}>
                  <Text style={styles.logBtnText}>LOG NEW SCORE</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  muted: { color: colours.muted, fontSize: 13 },
  title: { color: colours.text, fontSize: 30, fontWeight: '900', marginBottom: 14 },
  cardTitle: { color: colours.text, fontSize: 18, fontWeight: '900', marginBottom: 16 },
  assessCard: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.16)',
    marginBottom: 10,
  },
  assessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  assessLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assessName: { color: colours.text, fontSize: 15, fontWeight: '800' },
  assessRight: { alignItems: 'flex-end' },
  latestScore: { color: colours.cyan, fontSize: 18, fontWeight: '900' },
  latestUnit: { color: colours.muted, fontSize: 12, fontWeight: '700' },
  untested: { color: colours.amber, fontSize: 12, fontWeight: '800' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 8, color: colours.text, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontWeight: '700' },
  saveBtn: { backgroundColor: colours.cyan, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: colours.background, fontSize: 13, fontWeight: '900' },
  cancelBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
  logBtn: { backgroundColor: 'rgba(0,229,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,255,0.2)', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  logBtnText: { color: colours.cyan, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});