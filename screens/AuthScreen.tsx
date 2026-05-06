import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, shadow } from '../theme';

type Props = {
  loading: boolean;
  error: string;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
};

export function AuthScreen({ loading, error, onSignIn, onSignUp }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View style={styles.screen}>
      <View style={[styles.panel, shadow.card]}>
        <Text style={styles.kicker}>CLOUD ACCESS</Text>
        <Text style={styles.title}>Sign in to FORGE</Text>
        <Text style={styles.copy}>
          Email login unlocks cloud backup, shared members, and remote session sync through the backend.
        </Text>

        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={18} color={colours.muted} />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="email@unit.com"
            placeholderTextColor={colours.soft}
          />
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color={colours.muted} />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Password"
            placeholderTextColor={colours.soft}
          />
        </View>

        <Pressable style={[styles.primaryButton, loading && styles.buttonDisabled]} disabled={loading} onPress={() => onSignIn(email.trim(), password)}>
          {loading ? <ActivityIndicator color={colours.background} /> : <Text style={styles.primaryText}>Sign In</Text>}
        </Pressable>
        <Pressable style={[styles.secondaryButton, loading && styles.buttonDisabled]} disabled={loading} onPress={() => onSignUp(email.trim(), password)}>
          <Text style={styles.secondaryText}>Create Account</Text>
        </Pressable>

        <Text style={styles.errorText}>{error || ' '}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colours.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: 24,
    padding: 20,
    backgroundColor: colours.surface,
  },
  kicker: {
    color: colours.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  title: {
    color: colours.text,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 6,
  },
  copy: {
    color: colours.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    color: colours.text,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: colours.cyan,
    paddingVertical: 13,
    marginTop: 4,
  },
  primaryText: {
    color: colours.background,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${colours.cyan}40`,
    backgroundColor: colours.cyanDim,
    paddingVertical: 13,
    marginTop: 10,
  },
  secondaryText: {
    color: colours.cyan,
    fontSize: 15,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: colours.red,
    fontSize: 12,
    minHeight: 18,
    marginTop: 12,
  },
});
