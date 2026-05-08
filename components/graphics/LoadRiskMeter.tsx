import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colours, radius } from '../../theme';

type LoadRisk = 'Low' | 'Moderate' | 'High';

type Props = {
  risk: LoadRisk;
  acwr?: number;
};

const SEGMENTS: Array<{ key: LoadRisk; label: string; color: string }> = [
  { key: 'Low',      label: 'LOW',  color: colours.loadLow  },
  { key: 'Moderate', label: 'MOD',  color: colours.loadMod  },
  { key: 'High',     label: 'HIGH', color: colours.loadHigh },
];

export function LoadRiskMeter({ risk, acwr }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>LOAD RISK</Text>
      <View style={styles.track}>
        {SEGMENTS.map((seg) => {
          const active = seg.key === risk;
          return (
            <View
              key={seg.key}
              style={[
                styles.segment,
                { backgroundColor: active ? seg.color : `${seg.color}25` },
                active && styles.segmentActive,
              ]}
            >
              <Text style={[styles.segLabel, { color: active ? colours.background : `${seg.color}88` }]}>
                {seg.label}
              </Text>
            </View>
          );
        })}
      </View>
      {acwr !== undefined && (
        <Text style={styles.acwrText}>ACWR {acwr.toFixed(2)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  title: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  track: {
    flexDirection: 'row',
    gap: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    height: 28,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  segLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  acwrText: {
    color: colours.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
