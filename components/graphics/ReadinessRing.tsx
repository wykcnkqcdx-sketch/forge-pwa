import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colours } from '../../theme';

type Props = {
  score: number;           // 0–100
  tone: string;            // colour for the fill arc
  size?: number;
  strokeWidth?: number;
  label?: string;
  band?: string;
};

export function ReadinessRing({ score, tone, size = 96, strokeWidth = 8, label = 'READY', band }: Props) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (clampedScore / 100) * circumference;
  const gap = circumference - filled;

  // Rotate so arc starts at top (-90°)
  const rotation = -90;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={tone} stopOpacity="0.15" />
            <Stop offset="100%" stopColor={tone} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Glow background */}
        <Circle
          cx={cx} cy={cy} r={r + strokeWidth * 0.8}
          fill="url(#ringGlow)"
        />

        {/* Track */}
        <Circle
          cx={cx} cy={cy} r={r}
          strokeWidth={strokeWidth}
          stroke={colours.borderSoft}
          fill="none"
          strokeLinecap="round"
        />

        {/* Filled arc */}
        {clampedScore > 0 && (
          <Circle
            cx={cx} cy={cy} r={r}
            strokeWidth={strokeWidth}
            stroke={tone}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${gap}`}
            transform={`rotate(${rotation} ${cx} ${cy})`}
            opacity={0.92}
          />
        )}
      </Svg>

      {/* Centre text */}
      <View style={[styles.centre, { width: size, height: size }]} pointerEvents="none">
        <Text style={[styles.labelText, { fontSize: size * 0.09 }]}>{label}</Text>
        <Text style={[styles.scoreText, { color: tone, fontSize: size * 0.30 }]}>{clampedScore}</Text>
        {band ? <Text style={[styles.bandText, { color: tone, fontSize: size * 0.10 }]}>{band}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  scoreText: {
    fontWeight: '900',
    lineHeight: undefined,
  },
  bandText: {
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 2,
  },
});
