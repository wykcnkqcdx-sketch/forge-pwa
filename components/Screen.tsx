import React from 'react';
import { SafeAreaView, ScrollView, View, StyleSheet } from 'react-native';
import { colours } from '../theme';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.gridOverlay} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ right: 1 }}
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
    opacity: 0.022,
    backgroundColor: colours.cyan,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 156,
    gap: 14,
  },
});
