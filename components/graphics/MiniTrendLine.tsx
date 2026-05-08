import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { colours } from '../../theme';

type Props = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
};

export function MiniTrendLine({ data, width = 80, height = 28, color = colours.cyan, strokeWidth = 1.5 }: Props) {
  if (data.length < 2) return <View style={{ width, height }} />;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padX = 2;
  const padY = 3;

  const points = data.map((v, i) => {
    const x = padX + (i / (data.length - 1)) * (width - 2 * padX);
    const y = padY + (1 - (v - min) / range) * (height - 2 * padY);
    return `${x},${y}`;
  }).join(' ');

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
