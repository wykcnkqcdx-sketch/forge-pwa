import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colours } from '../theme';

interface SplashScreenProps {
  pulseAnim: Animated.Value;
  typedText: string;
}

export function SplashScreen({ pulseAnim, typedText }: SplashScreenProps) {
  return (
    <View style={styles.lockScreen}>
      <View style={styles.lockContent}>
        <Animated.Text style={[styles.brand, { opacity: pulseAnim, transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.95, 1.05] }) }] }]}>
          // FORGE
        </Animated.Text>
        <Text style={[styles.lockSub, { marginTop: 12 }]}>{typedText || '_'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lockScreen: {
    flex: 1,
    backgroundColor: colours.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockContent: {
    alignItems: 'center',
  },
  brand: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colours.cyan,
    textAlign: 'center',
  },
  lockSub: {
    fontSize: 16,
    color: colours.muted,
    textAlign: 'center',
  },
});