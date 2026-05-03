import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colours } from '../theme';

interface PinScreenProps {
  pinLength: number;
  pinInput: string;
  pinError: string;
  onPinInput: (input: string) => void;
}

export function PinScreen({ pinLength, pinInput, pinError, onPinInput }: PinScreenProps) {
  return (
    <View style={styles.lockScreen}>
      <View style={styles.lockContent}>
        <Text style={styles.brand}>// FORGE</Text>
        <Text style={styles.lockSub}>Enter PIN to access tactical dashboard.</Text>
        <View style={styles.pinWrapper}>
          <View style={styles.pinDisplay}>
            {Array.from({ length: pinLength }, (_, i) => (
              <View key={i} style={[styles.pinBox, pinInput.length > i && styles.pinBoxFilled]}>
                <Text style={styles.pinDot}>{pinInput.length > i ? '•' : ''}</Text>
              </View>
            ))}
          </View>
          <TextInput
            style={styles.hiddenInput}
            keyboardType="number-pad"
            maxLength={pinLength}
            value={pinInput}
            onChangeText={onPinInput}
            autoFocus
          />
        </View>
        <Text style={styles.pinErrorText}>{pinError ? 'Incorrect PIN' : ' '}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lockScreen: {
    flex: 1,
    backgroundColor: colours.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockContent: {
    alignItems: 'center',
  },
  brand: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colours.cyan,
    textAlign: 'center',
  },
  lockSub: {
    fontSize: 16,
    color: colours.muted,
    textAlign: 'center',
    marginBottom: 32,
  },
  pinWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  pinDisplay: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  pinBox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colours.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxFilled: {
    backgroundColor: colours.cyan,
    borderColor: colours.cyan,
  },
  pinDot: {
    fontSize: 12,
    color: colours.background,
    fontWeight: 'bold',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  pinErrorText: {
    fontSize: 14,
    color: colours.red,
    textAlign: 'center',
    height: 20,
  },
});