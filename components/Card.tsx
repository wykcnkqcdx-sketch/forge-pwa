import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colours, shadows, typography } from '../theme';
import { makeCardStyle, responsiveSpacing } from '../utils/styling';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: string;
  hot?: boolean;
};

export function Card({ children, style, accent, hot }: Props) {
  return (
    <View style={[makeCardStyle(accent, hot), style, shadows.card]}>
      {/* Top glass highlight stripe */}
      <View style={styles.highlight} />
      {/* Left accent bar when accent colour provided */}
      {accent && <View style={[styles.accentBar, { backgroundColor: accent }]} />}
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    opacity: 0.85,
  },
  inner: {
    padding: responsiveSpacing('lg'),
  },
});

