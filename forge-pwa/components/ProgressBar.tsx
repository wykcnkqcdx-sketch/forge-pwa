import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colours } from '../theme';

type Props = {
  value: number;
  colour?: string;
  height?: number;
};

export function ProgressBar({ value, colour = colours.cyan, height = 8 }: Props) {
  const pct = Math.min(100, Math.max(0, value));
  const glowColour = `${colour}55`;

  return (
    <View style={[styles.track, { height }]}>
      {/* Fill */}
      <View
        style={[
          styles.fill,
          {
            width: `${pct}%`,
            backgroundColor: colour,
            shadowColor: colour,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.70,
            shadowRadius: 6,
          },
        ]}
      />
      {/* Glow cap at the leading edge */}
      {pct > 4 && (
        <View
          style={[
            styles.glowCap,
            {
              left: `${pct}%` as unknown as number,
              backgroundColor: glowColour,
              width: 12,
              height: height + 4,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 12,
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  glowCap: {
    position: 'absolute',
    top: -2,
    marginLeft: -10,
    borderRadius: 6,
  },
});
