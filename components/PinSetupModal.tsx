import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, shadow, touchTarget } from '../theme';

interface PinSetupModalProps {
  mode: 'set' | 'change';
  newPinInput: string;
  confirmPinInput: string;
  error: string;
  onNewPinChange: (value: string) => void;
  onConfirmPinChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function PinSetupModal({
  mode,
  newPinInput,
  confirmPinInput,
  error,
  onNewPinChange,
  onConfirmPinChange,
  onSave,
  onClose,
}: PinSetupModalProps) {
  return (
    <View style={styles.pinSetupOverlay}>
      <View style={[styles.pinSetupPanel, shadow.card]}>
        <View style={styles.pinSetupHeader}>
          <View>
            <Text style={styles.pinSetupKicker}>APP LOCK</Text>
            <Text style={styles.pinSetupTitle}>{mode === 'set' ? 'Set PIN' : 'Change PIN'}</Text>
          </View>
          <Pressable style={styles.pinSetupClose} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close PIN setup">
            <Ionicons name="close" size={20} color={colours.text} />
          </Pressable>
        </View>
        <Text style={styles.pinSetupCopy}>Use 4 to 8 digits. Entering 0000 at lock screen still performs duress wipe.</Text>
        <TextInput
          style={styles.pinSetupInput}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          placeholder="New PIN"
          placeholderTextColor={colours.soft}
          value={newPinInput}
          onChangeText={onNewPinChange}
        />
        <TextInput
          style={styles.pinSetupInput}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          placeholder="Confirm PIN"
          placeholderTextColor={colours.soft}
          value={confirmPinInput}
          onChangeText={onConfirmPinChange}
        />
        <Text style={styles.pinSetupError}>{error || ' '}</Text>
        <Pressable style={styles.pinSetupButton} onPress={onSave}>
          <Text style={styles.pinSetupButtonText}>Save PIN</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pinSetupOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  pinSetupPanel: {
    backgroundColor: colours.surface,
    borderRadius: 22,
    padding: 24,
    margin: 20,
    minWidth: 320,
    maxWidth: 400,
  },
  pinSetupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  pinSetupKicker: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colours.cyan,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pinSetupTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colours.text,
    marginTop: 4,
  },
  pinSetupClose: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginRight: -4,
  },
  pinSetupCopy: {
    fontSize: 14,
    color: colours.textSoft,
    marginBottom: 20,
    lineHeight: 20,
  },
  pinSetupInput: {
    backgroundColor: colours.panel,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colours.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colours.border,
  },
  pinSetupError: {
    fontSize: 14,
    color: colours.red,
    marginBottom: 20,
    height: 20,
  },
  pinSetupButton: {
    backgroundColor: colours.cyan,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSetupButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colours.background,
  },
});
