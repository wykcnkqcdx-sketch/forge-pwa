import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colours } from '../../theme';

type Props = {
  label?: string;
  tone?: string;
  accentWidth?: number;
};

export function TacticalDivider({ label, tone = colours.cyan, accentWidth = 24 }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.accentBar, { backgroundColor: tone, width: accentWidth }]} />
      <View style={styles.line} />
      {label ? <Text style={[styles.label, { color: tone }]}>{label.toUpperCase()}</Text> : null}
      {label ? <View style={styles.lineFull} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.7,
  },
  accentBar: {
    height: 2,
    borderRadius: 1,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colours.borderSoft,
  },
  lineFull: {
    flex: 2,
    height: 1,
    backgroundColor: colours.borderSoft,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
