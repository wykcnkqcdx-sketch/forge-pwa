import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MetricCard } from './MetricCard';
import { colours } from '../theme';
import type { RuckEstimate } from '../lib/h2f';
import { cardinalDirection, formatHeading } from '../utils/ruck';
import { responsiveSpacing } from '../utils/styling';

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
    <>
      <View style={styles.grid}>
        <MetricCard icon="barbell" label="Pack" value={`${weightKg}kg`} sub="ruck load" />
        <MetricCard icon="footsteps" label="Loaded" value={`${Math.round(distanceKm * weightKg)}`} sub={`kg-km | ${pace}/km`} tone={colours.amber} />
      </View>

      <View style={styles.grid}>
        <MetricCard icon="trail-sign" label="Pandolf" value={`${pandolf.wattsCorrected}W`} sub={`${pandolf.metabolicCostKcalHour} kcal/hr`} tone={colours.green} />
        <MetricCard
          icon="compass"
          label="Heading"
          value={activeHeading == null ? '--' : formatHeading(activeHeading)}
          sub={activeHeading == null ? 'compass standby' : cardinalDirection(activeHeading)}
          tone={colours.cyan}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing('md') },
});
