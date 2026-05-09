import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colours, typography } from '../theme';
import type { RuckEstimate } from '../lib/h2f';
import { cardinalDirection, formatHeading } from '../utils/ruck';

export function RuckMetricSummary({
  weightKg,
  distanceKm,
  pace,
  pandolf,
  activeHeading,
}: {
  weightKg: number;
  distanceKm: number;
  pace: string;
  pandolf: RuckEstimate;
  activeHeading: number | null;
}) {
  return (
    <Card>
      <View style={styles.strip}>
        <View style={styles.col}>
          <View style={styles.labelRow}>
            <Ionicons name="barbell" size={10} color={colours.muted} />
            <Text style={styles.label}>PACK</Text>
          </View>
          <Text style={styles.value}>{weightKg}kg</Text>
          <Text style={styles.sub}>ruck load</Text>
        </View>

        <View style={[styles.col, styles.colDivider]}>
          <View style={styles.labelRow}>
            <Ionicons name="footsteps" size={10} color={colours.amber} />
            <Text style={styles.label}>LOADED</Text>
          </View>
          <Text style={[styles.value, { color: colours.amber }]}>
            {Math.round(distanceKm * weightKg)}
          </Text>
          <Text style={styles.sub}>kg·km · {pace}/km</Text>
        </View>

        <View style={[styles.col, styles.colDivider]}>
          <View style={styles.labelRow}>
            <Ionicons name="trail-sign" size={10} color={colours.green} />
            <Text style={styles.label}>PANDOLF</Text>
          </View>
          <Text style={[styles.value, { color: colours.green }]}>
            {pandolf.wattsCorrected}W
          </Text>
          <Text style={styles.sub}>{pandolf.metabolicCostKcalHour} kcal/hr</Text>
        </View>

        <View style={[styles.col, styles.colDivider]}>
          <View style={styles.labelRow}>
            <Ionicons name="compass" size={10} color={colours.cyan} />
            <Text style={styles.label}>HDG</Text>
          </View>
          <Text style={[styles.value, { color: colours.cyan }]}>
            {activeHeading == null ? '--' : formatHeading(activeHeading)}
          </Text>
          <Text style={styles.sub}>
            {activeHeading == null ? 'standby' : cardinalDirection(activeHeading)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: -16,
    marginVertical: -16,
  },
  col: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 2,
  },
  colDivider: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 5,
  },
  label: {
    fontSize: 8,
    fontWeight: '900' as const,
    color: colours.muted,
    letterSpacing: 1.2,
  },
  value: {
    fontSize: 18,
    fontWeight: '900' as const,
    color: colours.text,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  sub: {
    fontSize: 8,
    color: colours.muted,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
    marginTop: 1,
  },
});
