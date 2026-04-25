import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colours } from '../theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    marginBottom: 14,
  },
});
