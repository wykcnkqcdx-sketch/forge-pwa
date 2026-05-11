import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colours } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type RuckRingProps = {
  score: number;      // 0–100, Ruck Score shown in centre
  distance: number;   // 0–100, performance vs target
  load: number;       // 0–100
  pace: number;       // 0–100
  elevation: number;  // 0–100
  size?: number;
  showLabels?: boolean;
  animate?: boolean;
};

const RINGS = [
  { key: 'distance' as const, label: 'DIST', colour: colours.cyan   },  // sand/gold — outermost
  { key: 'load'     as const, label: 'LOAD', colour: colours.violet },  // olive
  { key: 'pace'     as const, label: 'PACE', colour: colours.green  },  // readiness green
  { key: 'elevation'as const, label: 'ELEV', colour: colours.amber  },  // amber — innermost
];

export function RuckRing({
  score, distance, load, pace, elevation,
  size = 220, showLabels = false, animate = true,
}: RuckRingProps) {
  const cx = size / 2;
  const cy = size / 2;

  const strokeW = size * 0.047;
  const ringGap = size * 0.018;

  const progressValues: Record<typeof RINGS[number]['key'], number> = {
    distance, load, pace, elevation,
  };

  const anims = useRef(RINGS.map(() => new Animated.Value(animate ? 0 : 1))).current;

  useEffect(() => {
    if (!animate) return;
    const timings = anims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 900 + i * 80,
        delay: 200 + i * 120,
        useNativeDriver: false,
      })
    );
    Animated.parallel(timings).start();
  }, []);

  // Inner clear diameter — score font scales with available space
  const innermostR = cx - strokeW / 2 - 3 * (strokeW + ringGap);
  const innerClear  = (innermostR - strokeW / 2 - ringGap) * 2;
  const scoreFontSz = Math.round(innerClear * 0.40);
  const labelFontSz = Math.max(7, Math.round(innerClear * 0.10));

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[styles.wrapper, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          {RINGS.map((ring, i) => {
            const r = cx - strokeW / 2 - i * (strokeW + ringGap);
            const circumference = 2 * Math.PI * r;
            const progress = Math.max(0, Math.min(100, progressValues[ring.key]));

            const dashOffset = anims[i].interpolate({
              inputRange: [0, 1],
              outputRange: [circumference, circumference * (1 - progress / 100)],
            });

            return (
              <G key={ring.key}>
                {/* Track */}
                <Circle
                  cx={cx} cy={cy} r={r}
                  stroke={colours.border}
                  strokeWidth={strokeW}
                  fill="none"
                />
                {/* Filled arc */}
                {progress > 0 && (
                  <AnimatedCircle
                    cx={cx} cy={cy} r={r}
                    stroke={ring.colour}
                    strokeWidth={strokeW}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={dashOffset as unknown as number}
                    transform={`rotate(-90 ${cx} ${cy})`}
                    opacity={0.92}
                  />
                )}
              </G>
            );
          })}
        </Svg>

        {/* Centre */}
        <View style={[styles.centre, { width: size, height: size }]} pointerEvents="none">
          <Text style={[styles.centreLabel, { fontSize: labelFontSz }]}>RUCK SCORE</Text>
          <Text style={[styles.centreScore, { fontSize: scoreFontSz, color: colours.cyan }]}>
            {Math.round(score)}
          </Text>
        </View>
      </View>

      {showLabels && (
        <View style={styles.legend}>
          {RINGS.map((ring, i) => (
            <View key={ring.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: ring.colour }]} />
              <Text style={styles.legendKey}>{ring.label}</Text>
              <Text style={[styles.legendVal, { color: ring.colour }]}>
                {Math.round(progressValues[ring.key])}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreLabel: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  centreScore: {
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: undefined,
    fontVariant: ['tabular-nums'],
  },
  legend: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 14,
  },
  legendItem: {
    alignItems: 'center',
    gap: 3,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendKey: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  legendVal: {
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
