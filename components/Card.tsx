import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colours, shadows } from '../theme';
import { useResponsive } from '../utils/responsive';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: string;
  hot?: boolean;
};

export function Card({ children, style, accent, hot }: Props) {
  const { cardPad, isTablet } = useResponsive();

  return (
    <View style={[
      styles.card,
      hot && styles.cardHot,
      shadows.subtle,
      style,
    ]}>
      {/* Top glass highlight */}
      <View style={styles.highlight} />
      {/* Left accent bar */}
      {accent && <View style={[styles.accentBar, { backgroundColor: accent }]} />}
      <View style={[styles.inner, { padding: cardPad, borderRadius: isTablet ? 22 : 18 }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(10, 20, 35, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardHot: {
    borderColor: colours.borderHot,
    backgroundColor: colours.panelHot,
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
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    opacity: 0.85,
  },
  inner: {
    padding: 16,
  },
});
