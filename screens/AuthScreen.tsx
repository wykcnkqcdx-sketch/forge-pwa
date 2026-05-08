import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, radius, shadows, touchTarget } from '../theme';
import { useResponsive } from '../utils/responsive';

type Props = {
  loading: boolean;
  error: string;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
};

export function AuthScreen({ loading, error, onSignIn, onSignUp }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const { fs, isTablet } = useResponsive();

  return (
    <View style={styles.screen}>
      {/* Subtle grid overlay */}
      <View style={styles.gridOverlay} pointerEvents="none" />

      <View style={[styles.panel, shadows.elevated]}>
        {/* Brand mark */}
        <View style={styles.brandRow}>
          <View style={styles.shieldWrap}>
            <Ionicons name="shield-checkmark" size={isTablet ? 28 : 24} color={colours.cyan} />
          </View>
          <View>
            <Text style={[styles.brand, { fontSize: fs(22, { min: 18, max: 28 }) }]}>// FORGE</Text>
            <Text style={[styles.kicker, { fontSize: fs(9, { min: 8, max: 11 }) }]}>TACTICAL FITNESS PLATFORM</Text>
          </View>
        </View>

        {/* Top accent bar */}
        <View style={styles.accentBar} />

        <Text style={[styles.title, { fontSize: fs(22, { min: 18, max: 28 }) }]}>Cloud Access</Text>
        <Text style={[styles.copy, { fontSize: fs(13, { min: 12, max: 15 }) }]}>
          Sign in to unlock cloud backup, shared members and remote session sync.
        </Text>

        {/* Email input */}
        <View style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>EMAIL ADDRESS</Text>
          <View style={[
            styles.inputWrap,
            focusedField === 'email' && styles.inputWrapFocused,
            error ? styles.inputWrapError : null,
          ]}>
            <Ionicons name="mail-outline" size={isTablet ? 18 : 16} color={focusedField === 'email' ? colours.cyan : colours.muted} />
            <TextInput
              style={[styles.input, { fontSize: fs(14, { min: 13, max: 16 }) }]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="operator@unit.mil"
              placeholderTextColor={colours.soft}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </View>

        {/* Password input */}
        <View style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { fontSize: fs(9, { min: 8, max: 10 }) }]}>PASSWORD</Text>
          <View style={[
            styles.inputWrap,
            focusedField === 'password' && styles.inputWrapFocused,
            error ? styles.inputWrapError : null,
          ]}>
            <Ionicons name="lock-closed-outline" size={isTablet ? 18 : 16} color={focusedField === 'password' ? colours.cyan : colours.muted} />
            <TextInput
              style={[styles.input, { fontSize: fs(14, { min: 13, max: 16 }) }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              placeholder="••••••••"
              placeholderTextColor={colours.soft}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="warning-outline" size={13} color={colours.red} />
            <Text style={[styles.errorText, { fontSize: fs(12, { min: 11, max: 13 }) }]}>{error}</Text>
          </View>
        ) : null}

        {/* Sign In */}
        <Pressable
          style={({ pressed }) => [styles.primaryButton, loading && styles.buttonDisabled, pressed && { opacity: 0.85 }]}
          disabled={loading}
          onPress={() => onSignIn(email.trim(), password)}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          {loading
            ? <ActivityIndicator color={colours.background} size="small" />
            : <>
                <Ionicons name="log-in-outline" size={isTablet ? 20 : 17} color={colours.background} />
                <Text style={[styles.primaryText, { fontSize: fs(14, { min: 13, max: 16 }) }]}>Sign In</Text>
              </>
          }
        </Pressable>

        {/* Create account */}
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, loading && styles.buttonDisabled, pressed && { opacity: 0.75 }]}
          disabled={loading}
          onPress={() => onSignUp(email.trim(), password)}
          accessibilityRole="button"
          accessibilityLabel="Create account"
        >
          <Ionicons name="person-add-outline" size={isTablet ? 18 : 15} color={colours.cyan} />
          <Text style={[styles.secondaryText, { fontSize: fs(14, { min: 13, max: 16 }) }]}>Create Account</Text>
        </Pressable>

        {/* Footer note */}
        <Text style={[styles.footerNote, { fontSize: fs(11, { min: 10, max: 12 }) }]}>
          All data is encrypted and stored privately. Offline use requires no account.
        </Text>
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
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.015,
    backgroundColor: colours.cyan,
  },
  panel: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: radius.lg,
    padding: 24,
    backgroundColor: colours.surface,
    overflow: 'hidden',
    gap: 0,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colours.cyan,
    opacity: 0.65,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  shieldWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colours.cyanDim,
    borderWidth: 1,
    borderColor: colours.borderHot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: colours.cyan,
    fontWeight: '900',
    letterSpacing: 2,
  },
  kicker: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 2,
  },
  title: {
    color: colours.text,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  copy: {
    color: colours.textSoft,
    lineHeight: 19,
    fontWeight: '700',
    marginBottom: 20,
  },
  fieldWrap: {
    marginBottom: 12,
    gap: 6,
  },
  fieldLabel: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colours.inputBorder,
    borderRadius: radius.sm,
    backgroundColor: colours.inputBg,
    paddingHorizontal: 12,
    minHeight: touchTarget,
  },
  inputWrapFocused: {
    borderColor: colours.inputFocus,
    backgroundColor: 'rgba(143,166,59,0.06)',
  },
  inputWrapError: {
    borderColor: colours.inputError,
  },
  input: {
    flex: 1,
    color: colours.text,
    fontWeight: '700',
    paddingVertical: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colours.redDim,
    borderWidth: 1,
    borderColor: `${colours.red}40`,
    borderRadius: radius.xs,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: colours.red,
    fontWeight: '700',
    flex: 1,
  },
  primaryButton: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.sm,
    backgroundColor: colours.cyan,
    marginTop: 4,
    ...shadows.cyan,
  },
  primaryText: {
    color: colours.background,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colours.borderHot,
    backgroundColor: colours.cyanDim,
    marginTop: 10,
  },
  secondaryText: {
    color: colours.cyan,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  footerNote: {
    color: colours.soft,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
});
