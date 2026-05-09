import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography } from '../theme';
import {
  fieldMarkTypes,
  type FieldMarkType,
} from '../utils/ruckFieldMarks';

export function RuckFieldMarkTypePicker({
  activeMarkType,
  selectedMarkType,
  onSelect,
}: {
  activeMarkType: FieldMarkType;
  selectedMarkType?: FieldMarkType;
  onSelect: (markType: FieldMarkType) => void;
}) {
  return (
    <View style={styles.markTypeGrid}>
      {fieldMarkTypes.map((markType) => {
        const active = activeMarkType === markType.key;
        const selectedForMark = selectedMarkType === markType.key;
        const highlighted = active || selectedForMark;
        return (
          <Pressable
            key={markType.key}
            style={[styles.markTypeButton, active && { borderColor: markType.tone, backgroundColor: `${markType.tone}1f` }]}
            onPress={() => onSelect(markType.key)}
          >
            <Ionicons name={markType.icon} size={15} color={highlighted ? markType.tone : colours.muted} />
            <Text style={[styles.markTypeText, highlighted && { color: markType.tone }]}>{markType.shortLabel}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  markTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  markTypeButton: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  markTypeText: { ...typography.label, color: colours.muted, fontWeight: '900' },
});
