import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colours, radius } from '../theme';

type Props = {
  value: number;     // 0–100
  colour?: string;
  height?: number;
  showGlow?: boolean;
  rounded?: boolean;
};

export function ProgressBar({ value, colour = colours.cyan, height = 6, showGlow = true, rounded = true }: Props) {
  const pct = Math.min(100, Math.max(0, value));

  return (
    <View style={[
      styles.track,
      {
        height,
        borderRadius: rounded ? radius.pill : 2,
        marginTop: 10,
      },
    ]}>
      {pct > 0 && (
        <View
          style={[
            styles.fill,
            {
              width: `${pct}%`,
              backgroundColor: colour,
              borderRadius: rounded ? radius.pill : 2,
              shadowColor: colour,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.65,
              shadowRadius: 5,
            },
          ]}
        />
      )}
      {/* Leading-edge glow cap */}
      {showGlow && pct > 4 && pct < 99 && (
        <View
          style={[
            styles.glowCap,
            {
              left: `${pct}%` as unknown as number,
              backgroundColor: `${colour}55`,
              width: height * 2.5,
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
    width: '100%',
    backgroundColor: colours.borderSoft,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  fill: {
    height: '100%',
  },
  glowCap: {
    position: 'absolute',
    top: -2,
    marginLeft: -8,
    borderRadius: 6,
  },
});
