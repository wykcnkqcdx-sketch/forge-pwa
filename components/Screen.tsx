import React from 'react';
import { SafeAreaView, ScrollView, View, StyleSheet } from 'react-native';
import { colours } from '../theme';
import { useResponsive } from '../utils/responsive';

type Props = {
  children: React.ReactNode;
  noScroll?: boolean;
};

export function Screen({ children, noScroll }: Props) {
  const { hPad, gap, isTablet, maxWidth, width } = useResponsive();

  const contentStyle = {
    paddingHorizontal: hPad,
    paddingTop: isTablet ? 24 : 16,
    paddingBottom: 160,
    gap,
    // Centre content on tablet
    alignSelf: isTablet ? ('center' as const) : undefined,
    width: isTablet ? maxWidth : undefined,
    minWidth: isTablet ? undefined : '100%' as const,
  };

  if (noScroll) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.gridOverlay} pointerEvents="none" />
        <View style={[contentStyle, { flex: 1 }]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.gridOverlay} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ right: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colours.background,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.018,
    backgroundColor: colours.cyan,
  },
});
