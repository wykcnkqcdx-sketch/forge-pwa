import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colours, radius } from '../theme';

const GOLD = colours.cyan;

function stampLabel(score: number) {
  if (score >= 80) return 'FIELD\nREADY';
  if (score >= 60) return 'COMPLETE';
  return 'MISSION\nLOGGED';
}

type Props = { score: number; onDone: () => void };

export function ForgeStamp({ score, onDone }: Props) {
  const scale      = useRef(new Animated.Value(1.55)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const bgOpacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();

    // Haptic fires when stamp visually "hits" (~150ms into the spring)
    const hapticTimer = setTimeout(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
      150,
    );

    const fadeTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,   { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) onDone(); });
    }, 1600);

    return () => {
      clearTimeout(hapticTimer);
      clearTimeout(fadeTimer);
    };
  }, []);

  const label = stampLabel(score);

  return (
    <Animated.View style={[st.overlay, { opacity: bgOpacity }]} pointerEvents="none">
      <Animated.View
        style={[
          st.stamp,
          { opacity, transform: [{ scale }, { rotate: '-8deg' }] },
        ]}
      >
        <View style={st.outer}>
          <View style={st.inner}>
            <Text style={st.label}>{label}</Text>
            <View style={st.rule} />
            <Text style={st.sub}>FORGE · RUCK READINESS</Text>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 15, 14, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  stamp: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outer: {
    borderWidth: 5,
    borderColor: GOLD,
    borderRadius: radius.sm,
    padding: 8,
  },
  inner: {
    borderWidth: 1.5,
    borderColor: `${GOLD}55`,
    borderRadius: 2,
    paddingHorizontal: 32,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: GOLD,
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 5,
    textAlign: 'center',
    lineHeight: 56,
    textTransform: 'uppercase',
  },
  rule: {
    width: '100%',
    height: 1.5,
    backgroundColor: `${GOLD}40`,
  },
  sub: {
    color: `${GOLD}70`,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 3.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
