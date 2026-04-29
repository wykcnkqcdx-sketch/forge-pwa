import React from 'react';
import { SafeAreaView, ScrollView, View, StyleSheet } from 'react-native';
import { colours } from '../theme';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      {/* Tactical grid overlay — simulated with nested views */}
      <View style={styles.gridOverlay} pointerEvents="none" />
      {/* Ambient glow top-left */}
      <View style={styles.glowTL} pointerEvents="none" />
      {/* Ambient glow bottom-right */}
      <View style={styles.glowBR} pointerEvents="none" />

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
    // Subtle scanline texture via repeated border pattern — RN doesn't support
    // repeating gradients, so we rely on background colour + opacity alone
    backgroundColor: colours.cyan,
  },
  glowTL: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(0, 229, 255, 0.055)',
  },
  glowBR: {
    position: 'absolute',
    bottom: -100,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 176, 32, 0.04)',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 14,
  },
});
