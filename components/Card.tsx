import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colours, shadow } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: string;
  hot?: boolean;
};

export function Card({ children, style, accent, hot }: Props) {
  return (
    <View style={[styles.card, hot && styles.cardHot, style, shadow.card]}>
      {/* Top glass highlight stripe */}
      <View style={styles.highlight} />
      {/* Left accent bar when accent colour provided */}
      {accent && <View style={[styles.accentBar, { backgroundColor: accent }]} />}
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(10, 20, 35, 0.80)',
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  cardHot: {
    borderColor: colours.border,
    borderLeftWidth: 2,
    borderLeftColor: colours.cyan,
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colours.borderGlass,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    opacity: 0.85,
  },
  inner: {
    padding: 16,
  },
});
