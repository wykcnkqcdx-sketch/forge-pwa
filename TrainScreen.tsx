import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colours } from '../theme';

export function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { width: `${safeValue}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  inner: {
    height: '100%',
    backgroundColor: colours.cyan,
    borderRadius: 999,
  },
});
