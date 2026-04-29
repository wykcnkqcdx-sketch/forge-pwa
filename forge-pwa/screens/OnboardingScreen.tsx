import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colours } from '../theme';

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  
  // Demographics
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState('');
  
  // Benchmarks
  const [pushups, setPushups] = useState('');
  const [runTime, setRunTime] = useState('');
  const [deadlift, setDeadlift] = useState('');

  async function handleSave() {
    const profile = { age, weight, goal, pushups, runTime, deadlift };
    await AsyncStorage.setItem('forge:profile', JSON.stringify(profile));
    onComplete();
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.brand}>// FORGE</Text>
          <Text style={styles.title}>INITIALISE OPERATOR</Text>
          <Text style={styles.subtitle}>Enter baseline metrics to calibrate tactical programming.</Text>
        </View>

        {step === 1 && (
          <View style={styles.form}>
            <Text style={styles.label}>AGE</Text>
            <TextInput style={styles.input} keyboardType="number-pad" placeholder="e.g. 28" placeholderTextColor={colours.muted} value={age} onChangeText={setAge} />
            
            <Text style={styles.label}>BODY WEIGHT (KG)</Text>
            <TextInput style={styles.input} keyboardType="number-pad" placeholder="e.g. 82" placeholderTextColor={colours.muted} value={weight} onChangeText={setWeight} />
            
            <Text style={styles.label}>PRIMARY GOAL</Text>
            <TextInput style={styles.input} placeholder="e.g. Selection Prep, Ruck Base" placeholderTextColor={colours.muted} value={goal} onChangeText={setGoal} />

            <Pressable style={styles.button} onPress={() => setStep(2)}>
              <Text style={styles.buttonText}>NEXT STAGE</Text>
            </Pressable>
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
            <Text style={styles.label}>MAX PUSH-UPS (2 MINS)</Text>
            <TextInput style={styles.input} keyboardType="number-pad" placeholder="e.g. 65" placeholderTextColor={colours.muted} value={pushups} onChangeText={setPushups} />
            
            <Text style={styles.label}>2-MILE RUN TIME (MM:SS)</Text>
            <TextInput style={styles.input} placeholder="e.g. 14:30" placeholderTextColor={colours.muted} value={runTime} onChangeText={setRunTime} />
            
            <Text style={styles.label}>DEADLIFT 3RM EST. (KG)</Text>
            <TextInput style={styles.input} keyboardType="number-pad" placeholder="e.g. 140" placeholderTextColor={colours.muted} value={deadlift} onChangeText={setDeadlift} />

            <View style={styles.buttonRow}>
              <Pressable style={[styles.button, styles.buttonOutline]} onPress={() => setStep(1)}>
                <Text style={styles.buttonOutlineText}>BACK</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.buttonPrimary]} onPress={handleSave}>
                <Text style={styles.buttonText}>CONFIRM & BOOT</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { marginBottom: 32, alignItems: 'center' },
  brand: { color: colours.cyan, fontSize: 16, fontWeight: '900', letterSpacing: 3, marginBottom: 8 },
  title: { color: colours.text, fontSize: 24, fontWeight: '900', letterSpacing: 1, marginBottom: 8, textAlign: 'center' },
  subtitle: { color: colours.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  form: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colours.border },
  label: { color: colours.cyan, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: colours.border, borderRadius: 8, color: colours.text, padding: 12, fontSize: 16, marginBottom: 20, fontWeight: '700' },
  button: { backgroundColor: colours.cyan, paddingVertical: 16, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: colours.background, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  buttonOutline: { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: colours.cyan },
  buttonOutlineText: { color: colours.cyan, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  buttonPrimary: { flex: 2 },
});