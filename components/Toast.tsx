import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, shadow } from '../theme';

interface ToastProps {
  message: string;
  animation: Animated.Value;
}

export function Toast({ message, animation }: ToastProps) {
  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, shadow.card, {
        opacity: animation,
        transform: [{ translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }]
      }]}
    >
      <View style={styles.toastIcon}>
        <Ionicons name="cloud-done" size={18} color={colours.background} />
      </View>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 96,
    zIndex: 30,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  toastIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colours.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    color: colours.text,
    lineHeight: 20,
  },
});