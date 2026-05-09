import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography } from '../theme';
import type { RuckMissionMode } from '../utils/ruck';

export function RuckMissionModeSelector({
  missionMode,
  onChange,
}: {
  missionMode: RuckMissionMode;
  onChange: (mode: RuckMissionMode) => void;
}) {
  return (
    <View style={styles.modeSelector}>
      {([
        ['simple', 'Simple', 'footsteps-outline'],
        ['tactical', 'Tactical', 'radio-outline'],
        ['navigation', 'Nav', 'navigate-outline'],
      ] as const).map(([mode, label, icon]) => {
        const selected = missionMode === mode;
        return (
          <Pressable
            key={mode}
            style={[styles.modeOption, selected && styles.modeOptionActive]}
            onPress={() => onChange(mode)}
          >
            <Ionicons name={icon} size={14} color={selected ? colours.background : colours.muted} />
            <Text style={[styles.modeOptionText, selected && styles.modeOptionTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  modeSelector: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    padding: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(4,8,15,0.38)',
  },
  modeOption: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 6,
  },
  modeOptionActive: { backgroundColor: colours.cyan },
  modeOptionText: { ...typography.caption, color: colours.muted, fontWeight: '900' },
  modeOptionTextActive: { color: colours.background },
});
